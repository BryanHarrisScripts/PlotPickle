param(
  [string]$BaseUrl = "http://127.0.0.1:4173"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
$localRoot = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $env:USERPROFILE "AppData\Local" }
$artifactRoot = Join-Path $localRoot "PlotPickle\uat"
$runner = Join-Path $PSScriptRoot "run-creative-writer-uat.mjs"
$reportPath = Join-Path $artifactRoot "acceptance-report.md"
$tracePath = Join-Path $artifactRoot "creative-writer-trace.jsonl"
$logPath = Join-Path $artifactRoot "creative-writer-uat.log"

New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null

function Write-CreativeUatStatus([string]$Message) {
  Write-Host $Message
  Add-Content -Path $logPath -Value "[$(Get-Date -Format o)] $Message" -Encoding UTF8
}

function Show-CreativeUatResult {
  Write-Host ""
  Write-Host "Report: $reportPath"
  Write-Host "Trace:  $tracePath"
  Write-Host "Log:    $logPath"
  Write-Host ""
  if (Test-Path $reportPath) { Write-Host (Get-Content -Raw -Encoding UTF8 $reportPath) }
  Write-Host ""
  Read-Host "Press Enter to close the Creative Writer UAT window"
}

function Stop-CreativeUat([string]$Message, [int]$Code = 1) {
  Write-CreativeUatStatus "FAIL: $Message"
  Show-CreativeUatResult
  exit $Code
}

trap {
  Stop-CreativeUat $_.Exception.Message 1
}

"[$(Get-Date -Format o)] Creative Writer UAT requested. URL=$BaseUrl" | Set-Content -Path $logPath -Encoding UTF8

Write-Host "============================================================"
Write-Host " PlotPickle Creative Writer Acceptance Test"
Write-Host "============================================================"
Write-Host "Scope: creative"
Write-Host "Target: $BaseUrl"
Write-Host "Engine: local Agent Plugin + Playwright MCP"
Write-Host "Cloud AI required: no"
Write-Host "Status: STARTING"
Write-Host "Workspace: $artifactRoot"
Write-Host ""

$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $BaseUrl -TimeoutSec 2
    if ($response.StatusCode -ge 200 -and $response.Content -match "PlotPickle") {
      Write-CreativeUatStatus "PlotPickle is ready."
      break
    }
  } catch {}
  Start-Sleep -Milliseconds 500
}
if ((Get-Date) -ge $deadline) { Stop-CreativeUat "PlotPickle did not become ready within 90 seconds." }
if (-not (Test-Path $runner)) { Stop-CreativeUat "Creative Writer UAT runner is missing: $runner" }

Write-CreativeUatStatus "Status: RUNNING - creating a disposable visual-writing story locally."
$previous = $ErrorActionPreference
try {
  $ErrorActionPreference = "Continue"
  & node $runner --base-url $BaseUrl --artifact-root $artifactRoot
  $exitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previous
}

if (-not (Test-Path $reportPath)) {
  Stop-CreativeUat "Creative Writer UAT ended without producing an acceptance report."
}
if ($exitCode -ne 0) {
  Stop-CreativeUat "Creative Writer UAT reported a blocking product-flow failure. Review the report and trace above." $exitCode
}

Write-CreativeUatStatus "Status: COMPLETE - Creative Writer acceptance report produced."
Show-CreativeUatResult
exit 0
