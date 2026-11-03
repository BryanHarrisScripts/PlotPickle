#Requires -Version 5.1
<#
  #3268 NATIVE ACCEPTANCE FIXTURE. Only fixed, uniquely tagged
  PlotPickleRecoveryAcceptance task names in this isolated candidate stage.
  No interaction with PlotPickleIndependentSupervisor or any Factory worker.
#>
[CmdletBinding()]
param(
  [switch]$Setup,
  [switch]$Start,
  [switch]$Status,
  [switch]$Stop,
  [switch]$Cleanup,
  [switch]$Child,
  [ValidatePattern('^[0-9]{2,10}$')][string]$Tag
)
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
  throw 'WINDOWS_ONLY'
}
if (@(@($Setup,$Start,$Status,$Stop,$Cleanup,$Child) | Where-Object { $_ }).Count -ne 1) {
  throw 'EXACTLY_ONE_OPERATION'
}
if ([string]::IsNullOrWhiteSpace($Tag)) { throw 'TAG_REQUIRED' }
$taskName = 'PlotPickleRecoveryAcceptance-' + $Tag
$root = Join-Path $PSScriptRoot '.artifacts\recovery-acceptance'
$marker = Join-Path $root ('task-' + $Tag + '.json')
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$exe = (Get-Command powershell.exe -ErrorAction Stop).Source
$arguments = ('-NoProfile -NonInteractive -File "{0}" -Child -Tag {1}' -f $PSCommandPath,$Tag)
function Get-Matching {
  $all = @(Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)
  if ($all.Count -eq 0) { return $null }
  if ($all.Count -ne 1) { throw 'MULTIPLE_TASKS_UNVERIFIABLE' }
  $t = $all[0]
  if (@($t.Actions).Count -ne 1 -or
      $t.TaskPath -ne '\' -or
      $t.Actions[0].Execute -cne $exe -or
      $t.Actions[0].Arguments -cne $arguments -or
      $t.Actions[0].WorkingDirectory -cne $PSScriptRoot) {
    throw 'FOREIGN_TASK_OWNERSHIP_UNVERIFIED'
  }
  return $t
}
if ($Child) {
  $parentTask = Get-Matching
  if ($null -eq $parentTask) { throw 'CHILD_TASK_UNOWNED' }
  New-Item -ItemType Directory -Path $root -Force | Out-Null
  while ($true) {
    $tmp = $marker + '.tmp'
    [pscustomobject]@{
      schemaVersion=1
      taskName=$taskName
      pid=$PID
      at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    } | ConvertTo-Json -Compress | Set-Content -LiteralPath $tmp -Encoding UTF8 -ErrorAction Stop
    Move-Item -LiteralPath $tmp -Destination $marker -Force -ErrorAction Stop
    Start-Sleep -Milliseconds 400
  }
}
if ($Setup) {
  if ($null -ne (Get-Matching)) { throw 'EXISTING_TASK_NO_OVERWRITE' }
  New-Item -ItemType Directory -Path $root -Force | Out-Null
  if (Test-Path $marker) { throw 'OLD_MARKER_PRESENT' }
  $action = New-ScheduledTaskAction -Execute $exe -Argument $arguments -WorkingDirectory $PSScriptRoot
  $principal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero)
  Register-ScheduledTask -TaskName $taskName -Action $action -Principal $principal -Settings $settings | Out-Null
  if ($null -eq (Get-Matching)) { throw 'SETUP_UNVERIFIED' }
  '{"state":"INSTALLED_NOT_STARTED"}'
  return
}
$t = Get-Matching
if ($null -eq $t) {
  if ($Status) {
    '{"state":"NOT_INSTALLED"}'
    return
  }
  throw 'TASK_NOT_INSTALLED'
}
if ($Status) {
  $heartbeat = $null
  if (Test-Path $marker -PathType Leaf) {
    try { $heartbeat = Get-Content -LiteralPath $marker -Raw | ConvertFrom-Json }
    catch { $heartbeat = $null }
  }
  [pscustomobject]@{
    state='OBSERVED_NOT_RELEASE_PROOF'
    taskInstalled=$true
    taskState=[string]$t.State
    pid=if ($heartbeat) { [int]$heartbeat.pid } else { $null }
    heartbeatAt=if ($heartbeat) { [long]$heartbeat.at } else { $null }
  } | ConvertTo-Json -Compress
  return
}
if ($Start) {
  if ($t.State -ne 'Ready') { throw 'TASK_NOT_READY' }
  Start-ScheduledTask -TaskName $taskName -ErrorAction Stop
  '{"state":"START_REQUESTED_UNCONFIRMED"}'
  return
}
if ($Stop) {
  if ($t.State -eq 'Running') {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction Stop
  }
  '{"state":"STOP_REQUESTED"}'
  return
}
if ($Cleanup) {
  if ($t.State -in @('Running','Queued')) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction Stop
    Start-Sleep -Seconds 1
  }
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
  if ($null -ne (Get-Matching)) { throw 'TASK_STILL_PRESENT' }
  if (Test-Path $marker) { Remove-Item -LiteralPath $marker -ErrorAction Stop }
  '{"state":"CLEANED"}'
}
