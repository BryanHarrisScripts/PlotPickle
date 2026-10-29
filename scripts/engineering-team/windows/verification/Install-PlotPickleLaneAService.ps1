<#
 #3302: INTERNAL subcomponent installer, used later by the ONE PlotPickle
 Always-on installer. Default -Plan is READ ONLY and never changes SCM.
 -Apply demands explicit reviewed SHA-256 + trusted Authenticode signer.
 This only registers an INERT diagnostic host, start=demand. It does NOT
 generate keys, start any process, activate review or admit tests.
#>
[CmdletBinding()]
param(
  [switch]$Apply,
  [string]$ReviewedBinaryPath,
  [string]$ExpectedBinarySha256,
  [string]$TrustedPublisherThumbprint
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'WINDOWS_REQUIRED' }
$serviceName='PlotPickleLaneA'
$account='NT SERVICE\PlotPickleLaneA'
$installDir=Join-Path $env:ProgramFiles 'PlotPickle\ServiceManager\LaneA'
$destination=Join-Path $installDir 'PlotPickleLaneAService.exe'
if (-not $Apply) {
  [pscustomobject]@{
    schemaVersion='PP-LANE-A-INSTALL-PLAN-V1'
    result='PLAN_ONLY'
    serviceName=$serviceName
    executionIdentity=$account
    installChoice='always-on'
    configuredStart='demand'
    diagnosticHostOnly=$true
    willInstall=$false
    willStart=$false
    willCreateKeys=$false
    canAdmit=$false
  } | ConvertTo-Json
  return
}
# Installation is separately owner-gated; no unattended apply from a PR.
$principal=[Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'ELEVATED_WINDOWS_INSTALLER_REQUIRED'
}
if ($ExpectedBinarySha256 -notmatch '^[a-fA-F0-9]{64}$' -or
    $TrustedPublisherThumbprint -notmatch '^[a-fA-F0-9]{40}$' -or
    [string]::IsNullOrWhiteSpace($ReviewedBinaryPath)) {
  throw 'INDEPENDENTLY_REVIEWED_BINARY_AND_SIGNER_REQUIRED'
}
$source=[IO.Path]::GetFullPath($ReviewedBinaryPath)
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'SIGNED_BINARY_NOT_FOUND' }
if ((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint) {
  throw 'SYMLINKED_BINARY_REJECTED'
}
$actualHash=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $ExpectedBinarySha256.ToLowerInvariant()) { throw 'REVIEWED_BINARY_SHA_MISMATCH' }
$signature=Get-AuthenticodeSignature -LiteralPath $source
if ($signature.Status -ne 'Valid' -or $null -eq $signature.SignerCertificate -or
    $signature.SignerCertificate.Thumbprint -ne $TrustedPublisherThumbprint.ToUpperInvariant()) {
  throw 'REVIEWED_BINARY_SIGNATURE_UNTRUSTED'
}
if ($source -eq [IO.Path]::GetFullPath($destination)) { throw 'SOURCE_IS_INSTALL_DESTINATION' }
if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) {
  throw 'REVIEWER_SERVICE_ALREADY_EXISTS_NO_OVERWRITE'
}
if (Test-Path -LiteralPath $destination) { throw 'REVIEWER_BINARY_ALREADY_STAGED' }

# Never follow a pre-existing junction or broad-write folder while elevated.
# A user-writable service image path would defeat the isolated SCM token.
$installRoot=[IO.Path]::GetFullPath($env:ProgramFiles).TrimEnd('\')
$expectedA=Join-Path $installRoot 'PlotPickle'
$expectedB=Join-Path $expectedA 'ServiceManager'
foreach ($candidate in @($installRoot,$expectedA,$expectedB,$installDir)) {
  if (Test-Path -LiteralPath $candidate) {
    $item=Get-Item -LiteralPath $candidate -Force -ErrorAction Stop
    if (-not $item.PSIsContainer -or
        (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
      throw 'INSTALL_DIRECTORY_REPARSE_OR_FILE_REJECTED'
    }
  }
}
# The manager's installer is elevated but may not turn a review proposal into
# a trusted identity. The restricted service is demand-start, not boot-start.
New-Item -Path $installDir -ItemType Directory -Force -ErrorAction Stop | Out-Null
foreach ($candidate in @($expectedA,$expectedB,$installDir)) {
  $folder=Get-Item -LiteralPath $candidate -Force
  if (($folder.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'INSTALL_DIRECTORY_REPARSE_OR_FILE_REJECTED'
  }
  $acl=Get-Acl -LiteralPath $candidate
  $rights=$acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])
  foreach ($rule in $rights) {
    if ($rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and
        @('S-1-1-0','S-1-5-11','S-1-5-32-545') -contains $rule.IdentityReference.Value -and
        (($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::Write) -ne 0 -or
         ($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::Modify) -ne 0)) {
      throw 'INSTALL_DIRECTORY_BROAD_WRITE_ACCESS'
    }
  }
}
$installed=$false
try {
  Copy-Item -LiteralPath $source -Destination $destination -ErrorAction Stop
  if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $actualHash) {
    throw 'INSTALLED_BINARY_HASH_MISMATCH'
  }
  $sc=Join-Path $env:SystemRoot 'System32\sc.exe'
  if (-not (Test-Path -LiteralPath $sc -PathType Leaf)) { throw 'SCM_TOOL_NOT_FOUND' }

  # sc.exe requires literal spaces after option equals signs.
  & $sc create $serviceName 'type=' 'own' 'start=' 'demand' 'binPath=' ('"' + $destination + '"') 'obj=' $account 'DisplayName=' 'PlotPickle Lane A - Inert Independent QA Identity'
  if ($LASTEXITCODE -ne 0) { throw 'SCM_CREATE_REJECTED' }
  $installed=$true
  & $sc sidtype $serviceName restricted
  if ($LASTEXITCODE -ne 0) { throw 'SCM_RESTRICTED_SERVICE_SID_FAILED' }
  $registered=Get-CimInstance -ClassName Win32_Service -Filter "Name='PlotPickleLaneA'"
  if ($null -eq $registered -or $registered.StartName -ne $account -or
      $registered.StartMode -ne 'Manual' -or $registered.State -ne 'Stopped') {
    throw 'SCM_INSTALLED_IDENTITY_OR_START_MODE_UNVERIFIED'
  }
  [pscustomobject]@{
    schemaVersion='PP-LANE-A-INSTALL-CANDIDATE-V1'
    status='INERT_SERVICE_INSTALLED_NOT_STARTED'
    serviceName=$serviceName
    imageSha256=$actualHash
    reviewerQualified=$false
    signerEnrolled=$false
    reviewerKeyCreated=$false
    independentAttestation=$false
    productionActivated=$false
    canAdmit=$false
    canCode=$false
    canMerge=$false
  } | ConvertTo-Json
} catch {
  # Roll back only the service this attempt created, never existing services.
  if ($installed) {
    & (Join-Path $env:SystemRoot 'System32\sc.exe') delete $serviceName | Out-Null
  }
  if (Test-Path -LiteralPath $destination) {
    Remove-Item -LiteralPath $destination -Force -ErrorAction SilentlyContinue
  }
  throw
}
