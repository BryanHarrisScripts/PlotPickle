[CmdletBinding()]
param(
  [string]$Version = "0.16.0"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$DesktopSetupUrl = "https://github.com/open-pencil/open-pencil/releases/download/v0.16.0/OpenPencil_0.16.0_x64-setup.exe"
$DesktopSetupSha256 = "1b851ac488ce9be437f8b321cadb87ee169f9a1d11968d8e8be87742c9d4df4b"

if ($Version -ne "0.16.0") {
  Write-Host "[WARNING] OpenPencil helper preparation accepts only the reviewed 0.16.0 release." -ForegroundColor Yellow
  exit 10
}

if (-not $env:LOCALAPPDATA) {
  Write-Host "[WARNING] OpenPencil setup skipped because LOCALAPPDATA is unavailable." -ForegroundColor Yellow
  exit 10
}

$npm = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
if (-not $npm) {
  Write-Host "[WARNING] OpenPencil setup skipped because npm.cmd is unavailable." -ForegroundColor Yellow
  exit 10
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Join-Path $repoRoot "designs\openpencil"
$toolRoot = Join-Path $env:LOCALAPPDATA "PlotPickle\tools\openpencil"
$mcpPackageJson = Join-Path $toolRoot "node_modules\@open-pencil\mcp\package.json"
$mcpEntrypoint = Join-Path $toolRoot "node_modules\@open-pencil\mcp\dist\index.mjs"
$cliPackageJson = Join-Path $toolRoot "node_modules\@open-pencil\cli\package.json"
$cliEntrypoint = Join-Path $toolRoot "node_modules\@open-pencil\cli\bin\openpencil.js"

New-Item -ItemType Directory -Force -Path $workspaceRoot | Out-Null
New-Item -ItemType Directory -Force -Path $toolRoot | Out-Null

function Get-PackageVersion([string]$PackageJson) {
  if (-not (Test-Path -LiteralPath $PackageJson -PathType Leaf)) { return "" }
  try {
    $package = Get-Content -LiteralPath $PackageJson -Raw | ConvertFrom-Json
    return [string]$package.version
  } catch {
    return ""
  }
}

function Find-OpenPencilDesktop {
  $candidates = @()
  if ($env:PLOTPICKLE_OPENPENCIL_DESKTOP_EXE) { $candidates += $env:PLOTPICKLE_OPENPENCIL_DESKTOP_EXE }
  $candidates += @(
    (Join-Path $env:LOCALAPPDATA "OpenPencil\OpenPencil.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\OpenPencil\OpenPencil.exe")
  )
  if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles "OpenPencil\OpenPencil.exe") }
  if (${env:ProgramFiles(x86)}) { $candidates += (Join-Path ${env:ProgramFiles(x86)} "OpenPencil\OpenPencil.exe") }
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $candidate }
  }
  return ""
}

$mcpReady = (Get-PackageVersion $mcpPackageJson) -eq $Version -and (Test-Path -LiteralPath $mcpEntrypoint -PathType Leaf)
$cliReady = (Get-PackageVersion $cliPackageJson) -eq $Version -and (Test-Path -LiteralPath $cliEntrypoint -PathType Leaf)

if (-not ($mcpReady -and $cliReady)) {
  Write-Host "[INFO] Preparing reviewed OpenPencil MCP + CLI $Version after PlotPickle core readiness." -ForegroundColor Cyan
  Write-Host "[INFO] Package location: $toolRoot" -ForegroundColor Cyan
  try {
    & $npm.Source install --prefix $toolRoot --no-save --omit=dev --no-audit --no-fund --progress=false --loglevel=warn "@open-pencil/mcp@$Version" "@open-pencil/cli@$Version"
    if ($LASTEXITCODE -ne 0) {
      Write-Host "[WARNING] OpenPencil helper preparation exited with code $LASTEXITCODE. PlotPickle remains available." -ForegroundColor Yellow
      exit 10
    }
  } catch {
    Write-Host "[WARNING] OpenPencil helper preparation failed: $($_.Exception.Message). PlotPickle remains available." -ForegroundColor Yellow
    exit 10
  }
}

$mcpReady = (Get-PackageVersion $mcpPackageJson) -eq $Version -and (Test-Path -LiteralPath $mcpEntrypoint -PathType Leaf)
$cliReady = (Get-PackageVersion $cliPackageJson) -eq $Version -and (Test-Path -LiteralPath $cliEntrypoint -PathType Leaf)
if (-not ($mcpReady -and $cliReady)) {
  Write-Host "[WARNING] OpenPencil helper setup did not produce the reviewed $Version MCP + CLI entrypoints. PlotPickle remains available." -ForegroundColor Yellow
  exit 10
}

# A matching package version alone is not a functional Windows CLI.
# open-pencil/open-pencil#1168 constructs C:\C:\... WASM paths in 0.16.0.
# This bounded shim only repairs the reviewed PlotPickle-managed package;
# it does not mutate global installations or any existing design/PPF file.
$compat = Join-Path $repoRoot "build\openpencil\openpencil-windows-canvaskit-compat.mjs"
$node = Get-Command "node.exe" -ErrorAction SilentlyContinue
if (-not $node -or -not (Test-Path -LiteralPath $compat -PathType Leaf)) {
  Write-Host "[WARNING] OpenPencil Windows CanvasKit compatibility helper is unavailable; GUI conversion readiness is not verified." -ForegroundColor Yellow
  exit 10
}
& $node.Source $compat $toolRoot
if ($LASTEXITCODE -ne 0) {
  Write-Host "[WARNING] OpenPencil 0.16.0 CanvasKit compatibility verification failed; the CLI cannot be marked conversion-ready. PlotPickle remains available." -ForegroundColor Yellow
  exit 10
}

function Get-DesktopVersion([string]$Executable) {
  if (-not $Executable -or -not (Test-Path -LiteralPath $Executable -PathType Leaf)) { return "" }
  try {
    $info = (Get-Item -LiteralPath $Executable -ErrorAction Stop).VersionInfo
    foreach ($candidate in @([string]$info.ProductVersion, [string]$info.FileVersion)) {
      if ($candidate -match '^(\d+\.\d+\.\d+)(?:\..*)?$') { return $Matches[1] }
    }
  } catch {}
  return ""
}

$desktop = Find-OpenPencilDesktop
$desktopOverride = -not [string]::IsNullOrWhiteSpace([string]$env:PLOTPICKLE_OPENPENCIL_DESKTOP_EXE)
$desktopVersion = Get-DesktopVersion $desktop
$needsDesktopUpgrade = -not $desktop -or (-not $desktopOverride -and $desktopVersion -ne $Version)
$desktopIsRunning = @(Get-Process -Name "OpenPencil" -ErrorAction SilentlyContinue).Count -gt 0
if ($needsDesktopUpgrade -and $desktopIsRunning) {
  Write-Host "[WARNING] OpenPencil Desktop is running. A version update is deferred until it is closed; no active design session will be interrupted." -ForegroundColor Yellow
} elseif ($needsDesktopUpgrade -and $env:CI -ne "true") {
  $downloadRoot = Join-Path $toolRoot "downloads"
  $installer = Join-Path $downloadRoot "OpenPencil_0.16.0_x64-setup.exe"
  New-Item -ItemType Directory -Force -Path $downloadRoot | Out-Null
  Write-Host "[INFO] Preparing reviewed OpenPencil Desktop $Version for explicit GUI design sessions." -ForegroundColor Cyan
  Write-Host "[INFO] The desktop app will not be launched during startup." -ForegroundColor Cyan
  try {
    if (-not (Test-Path -LiteralPath $installer -PathType Leaf) -or (Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $DesktopSetupSha256) {
      Invoke-WebRequest $DesktopSetupUrl -OutFile $installer
    }
    if ((Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $DesktopSetupSha256) {
      throw "OpenPencil Desktop installer identity changed."
    }
    $install = Start-Process -FilePath $installer -ArgumentList "/S" -Wait -PassThru
    if ($install.ExitCode -ne 0) { throw "OpenPencil Desktop installer exited with code $($install.ExitCode)." }
    $desktop = Find-OpenPencilDesktop
    $desktopVersion = Get-DesktopVersion $desktop
  } catch {
    Write-Host "[WARNING] OpenPencil Desktop preparation failed: $($_.Exception.Message). Core PlotPickle remains available." -ForegroundColor Yellow
  }
} elseif (-not $desktop) {
  Write-Host "[INFO] CI does not install the optional OpenPencil desktop GUI. Source-contract tests prove the pinned installer boundary." -ForegroundColor Cyan
}

Write-Host "[READY] OpenPencil MCP + CLI $Version are prepared in PlotPickle local app data." -ForegroundColor Green
Write-Host "[READY] Repository design workspace: $workspaceRoot" -ForegroundColor Green
if ($desktop) {
  $desktopVersion = Get-DesktopVersion $desktop
  if ($desktopVersion -eq $Version) {
    Write-Host "[READY] OpenPencil Desktop $desktopVersion : $desktop" -ForegroundColor Green
  } elseif ($desktopOverride) {
    Write-Host "[WARNING] An external OpenPencil Desktop override is configured (detected version: $desktopVersion); PlotPickle will not replace a Human-managed executable." -ForegroundColor Yellow
  } else {
    Write-Host "[WARNING] OpenPencil Desktop remains unverified or older than $Version (detected: $desktopVersion). The MCP/CLI upgrade does not certify GUI compatibility yet." -ForegroundColor Yellow
  }
} else {
  Write-Host "[WARNING] OpenPencil Desktop is not currently detectable; GUI commands will report that truthfully." -ForegroundColor Yellow
}
Write-Host "[INFO] OpenPencil is not launched or connected during startup." -ForegroundColor Cyan
Write-Host "[INFO] Use Settings > Command > OpenPencil open Timeline (or another explicit surface name) to launch a design session." -ForegroundColor Cyan
exit 0
