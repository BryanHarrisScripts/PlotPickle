#Requires -Version 5.1
<#
  #3142: owner-local acceptance broker entry point.
  This is NOT the Independent Windows Supervisor, remote MCP command bridge,
  model worker, credential manager or Product Gate attestation.
  Operates on current C: checkout; never moves data to the G: archive.
#>
[CmdletBinding(DefaultParameterSetName = 'Status')]
param(
  [Parameter(ParameterSetName = 'Status')][switch]$Status,
  [Parameter(Mandatory = $true, ParameterSetName = 'Receipt')][string]$Receipt,
  [Parameter(Mandatory = $true, ParameterSetName = 'Stage')][switch]$Stage,
  [Parameter(Mandatory = $true, ParameterSetName = 'Stage')][int]$PrNumber,
  [Parameter(Mandatory = $true, ParameterSetName = 'Stage')][string]$CandidateHead,
  [Parameter(Mandatory = $true, ParameterSetName = 'Stage')][string]$ExpectedHead,
  [Parameter(Mandatory = $true, ParameterSetName = 'Stage')][string]$RequestId,
  [Parameter(Mandatory = $true, ParameterSetName = 'Stage')][string]$Consent
)
$ErrorActionPreference = 'Stop'
if ($env:OS -cne 'Windows_NT') { throw 'OWNER_WINDOWS_ONLY' }
$scriptPath = Join-Path $PSScriptRoot 'owner-windows-acceptance.mjs'
if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
  throw 'REVIEWED_BROKER_SOURCE_MISSING'
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
if ($PSCmdlet.ParameterSetName -eq 'Status') {
  & $node $scriptPath --status
} elseif ($PSCmdlet.ParameterSetName -eq 'Receipt') {
  if ($Receipt -cnotmatch '^[a-f0-9]{32}$') { throw 'INVALID_RECEIPT_ID' }
  & $node $scriptPath --receipt $Receipt
} else {
  if ($CandidateHead -cnotmatch '^[a-f0-9]{40}$' -or
      $ExpectedHead -cnotmatch '^[a-f0-9]{40}$' -or
      $RequestId -cnotmatch '^[a-f0-9]{32}$' -or
      $PrNumber -lt 1 -or $PrNumber -gt 9999999) {
    throw 'INVALID_STAGE_SELECTION'
  }
  if ($Consent -cne 'AUTHORIZE_OWNER_WINDOWS_CANDIDATE_STAGE') {
    throw 'LOCAL_OPERATOR_CONSENT_REQUIRED'
  }
  if ([Console]::IsInputRedirected) { throw 'LOCAL_INTERACTIVE_CONSOLE_REQUIRED' }
  & $node $scriptPath --stage $PrNumber $CandidateHead $ExpectedHead $RequestId $Consent
}
if ($LASTEXITCODE -ne 0) { throw 'ACCEPTANCE_NOT_CONFIRMED_INSPECT_OUTPUT_AND_RECEIPT' }
