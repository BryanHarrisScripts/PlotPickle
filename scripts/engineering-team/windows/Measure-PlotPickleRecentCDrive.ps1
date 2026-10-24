#requires -Version 5.1
# PlotPickle #3241: OWNER-INITIATED read-only C: metadata/growth survey.
# Runs locally, not through the restricted MCP tunnel. Does not open file
# contents, hash files, follow reparse points, modify storage, or repair disks.
[CmdletBinding()]
param(
    [ValidateRange(1,30)][int]$Days = 5,
    [ValidateRange(30,900)][int]$MaxSeconds = 300,
    [ValidateRange(1000,3000000)][int]$MaxEntries = 1500000
)
$ErrorActionPreference = 'Stop'
$now = [DateTime]::UtcNow
$cutoff = $now.AddDays(-$Days)
$timer = [Diagnostics.Stopwatch]::StartNew()
$root = 'C:\'
$localApp = $env:LOCALAPPDATA
$userRoot = $env:USERPROFILE
$repo = if ($userRoot) { Join-Path $userRoot 'PlotPickle' } else { '' }
$plotLocal = if ($localApp) { Join-Path $localApp 'PlotPickle' } else { '' }
$global:ppVisited = 0
$global:ppErrors = 0
$global:ppSkippedLinks = 0
$global:ppDirectories = 0
$global:ppFutureTimes = 0
$global:ppIncomplete = $false
$grouped = @{}
$topCreated = New-Object 'System.Collections.Generic.List[object]'
$topModified = New-Object 'System.Collections.Generic.List[object]'
$topLimit = 25

function Test-Under([string]$candidate, [string]$prefix) {
    if ([string]::IsNullOrWhiteSpace($prefix)) { return $false }
    return $candidate.StartsWith($prefix.TrimEnd('\') + '\',
        [StringComparison]::OrdinalIgnoreCase)
}
function Get-FirstPart([string]$remainder) {
    if (-not $remainder) { return 'root' }
    $parts = $remainder.TrimStart('\').Split('\')
    if ($parts.Length -eq 0 -or -not $parts[0]) { return 'root' }
    $name = $parts[0]
    if ($name.Length -gt 70 -or $name -notmatch '^[a-zA-Z0-9_ .-]+$') { return 'other' }
    return $name
}
function Get-Group([string]$filename) {
    if (Test-Under $filename $plotLocal) {
        $rel = $filename.Substring($plotLocal.TrimEnd('\').Length).TrimStart('\')
        $pieces = $rel.Split('\')
        if ($pieces[0] -eq 'engineering-team' -and $pieces.Length -ge 3 -and
            $pieces[1] -eq 'autonomous-queue') {
            return ('PlotPickle/Factory/' + (Get-FirstPart $pieces[2]))
        }
        return ('PlotPickle/Local/' + (Get-FirstPart $rel))
    }
    if (Test-Under $filename $repo) {
        $rel = $filename.Substring($repo.TrimEnd('\').Length).TrimStart('\')
        return ('PlotPickle/Repository/' + (Get-FirstPart $rel))
    }
    if (Test-Under $filename $localApp) {
        $rel = $filename.Substring($localApp.TrimEnd('\').Length).TrimStart('\')
        return ('Other/UserAppDataLocal/' + (Get-FirstPart $rel))
    }
    if ($userRoot -and (Test-Under $filename (Join-Path $userRoot 'AppData\Roaming'))) {
        $home = Join-Path $userRoot 'AppData\Roaming'
        return ('Other/UserAppDataRoaming/' + (Get-FirstPart $filename.Substring($home.Length)))
    }
    if ($userRoot -and (Test-Under $filename $userRoot)) {
        return ('Other/UserProfile/' + (Get-FirstPart $filename.Substring($userRoot.Length)))
    }
    foreach ($region in @('C:\Windows','C:\Program Files','C:\Program Files (x86)','C:\ProgramData')) {
        if (Test-Under $filename $region) {
            return ('Other/' + $region.Substring(3).Replace('\','/') + '/' +
                (Get-FirstPart $filename.Substring($region.Length)))
        }
    }
    if ($filename.StartsWith('C:\Users\',[StringComparison]::OrdinalIgnoreCase)) {
        return 'Other/Users/OtherProfile'
    }
    return ('Other/C-root/' + (Get-FirstPart $filename.Substring(3)))
}
function Add-Top([System.Collections.Generic.List[object]]$list, $row) {
    $list.Add($row)
    if ($list.Count -gt $topLimit) {
        $lowest = 0
        for ($i=1; $i -lt $list.Count; $i++) {
            if ($list[$i].sizeBytes -lt $list[$lowest].sizeBytes) { $lowest=$i }
        }
        $list.RemoveAt($lowest)
    }
}
function Record-File($file) {
    try {
        $length = [long]$file.Length
        $created = $file.CreationTimeUtc
        $modified = $file.LastWriteTimeUtc
        $isCreated = $created -ge $cutoff -and $created -le $now.AddDays(1)
        $isModified = $modified -ge $cutoff -and $modified -le $now.AddDays(1)
        if ($created -gt $now.AddDays(1) -or $modified -gt $now.AddDays(1)) { $global:ppFutureTimes++ }
        if (-not ($isCreated -or $isModified)) { return }
        $category = Get-Group $file.FullName
        if (-not $grouped.ContainsKey($category)) {
            if ($grouped.Count -ge 500) { $category='Other/ExcessCategories' }
            if (-not $grouped.ContainsKey($category)) {
                $grouped[$category] = [pscustomobject]@{
                    bucket=$category; createdFiles=0; createdBytes=[long]0
                    modifiedFiles=0; modifiedBytes=[long]0
                }
            }
        }
        $stats = $grouped[$category]
        $suffix = [IO.Path]::GetExtension($file.Name)
        if ($suffix.Length -gt 12 -or $suffix -notmatch '^\.[a-zA-Z0-9]*$') { $suffix='[other]' }
        if ($isCreated) {
            $stats.createdFiles++
            $stats.createdBytes += $length
            Add-Top $topCreated ([pscustomobject]@{
                bucket=$category; extension=$suffix; sizeBytes=$length; utc=$created.ToString('o')
            })
        }
        if ($isModified) {
            $stats.modifiedFiles++
            $stats.modifiedBytes += $length
            Add-Top $topModified ([pscustomobject]@{
                bucket=$category; extension=$suffix; sizeBytes=$length; utc=$modified.ToString('o')
            })
        }
    } catch { $global:ppErrors++ }
}
$freeBefore = $null
try { $freeBefore = ([IO.DriveInfo]::new('C')).AvailableFreeSpace } catch {}
$stack = New-Object 'System.Collections.Generic.Stack[string]'
$stack.Push($root)
while ($stack.Count -gt 0) {
    if ($timer.Elapsed.TotalSeconds -ge $MaxSeconds -or $global:ppVisited -ge $MaxEntries) {
        $global:ppIncomplete = $true
        break
    }
    $directory = $stack.Pop()
    $global:ppDirectories++
    try {
        $entries = Get-ChildItem -LiteralPath $directory -Force -ErrorAction Stop
        foreach ($entry in $entries) {
            if ($timer.Elapsed.TotalSeconds -ge $MaxSeconds -or $global:ppVisited -ge $MaxEntries) {
                $global:ppIncomplete = $true
                break
            }
            $global:ppVisited++
            if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                $global:ppSkippedLinks++
                continue
            }
            if ($entry.PSIsContainer) { $stack.Push($entry.FullName) }
            else { Record-File $entry }
        }
    } catch { $global:ppErrors++ }
    if ($global:ppIncomplete) { break }
}
$timer.Stop()
$freeAfter = $null
try { $freeAfter = ([IO.DriveInfo]::new('C')).AvailableFreeSpace } catch {}
$summary = @($grouped.Values | Sort-Object createdBytes -Descending)
$createdTotal = [long]0
$modifiedTotal = [long]0
foreach ($g in $summary) { $createdTotal += $g.createdBytes; $modifiedTotal += $g.modifiedBytes }
$report = [ordered]@{
    schemaVersion=1
    tool='PlotPickle-RecentCDriveMetadata'
    state=if ($global:ppIncomplete -or $global:ppErrors -gt 0) { 'PARTIAL' } else { 'COMPLETE' }
    startedUtc=$now.ToString('o')
    cutoffUtc=$cutoff.ToString('o')
    finishedUtc=([DateTime]::UtcNow).ToString('o')
    durationSeconds=[math]::Round($timer.Elapsed.TotalSeconds,2)
    limits=@{days=$Days;maxSeconds=$MaxSeconds;maxEntries=$MaxEntries}
    visitedEntries=$global:ppVisited
    visitedDirectories=$global:ppDirectories
    inaccessibleOrChangedDirectories=$global:ppErrors
    reparsePointsSkipped=$global:ppSkippedLinks
    futureTimestampCount=$global:ppFutureTimes
    discoveryIncomplete=$global:ppIncomplete
    capacity=@{freeBytesBefore=$freeBefore;freeBytesAfter=$freeAfter}
    createdFilesApparentBytes=$createdTotal
    modifiedFilesApparentBytes=$modifiedTotal
    # Largest entries expose only category/extension/size/time, never file path/content.
    largestCreated=@($topCreated | Sort-Object sizeBytes -Descending)
    largestModified=@($topModified | Sort-Object sizeBytes -Descending)
    buckets=@($summary)
    integrity=@{
        state='NOT_TESTED'
        note='File metadata cannot prove corruption. Access failures and unusual timestamps are not proof of corrupt content. Use CHKDSK /scan or SFC /verifyonly separately if indicated.'
    }
    privacy=@{
        contentsRead=$false;fullPathsReturned=$false;reparseTraversed=$false
        deletionAuthorized=$false;repairAttempted=$false
    }
    interpretation='Creation times can change during file copies/extractions; modified and created totals overlap. Apparent logical file lengths do not equal physical disk growth or reclaimable bytes. PARTIAL counts are lower bounds.'
}
$report | ConvertTo-Json -Depth 8
