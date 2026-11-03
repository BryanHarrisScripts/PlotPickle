#Requires -Version 5.1
# #3333 fixed, read-only, owner-Windows supervisor diagnostics.
# No parameters, arbitrary commands, credential output, repairs, or lock deletion.
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'OWNER_WINDOWS_ONLY' }
$base = [Environment]::GetFolderPath('LocalApplicationData')
$supervisor = Join-Path $base 'PlotPickle\engineering-team\supervisor'
function Marker([string]$file) {
    try {
        $item = Get-Item -LiteralPath (Join-Path $supervisor $file) -Force -ErrorAction Stop
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return 'UNVERIFIABLE' }
        return 'PRESENT'
    } catch {
        if ($_.Exception -is [System.Management.Automation.ItemNotFoundException]) { return 'ABSENT' }
        return 'UNVERIFIABLE'
    }
}
# Times and Task Scheduler event metadata only. Never return event Message,
# ActionName, command lines, user identities or private filesystem paths.
function UtcStamp($date) {
    if ($null -eq $date -or $date.Year -lt 2000) { return $null }
    return $date.ToUniversalTime().ToString('o', [Globalization.CultureInfo]::InvariantCulture)
}
$taskState = 'NOT_INSTALLED'
$lastRunUtc = $null
$nextRunUtc = $null
$lastResult = $null
try {
    $tasks = @(Get-ScheduledTask -TaskName 'PlotPickleIndependentSupervisor' -ErrorAction Stop)
    if ($tasks.Count -ne 1) { $taskState = 'UNKNOWN' }
    else {
        $taskState = [string]$tasks[0].State
        try {
            $info = Get-ScheduledTaskInfo -InputObject $tasks[0] -ErrorAction Stop
            $lastResult = [long]$info.LastTaskResult
            $lastRunUtc = UtcStamp $info.LastRunTime
            $nextRunUtc = UtcStamp $info.NextRunTime
        } catch { $lastResult = $null }
    }
} catch { $taskState = 'NOT_INSTALLED_OR_UNREADABLE' }
$lockState = Marker 'running.lock'
$pidValue = $null
$processState = 'UNVERIFIABLE'
if ($lockState -eq 'PRESENT') {
    try {
        $lockPath = Join-Path $supervisor 'running.lock'
        $file = Get-Item -LiteralPath $lockPath -Force -ErrorAction Stop
        if (-not ($file -is [IO.FileInfo]) -or $file.Length -lt 2 -or $file.Length -gt 2048) {
            throw 'LOCK_UNVERIFIABLE'
        }
        $lock = Get-Content -LiteralPath $lockPath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
        if ($lock.pid -isnot [int] -and $lock.pid -isnot [long]) { throw 'LOCK_PID_INVALID' }
        $pidValue = [int]$lock.pid
        if ($pidValue -lt 1) { throw 'LOCK_PID_INVALID' }
        $processes = @(Get-CimInstance Win32_Process -Filter ("ProcessId = {0}" -f $pidValue) -ErrorAction Stop)
        if ($processes.Count -eq 0) { $processState = 'MISSING' }
        elseif ($processes.Count -ne 1) { $processState = 'UNVERIFIABLE' }
        elseif ([string]$processes[0].CommandLine -match 'unattended-supervisor\.mjs' -and
                [string]$processes[0].CommandLine -match '\-\-serve') {
            # A matching command line alone is NOT ownership or PID-reuse proof.
            $processState = 'CANDIDATE_NOT_VERIFIED'
        } else { $processState = 'OTHER_PROCESS_OR_REUSED_PID' }
    } catch {
        $pidValue = $null
        $processState = 'UNVERIFIABLE'
    }
}

# Scan at most 256 recent selected event IDs within a fixed twelve-hour
# window. A bounded scan finding no matching entry does NOT prove absence.
$taskEventsState = 'NOT_FOUND_IN_BOUNDED_SCAN'
$taskEvents = @()
try {
    $recent = @(Get-WinEvent -FilterHashtable @{
        LogName = 'Microsoft-Windows-TaskScheduler/Operational'
        StartTime = (Get-Date).AddHours(-12)
        Id = @(100,101,102,103,107,111,129,200,201,203)
    } -MaxEvents 256 -ErrorAction Stop)
    foreach ($eventRecord in $recent) {
        if ($taskEvents.Count -ge 8) { break }
        try {
            $eventXml = [xml]$eventRecord.ToXml()
            $fields = @{}
            foreach ($item in @($eventXml.Event.EventData.Data)) {
                if ($null -eq $item) { continue }
                $fieldName = [string]$item.GetAttribute('Name')
                if ($fieldName -in @('TaskName','ResultCode','ErrorCode','ReturnCode')) {
                    $fields[$fieldName] = [string]$item.InnerText
                }
            }
            if ($fields['TaskName'] -cne '\\PlotPickleIndependentSupervisor' -and
                $fields['TaskName'] -cne 'PlotPickleIndependentSupervisor') { continue }
            $resultCode = $null
            foreach ($name in @('ResultCode','ErrorCode','ReturnCode')) {
                $candidate = [string]$fields[$name]
                if ($candidate -cmatch '^(?:0x[0-9A-Fa-f]{1,8}|[0-9]{1,10}|-[0-9]{1,10})
    taskState = $taskState
    lastTaskResult = $lastResult
    lastRunUtc = $lastRunUtc
    nextRunUtc = $nextRunUtc
    taskEventsState = $taskEventsState
    taskEvents = @($taskEvents)
    lockState = $lockState
    lockPid = $pidValue
    processState = $processState
    stopMarker = (Marker 'stop-request.json')
    pauseMarker = (Marker 'pause-request.json')
    processOwnershipVerified = $false
    remediationAuthorized = $false
} | ConvertTo-Json -Compress -Depth 3
) {
                    $resultCode = $candidate
                    break
                }
            }
            $taskEvents += [pscustomobject]@{
                id = [int]$eventRecord.Id
                timeUtc = UtcStamp $eventRecord.TimeCreated
                resultCode = $resultCode
            }
        } catch {
            $taskEventsState = 'UNAVAILABLE'
            $taskEvents = @()
            break
        }
    }
    if ($taskEvents.Count -gt 0) { $taskEventsState = 'OBSERVED' }
} catch {
    $taskEventsState = 'UNAVAILABLE'
    if ($_.FullyQualifiedErrorId -match 'NoMatchingEventsFound') {
        $taskEventsState = 'NOT_FOUND_IN_BOUNDED_SCAN'
    }
}
[pscustomobject]@{
    schemaVersion = 1
    taskState = $taskState
    lastTaskResult = $lastResult
    lockState = $lockState
    lockPid = $pidValue
    processState = $processState
    stopMarker = (Marker 'stop-request.json')
    pauseMarker = (Marker 'pause-request.json')
    processOwnershipVerified = $false
    remediationAuthorized = $false
} | ConvertTo-Json -Compress -Depth 3
