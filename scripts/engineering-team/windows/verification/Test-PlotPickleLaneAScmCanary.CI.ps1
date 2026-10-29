<#
  #3302: EPHEMERAL CI-ONLY Windows SCM canary for the inert Lane A host.
  Intentionally cannot run on owner Windows through normal product controls.
  Creates no keys, reviewer authority, tunnel, worker or W8/W9 ADMIT.
  Default without all three CI flags throws before any mutation.
#>
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
if ($env:OS -ne 'Windows_NT' -or
    $env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows' -or
    $env:PLOTPICKLE_LANE_A_EPHEMERAL_CI -ne '1') { throw 'EPHEMERAL_WINDOWS_CI_ONLY' }
$principal=[Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'EPHEMERAL_CI_ADMIN_REQUIRED'
}
$name='PlotPickleLaneA'
$account='NT SERVICE\PlotPickleLaneA'
if (Get-Service -Name $name -ErrorAction SilentlyContinue) { throw 'EXISTING_SERVICE_MUST_NOT_BE_TOUCHED' }
$root=Join-Path $env:ProgramFiles 'PlotPickle-LaneA-Ephemeral-CI'
$exe=Join-Path $root 'PlotPickleLaneAService.exe'
$buildDir=Join-Path ([IO.Path]::GetTempPath()) ('PlotPickle-LaneA-CI-'+[guid]::NewGuid().ToString('N'))
$sc=Join-Path $env:SystemRoot 'System32\sc.exe'
$created=$false
try {
  $raw=& (Join-Path $PSScriptRoot 'Build-PlotPickleLaneAService.ps1') -Build -OutputDirectory $buildDir
  $receipt=$raw|ConvertFrom-Json
  if ($receipt.result -ne 'INERT_SELF_TEST_PASSED' -or $receipt.canAdmit -ne $false) {
    throw 'CANARY_NATIVE_COMPILE_FAILED'
  }
  if (Test-Path -LiteralPath $root) { throw 'CANARY_ROOT_COLLISION' }
  New-Item -Path $root -ItemType Directory -ErrorAction Stop|Out-Null
  Copy-Item -LiteralPath (Join-Path $buildDir 'PlotPickleLaneAService.exe') -Destination $exe -ErrorAction Stop
  if ((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $receipt.binarySha256) {
    throw 'CANARY_IMAGE_SHA_MISMATCH'
  }
  # Test-only sc.exe registration; never the production signed installer.
  & $sc create $name 'type=' 'own' 'start=' 'demand' 'binPath=' ('"' + $exe + '"') 'obj=' $account 'DisplayName=' 'PlotPickle CI ephemeral inert reviewer'|Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'CANARY_SCM_CREATE_FAILED' }
  $created=$true
  & $sc sidtype $name restricted|Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'CANARY_SCM_RESTRICTED_SID_FAILED' }
  $config=Get-CimInstance -ClassName Win32_Service -Filter "Name='PlotPickleLaneA'"
  if ($null -eq $config -or $config.StartName -ne $account -or
      $config.StartMode -ne 'Manual') { throw 'CANARY_ACCOUNT_OR_START_MODE_MISMATCH' }
  $sidType=@(& $sc qsidtype $name 2>$null) -join ' '
  if ($LASTEXITCODE -ne 0 -or $sidType -notmatch 'SERVICE_SID_TYPE\s*:\s*RESTRICTED') {
    throw 'CANARY_RESTRICTED_SID_UNVERIFIED'
  }
  & $sc start $name|Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'CANARY_SERVICE_START_FAILED' }
  $running=$null
  for ($i=0;$i -lt 30;$i++) {
    $running=Get-CimInstance -ClassName Win32_Service -Filter "Name='PlotPickleLaneA'"
    if ($null -ne $running -and $running.State -eq 'Running' -and [int]$running.ProcessId -gt 0) { break }
    Start-Sleep -Milliseconds 250
  }
  if ($null -eq $running -or $running.State -ne 'Running' -or [int]$running.ProcessId -lt 1) {
    throw 'CANARY_SCM_STARTUP_NOT_PROVEN'
  }
  $process=Get-CimInstance -ClassName Win32_Process -Filter "ProcessId=$([int]$running.ProcessId)"
  if ($null -eq $process) { throw 'CANARY_PROCESS_NOT_FOUND' }
  $owner=Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid
  $expected=([Security.Principal.NTAccount]$account).Translate([Security.Principal.SecurityIdentifier]).Value
  if ($null -eq $owner -or [int]$owner.ReturnValue -ne 0 -or $owner.Sid -ne $expected) {
    throw 'CANARY_REAL_PROCESS_SID_UNVERIFIED'
  }
  & $sc stop $name|Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'CANARY_SCM_STOP_REQUEST_FAILED' }
  $stopped=$false
  for ($i=0;$i -lt 40;$i++) {
    $now=Get-Service -Name $name -ErrorAction SilentlyContinue
    if ($null -ne $now -and $now.Status -eq 'Stopped') { $stopped=$true; break }
    Start-Sleep -Milliseconds 250
  }
  if (-not $stopped) { throw 'CANARY_STOP_NOT_ACKNOWLEDGED' }
  [pscustomobject]@{
    schemaVersion='PP-LANE-A-EPHEMERAL-SCM-V1'
    status='INERT_SCM_CANARY_PASSED'
    nativeCompilerSelfTest=$true
    virtualAccountTokenVerified=$true
    restrictedServiceSidConfigured=$true
    scmStartStopVerified=$true
    userMachineVerified=$false
    reviewerKeyProvisioned=$false
    independentlyAttested=$false
    w8w9Admitted=$false
    productGateVerified=$false
    mayAdmit=$false
    mayMerge=$false
  }|ConvertTo-Json -Depth 4
}
finally {
  if ($created) {
    $current=Get-Service -Name $name -ErrorAction SilentlyContinue
    if ($null -ne $current -and $current.Status -ne 'Stopped') {
      & $sc stop $name|Out-Null
      Start-Sleep -Seconds 2
    }
    & $sc delete $name|Out-Null
  }
  if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue }
  if (Test-Path -LiteralPath $buildDir) { Remove-Item -LiteralPath $buildDir -Recurse -Force -ErrorAction SilentlyContinue }
}
