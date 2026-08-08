param(
  [string]$BaseUrl = "http://127.0.0.1:4173",
  [ValidateSet("smoke", "full")]
  [string]$Scope = "smoke",
  [ValidateSet("local", "codex")]
  [string]$Engine = "local"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$localRoot = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $env:USERPROFILE "AppData\Local" }
$artifactRoot = Join-Path $localRoot "PlotPickle\uat"
$localRunner = Join-Path $PSScriptRoot "run-local-browser-uat.mjs"
$codexHome = Join-Path $artifactRoot "codex-home"
$pluginData = Join-Path $artifactRoot "agent-plugin"
$reportPath = Join-Path $artifactRoot "acceptance-report.md"
$tracePath = if ($Engine -eq "codex") { Join-Path $artifactRoot "codex-trace.jsonl" } else { Join-Path $artifactRoot "local-browser-trace.jsonl" }
$logPath = Join-Path $artifactRoot "local-uat.log"
$tempAuthPath = Join-Path $codexHome "auth.json"
$originalCodexHome = $env:CODEX_HOME
$normalCodexHome = if ($originalCodexHome) { $originalCodexHome } else { Join-Path $env:USERPROFILE ".codex" }
$normalAuthPath = Join-Path $normalCodexHome "auth.json"
$originalApiKey = $env:OPENAI_API_KEY
$copiedAuth = $false

New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null

function Write-UatStatus([string]$Message) {
  Write-Host $Message
  Add-Content -Path $logPath -Value "[$(Get-Date -Format o)] $Message"
}

function Clear-UatAuth {
  if ($script:copiedAuth -and (Test-Path $script:tempAuthPath)) {
    Remove-Item -Force $script:tempAuthPath -ErrorAction SilentlyContinue
  }
  if ($null -eq $script:originalApiKey) {
    Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
  } else {
    $env:OPENAI_API_KEY = $script:originalApiKey
  }
  if ($null -eq $script:originalCodexHome) {
    Remove-Item Env:CODEX_HOME -ErrorAction SilentlyContinue
  } else {
    $env:CODEX_HOME = $script:originalCodexHome
  }
}

function Stop-Uat([string]$Message, [int]$Code = 1) {
  Write-UatStatus "FAIL: $Message"
  Clear-UatAuth
  Write-Host ""
  Write-Host "Log:    $logPath"
  Write-Host "Trace:  $tracePath"
  Write-Host "Report: $reportPath"
  Write-Host ""
  Read-Host "Press Enter to close the UAT window"
  exit $Code
}

function Invoke-NativeCapture([string]$Command, [object[]]$Arguments) {
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $output = (& $Command @Arguments 2>&1 | ForEach-Object { $_.ToString() } | Out-String).Trim()
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  return [pscustomobject]@{
    Output = $output
    ExitCode = $exitCode
  }
}

function Show-UatResult {
  Write-Host ""
  Write-Host "Report: $reportPath"
  Write-Host "Trace:  $tracePath"
  Write-Host "Log:    $logPath"
  Write-Host ""
  if (Test-Path $reportPath) { Write-Host (Get-Content -Raw $reportPath) }
  Write-Host ""
  Read-Host "Press Enter to close the UAT window"
}

function Post-UatResult {
  if (-not (Test-Path $reportPath)) { return }
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { return }
  try {
    gh auth status 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { return }
    $body = @"
## LOCAL UAT FINAL

Scope: $Scope
Engine: $Engine
Source: Windows Start-PlotPickle.bat testing prompt

$(Get-Content -Raw $reportPath)
"@
    $tempComment = Join-Path $artifactRoot "issue-comment.md"
    $body | Set-Content -Path $tempComment -Encoding UTF8
    gh issue comment 490 --repo "BryanHarrisScripts/PlotPickle" --body-file $tempComment | Out-Null
    Write-UatStatus "Posted UAT report to issue #490."
  } catch {
    Write-UatStatus "GitHub posting skipped: $($_.Exception.Message)"
  }
}

trap {
  Stop-Uat $_.Exception.Message 1
}

"[$(Get-Date -Format o)] UAT requested. Engine=$Engine Scope=$Scope URL=$BaseUrl" | Set-Content -Path $logPath -Encoding UTF8
Write-Host "============================================================"
Write-Host " PlotPickle Human Acceptance Test"
Write-Host "============================================================"
Write-Host "Scope: $Scope"
Write-Host "Engine: $Engine"
Write-Host "Target: $BaseUrl"
Write-Host "Status: STARTING"
Write-Host "Workspace: $artifactRoot"
Write-Host ""

$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $BaseUrl -TimeoutSec 2
    if ($response.StatusCode -ge 200 -and $response.Content -match "PlotPickle") {
      Write-UatStatus "PlotPickle is ready."
      break
    }
  } catch {}
  Start-Sleep -Milliseconds 500
}

if ((Get-Date) -ge $deadline) {
  Stop-Uat "PlotPickle did not become ready within 90 seconds."
}

if ($Engine -eq "local") {
  if (-not (Test-Path $localRunner)) {
    Stop-Uat "The deterministic local browser UAT runner is missing: $localRunner"
  }

  Write-UatStatus "Engine: LOCAL - Agent Plugin + Playwright MCP. No ChatGPT/Codex quota is required."
  Write-UatStatus "Ollama review is optional and will be skipped if no suitable installed local model is available."
  Write-UatStatus "Status: RUNNING - local deterministic UAT started."

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & node $localRunner --base-url $BaseUrl --scope $Scope --artifact-root $artifactRoot
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if (-not (Test-Path $reportPath)) {
    Stop-Uat "Local UAT ended without producing an acceptance report."
  }
  if ($exitCode -ne 0) {
    Post-UatResult
    Stop-Uat "Local deterministic UAT reported a blocking failure. Review the report and trace above." $exitCode
  }

  Write-UatStatus "Status: COMPLETE - local acceptance report produced."
  Post-UatResult
  Show-UatResult
  exit 0
}

Write-UatStatus "Engine: CODEX - optional exploratory UAT. ChatGPT/Codex usage limits apply."

$codex = Get-Command codex -ErrorAction SilentlyContinue
if (-not $codex) {
  $npx = Get-Command npx -ErrorAction SilentlyContinue
  if (-not $npx) {
    Stop-Uat "Neither codex nor npx is available. Install Codex CLI and sign in with ChatGPT."
  }
  Write-UatStatus "Codex CLI is not installed globally. Preparing the current Codex CLI with npx for authentication check."
  $codexCommand = $npx.Source
  $codexPrefix = @("--yes", "@openai/codex")
} else {
  $codexCommand = $codex.Source
  $codexPrefix = @()
}

$env:CODEX_HOME = $normalCodexHome
$authResult = Invoke-NativeCapture -Command $codexCommand -Arguments (@($codexPrefix) + @("login", "status"))
$authOutput = $authResult.Output
$authExitCode = $authResult.ExitCode
Write-UatStatus "Codex authentication check: $authOutput"

if ($authExitCode -ne 0 -or $authOutput -match "Not logged in") {
  Stop-Uat "Codex is not signed in. Run 'codex --login' once and choose Sign in with ChatGPT, then run the Codex engine again."
}

if ($authOutput -match "Logged in using ChatGPT") {
  if (-not (Test-Path $normalAuthPath)) {
    Stop-Uat "Codex reports a ChatGPT login, but its reusable local auth file was not found at $normalAuthPath. Run 'codex --login' once to refresh the local login."
  }
  New-Item -ItemType Directory -Force -Path $codexHome | Out-Null
  Copy-Item -Force $normalAuthPath $tempAuthPath
  $copiedAuth = $true
  Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
  Write-UatStatus "Authentication: ChatGPT login detected and isolated for this UAT run."
} elseif ($authOutput -match "Logged in using an API key") {
  if ($env:PLOTPICKLE_UAT_ALLOW_API_KEY -ne "1") {
    Stop-Uat "Codex is currently using API-key authentication. PlotPickle UAT will not use billable API-key auth by default. Run 'codex logout' followed by 'codex --login' and choose Sign in with ChatGPT."
  }
  Write-UatStatus "Authentication: API-key mode explicitly allowed by PLOTPICKLE_UAT_ALLOW_API_KEY=1."
} else {
  Stop-Uat "Codex authentication mode was not recognized: $authOutput"
}

$env:CODEX_HOME = $codexHome
$env:PLOTPICKLE_AGENT_PLUGIN_DATA = $pluginData
$env:PLOTPICKLE_ACCEPTANCE_URL = $BaseUrl
$env:PLOTPICKLE_ACCEPTANCE_SCOPE = $Scope

Write-UatStatus "Preparing Agent Plugins and Playwright MCP."
node "scripts\prepare-agent-plugin-runner.mjs" | Out-Null
if ($LASTEXITCODE -ne 0) {
  Stop-Uat "Agent Plugins runner preparation failed with exit code $LASTEXITCODE."
}

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

if ($codex) {
  $command = $codex.Source
  $arguments = @("exec", "--json", "--sandbox", "read-only", "--output-last-message", $reportPath, $prompt)
} else {
  $command = $codexCommand
  $arguments = @("--yes", "@openai/codex", "exec", "--json", "--sandbox", "read-only", "--output-last-message", $reportPath, $prompt)
}

Write-UatStatus "Status: RUNNING - Codex exploratory UAT agent started."
$previousErrorActionPreference = $ErrorActionPreference
try {
  $ErrorActionPreference = "Continue"
  & $command @arguments 2>&1 | ForEach-Object { $_.ToString() } | Tee-Object -FilePath $tracePath
  $exitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousErrorActionPreference
}

if ($exitCode -ne 0) {
  Stop-Uat "Codex exploratory UAT agent exited with code $exitCode. Review the trace above and at $tracePath." $exitCode
}

if (-not (Test-Path $reportPath)) {
  Stop-Uat "Codex UAT ended without producing an acceptance report."
}

Write-UatStatus "Status: COMPLETE - Codex exploratory acceptance report produced."
Post-UatResult
Clear-UatAuth
Show-UatResult
exit 0
