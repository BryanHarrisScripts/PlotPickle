<#
 #3302: Build the INERT native Lane A Windows SCM host (no service install).
 -Plan (default) is read-only. -Build compiles outside the repository.
 Does not create credentials, enable review or modify SCM/Task Scheduler.
 Produces an UNSIGNED engineering binary, not a production release artifact.
#>
[CmdletBinding()]
param(
  [switch]$Build,
  [string]$OutputDirectory = (Join-Path $env:TEMP 'PlotPickle-LaneA-Diagnostic-Build')
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'WINDOWS_REQUIRED' }

$source = Join-Path $PSScriptRoot 'PlotPickleLaneAService.cs'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$reference = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\System.ServiceProcess.dll'
$output = Join-Path ([IO.Path]::GetFullPath($OutputDirectory)) 'PlotPickleLaneAService.exe'
foreach ($file in @($source, $compiler, $reference)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw 'LANE_A_BUILD_INPUT_MISSING' }
}
$sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
if (-not $Build) {
  [pscustomobject]@{
    mode='PLAN_ONLY'
    schemaVersion='PP-LANE-A-SCM-BUILD-V1'
    sourceSha256=$sourceHash
    compiler='framework64-v4.0.30319-csc'
    canInstall=$false
    canAdmit=$false
    willWriteFiles=$false
  } | ConvertTo-Json
  return
}

$parent = Split-Path -Parent $output
if (([IO.Path]::GetFullPath($parent)).StartsWith(
  ([IO.Path]::GetFullPath((Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path)).TrimEnd('\') + '\',
  [StringComparison]::OrdinalIgnoreCase)) {
  throw 'BUILD_INSIDE_REPOSITORY_FORBIDDEN'
}
if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
  New-Item -Path $parent -ItemType Directory -Force -ErrorAction Stop | Out-Null
}
# Do not replace a pre-existing binary supplied from another build.
if (Test-Path -LiteralPath $output) { throw 'BUILD_OUTPUT_ALREADY_EXISTS' }

$compilerArgs = @('/nologo', '/target:exe', '/optimize+', '/platform:anycpu',
  ('/out:' + $output), ('/reference:' + $reference), $source)
& $compiler @compilerArgs
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $output -PathType Leaf)) {
  throw 'LANE_A_NATIVE_COMPILE_FAILED'
}
$smoke = & $output '--self-test'
if ($LASTEXITCODE -ne 0 -or @($smoke).Count -ne 1 -or
    @($smoke)[0] -ne 'PP-LANE-A-SCM-HOST-V1:INERT_SELF_TEST_ONLY') {
  throw 'LANE_A_NATIVE_SELF_TEST_FAILED'
}
[pscustomobject]@{
  mode='NATIVE_BUILD_SELF_TEST'
  schemaVersion='PP-LANE-A-SCM-BUILD-V1'
  sourceSha256=$sourceHash
  binarySha256=(Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant()
  result='INERT_SELF_TEST_PASSED'
  signedForProduction=$false
  independentlyAttested=$false
  canInstall=$false
  canAdmit=$false
} | ConvertTo-Json
