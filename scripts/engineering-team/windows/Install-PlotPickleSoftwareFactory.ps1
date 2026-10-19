#Requires -Version 5.1
<#
.SYNOPSIS
  Register or unregister a user-owned PlotPickle engineering factory task.
.DESCRIPTION
  Must be explicitly invoked by the local Windows owner. Uses the existing
  approved node executable, current repository and interactive user. No admin
  escalation, credential embedding or silent install. Reboot/login starts only
  a factory that was separately enabled with explicit local consent.
#>
[CmdletBinding()]
param(
    [switch] $Install,
    [switch] $Uninstall
)
$ErrorActionPreference = 'Stop'
if ([bool]$Install -eq [bool]$Uninstall) {
    throw 'Specify exactly one of -Install or -Uninstall.'
}
if ($env:OS -ne 'Windows_NT') {
    throw 'This startup registration is Windows-only.'
}
$taskName = 'PlotPickleSoftwareFactory'
$script = Join-Path $PSScriptRoot 'autonomous-queue.mjs'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
if (-not (Test-Path -LiteralPath $script -PathType Leaf)) {
    throw 'The verified autonomous queue module is missing.'
}
if ($Uninstall) {
    $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($null -eq $existing) {
        Write-Output 'PLOTPICKLE FACTORY: scheduled startup is not installed.'
        return
    }
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Output 'PLOTPICKLE FACTORY: startup task removed; local queue consent remains separately controlled.'
    return
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
$git = (Get-Command git.exe -ErrorAction Stop).Source
$head = (& $git -C $repo rev-parse HEAD)
if ($LASTEXITCODE -ne 0 -or $head -notmatch '^[0-9a-f]{40}$') {
    throw 'Exact repository head is unavailable.'
}
$status = & $node $script --status | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $status.enabled) {
    throw 'Enable the local factory with the explicit issue allowlist before installing startup.'
}
if ($null -ne (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)) {
    throw 'A task with this name already exists. Never overwrite an unknown task.'
}
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $node -Argument ('"{0}" --serve' -f $script) -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Output ('PLOTPICKLE FACTORY: user-owned startup installed and started at exact repository head ' + $head)
Write-Output 'Verify by running: node scripts/engineering-team/windows/autonomous-queue.mjs --status'
