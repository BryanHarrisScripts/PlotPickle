[CmdletBinding()]
param(
  [ValidateSet("Status", "Install")]
  [string]$Mode = "Status",
  [switch]$Approved
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ManagedInstanceCore = Join-Path $Root "scripts\comfyui-managed-instance-core.ps1"
if (-not (Test-Path -LiteralPath $ManagedInstanceCore -PathType Leaf)) { throw "PlotPickle's ComfyUI managed-instance inspector is missing." }
. $ManagedInstanceCore

$Models = @(
  [ordered]@{
    Key = "LTX"
    Category = "checkpoints"
    FileName = "ltxv-2b-0.9.8-distilled.safetensors"
    Source = "https://huggingface.co/Lightricks/LTX-Video/resolve/main/ltxv-2b-0.9.8-distilled.safetensors?download=true"
    SourceLabel = "Lightricks - LTX-Video 2B 0.9.8 Distilled via Hugging Face"
    SizeBytes = [int64]6340744492
    SizeLabel = "6.34 GB"
    Sha256 = "76aa8c4786af752fa6f951947129d5290c3c6c0b2fadcadea6b5e114ae2cad8f"
  },
  [ordered]@{
    Key = "T5"
    Category = "text_encoders"
    FileName = "t5xxl_fp16.safetensors"
    Source = "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp16.safetensors?download=true"
    SourceLabel = "Comfy Anonymous - T5 XXL FP16 via Hugging Face"
    SizeBytes = [int64]9787841024
    SizeLabel = "9.79 GB"
    Sha256 = "6e480b09fae049a72d2a8c5fbccb8d3e92febeb233bbe9dfe7256958a9167635"
  }
)
$TotalSizeLabel = "16.13 GB"

function Unquote-YamlValue {
  param([string]$Value)
  $trimmed = $Value.Trim()
  if (($trimmed.StartsWith('"') -and $trimmed.EndsWith('"')) -or ($trimmed.StartsWith("'") -and $trimmed.EndsWith("'"))) {
    return $trimmed.Substring(1, $trimmed.Length - 2)
  }
  return $trimmed
}

function Read-YamlPathValue {
  param([string[]]$Lines, [string]$Key, [string]$DefaultValue = "")
  for ($index = 0; $index -lt $Lines.Count; $index++) {
    $line = [string]$Lines[$index]
    if ($line -notmatch "^\s*$([regex]::Escape($Key))\s*:\s*(.*?)\s*$") { continue }
    $value = Unquote-YamlValue $Matches[1]
    if ($value -and $value -notin @("|", ">")) { return $value }
    for ($next = $index + 1; $next -lt $Lines.Count; $next++) {
      $candidate = [string]$Lines[$next]
      if ($candidate -match '^\S') { break }
      $trimmed = $candidate.Trim()
      if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
      if ($trimmed -match '^[A-Za-z0-9_-]+\s*:') { break }
      return (Unquote-YamlValue $trimmed)
    }
    break
  }
  return $DefaultValue
}

function Resolve-ModelPath {
  param([string]$BasePath, [string]$Value)
  $expanded = [Environment]::ExpandEnvironmentVariables($Value) -replace '/', [IO.Path]::DirectorySeparatorChar
  if ([IO.Path]::IsPathRooted($expanded)) { return [IO.Path]::GetFullPath($expanded) }
  return [IO.Path]::GetFullPath((Join-Path $BasePath $expanded))
}

function Resolve-DesktopSharedModelDirectories {
  if (-not $env:APPDATA) { return $null }
  $yamlPath = Join-Path $env:APPDATA "Comfy Desktop\shared_model_paths.yaml"
  if (-not (Test-Path -LiteralPath $yamlPath -PathType Leaf)) { return $null }
  $lines = @(Get-Content -LiteralPath $yamlPath -ErrorAction Stop)
  $basePath = Read-YamlPathValue -Lines $lines -Key "base_path"
  if (-not $basePath) { return $null }
  $basePath = [Environment]::ExpandEnvironmentVariables($basePath)
  $checkpoints = Read-YamlPathValue -Lines $lines -Key "checkpoints" -DefaultValue "models/checkpoints"
  $textEncoders = Read-YamlPathValue -Lines $lines -Key "text_encoders" -DefaultValue "models/text_encoders"
  return [ordered]@{
    checkpoints = Resolve-ModelPath -BasePath $basePath -Value $checkpoints
    text_encoders = Resolve-ModelPath -BasePath $basePath -Value $textEncoders
  }
}

function Resolve-ManagedModelDirectories {
  $installed = @(Get-ComfyManagedInstances | Where-Object { $_.State -eq "installed" -and $_.EngineRoot })
  if ($installed.Count -ne 1) { return $null }
  return [ordered]@{
    checkpoints = [IO.Path]::GetFullPath((Join-Path $installed[0].EngineRoot "models\checkpoints"))
    text_encoders = [IO.Path]::GetFullPath((Join-Path $installed[0].EngineRoot "models\text_encoders"))
  }
}

function Resolve-ModelDirectories {
  $shared = Resolve-DesktopSharedModelDirectories
  if ($null -ne $shared) { return $shared }
  return Resolve-ManagedModelDirectories
}

function Write-Markers {
  param([string]$State, [string]$Message, [hashtable]$Directories)
  $checkpointDirectory = if ($null -ne $Directories) { [string]$Directories.checkpoints } else { "" }
  $textEncoderDirectory = if ($null -ne $Directories) { [string]$Directories.text_encoders } else { "" }
  Write-Output "PLOTPICKLE_LTX_INSTALL_STATUS=$State"
  Write-Output "PLOTPICKLE_LTX_INSTALL_DETAIL=$Message"
  Write-Output "PLOTPICKLE_LTX_TOTAL_SIZE=$TotalSizeLabel"
  Write-Output "PLOTPICKLE_LTX_CHECKPOINT_DIR=$checkpointDirectory"
  Write-Output "PLOTPICKLE_LTX_TEXT_ENCODER_DIR=$textEncoderDirectory"
}

function Test-ExpectedSize {
  param([string]$Path, [int64]$SizeBytes)
  if (-not $Path -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
  return [int64](Get-Item -LiteralPath $Path).Length -eq $SizeBytes
}

function Test-ReviewedFile {
  param([string]$Path, [int64]$SizeBytes, [string]$Sha256)
  if (-not (Test-ExpectedSize -Path $Path -SizeBytes $SizeBytes)) { return $false }
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() -eq $Sha256
}

function Download-ReviewedFile {
  param([hashtable]$Model, [string]$DestinationFile)
  $partial = "$DestinationFile.partial"
  if (Test-Path -LiteralPath $partial -PathType Leaf) { Remove-Item -LiteralPath $partial -Force }

  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Add-Type -AssemblyName System.Net.Http
  $handler = New-Object System.Net.Http.HttpClientHandler
  $handler.AllowAutoRedirect = $true
  $client = New-Object System.Net.Http.HttpClient($handler)
  $client.Timeout = [TimeSpan]::FromHours(6)
  $client.DefaultRequestHeaders.UserAgent.ParseAdd("PlotPickle-LTX-Installer/1.0")
  try {
    $response = $client.GetAsync($Model.Source, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
    $response.EnsureSuccessStatusCode()
    $input = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
    try {
      $output = [IO.File]::Open($partial, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
      try { $input.CopyToAsync($output).GetAwaiter().GetResult() } finally { $output.Dispose() }
    } finally { $input.Dispose() }
  } finally {
    $client.Dispose()
    $handler.Dispose()
  }

  if (-not (Test-ReviewedFile -Path $partial -SizeBytes $Model.SizeBytes -Sha256 $Model.Sha256)) {
    Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
    throw "$($Model.FileName) did not match PlotPickle's reviewed size and SHA-256. Nothing was activated."
  }
  Move-Item -LiteralPath $partial -Destination $DestinationFile
}

$directories = Resolve-ModelDirectories
if ($null -eq $directories) {
  Write-Markers -State "unsupported" -Message "PlotPickle could not resolve one unambiguous managed ComfyUI model library. Open ComfyUI Desktop Storage settings, keep the shared model library enabled, then retry." -Directories $null
  exit 2
}

$missing = New-Object System.Collections.Generic.List[string]
foreach ($model in $Models) {
  $directory = [string]$directories[$model.Category]
  $destination = Join-Path $directory $model.FileName
  if (-not (Test-Path -LiteralPath $destination -PathType Leaf)) {
    $missing.Add($model.FileName)
    continue
  }
  if (-not (Test-ExpectedSize -Path $destination -SizeBytes $model.SizeBytes)) {
    Write-Markers -State "conflict" -Message "$($model.FileName) already exists but its size does not match the reviewed file. PlotPickle will not overwrite it." -Directories $directories
    exit 3
  }
}

if ($Mode -eq "Status") {
  if ($missing.Count -eq 0) {
    Write-Markers -State "ready" -Message "Both reviewed LTX model files are present. PlotPickle will verify their SHA-256 before any installer-managed replacement or download." -Directories $directories
  } else {
    Write-Markers -State "missing" -Message "Missing reviewed LTX model files: $($missing -join ', '). Setup requires an explicit $TotalSizeLabel download approval." -Directories $directories
  }
  exit 0
}

if (-not $Approved) {
  Write-Markers -State "approval-required" -Message "Explicit approval is required before PlotPickle downloads up to $TotalSizeLabel of reviewed LTX model files." -Directories $directories
  exit 4
}

foreach ($model in $Models) {
  $directory = [string]$directories[$model.Category]
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  $destination = Join-Path $directory $model.FileName

  if (Test-Path -LiteralPath $destination -PathType Leaf) {
    Write-Host "[LTX] Verifying existing $($model.FileName)..."
    if (-not (Test-ReviewedFile -Path $destination -SizeBytes $model.SizeBytes -Sha256 $model.Sha256)) {
      Write-Markers -State "conflict" -Message "$($model.FileName) exists but does not match PlotPickle's reviewed SHA-256. PlotPickle will not overwrite it." -Directories $directories
      exit 3
    }
    continue
  }

  Write-Host "[LTX] Explicit download approved. Source: $($model.SourceLabel)"
  Write-Host "[LTX] Size: $($model.SizeLabel)"
  Write-Host "[LTX] Destination: $destination"
  Download-ReviewedFile -Model $model -DestinationFile $destination
}

foreach ($model in $Models) {
  $destination = Join-Path ([string]$directories[$model.Category]) $model.FileName
  if (-not (Test-ReviewedFile -Path $destination -SizeBytes $model.SizeBytes -Sha256 $model.Sha256)) {
    throw "$($model.FileName) did not pass post-install verification."
  }
}

Write-Markers -State "installed" -Message "The reviewed LTX 2B checkpoint and T5 text encoder were downloaded, size/hash verified, and activated in ComfyUI's model library." -Directories $directories
