[CmdletBinding()]
param(
  [string]$BaseUrl = "http://127.0.0.1:8188",
  [int]$ReadyTimeoutSeconds = 45,
  [switch]$AllowDesktopLaunch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ManagedInstanceCore = Join-Path $PSScriptRoot "comfyui-managed-instance-core.ps1"
if (-not (Test-Path -LiteralPath $ManagedInstanceCore -PathType Leaf)) {
  throw "PlotPickle's ComfyUI managed-instance inspector is missing: $ManagedInstanceCore"
}
. $ManagedInstanceCore

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
  return $result.ToArray()
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
      foreach ($leaf in @("Comfy Desktop.exe", "ComfyUI.exe", "ComfyUI Desktop.exe", "comfyui.exe")) {
        $candidate = Join-Path $location $leaf
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return (Resolve-Path -LiteralPath $candidate).Path }
      }
    }
  }
  foreach ($candidate in @(
    $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "Programs\Comfy Desktop\Comfy Desktop.exe" }),
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
  return @($roots.ToArray() | Select-Object -Unique)
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

function Get-NvidiaComputeProfile {
  $result = [ordered]@{ Name = ""; ComputeCapability = ""; Generation = "none" }
  $smi = Get-Command "nvidia-smi.exe" -ErrorAction SilentlyContinue
  if (-not $smi) { $smi = Get-Command "nvidia-smi" -ErrorAction SilentlyContinue }
  if (-not $smi) { return [pscustomobject]$result }
  $line = (& $smi.Source --query-gpu=name,compute_cap --format=csv,noheader,nounits 2>$null | Select-Object -First 1)
  if (-not $line) { return [pscustomobject]$result }
  $parts = @([string]$line -split "," | ForEach-Object { $_.Trim() })
  if ($parts.Count -ge 1) { $result.Name = $parts[0] }
  if ($parts.Count -ge 2) { $result.ComputeCapability = $parts[1] }
  $major = 0
  if ($result.ComputeCapability -match "^(\d+)") { $major = [int]$Matches[1] }
  if ($major -eq 6 -or $result.Name -match "GTX\s*10\d{2}|Titan\s+Xp|Titan\s+X.*Pascal") { $result.Generation = "pascal" }
  elseif ($major -eq 7 -or $result.Name -match "RTX\s*20|GTX\s*16") { $result.Generation = "turing" }
  elseif ($major -eq 8) { $result.Generation = "ampere-or-ada" }
  elseif ($major -ge 9) { $result.Generation = "modern" }
  elseif ($result.Name) { $result.Generation = "other" }
  return [pscustomobject]$result
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

function Open-ComfyDesktop([string]$DesktopExe) {
  Write-Host "[DESKTOP] Opening ComfyUI Desktop at the user's request..."
  Write-Host "          PlotPickle will not install checkpoints, workflows, or large video/H3 model packs automatically."
  try {
    $null = Start-Process -FilePath $DesktopExe -PassThru
    return [pscustomobject]@{ Ok = $true; Detail = "" }
  }
  catch {
    return [pscustomobject]@{ Ok = $false; Detail = "ComfyUI Desktop could not be opened: $($_.Exception.Message)" }
  }
}

function Test-SamePath([string]$Left, [string]$Right) {
  if (-not $Left -or -not $Right) { return $false }
  try {
    $leftFull = [IO.Path]::GetFullPath($Left).TrimEnd('\', '/')
    $rightFull = [IO.Path]::GetFullPath($Right).TrimEnd('\', '/')
    return $leftFull -ieq $rightFull
  } catch { return $false }
}

function Find-ComfyDesktopModelPathsConfig([object]$Instance) {
  if (-not $env:APPDATA) { return "" }
  foreach ($dataRoot in @(
    (Join-Path $env:APPDATA "Comfy Desktop"),
    (Join-Path $env:APPDATA "ComfyUI")
  )) {
    if (-not (Test-Path -LiteralPath $dataRoot -PathType Container)) { continue }

    $installationsPath = Join-Path $dataRoot "installations.json"
    if (Test-Path -LiteralPath $installationsPath -PathType Leaf) {
      try {
        $records = @(Get-Content -LiteralPath $installationsPath -Raw -ErrorAction Stop | ConvertFrom-Json)
        $record = $records | Where-Object { $_.installPath -and (Test-SamePath ([string]$_.installPath) ([string]$Instance.InstallRoot)) } | Select-Object -First 1
        if ($record -and $record.id) {
          $instanceYaml = Join-Path (Join-Path $dataRoot "instance-model-paths") "$($record.id).yaml"
          if (Test-Path -LiteralPath $instanceYaml -PathType Leaf) { return (Resolve-Path -LiteralPath $instanceYaml).Path }
        }
      } catch { }
    }

    $sharedYaml = Join-Path $dataRoot "shared_model_paths.yaml"
    if (Test-Path -LiteralPath $sharedYaml -PathType Leaf) { return (Resolve-Path -LiteralPath $sharedYaml).Path }
  }
  return ""
}

function Get-ComfyStartupLogs([string]$Stem) {
  $home = if ($env:PLOTPICKLE_HOME) { $env:PLOTPICKLE_HOME } elseif ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "PlotPickle" } else { Join-Path $env:USERPROFILE ".plotpickle" }
  $logDir = Join-Path $home "logs"
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  return [pscustomobject]@{
    Stdout = Join-Path $logDir "$Stem.log"
    Stderr = Join-Path $logDir "$Stem-error.log"
  }
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

$managedRoots = @(Get-ComfyManagedInstallRootCandidates)
$managedInstances = @(Get-ComfyManagedInstances -Roots $managedRoots)
$managedInstalled = @($managedInstances | Where-Object { $_.State -eq "installed" })
$managedProvisioning = @($managedInstances | Where-Object { $_.State -ne "installed" })
$roots = @(Get-ComfyRoots)
$mainPath = Find-ComfyMain $roots
$desktopExe = Find-ComfyDesktopExecutable

if (-not $mainPath -and $desktopExe -and $managedInstances.Count -eq 0) {
  if ($AllowDesktopLaunch) {
    $opened = Open-ComfyDesktop $desktopExe
    if (-not $opened.Ok) {
      Write-Warning $opened.Detail
      Write-Status "desktop-launch-failed" $opened.Detail
      exit 1
    }
  }
  $detail = "Comfy Desktop is installed, but no local managed ComfyUI instance was found in the current default install roots. Open Desktop and choose New Instance (or add an existing local installation); starter model packs are not required for the engine itself."
  Write-Host "[SETUP] $detail"
  Write-Status "desktop-no-managed-instance" $detail
  if ($AllowDesktopLaunch) { exit 1 } else { exit 0 }
}

if (-not $mainPath -and $desktopExe -and $managedProvisioning.Count -gt 0 -and $managedInstalled.Count -eq 0) {
  if ($AllowDesktopLaunch) {
    $opened = Open-ComfyDesktop $desktopExe
    if (-not $opened.Ok) {
      Write-Warning $opened.Detail
      Write-Status "desktop-launch-failed" $opened.Detail
      exit 1
    }
  }
  $instance = $managedProvisioning[0]
  $detail = "Comfy Desktop has a managed instance at $($instance.InstallRoot), but its main.py / virtual environment is still incomplete. Installation or package provisioning appears to still be in progress; let Desktop finish, then retry. PlotPickle will not relaunch it repeatedly or download models."
  Write-Host "[PROVISIONING] $detail"
  Write-Status "desktop-instance-provisioning" $detail
  exit 1
}

if (-not $mainPath -and $desktopExe -and $managedInstalled.Count -gt 0) {
  $instance = $managedInstalled[0]
  $stack = Get-ComfyManagedEnvironmentStack -Instance $instance
  $gpu = Get-NvidiaComputeProfile
  if ($gpu.Generation -eq "pascal" -and $stack.Torch -and -not (Test-ComfyPascalCu126Stack -Stack $stack)) {
    $expected = Get-PlotPicklePascalCu126Stack
    $detail = "The managed ComfyUI instance uses torch=$($stack.Torch), torchvision=$($stack.TorchVision), torchaudio=$($stack.TorchAudio). This Pascal GPU ($($gpu.Name), compute $($gpu.ComputeCapability)) requires PlotPickle's reviewed CUDA 12.6 compatibility stack: torch=$($expected.Torch), torchvision=$($expected.TorchVision), torchaudio=$($expected.TorchAudio). Passive verification will not modify it. Run scripts\configure-hardware-aware-local-ai.ps1 -Mode Configure -ConfigureComfyUI only when you explicitly approve the local repair."
    Write-Warning $detail
    Write-Status "desktop-pascal-stack-incompatible" $detail
    exit 1
  }

  if (-not $AllowDesktopLaunch) {
    $detail = "A managed ComfyUI instance is installed at $($instance.InstallRoot), but its local API is stopped at $($endpoint.BaseUrl). PlotPickle did not open Desktop or start the optional engine during passive verification."
    Write-Host "[INFO] $detail"
    Write-Status "desktop-managed-engine-stopped" $detail
    exit 0
  }

  $logs = Get-ComfyStartupLogs "comfyui-managed-startup"
  $modelPathsConfig = Find-ComfyDesktopModelPathsConfig -Instance $instance
  $managedArgs = @($instance.MainPath, "--disable-auto-launch", "--listen", $endpoint.Host, "--port", [string]$endpoint.Port)
  if ($modelPathsConfig) {
    $managedArgs += @("--extra-model-paths-config", "`"$modelPathsConfig`"")
    Write-Host "[MODELS] Reusing Comfy Desktop model-path configuration: $modelPathsConfig"
  } else {
    Write-Host "[MODELS] No Comfy Desktop external model-path file was required or unambiguously available; the managed instance's own model directory remains active."
  }
  Write-Host "[STARTING] Starting Comfy Desktop's managed ComfyUI engine headlessly at $($endpoint.BaseUrl)..."
  Write-Host "           Desktop UI is not required for API readiness. Startup logs: $($logs.Stdout)"
  try {
    $process = Start-Process -FilePath $instance.PythonPath -ArgumentList $managedArgs -WorkingDirectory $instance.EngineRoot -WindowStyle Hidden -RedirectStandardOutput $logs.Stdout -RedirectStandardError $logs.Stderr -PassThru
  }
  catch {
    $detail = "The managed ComfyUI engine could not be started directly: $($_.Exception.Message)"
    Write-Warning $detail
    Write-Status "launch-failed" $detail
    exit 1
  }

  $state = Wait-ComfyApi $endpoint.BaseUrl $ReadyTimeoutSeconds $process
  if ($state -eq "ready") {
    Write-Host "[READY] Managed ComfyUI is responding at $($endpoint.BaseUrl) without requiring a Desktop Launch click."
    Write-Status "started-ready" "Managed ComfyUI started headlessly at $($endpoint.BaseUrl)."
    exit 0
  }
  $alternateApi = Find-AlternateComfyApi $endpoint.Port
  if ($alternateApi) {
    $detail = "The managed ComfyUI engine responds at $alternateApi, but PlotPickle expects $($endpoint.BaseUrl). Correct the configured loopback port before retrying."
    Write-Warning $detail
    Write-Status "desktop-api-wrong-port" $detail
    exit 1
  }
  if ($state -eq "exited") {
    $crash = Get-ComfyManagedCrashEvidence -Instance $instance
    $evidence = if ($crash.Found) { " Evidence: $($crash.Summary)." } else { "" }
    $detail = "The managed ComfyUI engine exited before API readiness.$evidence Review $($logs.Stderr). PlotPickle did not download a model or enable cloud fallback."
    Write-Warning $detail
    Write-Status "desktop-managed-engine-crashed" $detail
    exit 1
  }
  $detail = "The managed ComfyUI engine was started directly, but /system_stats did not respond at $($endpoint.BaseUrl) within $ReadyTimeoutSeconds seconds. Review $($logs.Stdout) and $($logs.Stderr). Desktop can be opened separately for inspection, but PlotPickle will not wait for a manual Launch click."
  Write-Warning $detail
  Write-Status "starting-timeout" $detail
  exit 1
}

if (-not $mainPath -and $desktopExe -and -not $AllowDesktopLaunch) {
  $detail = "ComfyUI Desktop is installed, but its local engine/API is not running at $($endpoint.BaseUrl). Passive startup will not open an optional Desktop application."
  Write-Host "[INFO] $detail"
  Write-Host "       Use the reviewed Settings action when you want PlotPickle to start the local image engine."
  Write-Status "desktop-installed-not-running" $detail
  exit 0
}

if (-not $mainPath -and $desktopExe) {
  $opened = Open-ComfyDesktop $desktopExe
  if (-not $opened.Ok) {
    Write-Warning $opened.Detail
    Write-Status "desktop-launch-failed" $opened.Detail
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

$logs = Get-ComfyStartupLogs "comfyui-startup"
$args = @($mainPath, "--disable-auto-launch", "--listen", $endpoint.Host, "--port", [string]$endpoint.Port)
Write-Host "[STARTING] Starting classic/portable ComfyUI as a hidden local backend at $($endpoint.BaseUrl)..."
try { $process = Start-Process -FilePath $python -ArgumentList $args -WorkingDirectory (Split-Path -Parent $mainPath) -WindowStyle Hidden -RedirectStandardOutput $logs.Stdout -RedirectStandardError $logs.Stderr -PassThru }
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
  $detail = "ComfyUI exited before its API became ready. Review $($logs.Stderr)"
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
$detail = "ComfyUI did not become ready at $($endpoint.BaseUrl) within $ReadyTimeoutSeconds seconds. Review $($logs.Stdout) and $($logs.Stderr)"
Write-Warning $detail
Write-Status "starting-timeout" $detail
exit 1