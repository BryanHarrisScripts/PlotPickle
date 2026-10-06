$ErrorActionPreference = 'Stop'
$global:PlotPickle2698Probes = 0
$global:PlotPickle2698ComputeChecks = 0
$env:PLOTPICKLE_STARTUP_CONTRACT = 'plotpickle-startup-test.a+b'
function Invoke-WebRequest {
  param($Uri, $Headers, $TimeoutSec, [switch]$UseBasicParsing)
  $global:PlotPickle2698Probes++
  if ($Uri -ne 'http://127.0.0.1:4173/skin-v1') { throw "Wrong readiness route: $Uri" }
  if ($Headers['X-PlotPickle-Startup-Probe'] -ne 'companion-maintenance') { throw 'Missing classified probe' }
  if ($global:PlotPickle2698Probes -eq 1) { return @{ StatusCode = 200; Content = 'PlotPickle plotpickle-startup-testXab' } }
  if ($global:PlotPickle2698Probes -gt 2) { throw 'Transient failure after readiness' }
  return @{ StatusCode = 200; Content = $env:PLOTPICKLE_STARTUP_CONTRACT }
}
function Invoke-RestMethod {
  param($Method, $Uri, $Headers, $TimeoutSec)
  $global:PlotPickle2698ComputeChecks++
  return @{ ok = $true; readiness = @{ state = 'recommended-ready'; message = 'Synthetic local readiness' } }
}
$missingManager = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString() + '.ps1')
& (Join-Path $PSScriptRoot '../scripts/windows-companion-maintenance-after-ready.ps1') -BaseUrl 'http://127.0.0.1:4173/' -CompanionManager $missingManager -OpenPencilSetup $missingManager -ReadyTimeoutSeconds 5
if ($global:PlotPickle2698Probes -ne 2) { throw "Readiness was probed $global:PlotPickle2698Probes times instead of rejecting the stale marker then retaining success" }
if ($global:PlotPickle2698ComputeChecks -ne 1) { throw 'Deferred work did not start after the completed contract' }
Write-Host 'PASS: canonical readiness observation survives a subsequent transient failure.'
