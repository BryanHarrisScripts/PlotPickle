[CmdletBinding()]
param(
  [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$stage = Join-Path $root "releases\stage\PlotPickle-Windows"
$output = Join-Path $root "releases\windows-installer"
$launcherOutput = Join-Path $root "releases\launcher\win-x64"
$launcherProject = Join-Path $root "windows\launcher\PlotPickleLauncher.csproj"
$installerScript = Join-Path $root "windows\installer\PlotPickle.iss"
$packageJson = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
$appVersion = [string]$packageJson.version

function Get-WindowsProductVersion {
  param([string]$Version)
  $match = [regex]::Match($Version, '^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)')
  if (-not $match.Success) {
    throw "PlotPickle package version '$Version' does not start with semantic major.minor.patch numbers."
  }

  $components = @(
    [int]$match.Groups['major'].Value,
    [int]$match.Groups['minor'].Value,
    [int]$match.Groups['patch'].Value
  )
  foreach ($component in $components) {
    if ($component -lt 0 -or $component -gt 65535) {
      throw "PlotPickle package version '$Version' exceeds Windows version component limits."
    }
  }

  $build = 0
  $suffix = $Version.Substring($match.Length)
  $suffixNumber = [regex]::Match($suffix, '\d+')
  if ($suffixNumber.Success) {
    $build = [int]$suffixNumber.Value
    if ($build -gt 65535) {
      throw "PlotPickle package version '$Version' has a prerelease/build component too large for Windows metadata."
    }
  }

  return "$($components[0]).$($components[1]).$($components[2]).$build"
}

$windowsProductVersion = Get-WindowsProductVersion $appVersion

function Invoke-Checked {
  param([string]$FilePath, [string[]]$ArgumentList)
  Write-Host "> $FilePath $($ArgumentList -join ' ')"
  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath exited with code $LASTEXITCODE."
  }
}

function Find-Iscc {
  $command = Get-Command ISCC.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  foreach ($candidate in @(
    "$env:ProgramFiles(x86)\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
  )) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }
  throw "Inno Setup 6 was not found. Install it for release builds, then rerun this script."
}

function Find-SignTool {
  $command = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $kits = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"
  if (Test-Path $kits) {
    $candidate = Get-ChildItem $kits -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
      Sort-Object FullName -Descending |
      Select-Object -First 1
    if ($candidate) { return $candidate.FullName }
  }
  return $null
}

function Invoke-OptionalSigning {
  param([string]$Path)
  $thumbprint = [string]$env:PLOTPICKLE_SIGN_CERT_SHA1
  if ([string]::IsNullOrWhiteSpace($thumbprint)) {
    Write-Host "Signing certificate not configured; leaving $(Split-Path $Path -Leaf) unsigned and signing-ready."
    return
  }
  $signTool = Find-SignTool
  if (-not $signTool) { throw "PLOTPICKLE_SIGN_CERT_SHA1 is set but signtool.exe was not found." }
  $timestamp = if ($env:PLOTPICKLE_SIGN_TIMESTAMP_URL) { $env:PLOTPICKLE_SIGN_TIMESTAMP_URL } else { "http://timestamp.digicert.com" }
  Invoke-Checked $signTool @("sign", "/sha1", $thumbprint, "/fd", "SHA256", "/tr", $timestamp, "/td", "SHA256", $Path)
}

if ($env:OS -ne "Windows_NT") {
  throw "PlotPickleSetup.exe must be built on Windows."
}

Push-Location $root
try {
  Remove-Item $output -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $launcherOutput -Recurse -Force -ErrorAction SilentlyContinue
  New-Item $output -ItemType Directory -Force | Out-Null
  New-Item $launcherOutput -ItemType Directory -Force | Out-Null

  Invoke-Checked "node" @("scripts/package-platform.mjs", "windows")
  Invoke-Checked "node" @("scripts/windows-runtime.mjs", "verify-modules", "node_modules")
  Invoke-Checked "node" @("scripts/windows-installer/stage.mjs")

  Invoke-Checked "dotnet" @(
    "publish", $launcherProject,
    "-c", $Configuration,
    "-r", "win-x64",
    "--self-contained", "true",
    "-p:PublishSingleFile=true",
    "-p:PublishReadyToRun=true",
    "-p:DebugType=None",
    "-o", $launcherOutput
  )
  Copy-Item (Join-Path $launcherOutput "*") $stage -Recurse -Force

  $launcherExe = Join-Path $stage "PlotPickle.exe"
  if (-not (Test-Path $launcherExe)) { throw "Native PlotPickle.exe launcher was not produced." }
  Invoke-OptionalSigning $launcherExe
  Invoke-Checked $launcherExe @("--verify-install")
  Invoke-Checked "node" @("scripts/package-smoke.mjs", $stage)

  $iscc = Find-Iscc
  Write-Host "Windows installer version metadata: $windowsProductVersion (display version $appVersion)"
  Invoke-Checked $iscc @(
    "/DStageDir=$stage",
    "/DOutputDir=$output",
    "/DAppVersion=$appVersion",
    "/DWindowsProductVersion=$windowsProductVersion",
    $installerScript
  )

  $setup = Join-Path $output "PlotPickleSetup.exe"
  if (-not (Test-Path $setup)) { throw "Inno Setup did not produce PlotPickleSetup.exe." }
  Invoke-OptionalSigning $setup

  $hash = (Get-FileHash $setup -Algorithm SHA256).Hash.ToLowerInvariant()
  Set-Content (Join-Path $output "PlotPickleSetup.exe.sha256") "$hash  PlotPickleSetup.exe`n" -Encoding ascii
  Write-Host ""
  Write-Host "PlotPickle Windows installer ready: $setup"
  Write-Host "SHA256: $hash"
}
finally {
  Pop-Location
}
