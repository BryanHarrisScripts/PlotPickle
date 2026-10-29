<#
 #3302: Owner Windows read-only *candidate* acceptance inventory.
 Run only from independently reviewed exact-head checkout. No elevated
 privileges, service mutation, keys, model calls or catalogue writes.
 A JSON observation is not out-of-process F00 registrar attestation.
#>
[CmdletBinding()]
param(
    [string]$ExpectedSourceHead,
    [string]$ExpectedBinarySha256,
    [string]$ExpectedPublisherThumbprint,
    [string]$RepositoryRoot
)
$ErrorActionPreference='Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
$serviceName='PlotPickleLaneA'
$serviceAccount='NT SERVICE\PlotPickleLaneA'
$image=Join-Path $env:ProgramFiles 'PlotPickle\ServiceManager\LaneA\PlotPickleLaneAService.exe'
$stopMarker=Join-Path $env:LOCALAPPDATA 'PlotPickle\engineering-team\supervisor\stop-request.json'
$report=[ordered]@{
    schemaVersion='PP-LANE-A-OWNER-ACCEPTANCE-OBSERVATION-V1'
    role='PP-F00-D02-W0001'
    scope='LOCAL_READ_ONLY_NOT_INDEPENDENT_REGISTRAR'
    observedAtUtc=[DateTime]::UtcNow.ToString('o')
    code='UNPROVEN'
    sourceHeadMatch=$false
    sourceTreeClean=$false
    sourceHead='UNOBSERVED'
    binarySha256Match=$false
    trustedPublisherMatch=$false
    imagePathMatch=$false
    serviceInstalled=$false
    serviceAccountMatch=$false
    serviceManualStart=$false
    processRunning=$false
    processTokenAccountMatch=$false
    processTokenSidHash=$null
    ownerStopMarker='UNKNOWN'
    serviceSidRestricted='UNPROVEN'
    privilegeObservationState='UNPROVEN'
    codingReviewerSidDistinct='UNPROVEN'
    reviewerSignerKey='UNPROVEN'
    independentRegistrar='UNPROVEN'
    w8w9Admission='UNPROVEN'
    windowsProductGate='UNPROVEN'
    canStart=$false
    canStop=$false
    canAdmit=$false
    canCode=$false
    canMerge=$false
}
function Set-Block([string]$code) {
    $report.code=$code
    $report|ConvertTo-Json -Depth 6
}
# All three policy pins must be independently supplied from outside this PR.
# Missing pins keep the report blocked, including when the service is absent.
if ($ExpectedSourceHead -cnotmatch '^[a-f0-9]{40}$' -or
    $ExpectedBinarySha256 -cnotmatch '^[a-f0-9]{64}$' -or
    $ExpectedPublisherThumbprint -notmatch '^[a-fA-F0-9]{40}$' -or
    [string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    Set-Block 'EXTERNAL_POLICY_PINS_REQUIRED'
    return
}
# STOP is checked before service readiness: marker contents are never parsed.
try {
    Get-Item -LiteralPath $stopMarker -Force -ErrorAction Stop|Out-Null
    $report.ownerStopMarker='PRESENT'
} catch [System.Management.Automation.ItemNotFoundException] {
    $report.ownerStopMarker='ABSENT'
} catch {
    $report.ownerStopMarker='UNKNOWN'
}
if ($report.ownerStopMarker -ne 'ABSENT') {
    Set-Block 'OWNER_STOP_PRESENT_OR_UNREADABLE'
    return
}

# A PR head supplied by the operator is not sufficient: inspect the checkout.
try {
    $root=(Resolve-Path -LiteralPath $RepositoryRoot -ErrorAction Stop).Path
    $gitCommand=Get-Command git.exe -ErrorAction Stop
    $head=@(& $gitCommand.Source -C $root rev-parse HEAD 2>$null)
    $status=@(& $gitCommand.Source -C $root status --porcelain --untracked-files=no 2>$null)
    if ($LASTEXITCODE -ne 0 -or @($head).Count -ne 1) { throw 'GIT_SOURCE_NOT_INSPECTABLE' }
    $report.sourceHead=[string]$head[0]
    $report.sourceHeadMatch=($report.sourceHead -ceq $ExpectedSourceHead)
    $report.sourceTreeClean=(@($status).Count -eq 0)
} catch {
    Set-Block 'SOURCE_EDITION_NOT_OBSERVED'
    return
}
if (-not $report.sourceHeadMatch -or -not $report.sourceTreeClean) {
    Set-Block 'SOURCE_EDITION_UNVERIFIED'
    return
}

try {
    $service=Get-CimInstance -ClassName Win32_Service -Filter "Name='PlotPickleLaneA'" -ErrorAction Stop
} catch {
    Set-Block 'SCM_READ_UNAVAILABLE'
    return
}
if ($null -eq $service) {
    Set-Block 'REVIEWER_SERVICE_NOT_INSTALLED'
    return
}
$report.serviceInstalled=$true
$report.serviceAccountMatch=($service.StartName -eq $serviceAccount)
$report.serviceManualStart=($service.StartMode -eq 'Manual')
# Insist on precisely the expected image; no arguments or alternate launcher.
$reportedImage=[string]$service.PathName
$expectedQuoted='"'+$image+'"'
$report.imagePathMatch=($reportedImage -ieq $expectedQuoted -or $reportedImage -ieq $image)
if (-not $report.serviceAccountMatch -or -not $report.serviceManualStart -or -not $report.imagePathMatch) {
    Set-Block 'REVIEWER_SCM_CONFIGURATION_MISMATCH'
    return
}
try {
    $item=Get-Item -LiteralPath $image -Force -ErrorAction Stop
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'IMAGE_REPARSE_OR_KIND_INVALID'
    }
    $digest=(Get-FileHash -LiteralPath $image -Algorithm SHA256).Hash.ToLowerInvariant()
    $report.binarySha256Match=($digest -ceq $ExpectedBinarySha256)
    $sig=Get-AuthenticodeSignature -LiteralPath $image -ErrorAction Stop
    $report.trustedPublisherMatch=($sig.Status -eq 'Valid' -and
        $null -ne $sig.SignerCertificate -and
        $sig.SignerCertificate.Thumbprint -eq $ExpectedPublisherThumbprint)
} catch {
    Set-Block 'REVIEWER_IMAGE_READ_OR_SIGNATURE_UNAVAILABLE'
    return
}
if (-not $report.binarySha256Match -or -not $report.trustedPublisherMatch) {
    Set-Block 'REVIEWER_IMAGE_NOT_RELEASE_TRUSTED'
    return
}
try {
    $sc=Join-Path $env:SystemRoot 'System32\sc.exe'
    $sidType=@(& $sc qsidtype $serviceName 2>$null) -join ' '
    if ($LASTEXITCODE -eq 0 -and $sidType -match 'SERVICE_SID_TYPE\s*:\s*RESTRICTED') {
        $report.serviceSidRestricted='SCM_CONFIGURED_NOT_TOKEN_ATTESTED'
    }
} catch { $report.serviceSidRestricted='UNPROVEN' }
if ($report.serviceSidRestricted -ne 'SCM_CONFIGURED_NOT_TOKEN_ATTESTED') {
    Set-Block 'RESTRICTED_SID_NOT_OBSERVED'
    return
}
if ($service.State -ne 'Running' -or [int]$service.ProcessId -lt 1) {
    Set-Block 'REVIEWER_DIAGNOSTIC_SERVICE_NOT_RUNNING'
    return
}
try {
    $process=Get-CimInstance -ClassName Win32_Process -Filter "ProcessId=$([int]$service.ProcessId)" -ErrorAction Stop
    if ($null -eq $process) { throw 'SCM_PROCESS_UNOBSERVED' }
    $owner=Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid -ErrorAction Stop
    $expectedSid=([Security.Principal.NTAccount]$serviceAccount).Translate(
        [Security.Principal.SecurityIdentifier]).Value
    if ($null -eq $owner -or [int]$owner.ReturnValue -ne 0 -or
        $owner.Sid -ne $expectedSid) {
        Set-Block 'REVIEWER_PROCESS_ACCOUNT_MISMATCH'
        return
    }
    $report.processRunning=$true
    $report.processTokenAccountMatch=$true
    $sha=[Security.Cryptography.SHA256]::Create()
    try {
        $bytes=[Text.Encoding]::UTF8.GetBytes([string]$owner.Sid)
        $report.processTokenSidHash=([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()
    } finally { $sha.Dispose() }
} catch {
    Set-Block 'REVIEWER_PROCESS_TOKEN_UNAVAILABLE'
    return
}
# This is a local diagnostic only, never independent token/ACL evidence.
Set-Block 'LOCAL_SCM_CANDIDATE_ONLY'
