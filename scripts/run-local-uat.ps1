param(
  [string]$BaseUrl = "http://127.0.0.1:4173",
  [ValidateSet("smoke", "full")]
  [string]$Scope = "smoke"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$artifactRoot = Join-Path $repoRoot ".artifacts\local-uat"
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

"[$(Get-Date -Format o)] UAT requested. Scope=$Scope URL=$BaseUrl" | Set-Content -Path $logPath -Encoding UTF8

$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $BaseUrl -TimeoutSec 2
    if ($response.StatusCode -ge 200 -and $response.Content -match "PlotPickle") {
      Add-Content -Path $logPath -Value "[$(Get-Date -Format o)] PlotPickle is ready."
      break
    }
  } catch {}
  Start-Sleep -Milliseconds 500
}

if ((Get-Date) -ge $deadline) {
  Add-Content -Path $logPath -Value "[$(Get-Date -Format o)] FAIL: PlotPickle did not become ready within 90 seconds."
  exit 1
}

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
    Add-Content -Path $logPath -Value "[$(Get-Date -Format o)] FAIL: Neither codex nor npx is available."
    exit 1
  }
  $command = $npx.Source
  $arguments = @("--yes", "@openai/codex", "exec", "--json", "--sandbox", "read-only", "--output-last-message", $reportPath, $prompt)
}

Add-Content -Path $logPath -Value "[$(Get-Date -Format o)] Starting Codex UAT agent."
& $command @arguments 2>&1 | Tee-Object -FilePath $tracePath
$exitCode = $LASTEXITCODE

if (Test-Path $reportPath) {
  Add-Content -Path $logPath -Value "[$(Get-Date -Format o)] UAT finished. Report: $reportPath"
} else {
  Add-Content -Path $logPath -Value "[$(Get-Date -Format o)] FAIL: UAT ended without producing a report."
}

if (Get-Command gh -ErrorAction SilentlyContinue) {
  try {
    gh auth status 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $reportPath)) {
      $body = @"
## LOCAL UAT FINAL

Scope: $Scope
Source: Windows Start-PlotPickle.bat testing prompt

$(Get-Content -Raw $reportPath)
"@
      $tempComment = Join-Path $artifactRoot "issue-comment.md"
      $body | Set-Content -Path $tempComment -Encoding UTF8
      gh issue comment 490 --repo "BryanHarrisScripts/PlotPickle" --body-file $tempComment | Out-Null
      Add-Content -Path $logPath -Value "[$(Get-Date -Format o)] Posted UAT report to issue #490."
    }
  } catch {
    Add-Content -Path $logPath -Value "[$(Get-Date -Format o)] GitHub posting skipped: $($_.Exception.Message)"
  }
}

exit $exitCode
