[CmdletBinding()]
param(
  [string]$BuzzCheckout = "",
  [switch]$NoLaunch
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RequiredSignatureFix = "583af02299e20cbd8603044c7844bc128e4e06cd"
$BuzzRemote = "https://github.com/block/buzz.git"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Require-Command([string]$Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "Required command '$Name' was not found on PATH. Install it first, then rerun this helper."
  }
  return $command.Source
}

function Run-Git([string[]]$Arguments) {
  & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

Require-Command "git" | Out-Null
Require-Command "cargo" | Out-Null

if (-not $BuzzCheckout.Trim()) {
  $localBase = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { $env:TEMP }
  $BuzzCheckout = Join-Path $localBase "PlotPickle\Developer\buzz-upstream"
}

Write-Host ""
Write-Host "PlotPickle #1422 - latest BUZZ CLI verification" -ForegroundColor Cyan
Write-Host "BUZZ source: $BuzzRemote"
Write-Host "Managed checkout: $BuzzCheckout"
Write-Host "Required upstream fix: $RequiredSignatureFix"
Write-Host ""

if (-not (Test-Path $BuzzCheckout)) {
  $parent = Split-Path -Parent $BuzzCheckout
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  Write-Host "Cloning current BUZZ main..." -ForegroundColor Cyan
  Run-Git @("clone", "--filter=blob:none", "--branch", "main", $BuzzRemote, $BuzzCheckout)
}

if (-not (Test-Path (Join-Path $BuzzCheckout ".git"))) {
  throw "The managed BUZZ checkout exists but is not a Git repository: $BuzzCheckout"
}

Push-Location $BuzzCheckout
try {
  $origin = (& git remote get-url origin).Trim()
  if ($LASTEXITCODE -ne 0) { throw "Could not read the BUZZ checkout origin." }
  $normalizedOrigin = $origin.ToLowerInvariant().TrimEnd('/').Replace(".git", "")
  if ($normalizedOrigin -ne "https://github.com/block/buzz") {
    throw "Refusing to update an unexpected repository at $BuzzCheckout. Origin is '$origin'."
  }

  $dirty = (& git status --porcelain)
  if ($LASTEXITCODE -ne 0) { throw "Could not inspect the BUZZ checkout." }
  if ($dirty) {
    throw "The managed BUZZ checkout has local changes. Nothing was overwritten. Clean or remove '$BuzzCheckout' and rerun."
  }

  Write-Host "Updating to current BUZZ main..." -ForegroundColor Cyan
  Run-Git @("fetch", "--prune", "origin", "main")
  Run-Git @("checkout", "--detach", "origin/main")

  $buzzHead = (& git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) { throw "Could not resolve the current BUZZ source commit." }

  & git merge-base --is-ancestor $RequiredSignatureFix HEAD
  if ($LASTEXITCODE -ne 0) {
    throw "Current BUZZ main does not contain the required #6884 signature-preservation fix. Refusing the Story Bridge test."
  }

  Write-Host "BUZZ main: $buzzHead" -ForegroundColor Green
  Write-Host "Confirmed: #6884 signature fix is present." -ForegroundColor Green
  Write-Host "Building only buzz-cli in release mode..." -ForegroundColor Cyan
  & cargo build --locked -p buzz-cli --release
  if ($LASTEXITCODE -ne 0) {
    throw "BUZZ CLI release build failed with exit code $LASTEXITCODE."
  }

  $buzzExe = Join-Path $BuzzCheckout "target\release\buzz.exe"
  if (-not (Test-Path $buzzExe)) {
    throw "BUZZ CLI build completed but buzz.exe was not found at $buzzExe"
  }

  & $buzzExe --help *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "The newly built BUZZ CLI could not start."
  }

  $env:BUZZ_CLI_PATH = $buzzExe
  Write-Host ""
  Write-Host "READY" -ForegroundColor Green
  Write-Host "PlotPickle will use: $buzzExe"
  Write-Host "BUZZ source commit: $buzzHead"
  Write-Host "Installed BUZZ Desktop and BUZZ profile data were not modified."
  Write-Host ""

  if ($NoLaunch) {
    Write-Host "This PowerShell session now has BUZZ_CLI_PATH set to the fixed CLI." -ForegroundColor Yellow
    Write-Host "Launch PlotPickle from this same session to inherit it:"
    Write-Host "  & '$RepoRoot\Start-PlotPickle.bat'"
    return
  }

  $launcher = Join-Path $RepoRoot "Start-PlotPickle.bat"
  if (-not (Test-Path $launcher)) {
    throw "PlotPickle launcher was not found at $launcher"
  }

  Write-Host "Launching PlotPickle with the fixed latest BUZZ CLI..." -ForegroundColor Cyan
  Write-Host "In Settings > BUZZ, refresh diagnostics and run the Afterglow -> Tamsin Story Bridge proof."
  Start-Process -FilePath $launcher -WorkingDirectory $RepoRoot
}
finally {
  Pop-Location
}
