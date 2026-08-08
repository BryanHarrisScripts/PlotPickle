param(
  [string]$BaseUrl = "http://127.0.0.1:4173",
  [ValidateSet("smoke", "full")]
  [string]$Scope = "smoke"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
if (-not $localAppData) { $localAppData = $env:LOCALAPPDATA }
$artifactRoot = Join-Path $localAppData "PlotPickle\uat\current"
$codexHome = Join-Path $artifactRoot "codex-home"
$pluginData = Join-Path $artifactRoot "agent-plugin"
$reportPath = Join-Path $artifactRoot "acceptance-report.md"
$tracePath = Join-Path $artifactRoot "codex-trace.jsonl"
$logPath = Join-Path $artifactRoot "local-uat.log"

New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null
$env:CODEX_HOME = $codexHome
$env:PLOTPICKLE_AGENT_PLUGIN_DATA = $pluginData
$env:PLOTPICKLE_ACCEPTANCE_URL = $BaseUrl
$env:PLOTPICKLE_ACCEPTANCE_SCOPE = $Scope

function Write-UatStatus([string]$Message) {
  $line = "[$(Get-Date -Format o)] $Message"
  Write-Host $line
  Add-Content -Path $logPath -Value $line
}

function Finish-UatWindow([int]$ExitCode) {
  Write-Host ""
  Write-Host "Report: $reportPath"
  Write-Host "Trace : $tracePath"
  Write-Host "Log   : $logPath"
  Write-Host ""
  if ($ExitCode -eq 0 -and (Test-Path $reportPath)) {
    Write-Host "UAT COMPLETE - review the PASS/WARN/FAIL report above or at the report path."
  } else {
    Write-Host "UAT FAILED OR STOPPED EARLY - review the visible error and log path above."
  }
  Write-Host ""
  Read-Host "Press Enter to close this UAT window"
  exit $ExitCode
}

Set-Content -Path $logPath -Value "[$(Get-Date -Format o)] UAT requested. Scope=$Scope URL=$BaseUrl" -Encoding UTF8
Write-Host "============================================================"
Write-Host "  PlotPickle Human-like UAT Agent"
Write-Host "============================================================"
Write-Host "Scope : $Scope"
Write-Host "Target: $BaseUrl"
Write-Host "State : STARTING"
Write-Host ""

try {
  Write-UatStatus "Waiting for PlotPickle to become reachable..."
  $ready = $false
  $deadline = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $BaseUrl -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.Content -match "PlotPickle") {
        $ready = $true
        break
      }
    } catch {}
    Start-Sleep -Milliseconds 500
  }

  if (-not $ready) {
    throw "PlotPickle did not become ready within 90 seconds."
  }

  Write-UatStatus "PlotPickle is ready. Preparing Agent Plugins / Playwright MCP."
  node "scripts\prepare-agent-plugin-runner.mjs" | Out-Null

  $skill = "tools/agent-plugins/plotpickle-workflow-tester/skills/plotpickle-human-acceptance/SKILL.md"
  $checklist = "tools/agent-plugins/plotpickle-workflow-tester/skills/plotpickle-human-acceptance/references/workflow-checklist.md"
  $contract = "tools/agent-plugins/plotpickle-workflow-tester/skills/plotpickle-human-acceptance/references/visual-continuity-contract.md"

  $prompt = @"
Act as PlotPickle's human acceptance tester. Read and follow $skill, $checklist, and $contract.

Test the rendered application at $BaseUrl using the configured Playwright MCP browser server. Use visible UI controls as a first-time human user would. Do not edit repository files, do not call internal app functions, do not use real credentials, do not spend money, and do not perform external writes.

Acceptance scope: $Scope.
For smoke scope, complete splash/dashboard, project safety, Plan -> Storyboard -> Write -> Edit -> Graphic Novel -> Build context continuity, then verify Feedback can be reached. For full scope, follow the complete checklist through Reports/Export plus available recovery states.

Take screenshots at major screens and on every WARN or FAIL. Judge usability as well as technical function. End with a structured PASS/WARN/FAIL report including reproduction steps, story position, screenshot names and console/runtime errors. Do not fix issues during this run.
"@

  $codex = Get-Command codex -ErrorAction SilentlyContinue
  if ($codex) {
    $command = $codex.Source
    $arguments = @("exec", "--json", "--sandbox", "read-only", "--output-last-message", $reportPath, $prompt)
  } else {
    $npx = Get-Command npx -ErrorAction SilentlyContinue
    if (-not $npx) {
      throw "Neither codex nor npx is available."
    }
    $command = $npx.Source
    $arguments = @("--yes", "@openai/codex", "exec", "--json", "--sandbox", "read-only", "--output-last-message", $reportPath, $prompt)
  }

  Write-UatStatus "RUNNING - Codex UAT agent is starting the Playwright user journey."
  & $command @arguments 2>&1 | Tee-Object -FilePath $tracePath
  $exitCode = $LASTEXITCODE

  if ($exitCode -ne 0) {
    throw "Codex UAT agent exited with code $exitCode."
  }
  if (-not (Test-Path $reportPath)) {
    throw "UAT ended without producing an acceptance report."
  }

  Write-UatStatus "UAT finished and produced an acceptance report."

  if (Get-Command gh -ErrorAction SilentlyContinue) {
    try {
      gh auth status 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) {
        $body = @"
## LOCAL UAT FINAL

Scope: $Scope
Source: Windows Start-PlotPickle.bat testing prompt

$(Get-Content -Raw $reportPath)
"@
        $tempComment = Join-Path $artifactRoot "issue-comment.md"
        $body | Set-Content -Path $tempComment -Encoding UTF8
        gh issue comment 490 --repo "BryanHarrisScripts/PlotPickle" --body-file $tempComment | Out-Null
        Write-UatStatus "Posted UAT report to issue #490."
      }
    } catch {
      Write-UatStatus "GitHub posting skipped: $($_.Exception.Message)"
    }
  }

  Finish-UatWindow 0
} catch {
  Write-UatStatus "FAIL: $($_.Exception.Message)"
  Finish-UatWindow 1
}
