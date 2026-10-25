#Requires -Version 5.1
<#
  #3142: owner-invoked, *separate* Windows logon registration for the bounded
  ChatGPT-governed supervisor. Never starts the legacy Pi autonomous queue.
  INSTALL requires the supervisor to have been separately paired and enabled.
  START is explicit; its result is a request, not a running-worker attestation.
#>
[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$Start,
    [switch]$Status,
    [switch]$Stop,
    [switch]$Uninstall,
    [string]$Consent = ''
)
$ErrorActionPreference = 'Stop'
$selected = @(@($Install, $Start, $Status, $Stop, $Uninstall) | Where-Object { $_ })
if ($selected.Count -ne 1) {
    throw 'EXACTLY_ONE_SUPERVISOR_OPERATION_REQUIRED'
}
if ($env:OS -ne 'Windows_NT') {
    throw 'LOCAL_WINDOWS_ONLY'
}

$requiredConsent = 'ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR'
if (($Install -or $Start -or $Uninstall) -and $Consent -cne $requiredConsent) {
    throw 'LOCAL_WINDOWS_CONSENT_REQUIRED'
}
if (($Status -or $Stop) -and $Consent -ne '') {
    throw 'UNSUPPORTED_SUPERVISOR_ARGS'
}
$taskName = 'PlotPickleIndependentSupervisor'
$legacyTask = 'PlotPickleSoftwareFactory'
$scriptPath = Join-Path $PSScriptRoot 'unattended-supervisor.mjs'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
    throw 'REVIEWED_SUPERVISOR_SCRIPT_MISSING'
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$arguments = ('"{0}" --serve --consent {1}' -f $scriptPath, $requiredConsent)

function Get-TaskByName([string]$name) {
    return @(Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue)
}
function Test-TaskPrincipalIsCurrentUser([string]$taskUserId) {
    if ([string]::IsNullOrWhiteSpace($taskUserId)) { return $false }
    # Task Scheduler may normalize DOMAIN\user to user. Require SID equality.
    $current = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    if ($taskUserId -eq $current.User.Value) { return $true }
    try {
        $resolved = (New-Object System.Security.Principal.NTAccount($taskUserId)).Translate(
            [System.Security.Principal.SecurityIdentifier])
        if ($resolved.Value -eq $current.User.Value) { return $true }
    } catch {
        # A bare local username can fail NTAccount translation on some hosts.
    }
    # Resolve the unqualified name explicitly against this machine only.
    if ($taskUserId -match '^[^\\]+$') {
        try {
            $local = (New-Object System.Security.Principal.NTAccount($env:COMPUTERNAME, $taskUserId)).Translate(
                [System.Security.Principal.SecurityIdentifier])
            return $local.Value -eq $current.User.Value
        } catch { return $false }
    }
    return $false
}
function Read-OwnedTask {
    $matching = @(Get-TaskByName $taskName)
    if ($matching.Count -eq 0) { return $null }
    if ($matching.Count -ne 1) { throw 'SUPERVISOR_TASK_OWNERSHIP_UNVERIFIED' }
    $task = $matching[0]
    $actions = @($task.Actions)
    if ($actions.Count -ne 1 -or
        $task.TaskPath -ne '\' -or
        -not (Test-TaskPrincipalIsCurrentUser ([string]$task.Principal.UserId)) -or
        $actions[0].Execute -ne $node -or
        $actions[0].Arguments -ne $arguments -or
        $actions[0].WorkingDirectory -ne $repo) {
        throw 'SUPERVISOR_TASK_OWNERSHIP_UNVERIFIED'
    }
    return $task
}
function Read-WorkerStatus {
    $result = & $node $scriptPath --status
    if ($LASTEXITCODE -ne 0) { throw 'SUPERVISOR_STATUS_UNVERIFIABLE' }
    $worker = $result | ConvertFrom-Json
    if ($null -eq $worker -or [string]::IsNullOrEmpty($worker.state)) {
        throw 'SUPERVISOR_STATUS_UNVERIFIABLE'
    }
    return $worker
}
function Assert-ExactBoundWorker {
    $head = (& git -C $repo rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $head -cnotmatch '^[a-f0-9]{40}$') {
        throw 'EXACT_SOURCE_HEAD_UNVERIFIABLE'
    }
    $modified = & git -C $repo status --porcelain --untracked-files=no
    if ($LASTEXITCODE -ne 0 -or $modified) {
        throw 'TRACKED_SOURCE_NOT_CLEAN'
    }
    $worker = Read-WorkerStatus
    if ($worker.state -ne 'OFFLINE' -or $worker.exactSha -cne $head) {
        throw 'SUPERVISOR_NOT_OFFLINE_ON_CURRENT_HEAD'
    }
    return $head
}

if ($Status) {
    $worker = Read-WorkerStatus
    $task = Read-OwnedTask
    [pscustomobject]@{
        state = 'OBSERVED_NOT_INDEPENDENTLY_VERIFIED'
        taskInstalled = ($null -ne $task)
        taskState = if ($null -eq $task) { 'NOT_INSTALLED' } else { [string]$task.State }
        supervisorState = [string]$worker.state
        sourceHead = if ([string]$worker.exactSha -match '^[a-f0-9]{40}$') { [string]$worker.exactSha } else { $null }
        workerProcessVerified = $false
        autonomousCodingVerified = $false
        automaticMergeEnabled = $false
    } | ConvertTo-Json -Compress
    return
}
if ($Stop) {
    $receipt = (& $node $scriptPath --disable | ConvertFrom-Json)
    if ($LASTEXITCODE -ne 0 -or $null -eq $receipt) { throw 'LOCAL_STOP_REQUEST_UNVERIFIED' }
    if ($receipt.state -ne 'STOP_REQUESTED' -and $receipt.state -ne 'OFF') {
        throw 'LOCAL_STOP_REQUEST_UNVERIFIED'
    }
    [pscustomobject]@{
        state = [string]$receipt.state
        stopDisposition = if ($receipt.state -eq 'STOP_REQUESTED') { 'STOP_REQUESTED_UNCONFIRMED' } else { 'NO_ENABLED_SUPERVISOR' }
        ownedDescendantsVerifiedGone = $false
        workerProcessVerified = $false
    } | ConvertTo-Json -Compress
    return
}
if ($Install) {
    $null = Assert-ExactBoundWorker
    if (@(Get-TaskByName $legacyTask).Count -ne 0) {
        throw 'LEGACY_PI_FACTORY_TASK_PRESENT_DISABLE_SEPARATELY'
    }
    if (@(Get-TaskByName $taskName).Count -ne 0) {
        throw 'SUPERVISOR_TASK_ALREADY_EXISTS_NO_OVERWRITE'
    }
    $action = New-ScheduledTaskAction -Execute $node -Argument $arguments -WorkingDirectory $repo
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
    $principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
    [pscustomobject]@{
        state = 'INSTALLED_NOT_STARTED'
        taskName = $taskName
        automaticCodingEnabled = $false
        operatorStartRequiredNow = $true
        processOwnershipVerified = $false
    } | ConvertTo-Json -Compress
    return
}
if ($Start) {
    # A legacy task added after this supervisor was installed still blocks Start.
    if (@(Get-TaskByName $legacyTask).Count -ne 0) {
        throw 'LEGACY_PI_FACTORY_TASK_PRESENT_DISABLE_SEPARATELY'
    }
    $task = Read-OwnedTask
    if ($null -eq $task) { throw 'SUPERVISOR_TASK_NOT_INSTALLED' }
    $null = Assert-ExactBoundWorker
    if ([string]$task.State -ne 'Ready') {
        throw 'SUPERVISOR_TASK_NOT_READY_OR_ALREADY_RUNNING'
    }
    Start-ScheduledTask -TaskName $taskName
    [pscustomobject]@{
        state = 'START_REQUESTED_UNCONFIRMED'
        taskName = $taskName
        workerProcessVerified = $false
        agentExecutionVerified = $false
        automaticMergeEnabled = $false
    } | ConvertTo-Json -Compress
    return
}
if ($Uninstall) {
    $task = Read-OwnedTask
    if ($null -eq $task) {
        '{"state":"NOT_INSTALLED","workerProcessVerified":false}'
        return
    }
    if ([string]$task.State -in @('Running', 'Queued', 'Unknown')) {
        throw 'SUPERVISOR_TASK_MAY_STILL_BE_RUNNING_REQUEST_STOP_FIRST'
    }
    # No PID kill, Stop-ScheduledTask, legacy task mutation or process ownership claim.
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    '{"state":"UNREGISTERED_PROCESS_STOP_UNVERIFIED","workerProcessVerified":false}'
}
