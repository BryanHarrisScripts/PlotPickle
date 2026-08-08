param(
  [string]$BaseUrl = "http://127.0.0.1:4173"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
$localRoot = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $env:USERPROFILE "AppData\Local" }
$artifactRoot = Join-Path $localRoot "PlotPickle\uat"
$runner = Join-Path $PSScriptRoot "run-creative-writer-uat.mjs"
$reportPath = Join-Path $artifactRoot "acceptance-report.md"
$tracePath = Join-Path $artifactRoot "creative-writer-trace.jsonl"
$logPath = Join-Path $artifactRoot "creative-writer-uat.log"

New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null
"[$(Get-Date -Format o)] Creative Writer UAT requested. URL=$BaseUrl" | Set-Content -Path $logPath -Encoding UTF8

Write-Host "============================================================"
Write-Host " PlotPickle Creative Writer Acceptance Test"
Write-Host "============================================================"
Write-Host "Scope: creative"
Write-Host "Target: $BaseUrl"
Write-Host "Engine: local Agent Plugin + Playwright MCP"
Write-Host "Cloud AI required: no"
Write-Host "Status: STARTING"
Write-Host ""

$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $BaseUrl -TimeoutSec 2
    if ($response.StatusCode -ge 200 -and $response.Content -match "PlotPickle") { break }
  } catch {}
  Start-Sleep -Milliseconds 500
}
if ((Get-Date) -ge $deadline) { throw "PlotPickle did not become ready within 90 seconds." }
if (-not (Test-Path $runner)) { throw "Creative Writer UAT runner is missing: $runner" }

Write-Host "Status: RUNNING - creating a disposable visual-writing story locally."
$previous = $ErrorActionPreference
try {
  $ErrorActionPreference = "Continue"
  & node $runner --base-url $BaseUrl --artifact-root $artifactRoot
  $exitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previous
}

Write-Host ""
Write-Host "Report: $reportPath"
Write-Host "Trace:  $tracePath"
Write-Host "Log:    $logPath"
Write-Host ""
if (Test-Path $reportPath) { Write-Host (Get-Content -Raw $reportPath) }
if ($exitCode -ne 0) { throw "Creative Writer UAT reported a blocking product-flow failure." }
Write-Host "Status: COMPLETE"
