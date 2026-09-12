[CmdletBinding()]
param(
  [switch]$WebMCPTesting,
  [switch]$HumanTesting,
  [string]$RepositoryPath = (Join-Path $HOME "PlotPickle")
)

$ErrorActionPreference = "Stop"

if ($WebMCPTesting -and $HumanTesting) {
  throw "Choose either -WebMCPTesting or -HumanTesting, not both."
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
Write-Host "[UPDATE] Pulling the latest PlotPickle from GitHub..."
& $git.Source pull --ff-only
if ($LASTEXITCODE -ne 0) {
  throw "git pull --ff-only failed with exit code $LASTEXITCODE. PlotPickle was not started so the repository can be repaired safely."
}

$repoLauncher = Join-Path $repoPath "PlotPickle.ps1"
if (-not (Test-Path -LiteralPath $repoLauncher -PathType Leaf)) {
  throw "The freshly updated repository does not contain PlotPickle.ps1 at '$repoLauncher'."
}

Write-Host "[READY] Repository is current. Starting the freshly pulled PlotPickle launcher..."

$launchArgs = @{}
if ($WebMCPTesting) {
  $launchArgs.WebMCPTesting = $true
} elseif ($HumanTesting) {
  $launchArgs.HumanTesting = $true
}

& $repoLauncher @launchArgs
exit $LASTEXITCODE
