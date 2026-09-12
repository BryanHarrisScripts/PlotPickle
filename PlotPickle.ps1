[CmdletBinding()]
param(
  [switch]$WebMCPTesting,
  [switch]$HumanTesting
)

$ErrorActionPreference = "Stop"
$launcher = Join-Path $PSScriptRoot "Start-PlotPickle.bat"

if ($WebMCPTesting -and $HumanTesting) {
  throw "Choose either -WebMCPTesting or -HumanTesting, not both."
}

if (-not (Test-Path -LiteralPath $launcher)) {
  throw "Start-PlotPickle.bat was not found beside PlotPickle.ps1."
}

$mode = if ($WebMCPTesting) {
  "webmcp"
} elseif ($HumanTesting) {
  "human"
} else {
  Write-Host ""
  Write-Host "[TESTING MODE]"
  Write-Host "Choose how PlotPickle should start."
  Write-Host ""
  Write-Host "Y = WebMCP Testing - start an isolated test session and automatically check the interface, navigation, surfaces and Skin V1."
  Write-Host "N = Open PlotPickle normally - use your regular app session for hands-on Human testing. No autonomous WebMCP run is started."
  Write-Host ""

  do {
    $answer = (Read-Host "Run autonomous WebMCP Testing? [Y/N]").Trim()
  } until ($answer -match '^[YyNn]$')

  if ($answer -match '^[Yy]$') { "webmcp" } else { "human" }
}

if ($mode -eq "webmcp") {
  Write-Host "[READY] WebMCP Testing selected. Starting an isolated test session; your normal Human profile and credentials will not be used."
  & $launcher --webmcp-testing
} else {
  Write-Host "[READY] Normal PlotPickle selected. Opening your regular app session for hands-on Human testing."
  & $launcher --human-testing
}

exit $LASTEXITCODE
