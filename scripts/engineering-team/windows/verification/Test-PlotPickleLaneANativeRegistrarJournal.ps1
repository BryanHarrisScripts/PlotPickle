<#
 #3302 WO-001B NON-RELEASE author diagnostic. Compiles native source into
 disposable TEMP and tests exclusive-handle/flush/no-replay/torn/STOP paths.
 No service install, reviewer enrollment, protected test or release authority.
#>
[CmdletBinding()]
param([switch]$RunNativeDiagnostic)
$ErrorActionPreference='Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
$source=Join-Path $PSScriptRoot 'LaneARegistrarJournalBoundary.cs'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $source -PathType Leaf) -or
    -not (Test-Path -LiteralPath $compiler -PathType Leaf)) { throw 'NATIVE_INPUT_MISSING' }
if (-not $RunNativeDiagnostic) {
  [pscustomobject]@{schemaVersion='PP-F00-NATIVE-JOURNAL-ENGINEERING-V1'
    state='PLAN_ONLY';sourceSha256=(Get-FileHash $source -Algorithm SHA256).Hash.ToLowerInvariant()
    willWrite=$false;productionActivated=$false;independentVerification=$false} | ConvertTo-Json -Compress
  return
}
$root=Join-Path $env:TEMP ('pp-f00-native-journal-'+[guid]::NewGuid().ToString('N'))
$journal=Join-Path $root 'registrar-journal.bin'
$exe=Join-Path $root 'native-journal-diagnostic.exe'
$oldFlag=$env:PLOTPICKLE_LANE_A_EPHEMERAL_CI
$assertions=0
$symlink='UNPROVEN_WINDOWS_PRIVILEGE'
$token='UNPROVEN'
$scope='a'*64
function Assert-True([bool]$condition,[string]$reason) {
  if (-not $condition) { throw $reason }
  $script:assertions++
}
function Invoke-Native([string[]]$arguments) {
  $output=@(& $script:exe @arguments)
  $exit=$LASTEXITCODE
  [pscustomobject]@{code=$exit;line=(@($output) -join '').Trim()}
}
try {
  [void][IO.Directory]::CreateDirectory($root)
  $compileArgs=@('/nologo','/target:exe','/optimize+','/platform:anycpu',
    ('/out:'+$exe),$source)
  $compileOutput=@(& $compiler @compileArgs 2>&1)
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $exe -PathType Leaf)) {
    throw ('NATIVE_COMPILE_FAILED: '+($compileOutput -join ' '))
  }
  $assertions++
  $seed=[Text.Encoding]::UTF8.GetBytes("PP-LANE-A-PREPROVISIONED-JOURNAL-V1`n")
  $stream=[IO.FileStream]::new($journal,[IO.FileMode]::CreateNew,
    [IO.FileAccess]::ReadWrite,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough)
  try {$stream.Write($seed,0,$seed.Length);$stream.Flush($true)}
  finally {$stream.Dispose()}
  $env:PLOTPICKLE_LANE_A_EPHEMERAL_CI='1'
  $issueId='1'*32
  $issue=Invoke-Native @('--operate',$journal,'ISSUE',$scope,$issueId)
  Assert-True ($issue.code -eq 0 -and $issue.line -match '^CANDIDATE_FLUSHED\|[a-f0-9]{64}\|TOKEN_OBSERVED_NOT_ATTESTED$') 'ISSUE_NOT_FLUSHED'
  $nonce=($issue.line -split '\|')[1]
  $token=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $replay=Invoke-Native @('--operate',$journal,'ISSUE',$scope,$issueId)
  Assert-True ($replay.code -ne 0 -and $replay.line -match 'REQUEST_REPLAY_DENIED') 'REQUEST_REPLAY_ACCEPTED'
  $stream=[IO.FileStream]::new($journal,[IO.FileMode]::Open,
    [IO.FileAccess]::ReadWrite,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough)
  try {
    $contender=Invoke-Native @('--operate',$journal,'SPEND',$scope,('2'*32),$nonce)
    Assert-True ($contender.code -ne 0 -and $contender.line -match '^BLOCKED\|') 'SECOND_WRITER_ACCEPTED'
  } finally {$stream.Dispose()}
  $spend=Invoke-Native @('--operate',$journal,'SPEND',$scope,('2'*32),$nonce)
  Assert-True ($spend.code -eq 0 -and $spend.line -match '^CANDIDATE_FLUSHED\|') 'SPEND_NOT_FLUSHED'
  $spentReplay=Invoke-Native @('--operate',$journal,'SPEND',$scope,('3'*32),$nonce)
  Assert-True ($spentReplay.code -ne 0 -and $spentReplay.line -match 'NONCE_SPENT_OR_SCOPE_INVALID') 'SPENT_NONCE_REUSED'
  [IO.File]::AppendAllText($journal,'TORN',[Text.Encoding]::ASCII)
  $torn=Invoke-Native @('--operate',$journal,'ISSUE',$scope,('4'*32))
  Assert-True ($torn.code -ne 0 -and $torn.line -match 'TORN_') 'TORN_JOURNAL_ACCEPTED'
  # New preprovisioned journal for STOP; never repair/truncate the torn journal.
  $journal2=Join-Path $root 'STOP'
  [IO.File]::WriteAllText($journal2,'STOP',[Text.Encoding]::ASCII)
  $stop=Invoke-Native @('--operate',$journal,'ISSUE',$scope,('5'*32))
  Assert-True ($stop.code -ne 0 -and $stop.line -match 'STOP_OBSERVED') 'STOP_IGNORED'
  Remove-Item -LiteralPath $journal2 -Force
  # Native reparse denial is attempted but Windows privilege may forbid fixture creation.
  $link=Join-Path $root 'reparse-journal.bin'
  try {
    New-Item -ItemType SymbolicLink -Path $link -Target $journal -ErrorAction Stop | Out-Null
    $linkResult=Invoke-Native @('--operate',$link,'ISSUE',$scope,('6'*32))
    Assert-True ($linkResult.code -ne 0) 'REPARSE_PATH_ACCEPTED'
    $symlink='REJECTED'
  } catch [System.UnauthorizedAccessException] { $symlink='UNPROVEN_WINDOWS_PRIVILEGE' }
  catch [System.Management.Automation.RuntimeException] {
    if ($_.Exception.Message -match 'privilege|permission|not supported') {
      $symlink='UNPROVEN_WINDOWS_PRIVILEGE'
    } else { throw }
  }
  [pscustomobject]@{
    schemaVersion='PP-F00-NATIVE-JOURNAL-ENGINEERING-V1'
    state='NON_RELEASE_AUTHOR_DIAGNOSTIC_PASSED'
    assertionsPassed=$assertions
    nativeExclusiveHandleObserved=$true
    regularFileFlushObserved=$true
    duplicateAndSpentReplayDenied=$true
    tornTailDenied=$true
    stopMarkerObserved=$true
    symlinkFixture=$symlink
    observedTokenSid=$token
    registrarIdentityIndependentlyAttested=$false
    pathSwapRaceProven=$false
    crashPowerLossDurabilityProven=$false
    windowsProductGate=$false
    w8w9Admitted=$false
    mayAdmit=$false
    mayMerge=$false
  } | ConvertTo-Json -Compress
} finally {
  $env:PLOTPICKLE_LANE_A_EPHEMERAL_CI=$oldFlag
  if (Test-Path -LiteralPath $root -PathType Container) {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
  }
}
