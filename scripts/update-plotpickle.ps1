$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = 'Select the latest PlotPickle ZIP downloaded from GitHub'
$dialog.Filter = 'PlotPickle ZIP archive (*.zip)|*.zip'
$dialog.Multiselect = $false
$dialog.CheckFileExists = $true

Write-Host ''
Write-Host 'PLOTPICKLE IN-PLACE UPGRADE' -ForegroundColor Cyan
Write-Host '---------------------------'
Write-Host '1. Download the latest PlotPickle ZIP from the official GitHub repository.'
Write-Host '2. Select that ZIP in the file window that opens.'
Write-Host '3. The updater replaces program files but keeps installed dependencies.'
Write-Host ''
Write-Host "Current PlotPickle folder: $root"
Write-Host ''

if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
  exit 2
}

$zipPath = $dialog.FileName
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("PlotPickle-Update-" + [guid]::NewGuid().ToString('N'))
$extractRoot = Join-Path $tempRoot 'extracted'

try {
  New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null
  Write-Host '[1/4] Reading the selected update archive...'
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractRoot -Force

  $packageFile = Get-ChildItem -Path $extractRoot -Filter package.json -File -Recurse |
    Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]' } |
    Select-Object -First 1

  if (-not $packageFile) {
    throw 'The selected ZIP does not contain a PlotPickle package.json file.'
  }

  $source = $packageFile.Directory.FullName
  $package = Get-Content -LiteralPath $packageFile.FullName -Raw | ConvertFrom-Json
  if ($package.name -ne 'plotpickle') {
    throw "The selected ZIP does not appear to be PlotPickle. Package name: $($package.name)"
  }

  Write-Host "[2/4] Update identified: PlotPickle $($package.version)"
  Write-Host '[3/4] Replacing application files while preserving installed components...'

  $excludedDirectories = @(
    'node_modules', '.git', '.next', 'dist', '.wrangler', '.plotpickle'
  )

  $robocopyArgs = @(
    $source,
    $root,
    '/E',
    '/COPY:DAT',
    '/DCOPY:DAT',
    '/R:2',
    '/W:1',
    '/NFL',
    '/NDL',
    '/NP',
    '/NJH',
    '/NJS',
    '/XD'
  ) + $excludedDirectories

  & robocopy @robocopyArgs | Out-Null
  $copyCode = $LASTEXITCODE
  if ($copyCode -ge 8) {
    throw "Windows file copy failed with robocopy code $copyCode."
  }

  Write-Host '[4/4] Verifying the updated application files...'
  foreach ($required in @('package.json', 'package-lock.json', 'Start-PlotPickle.bat', 'Update-PlotPickle.bat')) {
    if (-not (Test-Path (Join-Path $root $required))) {
      throw "The updated folder is missing required file: $required"
    }
  }

  $installedPackage = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
  Write-Host ''
  Write-Host 'SUCCESS - PLOTPICKLE PROGRAM FILES UPDATED' -ForegroundColor Green
  Write-Host "Version now in folder: $($installedPackage.version)"
  Write-Host 'Installed npm components were preserved.'
  Write-Host 'When Start-PlotPickle.bat runs, it will update npm components only if package-lock.json changed.'
  Write-Host 'Your browser-stored story project was not changed.'
  exit 0
}
catch {
  Write-Host ''
  Write-Host "UPDATE FAILED: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
finally {
  if (Test-Path $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
