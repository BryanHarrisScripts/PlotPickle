<#
 #3302: ONE bounded native Windows diagnostic for the INTERNAL Lane A component.
 Default is read-only. -RunNativeCompile makes only a temporary, unsigned
 diagnostic EXE, runs --self-test and removes it; it does not install/start SCM,
 create an identity/key, contact GitHub, or issue independent W8/W9 admission.
#>
[CmdletBinding()]
param([switch]$RunNativeCompile)
$ErrorActionPreference='Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
$base=$PSScriptRoot
$report=[ordered]@{
  schemaVersion='PP-LANE-A-WINDOWS-DIAGNOSTIC-V1'
  observedAtUtc=[DateTime]::UtcNow.ToString('o')
  scope='LOCAL_WINDOWS_DIAGNOSTIC_NOT_INDEPENDENT_REVIEW'
  nativeCompile='NOT_REQUESTED'
  serviceHost='UNPROVEN'
  serviceSidType='UNPROVEN'
  independentTokenWitness='UNPROVEN'
  signingKeyProvisioned='UNPROVEN'
  registrarTrust='UNPROVEN'
  w8w9TestAdmission='UNPROVEN'
  exactHeadCIPass='UNPROVEN'
  windowsProductGate='UNPROVEN'
  reviewerActivated=$false
  canAdmit=$false
  canMerge=$false
}
try {
  $plan=& (Join-Path $base 'Install-PlotPickleLaneAService.ps1')
  $obj=$plan|ConvertFrom-Json
  if ($obj.result -ne 'PLAN_ONLY' -or $obj.canAdmit -ne $false) {
    throw 'INSTALLER_DEFAULT_NOT_READ_ONLY'
  }
} catch {
  $report.serviceHost='INSTALLER_PLAN_UNAVAILABLE'
  $report | ConvertTo-Json -Depth 5
  return
}
if ($RunNativeCompile) {
  $tempDir=Join-Path ([IO.Path]::GetTempPath()) ('PlotPickle-LaneA-'+[guid]::NewGuid().ToString('N'))
  try {
    $native=& (Join-Path $base 'Build-PlotPickleLaneAService.ps1') -Build -OutputDirectory $tempDir
    $receipt=$native|ConvertFrom-Json
    if ($receipt.result -ne 'INERT_SELF_TEST_PASSED' -or
        $receipt.signedForProduction -ne $false -or $receipt.canAdmit -ne $false) {
      throw 'UNEXPECTED_NATIVE_BUILD_RECEIPT'
    }
    $report.nativeCompile='INERT_CSC_SELF_TEST_PASS'
  } catch {
    # Avoid leaking Windows paths, executable contents or user credentials.
    $report.nativeCompile='NATIVE_COMPILE_OR_SELF_TEST_FAILED'
  } finally {
    if (Test-Path -LiteralPath $tempDir -PathType Container) {
      Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}
try {
  $inspect=& (Join-Path $base 'Inspect-PlotPickleLaneAService.ps1')|ConvertFrom-Json
  $report.serviceHost=[string]$inspect.status
} catch { $report.serviceHost='WINDOWS_INSPECTION_UNAVAILABLE' }
try {
  $sc=Join-Path $env:SystemRoot 'System32\sc.exe'
  $sidOutput=@(& $sc qsidtype PlotPickleLaneA 2>$null)
  if ($LASTEXITCODE -eq 0) {
    if (($sidOutput -join ' ') -match 'SERVICE_SID_TYPE\s*:\s*RESTRICTED') {
      $report.serviceSidType='SCM_RESTRICTED_CONFIGURED_UNVERIFIED_TOKEN'
    } else {
      $report.serviceSidType='SCM_RESTRICTED_SID_NOT_PROVEN'
    }
  }
} catch { $report.serviceSidType='SCM_SID_INSPECTION_UNAVAILABLE' }
# A missing diagnostic-only SCM service can leave sc.exe's LASTEXITCODE nonzero.
# The structured receipt, not an unrelated native command exit code, is truth.
$global:LASTEXITCODE=0
$report|ConvertTo-Json -Depth 5
