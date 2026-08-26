param(
  [string]$BaseUrl = "http://127.0.0.1:4173",
  [string]$CompanionManager = (Join-Path $PSScriptRoot "windows-companion-software.ps1"),
  [int]$ReadyTimeoutSeconds = 90
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

function Test-PlotPickleReady {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.Content -match "PlotPickle"
  } catch {
    return $false
  }
}

function Invoke-PlotPickleAiComputeVerification {
  param([string]$Url)
  $endpoint = "$($Url.TrimEnd('/'))/api/local-ai/runtime/readiness/startup"
  try {
    $result = Invoke-RestMethod -Method Post -Uri $endpoint -Headers @{ Accept = "application/json" } -TimeoutSec 55
    if ($result.ok -and $result.readiness) {
      $readiness = $result.readiness
      $message = [string]$readiness.message
      if ([string]::IsNullOrWhiteSpace($message)) {
        $message = "Recommended $($readiness.recommended.runtime); active $($readiness.actual.runtime)."
      }
      if ($readiness.state -eq "recommended-ready") {
        Write-Host "[READY] $message" -ForegroundColor Green
      } elseif ($readiness.state -eq "user-override") {
        Write-Host "[INFO] $message" -ForegroundColor Cyan
      } else {
        Write-Host "[WARNING] $message" -ForegroundColor Yellow
      }
      return
    }
    Write-Host "[WARNING] AI COMPUTE: PlotPickle returned no readiness snapshot. Core PlotPickle remains available." -ForegroundColor Yellow
  } catch {
    Write-Host "[WARNING] AI COMPUTE verification could not finish: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "[INFO] Core PlotPickle remains available; review Local Compute in Settings to install or repair the recommended configuration." -ForegroundColor Cyan
  }
}

$deadline = (Get-Date).AddSeconds([Math]::Max(5, $ReadyTimeoutSeconds))
while ((Get-Date) -lt $deadline) {
  if (Test-PlotPickleReady -Url $BaseUrl) { break }
  Start-Sleep -Milliseconds 500
}

if (-not (Test-PlotPickleReady -Url $BaseUrl)) {
  Write-Host "[INFO] Optional companion maintenance was skipped because PlotPickle did not become ready within the deferred maintenance window." -ForegroundColor Yellow
  exit 0
}

Write-Host "[INFO] PlotPickle is ready. Verifying recommended local AI compute without blocking the core app." -ForegroundColor Cyan
Invoke-PlotPickleAiComputeVerification -Url $BaseUrl

if (-not (Test-Path -LiteralPath $CompanionManager)) {
  Write-Host "[INFO] Optional companion inventory is unavailable. Core PlotPickle is already running and is unaffected." -ForegroundColor Yellow
  exit 0
}

Write-Host "[INFO] Starting non-interactive optional companion inventory and reviewed maintenance." -ForegroundColor Cyan
try {
  & $CompanionManager -Mode Maintain -NoPrompt
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] Optional companion maintenance reported warnings. PlotPickle remains available." -ForegroundColor Yellow
  }
} catch {
  Write-Host "[WARNING] Optional companion maintenance could not run: $($_.Exception.Message)" -ForegroundColor Yellow
}

exit 0
