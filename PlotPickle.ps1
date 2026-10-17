[CmdletBinding()]
param(
  [switch]$WebMCPTesting,
  [switch]$HumanTesting,
  [switch]$ConversationalUAT,
  [switch]$DeveloperSession
)

$ErrorActionPreference = "Stop"
$launcher = Join-Path $PSScriptRoot "Start-PlotPickle.bat"

$explicitModes = @($WebMCPTesting.IsPresent, $HumanTesting.IsPresent, $ConversationalUAT.IsPresent, $DeveloperSession.IsPresent) | Where-Object { $_ }
if ($explicitModes.Count -gt 1) {
  throw "Choose only one startup mode: -WebMCPTesting, -HumanTesting, or -ConversationalUAT, or -DeveloperSession."
}

if (-not (Test-Path -LiteralPath $launcher)) {
  throw "Start-PlotPickle.bat was not found beside PlotPickle.ps1."
}

$mode = if ($WebMCPTesting) {
  "webmcp"
} elseif ($ConversationalUAT) {
  "conversational-uat"
} elseif ($DeveloperSession) {
  "conversational-uat"
} elseif ($HumanTesting) {
  "normal"
} else {
  "normal"
}

if ($mode -eq "webmcp") {
  Write-Host "[READY] WebMCP Testing selected. Starting an isolated test session; your normal Human profile and credentials will not be used."
  & $launcher --webmcp-testing
} elseif ($mode -eq "conversational-uat") {
  Write-Host "[READY] Conversational UAT selected. Opening the governed Human development session with DSDD enabled."
  if ($DeveloperSession) {
    Write-Host "[MODE] Explicit developer session requested; this is not automatic ChatGPT Work/Codex detection."
    & $launcher --developer-session
  } else {
    & $launcher --conversational-uat
  }
} else {
  Write-Host "[READY] Normal PlotPickle selected. Opening the normal product UI; the launcher reports the actual server runtime separately."
  & $launcher --normal
}

exit $LASTEXITCODE
