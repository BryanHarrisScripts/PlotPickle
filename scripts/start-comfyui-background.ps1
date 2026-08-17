[CmdletBinding()]
param(
  [string]$BaseUrl = "http://127.0.0.1:8188",
  [int]$ReadyTimeoutSeconds = 45
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

$roots = @(Get-ComfyRoots)
$mainPath = Find-ComfyMain $roots
$desktopExe = Find-ComfyDesktopExecutable

if (-not $mainPath -and $desktopExe) {
  Write-Host "[DESKTOP] ComfyUI Desktop is installed, but its local API is not ready. Opening Desktop..."
  Write-Host "          PlotPickle will not install checkpoints, workflows, or large video/H3 model packs automatically."
  try { $process = Start-Process -FilePath $desktopExe -PassThru }
  catch {
    Write-Warning "ComfyUI Desktop could not be opened: $($_.Exception.Message)"
    Write-Status "desktop-launch-failed" $desktopExe
    exit 1
  }
  $state = Wait-ComfyApi $endpoint.BaseUrl $ReadyTimeoutSeconds $process
  if ($state -eq "ready") {
    Write-Host "[READY] ComfyUI Desktop's local API is responding at $($endpoint.BaseUrl)."
    Write-Status "desktop-started-ready" $desktopExe
    exit 0
  }
  if ($state -eq "exited") {
    Write-Warning "ComfyUI Desktop closed before its local API became ready."
    Write-Status "desktop-exited-before-ready" $desktopExe
    exit 1
  }
  Write-Warning "ComfyUI Desktop opened, but its local API did not become ready within $ReadyTimeoutSeconds seconds."
  Write-Host "[NEXT] Complete any visible first-run setup in Desktop and start its local engine. PlotPickle did not start a model/H3 download."
  Write-Status "desktop-opened-api-not-ready" $desktopExe
  exit 1
}

if (-not $mainPath) {
  if ($roots.Count) {
    Write-Host "[INFO] ComfyUI is installed, but neither a Desktop executable nor a headless main.py entry point could be located."
    Write-Status "installed-entrypoint-not-found" ($roots -join "; ")
  } else {
    Write-Host "[INFO] ComfyUI was not detected. It remains optional."
    Write-Status "not-installed"
  }
  exit 0
}

$python = Find-ComfyPython $mainPath
if (-not $python) {
  Write-Warning "ComfyUI main.py was found at $mainPath, but no compatible Python runtime was found."
  Write-Status "python-not-found" $mainPath
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
  Write-Warning "ComfyUI could not be started: $($_.Exception.Message)"
  Write-Status "launch-failed" $mainPath
  exit 1
}
$state = Wait-ComfyApi $endpoint.BaseUrl $ReadyTimeoutSeconds $process
if ($state -eq "ready") {
  Write-Host "[READY] ComfyUI is responding at $($endpoint.BaseUrl)."
  Write-Status "started-ready" $stdout
  exit 0
}
if ($state -eq "exited") {
  Write-Warning "ComfyUI exited before its API became ready. Review $stderr"
  Write-Status "exited-before-ready" $stderr
  exit 1
}
Write-Warning "ComfyUI did not become ready within $ReadyTimeoutSeconds seconds. Review $stdout and $stderr"
Write-Status "starting-timeout" $stdout
exit 1
