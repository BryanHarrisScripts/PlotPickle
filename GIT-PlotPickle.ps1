[CmdletBinding()]
param(
  [switch]$WebMCPTesting,
  [switch]$HumanTesting,
  [switch]$ConversationalUAT,
  [switch]$DeveloperSession,
  [string]$RepositoryPath = (Join-Path $HOME "PlotPickle")
)

$ErrorActionPreference = "Stop"

$explicitModes = @($WebMCPTesting.IsPresent, $HumanTesting.IsPresent, $ConversationalUAT.IsPresent, $DeveloperSession.IsPresent) | Where-Object { $_ }
if ($explicitModes.Count -gt 1) {
  throw "Choose only one startup mode: -WebMCPTesting, -HumanTesting, -ConversationalUAT, or -DeveloperSession."
}

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
  throw "Git was not found on PATH. Install Git for Windows before starting PlotPickle."
}

$repoPath = [System.IO.Path]::GetFullPath($RepositoryPath)
$gitDirectory = Join-Path $repoPath ".git"

if (-not (Test-Path -LiteralPath $repoPath -PathType Container)) {
  throw "PlotPickle repository was not found at '$repoPath'. Expected the repository at `$HOME\PlotPickle by default."
}

if (-not (Test-Path -LiteralPath $gitDirectory -PathType Container)) {
  throw "'$repoPath' is not a PlotPickle Git checkout because '.git' was not found."
}

Set-Location -LiteralPath $repoPath

Write-Host ""
Write-Host "[PLOTPICKLE] Repository: $repoPath"
$factoryGuard = Join-Path $repoPath 'scripts\engineering-team\windows\launcher\factory-startup-guard.mjs'
if (-not (Test-Path -LiteralPath $factoryGuard -PathType Leaf)) {
  throw "Factory-safe startup guard missing. Refusing an unprotected source update."
}
$node = Get-Command node.exe -ErrorAction Stop
& $node.Source $factoryGuard --update-check
$guardExit = $LASTEXITCODE
if ($guardExit -eq 0) {
  Write-Host "[UPDATE] Factory is absent. Pulling the latest PlotPickle from GitHub..."
  & $git.Source pull --ff-only
  if ($LASTEXITCODE -ne 0) {
    throw "git pull --ff-only failed. Existing processes and source are preserved."
  }
} elseif ($guardExit -eq 10) {
  Write-Host "[FACTORY PROTECTED] Source update deferred. Starting the current PlotPickle build without changing Factory-owned code or runtime."
} else {
  throw "Factory status could not be verified. No source update or startup was attempted."
}

$repoLauncher = Join-Path $repoPath "PlotPickle.ps1"
if (-not (Test-Path -LiteralPath $repoLauncher -PathType Leaf)) {
  throw "The freshly updated repository does not contain PlotPickle.ps1 at '$repoLauncher'."
}

Write-Host "[READY] Repository is current. Starting the freshly pulled PlotPickle launcher..."

$launchArgs = @{}
if ($WebMCPTesting) {
  $launchArgs.WebMCPTesting = $true
} elseif ($ConversationalUAT) {
  $launchArgs.ConversationalUAT = $true
} elseif ($DeveloperSession) {
  $launchArgs.DeveloperSession = $true
} elseif ($HumanTesting) {
  # Legacy compatibility alias: HumanTesting now means normal/pristine product mode.
  $launchArgs.HumanTesting = $true
}

& $repoLauncher @launchArgs
exit $LASTEXITCODE
