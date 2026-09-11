param(
  [ValidateSet("Install", "Verify", "Smoke")]
  [string]$Mode = "Verify",
  [switch]$Approved
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ConfigPath = Join-Path $RepoRoot "config\local-voice-input.json"
$Config = Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json

function Get-PlotPickleHome {
  if ($env:PLOTPICKLE_HOME) { return [IO.Path]::GetFullPath($env:PLOTPICKLE_HOME) }
  if ($env:LOCALAPPDATA) { return Join-Path $env:LOCALAPPDATA "PlotPickle" }
  return Join-Path $env:USERPROFILE ".plotpickle"
}

function Get-Sha256([string]$Path) {
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Assert-Hash([string]$Path, [string]$Expected, [string]$Label) {
  $actual = Get-Sha256 $Path
  if ($actual -ne $Expected.ToLowerInvariant()) {
    throw "$Label failed SHA-256 verification. Expected $Expected but received $actual."
  }
}

$Home = Get-PlotPickleHome
$RuntimeRoot = Join-Path $Home ("runtime\voice\whisper-" + $Config.runtime.releaseTag)
$BinRoot = Join-Path $RuntimeRoot "bin"
$ModelRoot = Join-Path $RuntimeRoot "models"
$ExePath = Join-Path $BinRoot $Config.runtime.executable
$ModelPath = Join-Path $ModelRoot $Config.model.fileName
$InstalledPath = Join-Path $RuntimeRoot "installed.json"
$WorkRoot = Join-Path $Home "temp\voice-setup"
$RuntimeArchive = Join-Path $WorkRoot $Config.runtime.assetName
$ModelDownload = Join-Path $WorkRoot $Config.model.fileName
$ExtractRoot = Join-Path $WorkRoot "runtime-extract"

function Test-ReviewedInstall {
  if (-not (Test-Path -LiteralPath $ExePath -PathType Leaf)) { throw "Reviewed whisper.cpp executable is missing: $ExePath" }
  if (-not (Test-Path -LiteralPath $ModelPath -PathType Leaf)) { throw "Reviewed base.en model is missing: $ModelPath" }
  if (-not (Test-Path -LiteralPath $InstalledPath -PathType Leaf)) { throw "Local dictation install manifest is missing: $InstalledPath" }
  $installed = Get-Content -Raw -LiteralPath $InstalledPath | ConvertFrom-Json
  if ($installed.releaseTag -ne $Config.runtime.releaseTag -or $installed.sourceCommit -ne $Config.runtime.sourceCommit) { throw "Installed whisper.cpp provenance does not match PlotPickle's reviewed pin." }
  if ($installed.sourceArchiveSha256 -ne $Config.runtime.sha256) { throw "Installed whisper.cpp source archive digest does not match PlotPickle's reviewed pin." }
  if ($installed.modelId -ne $Config.model.id -or $installed.modelRevision -ne $Config.model.revision) { throw "Installed local dictation model provenance does not match PlotPickle's reviewed pin." }
  Assert-Hash $ExePath $installed.executableSha256 "Installed whisper.cpp executable"
  Assert-Hash $ModelPath $Config.model.sha256 "Installed base.en model"
  Write-Output "PLOTPICKLE_VOICE_INSTALL_STATUS=ready"
  Write-Output "PLOTPICKLE_VOICE_INSTALL_DETAIL=Reviewed whisper.cpp runtime and base.en model are integrity-verified."
}

function Install-ReviewedRuntime {
  if (-not $Approved) { throw "Explicit approval is required before downloading the reviewed local dictation runtime and model." }
  if (-not [Environment]::Is64BitOperatingSystem) { throw "PlotPickle local dictation currently requires 64-bit Windows." }
  New-Item -ItemType Directory -Force -Path $WorkRoot, $BinRoot, $ModelRoot | Out-Null
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $ExtractRoot

  Write-Output "Downloading reviewed whisper.cpp CPU runtime $($Config.runtime.releaseTag)..."
  Invoke-WebRequest -Uri $Config.runtime.downloadUrl -OutFile $RuntimeArchive
  if ((Get-Item -LiteralPath $RuntimeArchive).Length -ne [int64]$Config.runtime.sizeBytes) { throw "whisper.cpp runtime archive size does not match the reviewed manifest." }
  Assert-Hash $RuntimeArchive $Config.runtime.sha256 "whisper.cpp runtime archive"

  Expand-Archive -LiteralPath $RuntimeArchive -DestinationPath $ExtractRoot -Force
  $sourceExe = Get-ChildItem -LiteralPath $ExtractRoot -Recurse -File -Filter $Config.runtime.executable | Select-Object -First 1
  if (-not $sourceExe) { throw "The reviewed whisper.cpp archive did not contain $($Config.runtime.executable)." }
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $BinRoot
  New-Item -ItemType Directory -Force -Path $BinRoot | Out-Null
  Copy-Item -Path (Join-Path $sourceExe.Directory.FullName "*") -Destination $BinRoot -Recurse -Force

  Write-Output "Downloading reviewed whisper.cpp $($Config.model.id) model..."
  Invoke-WebRequest -Uri $Config.model.downloadUrl -OutFile $ModelDownload
  if ((Get-Item -LiteralPath $ModelDownload).Length -ne [int64]$Config.model.sizeBytes) { throw "base.en model size does not match the reviewed manifest." }
  Assert-Hash $ModelDownload $Config.model.sha256 "base.en model"
  Move-Item -LiteralPath $ModelDownload -Destination $ModelPath -Force

  $runtimeLicense = Join-Path $RepoRoot $Config.runtime.licensePath
  $modelProvenance = Join-Path $RepoRoot $Config.model.provenancePath
  if (Test-Path -LiteralPath $runtimeLicense) { Copy-Item -LiteralPath $runtimeLicense -Destination (Join-Path $RuntimeRoot "LICENSE.whisper.cpp.txt") -Force }
  if (Test-Path -LiteralPath $modelProvenance) { Copy-Item -LiteralPath $modelProvenance -Destination (Join-Path $RuntimeRoot "MODEL-PROVENANCE.md") -Force }

  $installed = [ordered]@{
    schemaVersion = 1
    provider = "whisper.cpp"
    releaseTag = [string]$Config.runtime.releaseTag
    sourceCommit = [string]$Config.runtime.sourceCommit
    sourceArchiveSha256 = [string]$Config.runtime.sha256
    executableSha256 = Get-Sha256 $ExePath
    modelId = [string]$Config.model.id
    modelRevision = [string]$Config.model.revision
    modelSha256 = [string]$Config.model.sha256
    installedAt = [DateTime]::UtcNow.ToString("o")
  }
  $installed | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $InstalledPath -Encoding UTF8
  Test-ReviewedInstall
}

function Invoke-SmokeTest {
  Test-ReviewedInstall
  $SmokeRoot = Join-Path $WorkRoot "smoke"
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $SmokeRoot
  New-Item -ItemType Directory -Force -Path $SmokeRoot | Out-Null
  $wav = Join-Path $SmokeRoot "fixture.wav"
  $outBase = Join-Path $SmokeRoot "transcript"
  try {
    Add-Type -AssemblyName System.Speech
    $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
      $synth.SetOutputToWaveFile($wav, $format)
      $synth.Speak("Plot Pickle local voice input works.")
    } finally {
      $synth.Dispose()
    }
    & $ExePath -m $ModelPath -f $wav -l en -nt -otxt -of $outBase | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "whisper.cpp smoke transcription exited with code $LASTEXITCODE." }
    $textPath = "$outBase.txt"
    if (-not (Test-Path -LiteralPath $textPath)) { throw "whisper.cpp smoke test did not produce a transcript." }
    $text = (Get-Content -Raw -LiteralPath $textPath).Trim()
    if (-not $text -or $text -notmatch "(?i)(plot|pickle|voice|input|works)") { throw "whisper.cpp smoke transcript was empty or did not resemble the deterministic fixture: $text" }
    Write-Output "PLOTPICKLE_VOICE_SMOKE_STATUS=passed"
    Write-Output "PLOTPICKLE_VOICE_SMOKE_DETAIL=Local fixture audio transcribed successfully with reviewed whisper.cpp/base.en bytes."
  } finally {
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $SmokeRoot
  }
}

try {
  switch ($Mode) {
    "Install" { Install-ReviewedRuntime }
    "Verify" { Test-ReviewedInstall }
    "Smoke" {
      try { Test-ReviewedInstall } catch {
        if (-not $Approved) { throw }
        Install-ReviewedRuntime
      }
      Invoke-SmokeTest
    }
  }
} finally {
  Remove-Item -LiteralPath $RuntimeArchive, $ModelDownload -Force -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $ExtractRoot
}
