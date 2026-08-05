[CmdletBinding(DefaultParameterSetName = "Check")]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Ollama", "ComfyUI")]
  [string]$Tool,

  [Parameter(ParameterSetName = "Check")]
  [switch]$CheckOnly,

  [Parameter(ParameterSetName = "Install")]
  [switch]$Install
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Definitions = @{
  Ollama = @{
    PackageId = "Ollama.Ollama"
    DownloadUrl = "https://ollama.com/download/windows"
    Endpoint = "http://127.0.0.1:11434/api/tags"
    DisplayPattern = "^Ollama"
  }
  ComfyUI = @{
    PackageId = "Comfy.ComfyUI-Desktop"
    DownloadUrl = "https://comfy.org/download"
    Endpoint = "http://127.0.0.1:8188/system_stats"
    DisplayPattern = "^(ComfyUI|Comfy Desktop)"
  }
}
$CompanionManager = Join-Path $PSScriptRoot "windows-companion-software.ps1"
$BootstrapModel = if ($env:PLOTPICKLE_OLLAMA_BOOTSTRAP_MODEL) { $env:PLOTPICKLE_OLLAMA_BOOTSTRAP_MODEL } else { "smollm:135m" }

function Write-ToolStatus {
  param(
    [Parameter(Mandatory = $true)][string]$Status,
    [string]$Location = ""
  )
  Write-Output "PLOTPICKLE_LOCAL_AI_TOOL=$Tool"
  Write-Output "PLOTPICKLE_LOCAL_AI_STATUS=$Status"
  if ($Location) { Write-Output "PLOTPICKLE_LOCAL_AI_LOCATION=$Location" }
}

function Test-LoopbackService {
  param([Parameter(Mandatory = $true)][string]$Endpoint)
  try {
    $response = Invoke-WebRequest -Uri $Endpoint -Method Get -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
  }
  catch {
    return $false
  }
}

function Find-Ollama {
  $command = Get-Command "ollama.exe" -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $candidates = @()
  if ($env:LOCALAPPDATA) {
    $candidates += (Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe")
  }
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }
  return ""
}

function Find-InstalledApplication {
  param([Parameter(Mandatory = $true)][string]$Pattern)
  $registryRoots = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )
  foreach ($root in $registryRoots) {
    foreach ($entry in @(Get-ItemProperty -Path $root -ErrorAction SilentlyContinue)) {
      $displayProperty = $entry.PSObject.Properties["DisplayName"]
      if (-not $displayProperty) { continue }
      $displayName = [string]$displayProperty.Value
      if ($displayName -notmatch $Pattern) { continue }

      $locationProperty = $entry.PSObject.Properties["InstallLocation"]
      if ($locationProperty -and $locationProperty.Value) { return [string]$locationProperty.Value }
      return $displayName
    }
  }
  return ""
}

function Find-Tool {
  $definition = $Definitions[$Tool]
  if (Test-LoopbackService -Endpoint ([string]$definition.Endpoint)) {
    return [string]$definition.Endpoint
  }
  if ($Tool -eq "Ollama") {
    return Find-Ollama
  }
  return Find-InstalledApplication -Pattern ([string]$definition.DisplayPattern)
}

function Invoke-OllamaBootstrap {
  if ($Tool -ne "Ollama" -or -not $Install) { return }
  if (-not (Test-Path -LiteralPath $CompanionManager -PathType Leaf)) {
    Write-Warning "Ollama was detected, but PlotPickle's companion maintenance script is missing."
    return
  }
  Write-Host "Checking Ollama model readiness."
  & $CompanionManager -Mode BootstrapOllama -BootstrapModel $BootstrapModel
}

$definition = $Definitions[$Tool]
$existing = Find-Tool
if ($existing) {
  Write-Host "[OK] $Tool detected at $existing"
  Invoke-OllamaBootstrap
  Write-ToolStatus -Status "detected" -Location $existing
  exit 0
}

if ($CheckOnly -or -not $Install) {
  Write-Host "[INFO] $Tool was not detected. It remains optional."
  if ($Tool -eq "Ollama") {
    Write-Host "Install Ollama, then revisit this installer so PlotPickle can add the $BootstrapModel starter model."
  }
  Write-ToolStatus -Status "missing"
  exit 3
}

if (-not [Environment]::Is64BitOperatingSystem) {
  Write-Warning "$Tool requires a supported 64-bit Windows installation."
  Write-ToolStatus -Status "unsupported-platform"
  exit 1
}

$downloadUri = [Uri]([string]$definition.DownloadUrl)
$allowedHost = if ($Tool -eq "Ollama") { "ollama.com" } else { "comfy.org" }
if ($downloadUri.Scheme -ne "https" -or $downloadUri.Host -ne $allowedHost) {
  Write-Warning "The reviewed official $Tool download destination is invalid."
  Write-ToolStatus -Status "invalid-download-url"
  exit 1
}

$winget = Get-Command "winget.exe" -ErrorAction SilentlyContinue
if (-not $winget) {
  Write-Warning "Windows Package Manager was not found. Opening the official $Tool download page instead."
  Start-Process ([string]$definition.DownloadUrl)
  Write-ToolStatus -Status "official-download-opened"
  exit 5
}

Write-Host "Opening the visible Windows Package Manager installation for $Tool."
Write-Host "Package: $($definition.PackageId)"
if ($Tool -eq "Ollama") {
  Write-Host "After Ollama is installed and responding, PlotPickle will pull $BootstrapModel only when no local model exists."
} else {
  Write-Host "PlotPickle does not download checkpoints, custom nodes, workflows, or enable cloud fallback."
}
& $winget.Source install --id ([string]$definition.PackageId) --exact --source winget --interactive --accept-source-agreements --accept-package-agreements
$wingetExit = $LASTEXITCODE
if ($wingetExit -ne 0) {
  Write-Warning "$Tool installation exited with code $wingetExit. Opening the official download page so setup can continue manually."
  Start-Process ([string]$definition.DownloadUrl)
  Write-ToolStatus -Status "installer-not-completed"
  exit 4
}

Start-Sleep -Seconds 2
$installed = Find-Tool
if ($installed) {
  Write-Host "[SUCCESS] $Tool is installed or running at $installed"
  Invoke-OllamaBootstrap
  Write-ToolStatus -Status "installed" -Location $installed
  exit 0
}

Write-Host "[INFO] The $Tool installer completed, but the application is not running yet."
if ($Tool -eq "Ollama") {
  Write-Host "Start Ollama, then rerun this installer so PlotPickle can pull $BootstrapModel when the model list is empty."
} else {
  Write-Host "Checkpoints, custom nodes and workflows remain separate and were not downloaded."
}
Write-ToolStatus -Status "installed-not-running"
exit 0
