[CmdletBinding()]
param(
  [string]$BaseUrl = "http://127.0.0.1:8188",
  [int]$ReadyTimeoutSeconds = 45
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Status {
  param([string]$Status, [string]$Detail = "")
  Write-Output "PLOTPICKLE_COMFYUI_STATUS=$Status"
  if ($Detail) { Write-Output "PLOTPICKLE_COMFYUI_DETAIL=$Detail" }
}

function Get-LoopbackEndpoint {
  param([string]$Value)
  try { $uri = [Uri]$Value } catch { throw "Invalid ComfyUI URL: $Value" }
  if ($uri.Scheme -ne "http") { throw "ComfyUI startup accepts only a local HTTP address." }
  $hostName = $uri.Host.ToLowerInvariant()
  if ($hostName -notin @("127.0.0.1", "localhost", "::1")) { throw "ComfyUI startup is restricted to localhost." }
  if ($uri.UserInfo -or ($uri.AbsolutePath -and $uri.AbsolutePath -ne "/") -or $uri.Query -or $uri.Fragment) {
    throw "ComfyUI startup accepts only a loopback host and port, without credentials, path, query or fragment."
  }
  $port = if ($uri.IsDefaultPort) { 8188 } else { $uri.Port }
  if ($port -lt 1 -or $port -gt 65535) { throw "ComfyUI port must be between 1 and 65535." }
  return [pscustomobject]@{ Host = $hostName; Port = $port; BaseUrl = "http://$($uri.Host):$port" }
}

function Test-ComfyApi {
  param([string]$Url)
  try {
    $response = Invoke-RestMethod -Uri "$Url/system_stats" -Method Get -TimeoutSec 2
    return $null -ne $response
  }
  catch { return $false }
}

function Get-OptionalPropertyValue {
  param([AllowNull()][object]$InputObject, [string]$Name)
  if ($null -eq $InputObject) { return $null }
  try {
    $property = $InputObject.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
  }
  catch { return $null }
}

function Get-ComfyInstallRoots {
  $roots = New-Object System.Collections.Generic.List[string]
  $registryRoots = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )
  foreach ($registryRoot in $registryRoots) {
    foreach ($entry in @(Get-ItemProperty -Path $registryRoot -ErrorAction SilentlyContinue)) {
      $name = [string](Get-OptionalPropertyValue -InputObject $entry -Name "DisplayName")
      if (-not $name -or $name -notmatch "^(ComfyUI|Comfy Desktop)") { continue }
      $location = [string](Get-OptionalPropertyValue -InputObject $entry -Name "InstallLocation")
      if ($location -and (Test-Path -LiteralPath $location -PathType Container)) { $roots.Add($location) }
    }
  }

  foreach ($candidate in @(
    $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "Programs\ComfyUI" }),
    $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "ComfyUI" }),
    $(if ($env:APPDATA) { Join-Path $env:APPDATA "ComfyUI" }),
    $(if ($env:USERPROFILE) { Join-Path $env:USERPROFILE "ComfyUI" }),
    $(if ($env:USERPROFILE) { Join-Path $env:USERPROFILE "ComfyUI_windows_portable" }),
    $(if ($env:USERPROFILE) { Join-Path $env:USERPROFILE "Documents\ComfyUI" })
  )) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Container)) { $roots.Add($candidate) }
  }

  return @($roots | Select-Object -Unique)
}

function Find-ComfyMain {
  param([string[]]$Roots)
  foreach ($root in $Roots) {
    foreach ($relative in @("main.py", "ComfyUI\main.py", "resources\ComfyUI\main.py", "resources\app\ComfyUI\main.py")) {
      $candidate = Join-Path $root $relative
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { return (Resolve-Path -LiteralPath $candidate).Path }
    }
  }
  return ""
}

function Find-ComfyPython {
  param([string]$MainPath)
  $mainDir = Split-Path -Parent $MainPath
  $root = Split-Path -Parent $mainDir
  foreach ($candidate in @(
    (Join-Path $mainDir ".venv\Scripts\python.exe"),
    (Join-Path $mainDir "venv\Scripts\python.exe"),
    (Join-Path $root "python_embeded\python.exe"),
    (Join-Path $root "python_embedded\python.exe"),
    (Join-Path $root ".venv\Scripts\python.exe"),
    (Join-Path $root "venv\Scripts\python.exe")
  )) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return (Resolve-Path -LiteralPath $candidate).Path }
  }
  $python = Get-Command "python.exe" -ErrorAction SilentlyContinue
  if ($python) { return $python.Source }
  return ""
}

$endpoint = Get-LoopbackEndpoint -Value $BaseUrl
if (Test-ComfyApi -Url $endpoint.BaseUrl) {
  Write-Host "[READY] ComfyUI is already running at $($endpoint.BaseUrl). No second process was started."
  Write-Status -Status "ready-existing" -Detail $endpoint.BaseUrl
  exit 0
}

$roots = @(Get-ComfyInstallRoots)
$mainPath = Find-ComfyMain -Roots $roots
if (-not $mainPath) {
  if ($roots.Count -gt 0) {
    Write-Host "[INFO] ComfyUI is installed, but PlotPickle could not locate a headless main.py entry point."
    Write-Host "       Detected root(s): $($roots -join '; ')"
    Write-Status -Status "installed-entrypoint-not-found" -Detail ($roots -join "; ")
  } else {
    Write-Host "[INFO] ComfyUI was not detected. It remains optional."
    Write-Status -Status "not-installed"
  }
  exit 0
}

$python = Find-ComfyPython -MainPath $mainPath
if (-not $python) {
  Write-Warning "ComfyUI main.py was found at $mainPath, but no compatible Python runtime was found."
  Write-Status -Status "python-not-found" -Detail $mainPath
  exit 1
}

$plotPickleHome = if ($env:PLOTPICKLE_HOME) { $env:PLOTPICKLE_HOME } elseif ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "PlotPickle" } else { Join-Path $env:USERPROFILE ".plotpickle" }
$logDir = Join-Path $plotPickleHome "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stdoutLog = Join-Path $logDir "comfyui-startup.log"
$stderrLog = Join-Path $logDir "comfyui-startup-error.log"
$workingDirectory = Split-Path -Parent $mainPath
$arguments = @(
  $mainPath,
  "--dont-launch-browser",
  "--listen", $endpoint.Host,
  "--port", [string]$endpoint.Port
)

Write-Host "[STARTING] Starting ComfyUI as a hidden local backend..."
Write-Host "           Python: $python"
Write-Host "           Main:   $mainPath"
Write-Host "           URL:    $($endpoint.BaseUrl)"
Write-Host "           Log:    $stdoutLog"

try {
  $process = Start-Process -FilePath $python -ArgumentList $arguments -WorkingDirectory $workingDirectory -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
}
catch {
  Write-Warning "ComfyUI could not be started: $($_.Exception.Message)"
  Write-Status -Status "launch-failed" -Detail $mainPath
  exit 1
}

$deadline = (Get-Date).AddSeconds([Math]::Max(5, $ReadyTimeoutSeconds))
while ((Get-Date) -lt $deadline) {
  if (Test-ComfyApi -Url $endpoint.BaseUrl) {
    $statePath = Join-Path $plotPickleHome "runtime\comfyui-process.json"
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $statePath) | Out-Null
    @{ pid = $process.Id; startedBy = "PlotPickle"; baseUrl = $endpoint.BaseUrl; mainPath = $mainPath; log = $stdoutLog; startedAt = (Get-Date).ToUniversalTime().ToString("o") } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
    Write-Host "[READY] ComfyUI is responding at $($endpoint.BaseUrl)."
    Write-Status -Status "started-ready" -Detail $stdoutLog
    exit 0
  }
  if ($process.HasExited) {
    Write-Warning "ComfyUI exited before its API became ready. Review $stderrLog"
    Write-Status -Status "exited-before-ready" -Detail $stderrLog
    exit 1
  }
  Start-Sleep -Milliseconds 500
}

Write-Warning "ComfyUI did not become ready within $ReadyTimeoutSeconds seconds. It may still be loading models. Review $stdoutLog and $stderrLog"
Write-Status -Status "starting-timeout" -Detail $stdoutLog
exit 1
