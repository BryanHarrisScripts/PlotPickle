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
$LocalRoot = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $RepoRoot "logs" }
$LogRoot = Join-Path $LocalRoot "PlotPickle\full-verification"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogPath = Join-Path $LogRoot "plotpickle-full-check-$Stamp.log"
$GraphResultPath = Join-Path $LogRoot "plotpickle-full-check-$Stamp.graph.json"
$StartedAt = (Get-Date).ToUniversalTime().ToString("o")
$Results = New-Object System.Collections.Generic.List[object]
$FinalExitCode = 1
$ExpectedStages = @(
  [pscustomobject]@{ Name = "1 of 9 - Agent Skills registry"; Category = "Architecture" },
  [pscustomobject]@{ Name = "2 of 9 - Agent Skills architecture boundaries"; Category = "Architecture" },
  [pscustomobject]@{ Name = "3 of 9 - LEARN curriculum validation"; Category = "Curriculum" },
  [pscustomobject]@{ Name = "4 of 9 - Production build"; Category = "Production Build" },
  [pscustomobject]@{ Name = "5 of 9 - Ensure Pi local repair model"; Category = "Local AI / Pi" },
  [pscustomobject]@{ Name = "6 of 9 - Pi repair preflight"; Category = "Local AI / Pi" },
  [pscustomobject]@{ Name = "7 of 9 - Verify BUZZ live activity"; Category = "BUZZ" },
  [pscustomobject]@{ Name = "8 of 9 - Exhaustive code-aware UI and UX UAT"; Category = "UI / UX UAT" },
  [pscustomobject]@{ Name = "9 of 9 - Writer-in-Residence"; Category = "Writer Journey" }
)

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

function Invoke-FullVerificationGraph {
  Write-Section "HOST-OWNED VERIFICATION EXECUTION GRAPH"
  Write-Host "Independent checks run concurrently when they have no dependency or resource conflict." -ForegroundColor Gray
  Write-Host "The nine deterministic stages remain the sole PASS/FAIL authority." -ForegroundColor Gray
  Write-Host "Core graph: .\scripts\full-verification-graph.mjs. The progress wrapper adds heartbeat and bounded Pi preflight only." -ForegroundColor DarkGray
  Write-Host "A heartbeat shows elapsed time, active stages, progress, and an approximate ETA while work is running." -ForegroundColor Gray
  & node ".\scripts\full-verification-progress-runner.mjs" "--result-file" $GraphResultPath "--startup-wait-seconds" "$StartupWaitSeconds"
  $GraphExitCode = if ($null -eq $LASTEXITCODE) { 1 } else { [int]$LASTEXITCODE }

  if (-not (Test-Path $GraphResultPath)) {
    Write-Host "FAIL  Verification graph did not produce a structured result." -ForegroundColor Red
    foreach ($Stage in $ExpectedStages) {
      Add-Result $Stage.Name $Stage.Category "BLOCKED" 1 "Verification graph result was unavailable."
    }
    return $false
  }

  try {
    $Graph = Get-Content -Raw -Path $GraphResultPath | ConvertFrom-Json
    $StageRecords = @($Graph.stages)
    foreach ($Expected in $ExpectedStages) {
      $Stage = $StageRecords | Where-Object { $_.Step -eq $Expected.Name } | Select-Object -First 1
      if ($null -eq $Stage) {
        Add-Result $Expected.Name $Expected.Category "BLOCKED" 1 "Verification graph omitted this authoritative stage."
        continue
      }
      $Status = if ($Stage.Status -in @("PASS", "FAIL", "BLOCKED")) { [string]$Stage.Status } else { "BLOCKED" }
      $Code = if ($Status -eq "PASS") { 0 } else { if ($null -eq $Stage.ExitCode) { 1 } else { [int]$Stage.ExitCode } }
      Add-Result ([string]$Stage.Step) ([string]$Stage.Category) $Status $Code ([string]$Stage.Detail)
    }
    Write-Host "GRAPH  Peak parallel nodes: $($Graph.maxParallelObserved) / cap $($Graph.maxParallelism)" -ForegroundColor Cyan
    return $GraphExitCode -eq 0
  } catch {
    Write-Host "FAIL  Verification graph result could not be parsed: $($_.Exception.Message)" -ForegroundColor Red
    $Results.Clear()
    foreach ($Stage in $ExpectedStages) {
      Add-Result $Stage.Name $Stage.Category "BLOCKED" 1 "Verification graph result failed integrity parsing."
    }
    return $false
  }
}

function Write-StructuredVerificationRecord {
  $CompletedAt = (Get-Date).ToUniversalTime().ToString("o")
  $StageRecords = [object[]]($Results | ForEach-Object { $_ })
  $Payload = [ordered]@{
    startedAt = $StartedAt
    completedAt = $CompletedAt
    rawLogName = (Split-Path -Leaf $LogPath)
    retestOf = $RetestOf
    stages = $StageRecords
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
  Write-Host "Graph rule: no dependency, no wait; shared resources remain isolated." -ForegroundColor Gray

  [void](Invoke-FullVerificationGraph)

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
  $Results.Clear()
  foreach ($Stage in $ExpectedStages) {
    Add-Result $Stage.Name $Stage.Category "BLOCKED" 1 "Full verification runner failed before this stage could be proven."
  }
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