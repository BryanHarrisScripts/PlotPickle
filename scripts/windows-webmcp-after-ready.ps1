param(
  [string]$BaseUrl = "http://127.0.0.1:4173",
  [Parameter(Mandatory = $true)]
  [string]$StartupMarker,
  [int]$ReadyTimeoutSeconds = 240,
  [int]$RequestTimeoutSeconds = 30,
  [Parameter(Mandatory = $true)]
  [string]$RunnerPath,
  [Parameter(Mandatory = $true)]
  [string]$Home,
  [Parameter(Mandatory = $true)]
  [string]$ToolRoot
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

function Test-PlotPickleStartupContract {
  param(
    [string]$Url,
    [string]$Marker,
    [int]$TimeoutSeconds
  )

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec ([Math]::Max(1, $TimeoutSeconds))
    return $response.StatusCode -ge 200 -and $response.Content -match [regex]::Escape($Marker)
  } catch {
    return $false
  }
}

$deadline = (Get-Date).AddSeconds([Math]::Max(5, $ReadyTimeoutSeconds))
$ready = $false

Write-Host "[INFO] Waiting for PlotPickle to satisfy the completed startup contract before WebMCP UAT begins." -ForegroundColor Cyan

while ((Get-Date) -lt $deadline) {
  if (Test-PlotPickleStartupContract -Url $BaseUrl -Marker $StartupMarker -TimeoutSeconds $RequestTimeoutSeconds) {
    $ready = $true
    break
  }
  Start-Sleep -Milliseconds 500
}

if (-not $ready) {
  Write-Host "[FAIL] WebMCP UAT was not started because PlotPickle did not satisfy the completed startup contract within $ReadyTimeoutSeconds seconds." -ForegroundColor Red
  Write-Host "[INFO] This is a startup/readiness failure, not a PlotPickle surface or visual UAT finding." -ForegroundColor Yellow
  return
}

if (-not (Test-Path -LiteralPath $RunnerPath)) {
  Write-Host "[FAIL] WebMCP UAT runner is missing: $RunnerPath" -ForegroundColor Red
  return
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "[FAIL] Node.js is unavailable, so WebMCP UAT could not start after readiness." -ForegroundColor Red
  return
}

Write-Host "[READY] PlotPickle startup contract confirmed. Starting bounded WebMCP interface/surface UAT." -ForegroundColor Green
& $node.Source $RunnerPath "run" "--server" $BaseUrl "--home" $Home "--tool-root" $ToolRoot

if ($LASTEXITCODE -eq 0) {
  Write-Host "[PASS] WebMCP UAT completed after confirmed PlotPickle readiness." -ForegroundColor Green
} else {
  Write-Host "[FAIL] WebMCP UAT completed with findings after confirmed PlotPickle readiness." -ForegroundColor Red
}
