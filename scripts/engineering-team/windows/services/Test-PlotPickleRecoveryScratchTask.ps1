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
  [switch]$Crash,
  [switch]$Cleanup,
  [switch]$Child,
  [ValidatePattern('^[0-9]{2,10}$')][string]$Tag
)
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
  throw 'WINDOWS_ONLY'
}
if (@(@($Setup,$Start,$Status,$Stop,$Crash,$Cleanup,$Child) | Where-Object { $_ }).Count -ne 1) {
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
  # This acceptance task must belong to the actual owner session.
  $id=[string]$t.Principal.UserId
  if ($id -cne $identity.User.Value -and $id -cne $identity.Name) {
    try {
      $resolved=(New-Object Security.Principal.NTAccount($id)).Translate(
        [Security.Principal.SecurityIdentifier])
      if ($resolved.Value -cne $identity.User.Value) { throw 'FOREIGN_TASK_PRINCIPAL' }
    } catch { throw 'FOREIGN_TASK_PRINCIPAL' }
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
  $ownedProcess=$false
  if ($heartbeat -and $heartbeat.pid -gt 0) {
    try {
      $process=Get-CimInstance Win32_Process -Filter ('ProcessId=' + [int]$heartbeat.pid) -ErrorAction Stop
      $ownedProcess=($null -ne $process -and $process.Name -eq 'powershell.exe' -and
        $process.CommandLine -like ('*' + $PSCommandPath + '*') -and
        $process.CommandLine -match ('-Child\s+-Tag\s+' + $Tag + '(?:\s|$)'))
    } catch { $ownedProcess=$false }
  }
  [pscustomobject]@{
    processObserved=[bool]$ownedProcess
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
if ($Crash) {
  if ($t.State -ne 'Running') { throw 'SCRATCH_TASK_NOT_RUNNING' }
  if (-not (Test-Path -LiteralPath $marker -PathType Leaf)) {
    throw 'NO_SCRATCH_HEARTBEAT'
  }
  $hb=Get-Content -LiteralPath $marker -Raw | ConvertFrom-Json
  $candidate=Get-CimInstance Win32_Process -Filter ('ProcessId=' + [int]$hb.pid) -ErrorAction Stop
  if ($null -eq $candidate -or $candidate.Name -ne 'powershell.exe' -or
      $candidate.CommandLine -notlike ('*' + $PSCommandPath + '*') -or
      $candidate.CommandLine -notmatch ('-Child\s+-Tag\s+' + $Tag + '(?:\s|$)')) {
    throw 'SCRATCH_CHILD_PID_NOT_OWNED'
  }
  Stop-Process -Id ([int]$hb.pid) -Force -ErrorAction Stop
  '{"state":"SCRATCH_CHILD_TERMINATED"}'
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
