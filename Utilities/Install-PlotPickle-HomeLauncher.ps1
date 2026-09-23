$ErrorActionPreference = "Stop"
$repoPath = Join-Path $HOME "PlotPickle"
$bootstrap = Join-Path $repoPath "GIT-PlotPickle.ps1"
$launcher = Join-Path $repoPath "PlotPickle.ps1"
$homeLauncher = Join-Path $HOME "PlotPickle.ps1"

if (-not (Test-Path -LiteralPath $bootstrap -PathType Leaf) -or -not (Test-Path -LiteralPath $launcher -PathType Leaf)) {
  throw "Expected GIT-PlotPickle.ps1 and PlotPickle.ps1 in '$repoPath'."
}
if (Test-Path -LiteralPath $homeLauncher -PathType Leaf) {
  $backup = "$homeLauncher.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Copy-Item -LiteralPath $homeLauncher -Destination $backup -ErrorAction Stop
  Write-Host "[BACKUP] Previous home launcher saved to $backup"
}

Copy-Item -LiteralPath $bootstrap -Destination $homeLauncher -Force
Write-Host "[READY] From your home PowerShell prompt, run .\PlotPickle.ps1"
Write-Host "[READY] The launcher changes into '$repoPath', pulls from GitHub, then runs the updated repository launcher."
