param(
  [int]$StartupWaitSeconds = 240,
  [switch]$GitHubReport,
  [switch]$Repair,
  [string]$RetestOf = ""
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
$StartedAt = (Get-Date).ToUniversalTime().ToString("o")
$Results = New-Object System.Collections.Generic.List[object]
$FinalExitCode = 1

New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
Set-Location $RepoRoot

function Write-Section([string]$Text) {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor DarkGray
  Write-Host $Text -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor DarkGray
}

function Add-Result([string]$Name, [string]$Category, [string]$Status, [int]$ExitCode, [string]$Detail = "") {
  $Results.Add([pscustomobject]@{
    Step = $Name
    Category = $Category
    Status = $Status
    ExitCode = $ExitCode
    Detail = $Detail
  }) | Out-Null
}

function Invoke-NodeStep([string]$Name, [string]$Category, [string[]]$Arguments) {
  Write-Section $Name
  Write-Host "node $($Arguments -join ' ')" -ForegroundColor Gray
  & node @Arguments
  $Code = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  if ($Code -eq 0) {
    Write-Host "PASS  $Name" -ForegroundColor Green
    Add-Result $Name $Category "PASS" 0
  } else {
    Write-Host "FAIL  $Name (exit code $Code)" -ForegroundColor Red
    Add-Result $Name $Category "FAIL" $Code
  }
}

function Invoke-NpmStep([string]$Name, [string]$Category, [string[]]$Arguments) {
  Write-Section $Name
  Write-Host "npm $($Arguments -join ' ')" -ForegroundColor Gray
  & npm.cmd @Arguments
  $Code = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  if ($Code -eq 0) {
    Write-Host "PASS  $Name" -ForegroundColor Green
    Add-Result $Name $Category "PASS" 0
  } else {
    Write-Host "FAIL  $Name (exit code $Code)" -ForegroundColor Red
    Add-Result $Name $Category "FAIL" $Code
  }
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

function Write-StructuredVerificationRecord {
  $CompletedAt = (Get-Date).ToUniversalTime().ToString("o")
  $Payload = [ordered]@{
    startedAt = $StartedAt
    completedAt = $CompletedAt
    rawLogName = (Split-Path -Leaf $LogPath)
    retestOf = $RetestOf
    stages = @($Results)
  }
  $PayloadJson = $Payload | ConvertTo-Json -Depth 8 -Compress
  Write-Host ""
  Write-Host "Saving structured Quality / Verification Inbox record..." -ForegroundColor Gray
  $RecordOutput = $PayloadJson | & node ".\scripts\verification-record.mjs"
  $RecordCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  if ($RecordCode -ne 0) {
    Write-Host "FAIL  The structured Verification Inbox record could not be saved." -ForegroundColor Red
    return ""
  }
  try {
    $Record = (($RecordOutput | Out-String).Trim() | ConvertFrom-Json)
    if (-not $Record.runId) { throw "Missing runId" }
    Write-Host "SAVED  Verification Inbox record $($Record.runId)" -ForegroundColor Green
    return [string]$Record.runId
  } catch {
    Write-Host "FAIL  The structured Verification Inbox record returned an invalid receipt." -ForegroundColor Red
    return ""
  }
}

function Invoke-VerificationOrchestrator([string]$RunId) {
  $Arguments = @(".\scripts\verification-orchestrator.mjs", "--run-id", $RunId)
  if ($GitHubReport) { $Arguments += "--github-report" }
  if ($Repair) { $Arguments += "--repair" }
  Write-Host "Running role-safe verification review..." -ForegroundColor Gray
  & node @Arguments
  $Code = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  if ($Code -ne 0) {
    Write-Host "FAIL  Verification agent review / handoff did not complete." -ForegroundColor Red
    return $false
  }

  Write-Host "SAVED  Agent review / orchestration companion" -ForegroundColor Green
  $LifecycleArguments = @(".\scripts\verification-buzz-lifecycle.mjs", "--run-id", $RunId)
  if ($GitHubReport) { $LifecycleArguments += "--github-report" }
  & node @LifecycleArguments
  $LifecycleCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  if ($LifecycleCode -eq 0) {
    Write-Host "SENT   BUZZ verification lifecycle evidence" -ForegroundColor Green
  } else {
    Write-Host "WARN   BUZZ lifecycle delivery was unavailable; the deterministic verification result is unchanged." -ForegroundColor Yellow
  }
  return $true
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
  Write-Host "Deterministic tests own PASS/FAIL. Agents may observe, explain and repair only through bounded workflows after the record is saved." -ForegroundColor Gray

  Invoke-NodeStep "1 of 9 - Agent Skills registry" "Architecture" @(
    ".\scripts\agent-skills.mjs", "--self-test"
  )

  Invoke-NodeStep "2 of 9 - Agent Skills architecture boundaries" "Architecture" @(
    "--test",
    ".\tests\sage-brinewick-agent-skill.test.mjs",
    ".\tests\issue-913-agent-skills-migration.test.mjs"
  )

  Invoke-NpmStep "3 of 9 - LEARN curriculum validation" "Curriculum" @(
    "run", "validate:learn"
  )

  Invoke-NpmStep "4 of 9 - Production build" "Production Build" @(
    "run", "build"
  )

  Invoke-NodeStep "5 of 9 - Ensure Pi local repair model" "Local AI / Pi" @(
    ".\scripts\ensure-local-repair-model.mjs", "--worker", "pi"
  )

  Invoke-NodeStep "6 of 9 - Pi repair preflight" "Local AI / Pi" @(
    ".\scripts\run-uat-repair-agent.mjs", "--worker", "pi", "--preflight", "--require-ready"
  )

  $AppReady = Ensure-PlotPickleReady
  if ($AppReady) {
    Invoke-NodeStep "7 of 9 - Verify BUZZ live activity" "BUZZ" @(
      ".\scripts\verify-buzz-live-activity.mjs"
    )

    Invoke-NodeStep "8 of 9 - Exhaustive code-aware UI and UX UAT" "UI / UX UAT" @(
      ".\scripts\run-exhaustive-ui-uat.mjs"
    )

    Invoke-NodeStep "9 of 9 - Writer-in-Residence" "Writer Journey" @(
      ".\scripts\run-writer-in-residence.mjs"
    )
  } else {
    foreach ($BlockedStep in @(
      [pscustomobject]@{ Name = "7 of 9 - Verify BUZZ live activity"; Category = "BUZZ" },
      [pscustomobject]@{ Name = "8 of 9 - Exhaustive code-aware UI and UX UAT"; Category = "UI / UX UAT" },
      [pscustomobject]@{ Name = "9 of 9 - Writer-in-Residence"; Category = "Writer Journey" }
    )) {
      Write-Host "BLOCKED  $($BlockedStep.Name) - PlotPickle is not reachable at $PlotPickleUrl" -ForegroundColor Red
      Add-Result $BlockedStep.Name $BlockedStep.Category "BLOCKED" 1 "PlotPickle local app was not reachable."
    }
  }

  Write-Section "DETAILED RESULTS"
  foreach ($Result in $Results) {
    $Colour = if ($Result.Status -eq "PASS") { "Green" } elseif ($Result.Status -eq "BLOCKED") { "Yellow" } else { "Red" }
    $Suffix = if ($Result.Detail) { " - $($Result.Detail)" } elseif ($Result.ExitCode -ne 0) { " - exit code $($Result.ExitCode)" } else { "" }
    Write-Host ("{0,-8} {1}{2}" -f $Result.Status, $Result.Step, $Suffix) -ForegroundColor $Colour
  }

  Write-Section "FINAL SUMMARY"
  foreach ($Category in @(
    "Architecture",
    "Curriculum",
    "Production Build",
    "Local AI / Pi",
    "BUZZ",
    "UI / UX UAT",
    "Writer Journey"
  )) {
    $GroupResults = @($Results | Where-Object { $_.Category -eq $Category })
    if ($GroupResults.Count -eq 0) {
      $GroupStatus = "NOT RUN"
      $Colour = "Yellow"
    } elseif (@($GroupResults | Where-Object { $_.Status -eq "FAIL" }).Count -gt 0) {
      $GroupStatus = "FAIL"
      $Colour = "Red"
    } elseif (@($GroupResults | Where-Object { $_.Status -eq "BLOCKED" }).Count -gt 0) {
      $GroupStatus = "BLOCKED"
      $Colour = "Yellow"
    } else {
      $GroupStatus = "PASS"
      $Colour = "Green"
    }
    Write-Host ("{0,-18} {1}" -f $Category, $GroupStatus) -ForegroundColor $Colour
  }

  Write-Host ""
  Write-Host "Full log saved to:" -ForegroundColor Gray
  Write-Host $LogPath -ForegroundColor Yellow

  $Failed = @($Results | Where-Object { $_.Status -ne "PASS" }).Count -gt 0
  if ($Failed) {
    Write-Host ""
    Write-Host "One or more checks need attention. The complete child-process output above is part of this same log." -ForegroundColor Red
    $FinalExitCode = 1
  } else {
    Write-Host ""
    Write-Host "All PlotPickle full-verification checks passed." -ForegroundColor Green
    $FinalExitCode = 0
  }
} catch {
  Write-Host ""
  Write-Host "FULL CHECK ERROR  $($_.Exception.Message)" -ForegroundColor Red
  Add-Result "Full verification runner" "Runner" "FAIL" 1 $_.Exception.Message
  $FinalExitCode = 1
} finally {
  if ($TranscriptStarted) {
    try { Stop-Transcript | Out-Null } catch {}
  }
  $RunId = Write-StructuredVerificationRecord
  if (-not $RunId) {
    $FinalExitCode = 1
  } elseif (-not (Invoke-VerificationOrchestrator $RunId)) {
    $FinalExitCode = 1
  } else {
    Write-Host "Open the Quality / Verification Inbox: $PlotPickleUrl/verification-inbox" -ForegroundColor Cyan
  }
}

exit $FinalExitCode