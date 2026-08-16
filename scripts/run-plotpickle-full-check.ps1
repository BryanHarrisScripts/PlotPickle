param(
  [int]$StartupWaitSeconds = 240
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$PlotPickleUrl = "http://127.0.0.1:4173"
$Launcher = Join-Path $RepoRoot "Start-PlotPickle.bat"
$LocalRoot = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $RepoRoot "logs" }
$LogRoot = Join-Path $LocalRoot "PlotPickle\full-verification"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogPath = Join-Path $LogRoot "plotpickle-full-check-$Stamp.log"
$Results = New-Object System.Collections.Generic.List[object]

New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
Set-Location $RepoRoot

function Write-Section([string]$Text) {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor DarkGray
  Write-Host $Text -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor DarkGray
}

function Add-Result([string]$Name, [string]$Status, [int]$ExitCode, [string]$Detail = "") {
  $Results.Add([pscustomobject]@{
    Step = $Name
    Status = $Status
    ExitCode = $ExitCode
    Detail = $Detail
  }) | Out-Null
}

function Invoke-NodeStep([string]$Name, [string[]]$Arguments) {
  Write-Section $Name
  Write-Host "node $($Arguments -join ' ')" -ForegroundColor Gray
  & node @Arguments
  $Code = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  if ($Code -eq 0) {
    Write-Host "PASS  $Name" -ForegroundColor Green
    Add-Result $Name "PASS" 0
  } else {
    Write-Host "FAIL  $Name (exit code $Code)" -ForegroundColor Red
    Add-Result $Name "FAIL" $Code
  }
  return $Code
}

function Test-PlotPickleReady {
  try {
    $Response = Invoke-WebRequest -UseBasicParsing -Uri $PlotPickleUrl -TimeoutSec 3
    return $Response.StatusCode -ge 200 -and $Response.Content -match "PlotPickle"
  } catch {
    return $false
  }
}

function Ensure-PlotPickleReady {
  Write-Section "PlotPickle local app"
  if (Test-PlotPickleReady) {
    Write-Host "READY  PlotPickle is already running at $PlotPickleUrl" -ForegroundColor Green
    return $true
  }

  if (-not (Test-Path $Launcher)) {
    Write-Host "FAIL  Start-PlotPickle.bat is missing." -ForegroundColor Red
    Write-Host "The browser-dependent checks cannot run until PlotPickle is started." -ForegroundColor Yellow
    return $false
  }

  Write-Host "START  PlotPickle is not running, so the official Start-PlotPickle.bat launcher will open now." -ForegroundColor Cyan
  try {
    Start-Process -FilePath "cmd.exe" -ArgumentList @("/d", "/c", ('"{0}"' -f $Launcher)) -WorkingDirectory $RepoRoot -WindowStyle Normal | Out-Null
  } catch {
    Write-Host "FAIL  PlotPickle could not be started: $($_.Exception.Message)" -ForegroundColor Red
    return $false
  }

  $Deadline = (Get-Date).AddSeconds([Math]::Max(30, $StartupWaitSeconds))
  while ((Get-Date) -lt $Deadline) {
    if (Test-PlotPickleReady) {
      Write-Host "READY  PlotPickle answered at $PlotPickleUrl" -ForegroundColor Green
      return $true
    }
    Start-Sleep -Seconds 2
  }

  Write-Host "FAIL  PlotPickle did not become reachable within $StartupWaitSeconds seconds." -ForegroundColor Red
  Write-Host "Leave the Start-PlotPickle window open, review its last error, then run Run-PlotPickle-Full-Check.bat again." -ForegroundColor Yellow
  return $false
}

$TranscriptStarted = $false
try {
  Start-Transcript -Path $LogPath -Force | Out-Null
  $TranscriptStarted = $true

  Clear-Host
  Write-Host "PlotPickle Full Verification" -ForegroundColor Cyan
  Write-Host "Repository: $RepoRoot"
  Write-Host "Log:        $LogPath"
  Write-Host ""
  Write-Host "This runs Pi readiness, BUZZ, exhaustive UI/UX UAT, and Writer-in-Residence in one pass." -ForegroundColor Gray

  Invoke-NodeStep "1 of 5 - Ensure Pi local repair model" @(
    ".\scripts\ensure-local-repair-model.mjs", "--worker", "pi"
  ) | Out-Null

  Invoke-NodeStep "2 of 5 - Pi repair preflight" @(
    ".\scripts\run-uat-repair-agent.mjs", "--worker", "pi", "--preflight", "--require-ready"
  ) | Out-Null

  $AppReady = Ensure-PlotPickleReady
  if ($AppReady) {
    Invoke-NodeStep "3 of 5 - Verify BUZZ live activity" @(
      ".\scripts\verify-buzz-live-activity.mjs"
    ) | Out-Null

    Invoke-NodeStep "4 of 5 - Exhaustive code-aware UI and UX UAT" @(
      ".\scripts\run-exhaustive-ui-uat.mjs", "--github-report"
    ) | Out-Null

    Invoke-NodeStep "5 of 5 - Writer-in-Residence" @(
      ".\scripts\run-writer-in-residence.mjs", "--github-report"
    ) | Out-Null
  } else {
    foreach ($Name in @(
      "3 of 5 - Verify BUZZ live activity",
      "4 of 5 - Exhaustive code-aware UI and UX UAT",
      "5 of 5 - Writer-in-Residence"
    )) {
      Write-Host "BLOCKED  $Name - PlotPickle is not reachable at $PlotPickleUrl" -ForegroundColor Red
      Add-Result $Name "BLOCKED" 1 "PlotPickle local app was not reachable."
    }
  }

  Write-Section "FINAL SUMMARY"
  foreach ($Result in $Results) {
    $Colour = if ($Result.Status -eq "PASS") { "Green" } else { "Red" }
    $Suffix = if ($Result.Detail) { " - $($Result.Detail)" } elseif ($Result.ExitCode -ne 0) { " - exit code $($Result.ExitCode)" } else { "" }
    Write-Host ("{0,-8} {1}{2}" -f $Result.Status, $Result.Step, $Suffix) -ForegroundColor $Colour
  }

  Write-Host ""
  Write-Host "Full log saved to:" -ForegroundColor Gray
  Write-Host $LogPath -ForegroundColor Yellow

  $Failed = @($Results | Where-Object { $_.Status -ne "PASS" }).Count -gt 0
  if ($Failed) {
    Write-Host ""
    Write-Host "One or more checks need attention. Nothing was hidden or treated as a pass." -ForegroundColor Red
    $FinalExitCode = 1
  } else {
    Write-Host ""
    Write-Host "All PlotPickle full-verification checks passed." -ForegroundColor Green
    $FinalExitCode = 0
  }
} catch {
  Write-Host ""
  Write-Host "FULL CHECK ERROR  $($_.Exception.Message)" -ForegroundColor Red
  Add-Result "Full verification runner" "FAIL" 1 $_.Exception.Message
  $FinalExitCode = 1
} finally {
  if ($TranscriptStarted) {
    try { Stop-Transcript | Out-Null } catch {}
  }
}

exit $FinalExitCode
