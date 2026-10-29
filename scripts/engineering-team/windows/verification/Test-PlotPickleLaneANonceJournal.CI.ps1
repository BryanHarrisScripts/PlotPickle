<#
 #3302: NON-RELEASE Windows capability probe for a pre-existing append-only
 registrar journal. No production ledger, identity, keys, signer or admission.
 The test verifies OS file exclusivity and regular-file write-through/flush;
 it cannot prove power-loss durability or an independent registrar.
#>
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT' -or $env:PLOTPICKLE_LANE_A_EPHEMERAL_CI -ne '1') {
  throw 'NON_RELEASE_WINDOWS_CI_ONLY'
}

$root = Join-Path $env:TEMP ('pp-f00-journal-' + [guid]::NewGuid().ToString('N'))
$journal = Join-Path $root 'preprovisioned-journal.bin'
$stream = $null
$contender = $null
$exclusive = $false
$persisted = $false
$code = 'UNPROVEN'
try {
  [void][IO.Directory]::CreateDirectory($root)
  # The eventual registrar must provision and ACL this file independently.
  # This disposable CI file proves only that Windows supports these primitives.
  $stream = [IO.FileStream]::new($journal, [IO.FileMode]::CreateNew,
    [IO.FileAccess]::ReadWrite, [IO.FileShare]::None, 4096,
    [IO.FileOptions]::WriteThrough)
  $seed = [Text.Encoding]::UTF8.GetBytes("PP-F00-JOURNAL-PROBE-V1`n")
  $stream.Write($seed,0,$seed.Length)
  $stream.Flush($true)
  try {
    $contender = [IO.FileStream]::new($journal, [IO.FileMode]::Open,
      [IO.FileAccess]::ReadWrite, [IO.FileShare]::None, 4096,
      [IO.FileOptions]::WriteThrough)
  } catch [IO.IOException] {
    $exclusive = $true
  } finally {
    if ($null -ne $contender) { $contender.Dispose(); $contender = $null }
  }
  $append = [Text.Encoding]::UTF8.GetBytes("ISSUE|synthetic-1`nSPEND|synthetic-1`n")
  $stream.Position = $stream.Length
  $stream.Write($append,0,$append.Length)
  $stream.Flush($true)
  $stream.Dispose()
  $stream = $null
  $expected = "PP-F00-JOURNAL-PROBE-V1`nISSUE|synthetic-1`nSPEND|synthetic-1`n"
  $persisted = [IO.File]::ReadAllText($journal,[Text.Encoding]::UTF8) -ceq $expected
  $code = if ($exclusive -and $persisted) { 'PRIMITIVES_OBSERVED' } else { 'PRIMITIVES_UNPROVEN' }
} catch {
  $code = 'WINDOWS_JOURNAL_PRIMITIVE_ERROR'
} finally {
  if ($null -ne $contender) { $contender.Dispose() }
  if ($null -ne $stream) { $stream.Dispose() }
  if (Test-Path -LiteralPath $root -PathType Container) {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
  }
}
[pscustomobject]@{
  schemaVersion='PP-F00-NONRELEASE-JOURNAL-PROBE-V1'
  code=$code
  exclusiveFileAccessObserved=$exclusive
  regularFileFlushObserved=$persisted
  powerLossDurabilityVerified=$false
  atomicNonceConsumptionVerified=$false
  independentlyAttested=$false
  registrarProvisioned=$false
  w8w9Admitted=$false
  canAdmit=$false
  canMerge=$false
} | ConvertTo-Json -Compress
