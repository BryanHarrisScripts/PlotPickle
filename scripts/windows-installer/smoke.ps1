[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SetupPath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$setup = (Resolve-Path $SetupPath).Path
$installRoot = Join-Path $env:LOCALAPPDATA "PlotPickle-Installer-Smoke-$PID"
$userDataRoot = Join-Path $env:LOCALAPPDATA "PlotPickle"
$markerDirectory = Join-Path $userDataRoot "projects"
$marker = Join-Path $markerDirectory "installer-smoke-preserve.marker"
$baseUrl = "http://127.0.0.1:4173/"
$startupRequestTimeoutSeconds = 30
$startupProbeUserAgent = "PlotPickle-Installer-Smoke/$PID"
$launcherProcess = $null
$runtimeModules = $null
$runtimeMarker = $null

function Invoke-Checked {
  param([string]$FilePath, [string[]]$ArgumentList)
  Write-Host "> $FilePath $($ArgumentList -join ' ')"
  $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -Wait -PassThru -WindowStyle Hidden
  if ($process.ExitCode -ne 0) {
    throw "$FilePath exited with code $($process.ExitCode)."
  }
}

function Install-PlotPickle {
  Invoke-Checked $setup @(
    "/VERYSILENT",
    "/SUPPRESSMSGBOXES",
    "/NORESTART",
    "/SP-",
    "/DIR=$installRoot"
  )
}

function Assert-InstalledPayload {
  foreach ($required in @(
    "PlotPickle.exe",
    "Start-PlotPickle.bat",
    "package.json",
    "installer-manifest.json",
    "runtime\node\node.exe",
    "runtime\node\npm.cmd",
    "node_modules\vite\package.json",
    "worker\index.ts"
  )) {
    $candidate = Join-Path $installRoot $required
    if (-not (Test-Path $candidate)) { throw "Installed payload is missing $required" }
  }
  Assert-DeveloperDependenciesExcluded (Join-Path $installRoot "node_modules")
}

function Assert-DeveloperDependenciesExcluded {
  param([string]$ModulesPath)
  foreach ($excluded in @(
    "@types\react",
    "@types\react-dom",
    "drizzle-kit",
    "eslint",
    "eslint-config-next",
    "typescript"
  )) {
    if (Test-Path (Join-Path $ModulesPath $excluded)) {
      throw "Developer-only dependency leaked into the runtime: $excluded"
    }
  }
}

function Wait-ForStartup {
  $deadline = (Get-Date).AddMinutes(3)
  $lastError = "No response received."
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $baseUrl -TimeoutSec $startupRequestTimeoutSeconds -UserAgent $startupProbeUserAgent
      if ($response.StatusCode -ge 200 -and $response.Content -match "plotpickle-startup-v4") { return }
      $lastError = "The response did not contain the installed startup contract."
    }
    catch { $lastError = $_.Exception.Message }
    Start-Sleep -Milliseconds 500
  }
  throw "Installed PlotPickle did not become ready at $baseUrl $lastError"
}

function Write-LauncherDiagnostics {
  $launcherLog = Join-Path $userDataRoot "logs\launcher.log"
  if (Test-Path $launcherLog) {
    Write-Host "Installed launcher diagnostics:"
    Get-Content $launcherLog | ForEach-Object { Write-Host $_ }
  }
  else {
    Write-Warning "Installed launcher log was not created at $launcherLog"
  }
}

function Wait-ForShutdown {
  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline) {
    try { Invoke-WebRequest -UseBasicParsing -Uri $baseUrl -TimeoutSec 1 | Out-Null }
    catch { return }
    Start-Sleep -Milliseconds 250
  }
  throw "PlotPickle remained reachable after its process tree was stopped."
}

function Start-InstalledPlotPickle {
  $launcher = Join-Path $installRoot "PlotPickle.exe"
  $process = Start-Process -FilePath $launcher -PassThru -WindowStyle Hidden
  try { Wait-ForStartup }
  catch {
    Write-LauncherDiagnostics
    Stop-PlotPickleTree $process
    throw
  }
  return $process
}

function Stop-PlotPickleTree {
  param($Process)
  if ($null -eq $Process) { return }
  if (-not $Process.HasExited) {
    & (Join-Path $env:SystemRoot "System32\taskkill.exe") /PID $Process.Id /T /F | Out-Null
    $Process.WaitForExit(10000) | Out-Null
  }
  Wait-ForShutdown
}

function Resolve-PersistentRuntimeModules {
  $installedModules = Join-Path $installRoot "node_modules"
  $item = Get-Item $installedModules -Force
  if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) {
    throw "First launch did not replace the installed node_modules directory with a persistent-runtime junction."
  }
  $target = @($item.Target)[0]
  if (-not $target) { throw "The installed node_modules junction does not expose its target." }
  if (-not [System.IO.Path]::IsPathRooted($target)) { $target = Join-Path $installRoot $target }
  return [System.IO.Path]::GetFullPath($target)
}

function Remove-InstallRootSafely {
  $installedModules = Join-Path $installRoot "node_modules"
  if (Test-Path $installedModules) {
    $item = Get-Item $installedModules -Force
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      & $env:ComSpec /D /C rmdir "`"$installedModules`"" | Out-Null
      if (Test-Path $installedModules) {
        Write-Warning "Skipped installer-smoke cleanup because the runtime junction could not be detached safely."
        return
      }
    }
  }
  Remove-Item $installRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Remove-InstallRootSafely
New-Item $markerDirectory -ItemType Directory -Force | Out-Null
Set-Content $marker "PlotPickle installer smoke must preserve this user-data marker.`n" -Encoding utf8

try {
  Install-PlotPickle
  Assert-InstalledPayload

  $launcher = Join-Path $installRoot "PlotPickle.exe"
  Invoke-Checked $launcher @("--verify-install")

  $launcherProcess = Start-InstalledPlotPickle
  $runtimeModules = Resolve-PersistentRuntimeModules
  Assert-DeveloperDependenciesExcluded $runtimeModules
  foreach ($required in @("vite\package.json", "rolldown\package.json")) {
    if (-not (Test-Path (Join-Path $runtimeModules $required))) {
      throw "Persistent runtime is missing $required after first launch."
    }
  }
  $runtimeMarker = Join-Path $runtimeModules "installer-smoke-runtime-$PID.marker"
  Set-Content $runtimeMarker "PlotPickle upgrade and uninstall must preserve this runtime.`n" -Encoding utf8
  Stop-PlotPickleTree $launcherProcess
  $launcherProcess = $null

  Install-PlotPickle
  Assert-InstalledPayload
  $updatedModules = Get-Item (Join-Path $installRoot "node_modules") -Force
  if (($updatedModules.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Upgrade wrote the new payload through the previous persistent-runtime junction."
  }
  if (-not (Test-Path $runtimeMarker)) { throw "Upgrade removed the reusable persistent runtime." }

  $launcherProcess = Start-InstalledPlotPickle
  $updatedRuntimeModules = Resolve-PersistentRuntimeModules
  if ($updatedRuntimeModules -ne $runtimeModules) { throw "Same-version upgrade changed the runtime fingerprint unexpectedly." }
  Stop-PlotPickleTree $launcherProcess
  $launcherProcess = $null

  $uninstaller = Get-ChildItem $installRoot -Filter "unins*.exe" | Select-Object -First 1
  if (-not $uninstaller) { throw "Inno Setup uninstaller was not installed." }
  Invoke-Checked $uninstaller.FullName @("/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART")

  if (-not (Test-Path $marker)) {
    throw "Uninstall removed PlotPickle user data. User projects must remain separate from application binaries."
  }
  if (-not (Test-Path $runtimeMarker) -or -not (Test-Path (Join-Path $runtimeModules "vite\package.json"))) {
    throw "Uninstall followed the application junction and damaged the persistent runtime."
  }

  Write-Host "Installer smoke passed: install, real launch, junction-safe upgrade, relaunch, uninstall, and persistent-data preservation."
}
finally {
  if ($null -ne $launcherProcess) { Stop-PlotPickleTree $launcherProcess }
  Remove-InstallRootSafely
  if ($runtimeMarker) { Remove-Item $runtimeMarker -Force -ErrorAction SilentlyContinue }
  Remove-Item $marker -Force -ErrorAction SilentlyContinue
}
