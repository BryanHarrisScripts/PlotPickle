[CmdletBinding()]
param(
  [string]$BaseUrl = "http://127.0.0.1:8188",
  [int]$ReadyTimeoutSeconds = 45,
  [switch]$AllowDesktopLaunch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Status([string]$Status, [string]$Detail = "") {
  Write-Output "PLOTPICKLE_COMFYUI_STATUS=$Status"
  if ($Detail) { Write-Output "PLOTPICKLE_COMFYUI_DETAIL=$Detail" }
}

function Get-LoopbackEndpoint([string]$Value) {
  try { $uri = [Uri]$Value } catch { throw "Invalid ComfyUI URL: $Value" }
  $hostName = $uri.Host.ToLowerInvariant()
  if ($uri.Scheme -ne "http" -or $hostName -notin @("127.0.0.1", "localhost", "::1")) {
    throw "ComfyUI startup is restricted to a local HTTP address."
  }
  if ($uri.UserInfo -or ($uri.AbsolutePath -and $uri.AbsolutePath -ne "/") -or $uri.Query -or $uri.Fragment) {
    throw "ComfyUI startup accepts only a loopback host and port."
  }
  $port = if ($uri.IsDefaultPort) { 8188 } else { $uri.Port }
  if ($port -lt 1 -or $port -gt 65535) { throw "ComfyUI port must be between 1 and 65535." }
  [pscustomobject]@{ Host = $hostName; Port = $port; BaseUrl = "http://$($uri.Host):$port" }
}

function Test-ComfyApi([string]$Url) {
  try { return $null -ne (Invoke-RestMethod -Uri "$Url/system_stats" -Method Get -TimeoutSec 2) } catch { return $false }
}

function Find-AlternateComfyApi([int]$ExpectedPort) {
  foreach ($port in @(8187, 8188, 8189, 8190, 8000) | Select-Object -Unique) {
    if ($port -eq $ExpectedPort) { continue }
    $candidate = "http://127.0.0.1:$port"
    if (Test-ComfyApi $candidate) { return $candidate }
  }
  return ""
}

function Get-Property([object]$Object, [string]$Name) {
  if ($null -eq $Object) { return "" }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property -or $null -eq $property.Value) { return "" }
  return [string]$property.Value
}

function Get-ComfyRegistryEntries {
  $result = New-Object System.Collections.Generic.List[object]
  foreach ($root in @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )) {
    foreach ($entry in @(Get-ItemProperty -Path $root -ErrorAction SilentlyContinue)) {
      if ((Get-Property $entry "DisplayName") -match "^(ComfyUI|Comfy Desktop)") { $result.Add($entry) }
    }
  }
  return @($result)
}

function Resolve-Exe([string]$Value) {
  if (-not $Value) { return "" }
  $candidate = [Environment]::ExpandEnvironmentVariables($Value).Trim()
  if ($candidate -match '^"([^"]+\.exe)"') { $candidate = $Matches[1] }
  elseif ($candidate -match '^([^,]+\.exe)(?:,\d+)?$') { $candidate = $Matches[1] }
  $candidate = $candidate.Trim().Trim('"')
  if (Test-Path -LiteralPath $candidate -PathType Leaf) { return (Resolve-Path -LiteralPath $candidate).Path }
  return ""
}

function Find-ComfyDesktopExecutable {
  foreach ($entry in @(Get-ComfyRegistryEntries)) {
    $icon = Resolve-Exe (Get-Property $entry "DisplayIcon")
    if ($icon -and (Split-Path -Leaf $icon) -notmatch "(?i)unins|uninstall|update") { return $icon }
    $location = Get-Property $entry "InstallLocation"
    if ($location) {
      foreach ($leaf in @("ComfyUI.exe", "ComfyUI Desktop.exe", "comfyui.exe")) {
        $candidate = Join-Path $location $leaf
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return (Resolve-Path -LiteralPath $candidate).Path }
      }
    }
  }
  foreach ($candidate in @(
    $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "Programs\ComfyUI\ComfyUI.exe" }),
    $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "Programs\ComfyUI Desktop\ComfyUI Desktop.exe" }),
    $(if ($env:ProgramFiles) { Join-Path $env:ProgramFiles "ComfyUI\ComfyUI.exe" })
  )) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return (Resolve-Path -LiteralPath $candidate).Path }
  }
  return ""
}

function Get-ComfyRoots {
  $roots = New-Object System.Collections.Generic.List[string]
  foreach ($entry in @(Get-ComfyRegistryEntries)) {
    $location = Get-Property $entry "InstallLocation"
    if ($location -and (Test-Path -LiteralPath $location -PathType Container)) { $roots.Add($location) }
  }
  foreach ($candidate in @(
    $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "Programs\ComfyUI" }),
    $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "ComfyUI" }),
    $(if ($env:USERPROFILE) { Join-Path $env:USERPROFILE "ComfyUI" }),
    $(if ($env:USERPROFILE) { Join-Path $env:USERPROFILE "ComfyUI_windows_portable" })
  )) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Container)) { $roots.Add($candidate) }
  }
  return @($roots | Select-Object -Unique)
}

function Find-ComfyMain([string[]]$Roots) {
  foreach ($root in $Roots) {
    foreach ($relative in @("main.py", "ComfyUI\main.py", "resources\ComfyUI\main.py", "resources\app\ComfyUI\main.py")) {
      $candidate = Join-Path $root $relative
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { return (Resolve-Path -LiteralPath $candidate).Path }
    }
  }
  return ""
}

function Find-ComfyPython([string]$MainPath) {
  $mainDir = Split-Path -Parent $MainPath
  $root = Split-Path -Parent $mainDir
  foreach ($candidate in @(
    (Join-Path $mainDir ".venv\Scripts\python.exe"), (Join-Path $mainDir "venv\Scripts\python.exe"),
    (Join-Path $root "python_embeded\python.exe"), (Join-Path $root "python_embedded\python.exe"),
    (Join-Path $root ".venv\Scripts\python.exe"), (Join-Path $root "venv\Scripts\python.exe")
  )) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return (Resolve-Path -LiteralPath $candidate).Path }
  }
  $python = Get-Command "python.exe" -ErrorAction SilentlyContinue
  if ($python) { return $python.Source }
  return ""
}

function Wait-ComfyApi([string]$Url, [int]$TimeoutSeconds, [object]$Process = $null) {
  $deadline = (Get-Date).AddSeconds([Math]::Max(5, $TimeoutSeconds))
  while ((Get-Date) -lt $deadline) {
    if (Test-ComfyApi $Url) { return "ready" }
    if ($null -ne $Process -and $Process.HasExited) { return "exited" }
    Start-Sleep -Milliseconds 500
  }
  return "timeout"
}

$endpoint = Get-LoopbackEndpoint $BaseUrl
if (Test-ComfyApi $endpoint.BaseUrl) {
  Write-Host "[READY] ComfyUI is already running at $($endpoint.BaseUrl)."
  Write-Status "ready-existing" $endpoint.BaseUrl
  exit 0
}

$alternateApi = Find-AlternateComfyApi $endpoint.Port
if ($alternateApi) {
  $detail = "ComfyUI is responding at $alternateApi, but PlotPickle is configured for $($endpoint.BaseUrl). Set ComfyUI to port $($endpoint.Port) or correct the configured loopback URL."
  Write-Warning $detail
  Write-Status "api-wrong-port" $detail
  exit 1
}

$roots = @(Get-ComfyRoots)
$mainPath = Find-ComfyMain $roots
$desktopExe = Find-ComfyDesktopExecutable

if (-not $mainPath -and $desktopExe -and -not $AllowDesktopLaunch) {
  $detail = "ComfyUI Desktop is installed, but its local engine/API is not running at $($endpoint.BaseUrl). Open Desktop, finish first-run instance setup if shown, and start the local engine."
  Write-Host "[INFO] $detail"
  Write-Host "       PlotPickle will not open Desktop without an explicit user action."
  Write-Host "       Use the reviewed Settings action, or rerun this starter with -AllowDesktopLaunch."
  Write-Status "desktop-installed-not-running" $detail
  exit 0
}

if (-not $mainPath -and $desktopExe) {
  Write-Host "[DESKTOP] Opening ComfyUI Desktop at the user's request..."
  Write-Host "          PlotPickle will not install checkpoints, workflows, or large video/H3 model packs automatically."
  try { $null = Start-Process -FilePath $desktopExe -PassThru }
  catch {
    $detail = "ComfyUI Desktop could not be opened: $($_.Exception.Message)"
    Write-Warning $detail
    Write-Status "desktop-launch-failed" $detail
    exit 1
  }
  $state = Wait-ComfyApi $endpoint.BaseUrl $ReadyTimeoutSeconds
  if ($state -eq "ready") {
    Write-Host "[READY] ComfyUI Desktop's local API is responding at $($endpoint.BaseUrl)."
    Write-Status "desktop-started-ready" $endpoint.BaseUrl
    exit 0
  }
  $alternateApi = Find-AlternateComfyApi $endpoint.Port
  if ($alternateApi) {
    $detail = "ComfyUI Desktop opened and its API responds at $alternateApi, but PlotPickle expects $($endpoint.BaseUrl). Change the Desktop server port to $($endpoint.Port), then retry."
    Write-Warning $detail
    Write-Status "desktop-api-wrong-port" $detail
    exit 1
  }
  $detail = "ComfyUI Desktop opened, but /system_stats did not respond at $($endpoint.BaseUrl) within $ReadyTimeoutSeconds seconds. Complete any visible first-run instance setup, select/configure a local instance, and start the local engine; confirm that its server port is $($endpoint.Port)."
  Write-Warning $detail
  Write-Host "[NEXT] PlotPickle did not start a checkpoint, model, workflow, or H3 download and will continue without local image generation."
  Write-Status "desktop-opened-api-not-ready" $detail
  exit 1
}

if (-not $mainPath) {
  if ($roots.Count) {
    $detail = "ComfyUI is installed, but neither a Desktop executable nor a headless main.py entry point could be located. Re-open ComfyUI Desktop and confirm a local instance is configured."
    Write-Host "[INFO] $detail"
    Write-Status "installed-entrypoint-not-found" $detail
  } else {
    Write-Host "[INFO] ComfyUI was not detected. It remains optional."
    Write-Status "not-installed" "Install ComfyUI only if you want local image generation; PlotPickle remains usable without it."
  }
  exit 0
}

$python = Find-ComfyPython $mainPath
if (-not $python) {
  $detail = "ComfyUI main.py was found at $mainPath, but no compatible Python runtime was found for that local instance."
  Write-Warning $detail
  Write-Status "python-not-found" $detail
  exit 1
}

$home = if ($env:PLOTPICKLE_HOME) { $env:PLOTPICKLE_HOME } elseif ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "PlotPickle" } else { Join-Path $env:USERPROFILE ".plotpickle" }
$logDir = Join-Path $home "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stdout = Join-Path $logDir "comfyui-startup.log"
$stderr = Join-Path $logDir "comfyui-startup-error.log"
$args = @($mainPath, "--dont-launch-browser", "--listen", $endpoint.Host, "--port", [string]$endpoint.Port)
Write-Host "[STARTING] Starting classic/portable ComfyUI as a hidden local backend at $($endpoint.BaseUrl)..."
try { $process = Start-Process -FilePath $python -ArgumentList $args -WorkingDirectory (Split-Path -Parent $mainPath) -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru }
catch {
  $detail = "ComfyUI could not be started: $($_.Exception.Message)"
  Write-Warning $detail
  Write-Status "launch-failed" $detail
  exit 1
}
$state = Wait-ComfyApi $endpoint.BaseUrl $ReadyTimeoutSeconds $process
if ($state -eq "ready") {
  Write-Host "[READY] ComfyUI is responding at $($endpoint.BaseUrl)."
  Write-Status "started-ready" $endpoint.BaseUrl
  exit 0
}
if ($state -eq "exited") {
  $detail = "ComfyUI exited before its API became ready. Review $stderr"
  Write-Warning $detail
  Write-Status "exited-before-ready" $detail
  exit 1
}
$alternateApi = Find-AlternateComfyApi $endpoint.Port
if ($alternateApi) {
  $detail = "A ComfyUI API is responding at $alternateApi instead of the configured $($endpoint.BaseUrl). Correct the local server port before retrying."
  Write-Warning $detail
  Write-Status "api-wrong-port" $detail
  exit 1
}
$detail = "ComfyUI did not become ready at $($endpoint.BaseUrl) within $ReadyTimeoutSeconds seconds. Review $stdout and $stderr"
Write-Warning $detail
Write-Status "starting-timeout" $detail
exit 1
