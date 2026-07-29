param(
  [Parameter(Mandatory = $true)]
  [string]$InstallRoot,

  [string]$ZipPath = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"
$downloadUrl = "https://github.com/BryanHarrisScripts/PlotPickle/archive/refs/heads/main.zip"
$preservedDirectories = @("node_modules", ".git", ".next", "dist", ".wrangler", ".plotpickle", "projects", "exports", "user-data", "backups")
$preservedRootFiles = @(".env", ".env.local", ".env.development.local", ".env.production.local")

function Write-Heading([string]$Text) {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Cyan
  Write-Host "  $Text" -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor Cyan
  Write-Host ""
}

function Read-Manifest([string]$Root) {
  $manifestPath = Join-Path $Root "package.json"
  if (-not (Test-Path -LiteralPath $manifestPath)) { return $null }
  try {
    return Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Select-UpdateZip {
  Add-Type -AssemblyName System.Windows.Forms
  $dialog = New-Object System.Windows.Forms.OpenFileDialog
  $dialog.Title = "Choose the latest PlotPickle ZIP"
  $dialog.Filter = "PlotPickle ZIP (*.zip)|*.zip"
  $dialog.CheckFileExists = $true
  $downloads = Join-Path $env:USERPROFILE "Downloads"
  if (Test-Path -LiteralPath $downloads) { $dialog.InitialDirectory = $downloads }
  $result = $dialog.ShowDialog()
  if ($result -ne [System.Windows.Forms.DialogResult]::OK) { return "" }
  return $dialog.FileName
}

function Find-SourceRoot([string]$ExtractRoot) {
  if ((Test-Path -LiteralPath (Join-Path $ExtractRoot "package.json")) -and
      (Test-Path -LiteralPath (Join-Path $ExtractRoot "Start-PlotPickle.bat"))) {
    return $ExtractRoot
  }

  $candidate = Get-ChildItem -LiteralPath $ExtractRoot -Directory |
    Where-Object {
      (Test-Path -LiteralPath (Join-Path $_.FullName "package.json")) -and
      (Test-Path -LiteralPath (Join-Path $_.FullName "Start-PlotPickle.bat"))
    } |
    Select-Object -First 1

  if (-not $candidate) { throw "The selected ZIP does not contain a valid PlotPickle package." }
  return $candidate.FullName
}

function Assert-ServerStopped {
  $listener = $null
  try {
    $listener = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue
  } catch {
    # Older Windows editions may not expose Get-NetTCPConnection. Locked files are checked during replacement.
  }
  if ($listener) {
    throw "PlotPickle is still running. Close its local-server window, then run the updater again."
  }
}

$InstallRoot = [System.IO.Path]::GetFullPath($InstallRoot)
$currentManifest = Read-Manifest $InstallRoot
if (-not $currentManifest -or $currentManifest.name -ne "plotpickle") {
  throw "This updater must be run from an existing PlotPickle folder."
}

Write-Heading "PlotPickle Playhouse - Guided Update"
Write-Host "This updater replaces PlotPickle program files only." -ForegroundColor White
Write-Host "It preserves:" -ForegroundColor White
Write-Host "  - the persistent package runtime in %LOCALAPPDATA%\PlotPickle" -ForegroundColor Green
Write-Host "  - browser-stored PlotPickle projects" -ForegroundColor Green
Write-Host "  - exported .plotpickle.json files" -ForegroundColor Green
Write-Host "  - local .env configuration and user-owned folders" -ForegroundColor Green
Write-Host ""
Write-Host "Current installation: $InstallRoot"
Write-Host "Current version:      $($currentManifest.version)"

Assert-ServerStopped

if ([string]::IsNullOrWhiteSpace($ZipPath)) {
  Write-Host ""
  Write-Host "The repository is private, so the download opens in your signed-in browser." -ForegroundColor Yellow
  Write-Host "Download the ZIP, then return here and choose it." -ForegroundColor Yellow
  Start-Process $downloadUrl
  [void](Read-Host "Press Enter after the ZIP download finishes")
  $ZipPath = Select-UpdateZip
}

if ([string]::IsNullOrWhiteSpace($ZipPath)) {
  Write-Host "Update cancelled. No files were changed." -ForegroundColor Yellow
  exit 0
}

$ZipPath = [System.IO.Path]::GetFullPath($ZipPath)
if (-not (Test-Path -LiteralPath $ZipPath)) { throw "The selected ZIP could not be found: $ZipPath" }

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("PlotPickle-Update-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempRoot | Out-Null

try {
  Write-Heading "STEP 1 OF 4 - Validating the update package"
  Write-Host "ZIP: $ZipPath"
  Expand-Archive -LiteralPath $ZipPath -DestinationPath $tempRoot -Force
  $sourceRoot = Find-SourceRoot $tempRoot
  $newManifest = Read-Manifest $sourceRoot
  if (-not $newManifest -or $newManifest.name -ne "plotpickle") {
    throw "The selected ZIP is not an official PlotPickle source package."
  }
  $newVersion = $newManifest.version
  if ([string]::IsNullOrWhiteSpace($newVersion)) { throw "The update package has no readable PlotPickle version." }
  Write-Host "[OK] Valid PlotPickle package found." -ForegroundColor Green
  Write-Host "New version: $newVersion"

  Write-Heading "STEP 2 OF 4 - Preserving local data"
  $localHome = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "PlotPickle" } else { Join-Path $env:USERPROFILE ".plotpickle" }
  New-Item -ItemType Directory -Path $localHome -Force | Out-Null
  $history = Join-Path $localHome "update-history.log"
  $oldVersion = $currentManifest.version
  Add-Content -LiteralPath $history -Value "$(Get-Date -Format o)  $oldVersion -> $newVersion  ZIP=$ZipPath"
  Write-Host "[OK] Persistent runtime left untouched: $localHome\runtimes" -ForegroundColor Green
  Write-Host "[OK] Browser project storage is outside the program folder." -ForegroundColor Green
  Write-Host "[OK] User-owned projects, exports, user-data, and backups folders are preserved." -ForegroundColor Green
  Write-Host "[OK] Local update history: $history" -ForegroundColor Green

  Write-Heading "STEP 3 OF 4 - Updating PlotPickle program files"
  Get-ChildItem -LiteralPath $sourceRoot -Directory -Force | ForEach-Object {
    if (-not ($preservedDirectories -contains $_.Name)) {
      $target = Join-Path $InstallRoot $_.Name
      if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
      Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force
      Write-Host "[UPDATED] $($_.Name)"
    }
  }

  Get-ChildItem -LiteralPath $sourceRoot -File -Force | ForEach-Object {
    if (-not ($preservedRootFiles -contains $_.Name)) {
      Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $InstallRoot $_.Name) -Force
    }
  }

  foreach ($buildFolder in @(".next", "dist", ".wrangler")) {
    $target = Join-Path $InstallRoot $buildFolder
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
  }

  Write-Host "[OK] Program files updated in place." -ForegroundColor Green
  Write-Host "[OK] node_modules was not downloaded or copied." -ForegroundColor Green

  Write-Heading "STEP 4 OF 4 - Update completed successfully"
  $installedManifest = Read-Manifest $InstallRoot
  if (-not $installedManifest -or $installedManifest.name -ne "plotpickle" -or $installedManifest.version -ne $newVersion) {
    throw "Version verification failed after file replacement."
  }
  Write-Host "SUCCESS - PlotPickle $oldVersion was upgraded to $($installedManifest.version)." -ForegroundColor Green
  Write-Host ""
  Write-Host "On the next start:" -ForegroundColor White
  Write-Host "  - the launcher reconnects to the matching persistent runtime;" -ForegroundColor White
  Write-Host "  - no package installation occurs when package-lock.json is unchanged;" -ForegroundColor White
  Write-Host "  - only a genuinely new dependency set creates a new runtime." -ForegroundColor White
  Write-Host ""

  $answer = Read-Host "Start PlotPickle now? [Y/N]"
  if ($answer -match "^[Yy]") {
    Start-Process -FilePath (Join-Path $InstallRoot "Start-PlotPickle.bat") -WorkingDirectory $InstallRoot
  }
} finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
