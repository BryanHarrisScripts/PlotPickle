#Requires -Version 5.1
<#
  #3142: local owner-approved Windows Acceptance Broker.
  Keeps PlotPickleIndependentSupervisor running; never starts the Pi Factory.
  C: is live execution. No remote MCP command or auto-merge is provided.
  When running from a preview checkout, bind the broker code's exact SHA and
  the SEPARATE canonical clean MAIN checkout before any candidate staging.
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
  [Parameter(Mandatory = $true, ParameterSetName = 'Stage')][string]$Consent,
  [Parameter(Mandatory = $true, ParameterSetName = 'Stage')][string]$BrokerHead,
  [Parameter(ParameterSetName = 'Status')]
  [Parameter(Mandatory = $true, ParameterSetName = 'Stage')][string]$TrustedMainRoot
)
$ErrorActionPreference = 'Stop'
if ($env:OS -cne 'Windows_NT') { throw 'OWNER_WINDOWS_ONLY' }
$scriptPath = Join-Path $PSScriptRoot 'owner-windows-acceptance.mjs'
if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
  throw 'REVIEWED_BROKER_SOURCE_MISSING'
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
if ($PSCmdlet.ParameterSetName -eq 'Receipt') {
  if ($Receipt -cnotmatch '^[a-f0-9]{32}$') { throw 'INVALID_RECEIPT_ID' }
  & $node $scriptPath --receipt $Receipt
} elseif ($PSCmdlet.ParameterSetName -eq 'Status') {
  if ([string]::IsNullOrWhiteSpace($TrustedMainRoot)) {
    & $node $scriptPath --status
  } else {
    $trustedMain = (Resolve-Path -LiteralPath $TrustedMainRoot -ErrorAction Stop).Path
    & $node $scriptPath --status --main-root $trustedMain
  }
} else {
  if ($CandidateHead -cnotmatch '^[a-f0-9]{40}$' -or
      $ExpectedHead -cnotmatch '^[a-f0-9]{40}$' -or
      $BrokerHead -cnotmatch '^[a-f0-9]{40}$' -or
      $RequestId -cnotmatch '^[a-f0-9]{32}$' -or
      $PrNumber -lt 1 -or $PrNumber -gt 9999999) {
    throw 'INVALID_STAGE_SELECTION'
  }
  if ($Consent -cne 'AUTHORIZE_OWNER_WINDOWS_CANDIDATE_STAGE') {
    throw 'LOCAL_OPERATOR_CONSENT_REQUIRED'
  }
  if ([Console]::IsInputRedirected) { throw 'LOCAL_INTERACTIVE_CONSOLE_REQUIRED' }
  $codeRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..\..')).Path
  $trustedMain = (Resolve-Path -LiteralPath $TrustedMainRoot -ErrorAction Stop).Path
  if ([System.IO.Path]::GetPathRoot($codeRoot) -cne 'C:\' -or
      [System.IO.Path]::GetPathRoot($trustedMain) -cne 'C:\') {
    throw 'LIVE_CODE_AND_MAIN_MUST_REMAIN_ON_C'
  }
  $codeSha = (& git -C $codeRoot rev-parse HEAD)
  if ($LASTEXITCODE -ne 0 -or $codeSha.Trim() -cne $BrokerHead) {
    throw 'BROKER_CODE_HEAD_UNVERIFIED'
  }
  $codeDirty = & git -C $codeRoot status --porcelain --untracked-files=no
  if ($LASTEXITCODE -ne 0 -or $codeDirty) {
    throw 'BROKER_CODE_CHECKOUT_DIRTY'
  }
  & $node $scriptPath --stage $PrNumber $CandidateHead $ExpectedHead $RequestId $Consent --main-root $trustedMain
}
if ($LASTEXITCODE -ne 0) { throw 'ACCEPTANCE_NOT_CONFIRMED_INSPECT_OUTPUT_AND_RECEIPT' }
