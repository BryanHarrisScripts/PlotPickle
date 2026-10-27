<#
  #3302 Lane A — READ-ONLY Windows SID and file ACL preflight.
  Does not create a Windows account, key, signature, task, trusted reviewer
  or admission. A local self-report is NOT independent registrar attestation.
#>
[CmdletBinding()]
param(
    [ValidateSet('Coding','Reviewer')][string]$Mode = 'Coding',
    [string]$ExpectedCodingSid,
    [string]$PrivateKeyPath,
    [string]$RepositoryRoot
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'WINDOWS_REQUIRED' }
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
if ($null -eq $identity -or $null -eq $identity.User) { throw 'PROCESS_TOKEN_UNAVAILABLE' }
$sid = $identity.User.Value

if ($Mode -eq 'Coding') {
    [pscustomobject]@{
        schemaVersion = 'PP-LANE-A-IDENTITY-INSPECT-V1'
        status = 'LOCAL_CODING_SID_OBSERVED_NOT_INDEPENDENT'
        role = 'coding'
        account = $identity.Name
        sid = $sid
        inspectedAtUtc = [DateTime]::UtcNow.ToString('o')
        credentialCreated = $false
        independentRegistrarAttested = $false
    } | ConvertTo-Json -Depth 4
    return
}

if ([string]::IsNullOrWhiteSpace($ExpectedCodingSid) -or
    $ExpectedCodingSid -notmatch '^S-1-(?:[0-9]+-){2,}[0-9]+$') {
    throw 'CODING_SID_REQUIRED'
}
if ($sid -eq $ExpectedCodingSid) { throw 'CODING_AND_REVIEWER_SHARE_WINDOWS_SID' }
if ([string]::IsNullOrWhiteSpace($PrivateKeyPath) -or
    [string]::IsNullOrWhiteSpace($RepositoryRoot)) { throw 'KEY_PATH_AND_REPO_REQUIRED' }
$file = Get-Item -LiteralPath $PrivateKeyPath -ErrorAction Stop
$repo = Get-Item -LiteralPath $RepositoryRoot -ErrorAction Stop
if ($file.PSIsContainer -or -not $repo.PSIsContainer) { throw 'PATH_KIND_INVALID' }
$keyFull = [System.IO.Path]::GetFullPath($file.FullName)
$repoFull = [System.IO.Path]::GetFullPath($repo.FullName).TrimEnd('\') + '\'
if ($keyFull.StartsWith($repoFull,[StringComparison]::OrdinalIgnoreCase)) {
    throw 'PRIVATE_KEY_INSIDE_GIT_CHECKOUT'
}

$allowed = @($sid, 'S-1-5-18', 'S-1-5-32-544')
$evidence = @()
foreach ($entry in @($file, $file.Directory)) {
    $acl = Get-Acl -LiteralPath $entry.FullName -ErrorAction Stop
    if (-not $acl.AreAccessRulesProtected) { throw 'ACL_INHERITANCE_NOT_DISABLED' }
    $ownerSid = ([System.Security.Principal.NTAccount]$acl.Owner).Translate(
        [System.Security.Principal.SecurityIdentifier]).Value
    if ($ownerSid -ne $sid) { throw 'PRIVATE_KEY_OWNER_MISMATCH' }
    $rules = $acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])
    foreach ($rule in $rules) {
        $aceSid = $rule.IdentityReference.Value
        if ($rule.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow -and
            $allowed -notcontains $aceSid) { throw 'PRIVATE_KEY_ACL_BROAD_ACCESS' }
    }
    $aclHash = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($acl.Sddl)
        $digest = [Convert]::ToHexString($aclHash.ComputeHash($bytes)).ToLowerInvariant()
    } finally {
        $aclHash.Dispose()
    }
    $evidence += [pscustomobject]@{ kind = $(if ($entry.PSIsContainer) {'directory'} else {'key'}); aclSha256=$digest }
}
[pscustomobject]@{
    schemaVersion = 'PP-LANE-A-IDENTITY-INSPECT-V1'
    status = 'LOCAL_REVIEWER_CANDIDATE_NOT_INDEPENDENT_ATTESTATION'
    actorId = 'PP-F00-D02-W0001'
    roleAlias = 'PP-F00-LA-W0001'
    account = $identity.Name
    reviewerSid = $sid
    codingSidDistinct = $true
    aclObservations = $evidence
    inspectedAtUtc = [DateTime]::UtcNow.ToString('o')
    credentialCreated = $false
    independentRegistrarAttested = $false
    productionActivated = $false
} | ConvertTo-Json -Depth 5
