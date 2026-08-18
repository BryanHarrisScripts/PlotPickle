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

$Starter = [ordered]@{
  FileName = "sd_xl_base_1.0.safetensors"
  Source = "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors?download=true"
  SourceLabel = "Stability AI · stable-diffusion-xl-base-1.0 via Hugging Face"
  License = "OpenRAIL++"
  SizeBytes = [int64]6938078334
  SizeLabel = "6.94 GB"
  Sha256 = "31e35c80fc4829d14f90153f4c74cd59c90b779f6afe05a74cd6120b893f7e5b"
}

function Unquote-YamlValue {
  param([string]$Value)
  $trimmed = $Value.Trim()
  if (($trimmed.StartsWith('"') -and $trimmed.EndsWith('"')) -or ($trimmed.StartsWith("'") -and $trimmed.EndsWith("'"))) {
    return $trimmed.Substring(1, $trimmed.Length - 2)
  }
  return $trimmed
}

function Resolve-DesktopSharedCheckpointDirectory {
  if (-not $env:APPDATA) { return "" }
  $yamlPath = Join-Path $env:APPDATA "Comfy Desktop\shared_model_paths.yaml"
  if (-not (Test-Path -LiteralPath $yamlPath -PathType Leaf)) { return "" }

  $basePath = ""
  $checkpointValue = ""
  foreach ($line in @(Get-Content -LiteralPath $yamlPath -ErrorAction Stop)) {
    if (-not $basePath -and $line -match '^\s*base_path\s*:\s*(.+?)\s*$') { $basePath = Unquote-YamlValue $Matches[1] }
    if (-not $checkpointValue -and $line -match '^\s*checkpoints\s*:\s*(.+?)\s*$') { $checkpointValue = Unquote-YamlValue $Matches[1] }
    if ($basePath -and $checkpointValue) { break }
  }
  if (-not $basePath) { return "" }
  if (-not $checkpointValue) { $checkpointValue = "models/checkpoints" }

  $checkpointValue = $checkpointValue.Replace('/', [IO.Path]::DirectorySeparatorChar)
  if ([IO.Path]::IsPathRooted($checkpointValue)) { return [IO.Path]::GetFullPath($checkpointValue) }
  return [IO.Path]::GetFullPath((Join-Path $basePath $checkpointValue))
}

function Resolve-ManagedCheckpointDirectory {
  $installed = @(Get-ComfyManagedInstances | Where-Object { $_.State -eq "installed" -and $_.EngineRoot })
  if ($installed.Count -ne 1) { return "" }
  return [IO.Path]::GetFullPath((Join-Path $installed[0].EngineRoot "models\checkpoints"))
}

function Resolve-CheckpointDirectory {
  $shared = Resolve-DesktopSharedCheckpointDirectory
  if ($shared) { return $shared }
  return Resolve-ManagedCheckpointDirectory
}

function Test-SdxlName {
  param([string]$Name)
  return $Name -match '(?i)(sd.?xl|stable.?diffusion.?xl|juggernaut.?xl|realvis.?xl|dreamshaper.?xl)'
}

function Find-CompatibleCheckpoint {
  param([string]$Directory)
  if (-not $Directory -or -not (Test-Path -LiteralPath $Directory -PathType Container)) { return "" }
  $match = Get-ChildItem -LiteralPath $Directory -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -in @('.safetensors', '.ckpt') -and (Test-SdxlName $_.Name) } |
    Sort-Object Name |
    Select-Object -First 1
  return if ($match) { $match.FullName } else { "" }
}

function Test-ReviewedStarterFile {
  param([string]$Path)
  if (-not $Path -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
  $file = Get-Item -LiteralPath $Path
  if ([int64]$file.Length -ne $Starter.SizeBytes) { return $false }
  $hash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  return $hash -eq $Starter.Sha256
}

function Write-Markers {
  param([string]$State, [string]$Destination, [string]$Message)
  Write-Output "PLOTPICKLE_SDXL_STATUS=$State"
  Write-Output "PLOTPICKLE_SDXL_FILENAME=$($Starter.FileName)"
  Write-Output "PLOTPICKLE_SDXL_SIZE_BYTES=$($Starter.SizeBytes)"
  Write-Output "PLOTPICKLE_SDXL_SIZE_LABEL=$($Starter.SizeLabel)"
  Write-Output "PLOTPICKLE_SDXL_SHA256=$($Starter.Sha256)"
  Write-Output "PLOTPICKLE_SDXL_LICENSE=$($Starter.License)"
  Write-Output "PLOTPICKLE_SDXL_SOURCE_LABEL=$($Starter.SourceLabel)"
  Write-Output "PLOTPICKLE_SDXL_DESTINATION=$Destination"
  Write-Output "PLOTPICKLE_SDXL_DETAIL=$Message"
}

function Download-ReviewedStarter {
  param([string]$DestinationFile)
  $partial = "$DestinationFile.partial"
  if (Test-Path -LiteralPath $partial -PathType Leaf) { Remove-Item -LiteralPath $partial -Force }

  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $client = New-Object System.Net.Http.HttpClient
  $client.Timeout = [TimeSpan]::FromHours(2)
  try {
    $response = $client.GetAsync($Starter.Source, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
    $response.EnsureSuccessStatusCode()
    $input = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
    try {
      $output = [IO.File]::Open($partial, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
      try { $input.CopyToAsync($output).GetAwaiter().GetResult() } finally { $output.Dispose() }
    } finally { $input.Dispose() }
  } finally { $client.Dispose() }

  $downloaded = Get-Item -LiteralPath $partial
  if ([int64]$downloaded.Length -ne $Starter.SizeBytes) {
    Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
    throw "The SDXL download size did not match the reviewed file. Nothing was activated."
  }
  $hash = (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -ne $Starter.Sha256) {
    Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
    throw "The SDXL download hash did not match the reviewed file. Nothing was activated."
  }
  Move-Item -LiteralPath $partial -Destination $DestinationFile
}

$checkpointDirectory = Resolve-CheckpointDirectory
if (-not $checkpointDirectory) {
  Write-Markers -State "unsupported" -Destination "" -Message "PlotPickle could not resolve one unambiguous managed ComfyUI checkpoint directory. Open ComfyUI Desktop Storage settings and keep its shared model library enabled, then retry."
  exit 2
}

$destination = Join-Path $checkpointDirectory $Starter.FileName
$compatible = Find-CompatibleCheckpoint -Directory $checkpointDirectory
if ($compatible -and -not (Test-Path -LiteralPath $destination -PathType Leaf)) {
  Write-Markers -State "existing-compatible" -Destination $compatible -Message "An SDXL-compatible checkpoint already exists. PlotPickle will not download another starter automatically."
  exit 0
}
if (Test-ReviewedStarterFile -Path $destination) {
  Write-Markers -State "ready" -Destination $destination -Message "The reviewed SDXL 1.0 starter is already installed and verified."
  exit 0
}
if (Test-Path -LiteralPath $destination -PathType Leaf) {
  Write-Markers -State "conflict" -Destination $destination -Message "A file already uses the reviewed SDXL starter filename but does not match its reviewed size and SHA-256. PlotPickle will not overwrite it."
  exit 3
}

if ($Mode -eq "Status") {
  Write-Markers -State "missing" -Destination $destination -Message "The reviewed SDXL 1.0 starter is not installed. Explicit approval is required before the 6.94 GB download."
  exit 0
}
if (-not $Approved) {
  Write-Markers -State "approval-required" -Destination $destination -Message "Explicit approval is required before PlotPickle downloads the reviewed SDXL 1.0 starter."
  exit 4
}

New-Item -ItemType Directory -Force -Path $checkpointDirectory | Out-Null
Write-Host "[SDXL] Explicit download approved. Source: $($Starter.SourceLabel)"
Write-Host "[SDXL] Size: $($Starter.SizeLabel) | License: $($Starter.License)"
Write-Host "[SDXL] Destination: $destination"
Download-ReviewedStarter -DestinationFile $destination
if (-not (Test-ReviewedStarterFile -Path $destination)) { throw "The reviewed SDXL starter did not pass post-install verification." }
Write-Markers -State "installed" -Destination $destination -Message "The reviewed SDXL 1.0 starter was downloaded, size/hash verified, and activated in ComfyUI's checkpoint library."
