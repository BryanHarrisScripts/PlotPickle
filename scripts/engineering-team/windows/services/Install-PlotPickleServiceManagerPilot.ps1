#Requires -Version 5.1
<#
 #3268: install/observe/disable one limited owner-session Service Manager pilot.
 No new tunnel or coding authority. This is a logon task, NOT a boot-time SCM
 service. Never replaces or stops the existing Supervisor or its work.
#>
[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$Status,
    [switch]$Stop,
    [switch]$Start,
    [switch]$Uninstall,
    [string]$Consent = ''
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'OWNER_WINDOWS_ONLY' }
$operations = @(@($Install,$Status,$Stop,$Start,$Uninstall) | Where-Object { $_ })
if ($operations.Count -ne 1) { throw 'EXACTLY_ONE_MANAGER_OPERATION_REQUIRED' }
$requiredConsent='ENABLE_PLOTPICKLE_SERVICE_MANAGER_PILOT'
if (($Install -or $Start -or $Uninstall) -and $Consent -cne $requiredConsent) {
    throw 'OWNER_MANAGER_CONSENT_REQUIRED'
}
if (($Status -or $Stop) -and $Consent -ne '') { throw 'UNEXPECTED_CONSENT' }
$name='PlotPickleServiceManagerPilot'
$agent=Join-Path $PSScriptRoot 'supervisor-recovery-agent.mjs'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
if (-not (Test-Path -LiteralPath $agent -PathType Leaf)) {
    throw 'REVIEWED_MANAGER_SCRIPT_NOT_FOUND'
}
$node=(Get-Command node.exe -ErrorAction Stop).Source
$argsText=('"{0}" --watch' -f $agent)
$identity=[System.Security.Principal.WindowsIdentity]::GetCurrent()

function TaskMatchesOwner {
    param($Task)
    if ($null -eq $Task -or $Task.TaskPath -ne '\' -or @($Task.Actions).Count -ne 1) { return $false }
    if ($Task.Actions[0].Execute -cne $node -or
        $Task.Actions[0].Arguments -cne $argsText -or
        $Task.Actions[0].WorkingDirectory -cne $repo) { return $false }
    $userId=[string]$Task.Principal.UserId
    if ($userId -eq $identity.User.Value) { return $true }
    try {
        $sid=(New-Object System.Security.Principal.NTAccount($userId)).Translate(
            [System.Security.Principal.SecurityIdentifier])
        return $sid.Value -eq $identity.User.Value
    } catch { return $false }
}
function Read-Task {
    $tasks=@(Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue)
    if ($tasks.Count -eq 0) { return $null }
    if ($tasks.Count -ne 1 -or -not (TaskMatchesOwner $tasks[0])) {
        throw 'MANAGER_TASK_OWNERSHIP_UNVERIFIED'
    }
    return $tasks[0]
}
function Assert-CleanMain {
    $head=(& git.exe -C $repo rev-parse HEAD).Trim()
    $branch=(& git.exe -C $repo branch --show-current).Trim()
    $dirty=& git.exe -C $repo status --porcelain --untracked-files=no
    if ($LASTEXITCODE -ne 0 -or $head -cnotmatch '^[a-f0-9]{40}$' -or
        $branch -cne 'main' -or $dirty) { throw 'EXACT_CLEAN_MAIN_REQUIRED' }
    return $head
}
if ($Status) {
    $task=Read-Task
    [pscustomobject]@{
        state=if ($null -eq $task) { 'NOT_INSTALLED' } else { [string]$task.State }
        startupScope='OWNER_LOGON_ONLY_NOT_BOOT_TIME'
        taskOwned=($null -ne $task)
        independentWindowsAcceptance=$false
        managerProcessVerified=$false
        automaticMergeEnabled=$false
    } | ConvertTo-Json -Compress
    return
}
if ($Install) {
    $head=Assert-CleanMain
    if ($null -ne (Read-Task)) { throw 'MANAGER_ALREADY_INSTALLED' }
    $supervisor=@(Get-ScheduledTask -TaskName 'PlotPickleIndependentSupervisor' -ErrorAction SilentlyContinue)
    if ($supervisor.Count -ne 1) { throw 'EXISTING_SUPERVISOR_REQUIRED' }
    $action=New-ScheduledTaskAction -Execute $node -Argument $argsText -WorkingDirectory $repo
    $trigger=New-ScheduledTaskTrigger -AtLogOn -User $identity.Name
    $principal=New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
    $settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -StartWhenAvailable
    Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
    $task=Read-Task
    if ($null -eq $task) { throw 'INSTALLED_TASK_IDENTITY_UNVERIFIED' }
    [pscustomobject]@{ state='INSTALLED_NOT_STARTED'; sourceHead=$head;
        startupScope='OWNER_LOGON_ONLY_NOT_BOOT_TIME'; managerProcessVerified=$false } |
        ConvertTo-Json -Compress
    return
}
$task=Read-Task
if ($null -eq $task) { throw 'MANAGER_TASK_NOT_INSTALLED' }
if ($Stop) {
    Disable-ScheduledTask -TaskName $name -ErrorAction Stop | Out-Null
    if ([string]$task.State -eq 'Running') {
        Stop-ScheduledTask -TaskName $name -ErrorAction Stop
    }
    [pscustomobject]@{ state='STOP_REQUESTED_NOT_PROCESS_ATTESTED';
        managerProcessVerified=$false; supervisorUntouched=$true } |
        ConvertTo-Json -Compress
    return
}
if ($Start) {
    $head=Assert-CleanMain
    if ($task.State -eq 'Running') { throw 'MANAGER_ALREADY_RUNNING' }
    Enable-ScheduledTask -TaskName $name -ErrorAction Stop | Out-Null
    Start-ScheduledTask -TaskName $name -ErrorAction Stop
    [pscustomobject]@{ state='START_REQUESTED_UNCONFIRMED'; sourceHead=$head;
        managerProcessVerified=$false; supervisorUntouched=$true } |
        ConvertTo-Json -Compress
    return
}
if ($Uninstall) {
    if ($task.State -in @('Running','Queued','Unknown')) {
        throw 'MANAGER_MUST_BE_STOPPED_FIRST'
    }
    Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction Stop
    [pscustomobject]@{ state='UNREGISTERED_NOT_RUNNING_AT_OBSERVATION';
        supervisorUntouched=$true } | ConvertTo-Json -Compress
}
