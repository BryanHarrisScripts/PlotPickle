#Requires -Version 5.1
<#
.SYNOPSIS
Explicit opt-in per-user PlotPickle Software Factory backlog supervisor.
Admission-only foundation; does NOT grant autonomous patch/model/merge authority.
#>
[CmdletBinding(DefaultParameterSetName='Status')]
param(
  [Parameter(ParameterSetName='Install',Mandatory)][switch]$Install,
  [Parameter(ParameterSetName='Install',Mandatory)][ValidateSet('ENABLE_BOUNDED_FACTORY')][string]$Consent,
  [Parameter(ParameterSetName='Uninstall',Mandatory)][switch]$Uninstall,
  [Parameter(ParameterSetName='Status')][switch]$Status
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$taskName='PlotPickle Software Factory Admission'
$repoRoot=Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$worker=Join-Path $PSScriptRoot 'factory-worker.mjs'
if(-not (Test-Path -LiteralPath $worker -PathType Leaf)){throw 'FACTORY_WORKER_NOT_FOUND'}
if($Uninstall){
  $task=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if($null -ne $task) {
    if($task.State -eq 'Running'){Stop-ScheduledTask -TaskName $taskName}
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  }
  & node $worker --disable
  if($LASTEXITCODE -ne 0){throw 'FACTORY_DISABLE_FAILED'}
  Write-Output 'UNINSTALLED_AND_DISABLED'
  return
}
if($Install){
  if($Consent -cne 'ENABLE_BOUNDED_FACTORY'){throw 'EXPLICIT_CONSENT_REQUIRED'}
  if($null -ne (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)){
    throw 'EXISTING_FACTORY_TASK_REVIEW_REQUIRED'
  }
  $node=(Get-Command node -CommandType Application -ErrorAction Stop).Source
  if(-not (Test-Path -LiteralPath $node -PathType Leaf)){throw 'NODE_UNAVAILABLE'}
  & $node $worker --enable
  if($LASTEXITCODE -ne 0){throw 'FACTORY_ENABLE_FAILED'}
  $action=New-ScheduledTaskAction -Execute $node -Argument ('"' + $worker + '" --run') -WorkingDirectory $repoRoot
  $trigger=New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
  $principal=New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
  $settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Seconds 0) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Opt-in PlotPickle admission-only worker; no model, source mutation or merge authority' | Out-Null
  Start-ScheduledTask -TaskName $taskName
  Write-Output 'INSTALLED_ADMISSION_ONLY; inspect --status; autonomous implementation still BLOCKED'
  return
}
$existing=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
& node $worker --status
if($LASTEXITCODE -ne 0){throw 'FACTORY_STATUS_FAILED'}
Write-Output ('WINDOWS_SCHEDULED_TASK=' + $(if($null -eq $existing){'NOT_INSTALLED'}else{$existing.State.ToString()}))
