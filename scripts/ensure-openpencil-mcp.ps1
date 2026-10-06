[CmdletBinding()]
param(
  [string]$Version = "0.15.1"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $env:LOCALAPPDATA) {
  Write-Host "[WARNING] OpenPencil MCP setup skipped because LOCALAPPDATA is unavailable." -ForegroundColor Yellow
  exit 10
}

$npm = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
if (-not $npm) {
  Write-Host "[WARNING] OpenPencil MCP setup skipped because npm.cmd is unavailable." -ForegroundColor Yellow
  exit 10
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Join-Path $repoRoot "designs\openpencil"
$toolRoot = Join-Path $env:LOCALAPPDATA "PlotPickle\tools\openpencil"
$packageJson = Join-Path $toolRoot "node_modules\@open-pencil\mcp\package.json"
$entrypoint = Join-Path $toolRoot "node_modules\@open-pencil\mcp\dist\index.mjs"

New-Item -ItemType Directory -Force -Path $workspaceRoot | Out-Null
New-Item -ItemType Directory -Force -Path $toolRoot | Out-Null

function Get-InstalledVersion {
  if (-not (Test-Path -LiteralPath $packageJson -PathType Leaf)) { return "" }
  try {
    $package = Get-Content -LiteralPath $packageJson -Raw | ConvertFrom-Json
    return [string]$package.version
  } catch {
    return ""
  }
}

$installedVersion = Get-InstalledVersion
if ($installedVersion -eq $Version -and (Test-Path -LiteralPath $entrypoint -PathType Leaf)) {
  Write-Host "[READY] OpenPencil MCP $Version is prepared in PlotPickle local app data." -ForegroundColor Green
  Write-Host "[READY] Repository design workspace: $workspaceRoot" -ForegroundColor Green
  Write-Host "[INFO] OpenPencil is not launched or connected during startup." -ForegroundColor Cyan
  exit 0
}

Write-Host "[INFO] Preparing reviewed OpenPencil MCP $Version after PlotPickle core readiness." -ForegroundColor Cyan
Write-Host "[INFO] Package location: $toolRoot" -ForegroundColor Cyan
Write-Host "[INFO] Repository design workspace: $workspaceRoot" -ForegroundColor Cyan
Write-Host "[INFO] This does not launch OpenPencil or connect port 7600." -ForegroundColor Cyan

try {
  & $npm.Source install --prefix $toolRoot --no-save --omit=dev --no-audit --no-fund --progress=false --loglevel=warn "@open-pencil/mcp@$Version"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] OpenPencil MCP package preparation exited with code $LASTEXITCODE. PlotPickle remains available." -ForegroundColor Yellow
    exit 10
  }
} catch {
  Write-Host "[WARNING] OpenPencil MCP package preparation failed: $($_.Exception.Message). PlotPickle remains available." -ForegroundColor Yellow
  exit 10
}

$installedVersion = Get-InstalledVersion
if ($installedVersion -ne $Version -or -not (Test-Path -LiteralPath $entrypoint -PathType Leaf)) {
  Write-Host "[WARNING] OpenPencil MCP setup did not produce the reviewed $Version entrypoint. PlotPickle remains available." -ForegroundColor Yellow
  exit 10
}

Write-Host "[READY] OpenPencil MCP $Version is prepared in PlotPickle local app data." -ForegroundColor Green
Write-Host "[READY] Repository design workspace: $workspaceRoot" -ForegroundColor Green
Write-Host "[INFO] Use Settings > Command > Connect OpenPencil when you want to launch the local MCP server." -ForegroundColor Cyan
exit 0
