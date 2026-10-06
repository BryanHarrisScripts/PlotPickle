[CmdletBinding()]
param(
  [string]$Version = "0.15.1"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$DesktopSetupUrl = "https://github.com/open-pencil/open-pencil/releases/download/v0.15.1/OpenPencil_0.15.1_x64-setup.exe"
$DesktopSetupSha256 = "5e06bc1b58afc80e16c7a5828fced68c3b3aa656b32c20f4fe9c651feab6f5f9"

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

$desktop = Find-OpenPencilDesktop
if (-not $desktop -and $env:CI -ne "true") {
  $downloadRoot = Join-Path $toolRoot "downloads"
  $installer = Join-Path $downloadRoot "OpenPencil_0.15.1_x64-setup.exe"
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
  } catch {
    Write-Host "[WARNING] OpenPencil Desktop preparation failed: $($_.Exception.Message). Core PlotPickle remains available." -ForegroundColor Yellow
  }
} elseif (-not $desktop) {
  Write-Host "[INFO] CI does not install the optional OpenPencil desktop GUI. Source-contract tests prove the pinned installer boundary." -ForegroundColor Cyan
}

Write-Host "[READY] OpenPencil MCP + CLI $Version are prepared in PlotPickle local app data." -ForegroundColor Green
Write-Host "[READY] Repository design workspace: $workspaceRoot" -ForegroundColor Green
if ($desktop) {
  Write-Host "[READY] OpenPencil Desktop: $desktop" -ForegroundColor Green
} else {
  Write-Host "[WARNING] OpenPencil Desktop is not currently detectable; GUI commands will report that truthfully." -ForegroundColor Yellow
}
Write-Host "[INFO] OpenPencil is not launched or connected during startup." -ForegroundColor Cyan
Write-Host "[INFO] Use Settings > Command > OpenPencil open Timeline (or another explicit surface name) to launch a design session." -ForegroundColor Cyan
exit 0
