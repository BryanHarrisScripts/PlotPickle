[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Ollama", "ComfyUI")]
  [string]$Tool,

  [switch]$CheckOnly,
  [switch]$Install,
  [switch]$Maintain
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
$StarterModel = "smollm2:135m-instruct-q2_K"
$OllamaTagsUrl = "http://127.0.0.1:11434/api/tags"
$OllamaPullUrl = "http://127.0.0.1:11434/api/pull"
$ComfyStarter = Join-Path $PSScriptRoot "start-comfyui-background.ps1"
$ComfyReadyStatuses = @("ready-existing", "desktop-started-ready", "started-ready")

function Write-ToolStatus {
  param(
    [Parameter(Mandatory = $true)][string]$Status,
    [string]$Location = "",
    [string]$Detail = ""
  )
  Write-Output "PLOTPICKLE_LOCAL_AI_TOOL=$Tool"
  Write-Output "PLOTPICKLE_LOCAL_AI_STATUS=$Status"
  if ($Location) { Write-Output "PLOTPICKLE_LOCAL_AI_LOCATION=$Location" }
  if ($Detail) { Write-Output "PLOTPICKLE_LOCAL_AI_DETAIL=$Detail" }
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

function Get-OllamaModels {
  try {
    $response = Invoke-RestMethod -Uri $OllamaTagsUrl -Method Get -TimeoutSec 4
    return @($response.models | ForEach-Object {
      if ($_.name) { [string]$_.name } elseif ($_.model) { [string]$_.model }
    } | Where-Object { $_ })
  }
  catch {
    return @()
  }
}

function Install-OllamaStarterModel {
  if (-not (Test-LoopbackService -Endpoint $OllamaTagsUrl)) {
    Write-Warning "Ollama is installed but not running. Start Ollama, then revisit PlotPickle Settings or run Start-PlotPickle.bat again."
    return $false
  }

  $existingModels = @(Get-OllamaModels)
  if ($existingModels.Count -gt 0) {
    Write-Host "[OK] Ollama already reports $($existingModels.Count) installed model(s)."
    return $true
  }

  Write-Host "[MODEL] Ollama is running without a model. Installing PlotPickle's reviewed starter model: $StarterModel"
  Write-Host "        This approximately 88 MB model verifies the lowest-resource local path; it is not the recommended final writing model."
  try {
    $body = @{ model = $StarterModel; stream = $false } | ConvertTo-Json -Compress
    $result = Invoke-RestMethod -Uri $OllamaPullUrl -Method Post -ContentType "application/json" -Body $body -TimeoutSec 900
    if ([string]$result.status -ne "success") {
      throw "Ollama did not report a successful model pull."
    }
    $refreshed = @(Get-OllamaModels)
    if ($refreshed -notcontains $StarterModel) {
      throw "The starter-model pull completed, but /api/tags did not report $StarterModel."
    }
    Write-Host "[SUCCESS] Ollama starter model installed and verified: $StarterModel"
    return $true
  }
  catch {
    Write-Warning "The Ollama starter model could not be installed: $($_.Exception.Message)"
    Write-Host "PlotPickle will continue in No AI mode. Retry from Settings > Ollama."
    return $false
  }
}

function Get-ComfyStarterValue {
  param(
    [Parameter(Mandatory = $true)][string[]]$Lines,
    [Parameter(Mandatory = $true)][string]$Name
  )
  $prefix = "$Name="
  $match = $Lines | Where-Object { $_.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) } | Select-Object -Last 1
  if (-not $match) { return "" }
  return ([string]$match).Substring($prefix.Length).Trim()
}

function Start-ComfyUIForPlotPickle {
  if (-not (Test-Path -LiteralPath $ComfyStarter -PathType Leaf)) {
    $detail = "The ComfyUI background starter is missing. PlotPickle will continue and ComfyUI can still be started manually."
    Write-Warning $detail
    return [pscustomobject]@{ Ready = $false; Status = "starter-missing"; Detail = $detail }
  }
  $baseUrl = if ($env:PLOTPICKLE_COMFYUI_URL) { $env:PLOTPICKLE_COMFYUI_URL } else { "http://127.0.0.1:8188" }
  Write-Host "[STARTUP] Ensuring installed ComfyUI is available as PlotPickle's local image engine at $baseUrl..."
  try {
    $rawOutput = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ComfyStarter -BaseUrl $baseUrl -ReadyTimeoutSeconds 90 -AllowDesktopLaunch 2>&1)
    $exitCode = [int]$LASTEXITCODE
    $lines = @($rawOutput | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
    foreach ($line in $lines) { Write-Host $line }

    $status = Get-ComfyStarterValue -Lines $lines -Name "PLOTPICKLE_COMFYUI_STATUS"
    $detail = Get-ComfyStarterValue -Lines $lines -Name "PLOTPICKLE_COMFYUI_DETAIL"
    if (-not $status) { $status = if ($exitCode -eq 0) { "api-status-missing" } else { "startup-failed" } }
    if (-not $detail) { $detail = "ComfyUI starter exited with code $exitCode without a readiness detail." }
    $ready = $exitCode -eq 0 -and $ComfyReadyStatuses -contains $status

    if (-not $ready) {
      Write-Warning "ComfyUI Desktop may be installed, but its local API is not ready. $detail PlotPickle will continue; finish ComfyUI Desktop first-run setup or review the PlotPickle ComfyUI startup log, then retry."
    } else {
      Write-Host "[OK] ComfyUI local API is ready at $baseUrl."
    }
    return [pscustomobject]@{ Ready = $ready; Status = $status; Detail = $detail }
  }
  catch {
    $detail = "ComfyUI local-image startup failed: $($_.Exception.Message). PlotPickle will continue."
    Write-Warning $detail
    return [pscustomobject]@{ Ready = $false; Status = "startup-failed"; Detail = $detail }
  }
}

function Find-Ollama {
  $command = Get-Command "ollama.exe" -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  if ($env:LOCALAPPDATA) {
    $candidate = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
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
  if (Test-LoopbackService -Endpoint ([string]$definition.Endpoint)) { return [string]$definition.Endpoint }
  if ($Tool -eq "Ollama") { return Find-Ollama }
  return Find-InstalledApplication -Pattern ([string]$definition.DisplayPattern)
}

function Invoke-ReviewedUpgrade {
  param([Parameter(Mandatory = $true)][string]$PackageId)
  $winget = Get-Command "winget.exe" -ErrorAction SilentlyContinue
  if (-not $winget) {
    Write-Host "[SKIP] Windows Package Manager is unavailable; $Tool remains user-managed."
    return
  }
  Write-Host "[UPDATE] Checking $Tool through reviewed package $PackageId..."
  try {
    & $winget.Source upgrade --id $PackageId --exact --source winget --include-unknown --accept-source-agreements --accept-package-agreements --disable-interactivity
    if ($LASTEXITCODE -ne 0) { Write-Warning "$Tool update check exited with code $LASTEXITCODE. PlotPickle will continue." }
  }
  catch {
    Write-Warning "$Tool update check failed: $($_.Exception.Message). PlotPickle will continue."
  }
}

$definition = $Definitions[$Tool]
$existing = Find-Tool
if ($existing) {
  Write-Host "[OK] $Tool detected at $existing"
  if ($Maintain) {
    Invoke-ReviewedUpgrade -PackageId ([string]$definition.PackageId)
    if ($Tool -eq "Ollama") { [void](Install-OllamaStarterModel) }
    if ($Tool -eq "ComfyUI") {
      $comfyReadiness = Start-ComfyUIForPlotPickle
      Write-ToolStatus -Status ([string]$comfyReadiness.Status) -Location $existing -Detail ([string]$comfyReadiness.Detail)
      if (-not $comfyReadiness.Ready) { exit 1 }
      exit 0
    }
  }
  if ($Tool -eq "ComfyUI" -and -not (Test-LoopbackService -Endpoint ([string]$definition.Endpoint))) {
    Write-Host "[INFO] ComfyUI Desktop is installed, but the local API is not responding on 127.0.0.1:8188."
    Write-ToolStatus -Status "installed-api-not-ready" -Location $existing -Detail "Start or finish ComfyUI Desktop so /system_stats responds locally."
    exit 3
  }
  Write-ToolStatus -Status "detected" -Location $existing
  exit 0
}

if ($CheckOnly -or (-not $Install -and -not $Maintain)) {
  Write-Host "[INFO] $Tool was not detected. It remains optional."
  Write-ToolStatus -Status "missing"
  exit 3
}

if ($Maintain -and -not $Install) {
  Write-Host "[INFO] $Tool is not installed, so automatic maintenance was skipped."
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
Write-Host "PlotPickle does not request a silent install or enable cloud fallback."
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
  if ($Tool -eq "Ollama") {
    [void](Install-OllamaStarterModel)
  } else {
    Write-Host "Models, checkpoints and workflows remain separate and were not downloaded."
    if ($Tool -eq "ComfyUI") {
      $comfyReadiness = Start-ComfyUIForPlotPickle
      Write-ToolStatus -Status ([string]$comfyReadiness.Status) -Location $installed -Detail ([string]$comfyReadiness.Detail)
      if (-not $comfyReadiness.Ready) { exit 1 }
      exit 0
    }
  }
  Write-ToolStatus -Status "installed" -Location $installed
  exit 0
}

Write-Host "[INFO] The $Tool installer completed, but the application is not running yet."
if ($Tool -eq "Ollama") {
  Write-Host "[REVISIT] Start Ollama, then run Start-PlotPickle.bat again so the starter model can be installed."
} else {
  Write-Host "Models, checkpoints and workflows remain separate and were not downloaded."
}
Write-ToolStatus -Status "installed-not-running"
exit 0