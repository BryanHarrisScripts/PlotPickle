param(
  [switch]$VerifyOnly
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Write-Step([string]$Message) {
  Write-Host "[PlotPickle Dev Stack] $Message" -ForegroundColor Cyan
}

function Require-Command([string]$Name, [string]$Help) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "$Name was not found. $Help"
  }
  return $command
}

function Find-GitBash {
  $git = Get-Command git -ErrorAction SilentlyContinue
  $candidates = @()

  if ($git -and $git.Source) {
    $gitRoot = Split-Path -Parent (Split-Path -Parent $git.Source)
    $candidates += (Join-Path $gitRoot "bin\bash.exe")
    $candidates += (Join-Path $gitRoot "usr\bin\bash.exe")
  }

  $candidates += @(
    "C:\Program Files\Git\bin\bash.exe",
    "C:\Program Files\Git\usr\bin\bash.exe",
    "C:\Program Files (x86)\Git\bin\bash.exe"
  )

  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    if (Test-Path $candidate) { return $candidate }
  }

  $bash = Get-Command bash -ErrorAction SilentlyContinue
  if ($bash -and $bash.Source -and $bash.Source -notmatch "(?i)\\Windows\\System32\\bash\.exe$") {
    return $bash.Source
  }
  return $null
}

Write-Step "Checking Windows-native prerequisites"
Require-Command node "Install the Node version required by package.json." | Out-Null
Require-Command npm "Install npm with Node.js." | Out-Null
Require-Command git "Install Git for Windows." | Out-Null

$bashPath = Find-GitBash
if (-not $bashPath) {
  throw "Git Bash was not found. PlotPickle's Windows-native Pi setup does not use the C:\Windows\System32\bash.exe WSL launcher. Install Git for Windows with Git Bash, then rerun this script."
}
Write-Host "Git Bash ........................... $bashPath"

if (-not $VerifyOnly) {
  Write-Step "Installing Cline CLI"
  # npm 11's global allow-scripts warning points to approve-scripts even though
  # approve-scripts cannot manage global installs. Cline's published CLI binary
  # is delivered through platform optional dependencies, and PlotPickle verifies
  # the installed command immediately below, so do not execute unreviewed global
  # lifecycle scripts merely to silence that warning.
  & npm install -g cline --ignore-scripts
  if ($LASTEXITCODE -ne 0) { throw "Cline installation failed with exit code $LASTEXITCODE." }

  Write-Step "Installing Pi coding agent"
  & npm install -g --ignore-scripts @earendil-works/pi-coding-agent
  if ($LASTEXITCODE -ne 0) { throw "Pi installation failed with exit code $LASTEXITCODE." }

  Write-Step "Installing pinned Pi project extensions"
  $packages = @(
    "npm:@dietrichgebert/ponytail@4.8.4",
    "npm:pi-subagents@0.35.1",
    "npm:@ff-labs/pi-fff@0.10.1",
    "npm:pi-mcp-adapter@2.26.0"
  )
  foreach ($package in $packages) {
    & pi install $package -l
    if ($LASTEXITCODE -ne 0) { throw "Pi package install failed for $package with exit code $LASTEXITCODE." }
  }
}

Write-Step "Verifying developer agents"
$pi = Get-Command pi -ErrorAction SilentlyContinue
$cline = Get-Command cline -ErrorAction SilentlyContinue

if (-not $pi) { throw "Pi CLI is not available on PATH." }
if (-not $cline) { throw "Cline CLI is not available on PATH." }

$piVersion = (& pi --version 2>&1 | Out-String).Trim()
$clineVersion = (& cline version 2>&1 | Out-String).Trim()
Write-Host "Pi ................................ $piVersion"
Write-Host "Cline ............................. $clineVersion"

Write-Step "Verifying shared PlotPickle MCP server"
& node scripts/developer-agent-mcp.mjs --self-test
if ($LASTEXITCODE -ne 0) { throw "PlotPickle developer MCP self-test failed." }

Write-Step "Verifying Agent Bench catalog"
& node scripts/run-agent-bench.mjs --list
if ($LASTEXITCODE -ne 0) { throw "PlotPickle Agent Bench catalog validation failed." }

Write-Host ""
Write-Host "PlotPickle developer-agent stack READY" -ForegroundColor Green
Write-Host "Shared rules ....................... AGENTS.md"
Write-Host "Shared MCP ......................... .mcp.json / .cline/mcp.json"
Write-Host "Primary candidates ................. Pi / Cline"
Write-Host "Excluded required tools ............ OpenHands / Herdr"
Write-Host "Provider credentials ............... unchanged; configure locally in Pi/Cline"
Write-Host "Benchmark .......................... node scripts/run-agent-bench.mjs --list"
