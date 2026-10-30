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
$taskState = 'NOT_INSTALLED'
$lastResult = $null
try {
    $tasks = @(Get-ScheduledTask -TaskName 'PlotPickleIndependentSupervisor' -ErrorAction Stop)
    if ($tasks.Count -ne 1) { $taskState = 'UNKNOWN' }
    else {
        $taskState = [string]$tasks[0].State
        try {
            $info = Get-ScheduledTaskInfo -InputObject $tasks[0] -ErrorAction Stop
            $lastResult = [long]$info.LastTaskResult
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
