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
$artifactRoot = Join-Path $localRoot "PlotPickle\uat\learn"
$reportPath = Join-Path $artifactRoot "learn-acceptance-report.md"
$logPath = Join-Path $artifactRoot "learn-uat.log"

New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null

$findings = New-Object System.Collections.Generic.List[object]

function Add-Finding([string]$Status, [string]$Check, [string]$Detail) {
  $findings.Add([pscustomobject]@{ Status = $Status; Check = $Check; Detail = $Detail })
  Write-Host "[$Status] $Check - $Detail"
  Add-Content -Path $logPath -Value "[$(Get-Date -Format o)] [$Status] $Check - $Detail" -Encoding UTF8
}

function Wait-ForPlotPickle {
  $deadline = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $BaseUrl -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.Content -match "PlotPickle") { return $response }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  throw "PlotPickle did not become ready within 90 seconds."
}

function Write-Report {
  $failCount = @($findings | Where-Object Status -eq "FAIL").Count
  $warnCount = @($findings | Where-Object Status -eq "WARN").Count
  $overall = if ($failCount -gt 0) { "FAIL" } elseif ($warnCount -gt 0) { "WARN" } else { "PASS" }
  $lines = @(
    "# PlotPickle LEARN UAT",
    "",
    "Overall: $overall",
    "Run: $(Get-Date -Format o)",
    "Target: $BaseUrl",
    "",
    "## Findings",
    ""
  )
  foreach ($finding in $findings) {
    $lines += "- $($finding.Status) - $($finding.Check): $($finding.Detail)"
  }
  $lines += ""
  $lines += "## Acceptance scope"
  $lines += ""
  $lines += "LEARN startup, rendered LEARN shell, curriculum foundation, Mastra readiness, writing-engine recovery state, and local GUIDE readiness."
  $lines | Set-Content -Path $reportPath -Encoding UTF8
  return $overall
}

"[$(Get-Date -Format o)] LEARN UAT requested. URL=$BaseUrl" | Set-Content -Path $logPath -Encoding UTF8

Write-Host "============================================================"
Write-Host " PlotPickle LEARN UAT"
Write-Host "============================================================"
Write-Host "Purpose: Validate the rebuilt LEARN-first experience and local Curriculum Guide path."
Write-Host "Target: $BaseUrl"
Write-Host "Report: $reportPath"
Write-Host ""

try {
  $home = Wait-ForPlotPickle
  Add-Finding "PASS" "Application startup" "PlotPickle is reachable locally."

  if ($home.Content -match "LEARN|Learn") {
    Add-Finding "PASS" "LEARN entry" "The rendered application exposes LEARN content."
  } else {
    Add-Finding "FAIL" "LEARN entry" "The rendered application did not expose a discoverable LEARN entry."
  }

  $previous = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & node --test tests/foundation-architecture.test.mjs 2>&1 | Tee-Object -FilePath $logPath -Append
    $foundationExit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  if ($foundationExit -eq 0) {
    Add-Finding "PASS" "LEARN foundation" "Canonical curriculum and modular foundation contracts passed."
  } else {
    Add-Finding "FAIL" "LEARN foundation" "Foundation architecture tests failed. Review the log."
  }

  try {
    $status = Invoke-RestMethod -Uri "$BaseUrl/api/writing-assistant/status" -TimeoutSec 4
    if ($status.mastra.ready) {
      Add-Finding "PASS" "Mastra readiness" "The embedded Mastra runtime initialized and reports $($status.mastra.agents.Count) agents."
    } else {
      Add-Finding "FAIL" "Mastra readiness" "The Writing Assistant endpoint responded, but Mastra is not ready."
    }

    if ($status.activeProvider -eq "disabled") {
      Add-Finding "WARN" "Curriculum Guide engine" "No writing engine is active. LEARN must present the Settings/recovery path instead of hanging."
    } elseif ($status.activeProvider -eq "ollama" -and -not $status.ollama.reachable) {
      Add-Finding "WARN" "Ollama recovery" "Ollama is selected but unreachable. LEARN should preserve the question and offer recovery."
    } else {
      Add-Finding "PASS" "Curriculum Guide engine" "Writing Assistant provider '$($status.activeProvider)' is available to LEARN."
    }
  } catch {
    Add-Finding "FAIL" "Writing Assistant status" "LEARN could not read the local Writing Assistant/Mastra status endpoint: $($_.Exception.Message)"
  }
} catch {
  Add-Finding "FAIL" "Application startup" $_.Exception.Message
}

$overall = Write-Report
Write-Host ""
Write-Host "============================================================"
Write-Host " LEARN UAT RESULT: $overall"
Write-Host "============================================================"
Write-Host "Report: $reportPath"
Write-Host "Log:    $logPath"
Write-Host ""
if (Test-Path $reportPath) { Write-Host (Get-Content -Raw -Encoding UTF8 $reportPath) }
Write-Host ""
Read-Host "Press Enter to close the LEARN UAT window"

if ($overall -eq "FAIL") { exit 1 }
exit 0
