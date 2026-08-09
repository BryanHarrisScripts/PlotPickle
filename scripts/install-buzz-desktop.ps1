[CmdletBinding()]
param(
  [switch]$CheckOnly,
  [switch]$Install,
  [switch]$Maintain
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptRoot
$ConfigPath = Join-Path $ProjectRoot "config\buzz-desktop.json"

function Write-PlotPickleBuzzStatus {
  param(
    [Parameter(Mandatory = $true)][string]$Status,
    [string]$Executable = ""
  )
  Write-Output "PLOTPICKLE_BUZZ_STATUS=$Status"
  if ($Executable) { Write-Output "PLOTPICKLE_BUZZ_CLI=$Executable" }
}

function Get-BuzzCliCandidates {
  $roots = New-Object System.Collections.Generic.List[string]
  if ($env:LOCALAPPDATA) {
    $roots.Add((Join-Path $env:LOCALAPPDATA "Buzz"))
    $roots.Add((Join-Path $env:LOCALAPPDATA "Programs\Buzz"))
  }
  if ($env:ProgramFiles) { $roots.Add((Join-Path $env:ProgramFiles "Buzz")) }
  if (${env:ProgramFiles(x86)}) { $roots.Add((Join-Path ${env:ProgramFiles(x86)} "Buzz")) }

  $relativeExecutables = @(
    "buzz.exe",
    "resources\buzz.exe",
    "buzz-x86_64-pc-windows-msvc.exe",
    "resources\buzz-x86_64-pc-windows-msvc.exe"
  )
  $candidates = New-Object System.Collections.Generic.List[string]
  foreach ($rootPath in $roots) {
    foreach ($relativeExecutable in $relativeExecutables) {
      $candidates.Add((Join-Path $rootPath $relativeExecutable))
    }
  }
  return $candidates | Select-Object -Unique
}

function Find-BuzzCli {
  foreach ($candidate in Get-BuzzCliCandidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }
  return ""
}

function Get-BuzzVersion {
  param([string]$Executable)
  if (-not $Executable -or -not (Test-Path -LiteralPath $Executable -PathType Leaf)) { return "" }
  try {
    $item = Get-Item -LiteralPath $Executable
    foreach ($value in @($item.VersionInfo.ProductVersion, $item.VersionInfo.FileVersion)) {
      if ($value -and [string]$value -match "\d+(?:\.\d+){1,3}") { return $Matches[0] }
    }
  }
  catch { }

  $registryRoots = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )
  foreach ($root in $registryRoots) {
    foreach ($entry in @(Get-ItemProperty -Path $root -ErrorAction SilentlyContinue)) {
      $nameProperty = $entry.PSObject.Properties["DisplayName"]
      $versionProperty = $entry.PSObject.Properties["DisplayVersion"]
      if ($nameProperty -and [string]$nameProperty.Value -match "^Buzz(?: Desktop)?$") {
        $registryVersion = [string]$(if ($versionProperty) { $versionProperty.Value } else { "" })
        if ($registryVersion -match "\d+(?:\.\d+){1,3}") { return $Matches[0] }
      }
    }
  }
  return ""
}

function Compare-BuzzVersion {
  param(
    [Parameter(Mandatory = $true)][string]$Installed,
    [Parameter(Mandatory = $true)][string]$Reviewed
  )

  try {
    $installedVersion = [Version]$Installed
    $reviewedVersion = [Version]$Reviewed
    return $installedVersion.CompareTo($reviewedVersion)
  }
  catch {
    return $null
  }
}

if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
  Write-Warning "The packaged Buzz Desktop compatibility file is missing: $ConfigPath"
  Write-PlotPickleBuzzStatus -Status "configuration-missing"
  exit 1
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$releaseTag = [string]$config.releaseTag
$version = [string]$config.version
$assetName = [string]$config.windows.asset
$downloadUrl = [string]$config.windows.downloadUrl

$existingCli = Find-BuzzCli
if ($existingCli) {
  $installedVersion = Get-BuzzVersion -Executable $existingCli
  $comparison = if ($installedVersion) { Compare-BuzzVersion -Installed $installedVersion -Reviewed $version } else { $null }

  if ($Maintain -and $installedVersion -and $null -ne $comparison -and $comparison -gt 0) {
    Write-Host "[OK] Buzz Desktop $installedVersion is newer than PlotPickle's reviewed package $version."
    Write-Host "Keeping the installed version and skipping the pinned installer."
    Write-PlotPickleBuzzStatus -Status "detected" -Executable $existingCli
    exit 0
  }

  $updateRequired = $Maintain -and $installedVersion -and $null -ne $comparison -and $comparison -lt 0
  if (-not $updateRequired) {
    $versionLabel = if ($installedVersion) { $installedVersion } else { "version unknown" }
    Write-Host "[OK] Buzz Desktop $versionLabel CLI detected at $existingCli"
    if ($Maintain -and -not $installedVersion) {
      Write-Warning "Buzz Desktop is installed, but its version could not be verified. Automatic reinstallation was skipped."
    }
    if ($Maintain -and $installedVersion -and $null -eq $comparison) {
      Write-Warning "Buzz Desktop is installed, but its version could not be compared safely. Automatic reinstallation was skipped."
    }
    Write-PlotPickleBuzzStatus -Status "detected" -Executable $existingCli
    exit 0
  }
  Write-Host "[UPDATE] Buzz Desktop $installedVersion is installed; PlotPickle's reviewed package is $version."
}

if ($CheckOnly -or (-not $Install -and -not $Maintain)) {
  Write-Host "[INFO] Buzz Desktop $version was not detected in a supported Windows installation folder."
  Write-PlotPickleBuzzStatus -Status "missing"
  exit 3
}

if (-not [Environment]::Is64BitOperatingSystem) {
  Write-Warning "Buzz Desktop $version currently provides an x64 Windows installer."
  Write-PlotPickleBuzzStatus -Status "unsupported-platform"
  exit 1
}

$uri = [Uri]$downloadUrl
if ($uri.Scheme -ne "https" -or $uri.Host -ne "github.com" -or -not $uri.AbsolutePath.StartsWith("/block/buzz/releases/download/$releaseTag/")) {
  Write-Warning "The Buzz Desktop download URL is not the pinned official block/buzz release URL."
  Write-PlotPickleBuzzStatus -Status "invalid-download-url"
  exit 1
}
if ($uri.Segments[-1] -ne $assetName) {
  Write-Warning "The Buzz Desktop asset name does not match the pinned release configuration."
  Write-PlotPickleBuzzStatus -Status "invalid-asset"
  exit 1
}

$downloadRoot = Join-Path ([IO.Path]::GetTempPath()) "PlotPickle\BuzzDesktop-$version"
$installerPath = Join-Path $downloadRoot $assetName

try {
  if (Test-Path -LiteralPath $downloadRoot) { Remove-Item -LiteralPath $downloadRoot -Recurse -Force }
  New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null

  Write-Host "Downloading the official Buzz Desktop $version installer from block/buzz..."
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing -MaximumRedirection 10

  $downloaded = Get-Item -LiteralPath $installerPath
  if ($downloaded.Length -lt 1MB) { throw "The downloaded installer is unexpectedly small." }

  $stream = [IO.File]::OpenRead($installerPath)
  try {
    if ($stream.ReadByte() -ne 0x4D -or $stream.ReadByte() -ne 0x5A) { throw "The downloaded file is not a Windows executable." }
  }
  finally { $stream.Dispose() }

  $hash = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash
  Write-Host "Downloaded $assetName"
  Write-Host "SHA-256: $hash"
  Write-Warning "Buzz Desktop $version is a separate third-party application. Its current Windows asset is labelled alpha-unsigned, so Windows SmartScreen may ask you to confirm before it opens."
  Write-Host "The installer will remain visible. PlotPickle does not pass silent-install flags or request elevation."

  $process = Start-Process -FilePath $installerPath -Wait -PassThru
  Write-Host "Buzz Desktop installer exited with code $($process.ExitCode)."
  Start-Sleep -Seconds 2

  $installedCli = Find-BuzzCli
  if ($installedCli) {
    Write-Host "[SUCCESS] Buzz Desktop $version CLI detected at $installedCli"
    Write-PlotPickleBuzzStatus -Status $(if ($Maintain) { "updated" } else { "installed" }) -Executable $installedCli
    exit 0
  }

  Write-Warning "The installer closed, but PlotPickle could not find the Buzz Desktop CLI. The install may have been cancelled or placed somewhere unsupported."
  Write-PlotPickleBuzzStatus -Status "not-completed"
  exit 4
}
catch {
  Write-Warning "Buzz Desktop installation could not finish: $($_.Exception.Message)"
  Write-PlotPickleBuzzStatus -Status "failed"
  exit 1
}
finally {
  if (Test-Path -LiteralPath $downloadRoot) {
    Remove-Item -LiteralPath $downloadRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
