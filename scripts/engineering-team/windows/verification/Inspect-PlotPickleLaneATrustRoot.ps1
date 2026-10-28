<#
 #3302 read-only Windows trust-root observation for automated Lane A.
 Does not set registry values, import certificates, create private keys, grant
 trust, issue signed review, or activate the reviewer.
 The trust root must first come from separately verified signed policy.
#>
[CmdletBinding()]
param([string]$ExpectedRootFingerprint)
$ErrorActionPreference='Stop'
if ($env:OS -ne 'Windows_NT') { throw 'WINDOWS_REQUIRED' }

$registryPath='Registry::HKEY_LOCAL_MACHINE\SOFTWARE\PlotPickle\ServiceManager\Trust\LaneA'
$out=[ordered]@{
 schemaVersion='PP-LANE-A-TRUST-ROOT-OBSERVATION-V1'
 scope='READ_ONLY_LOCAL_REGISTRY_NOT_INDEPENDENT_ROOT_CUSTODY'
 observedAtUtc=[DateTime]::UtcNow.ToString('o')
 code='UNPROVEN'
 registryPresent=$false
 publisherKeyFingerprintMatch=$false
 broadWriteAclDenied='UNPROVEN'
 independentPublisherAttestation='UNPROVEN'
 canEnroll=$false
 canAdmit=$false
 canEditCatalogue=$false
 canMerge=$false
}
function Emit([string]$code){
 $out.code=$code
 $out|ConvertTo-Json -Depth 4
}
if ($ExpectedRootFingerprint -cnotmatch '^[a-f0-9]{64}$') {
 Emit 'EXTERNAL_ROOT_PIN_REQUIRED'
 return
}
try {
 $key=Get-Item -LiteralPath $registryPath -ErrorAction Stop
} catch [System.Management.Automation.ItemNotFoundException] {
 Emit 'ROOT_NOT_INSTALLED'
 return
} catch {
 Emit 'TRUST_ROOT_REGISTRY_UNAVAILABLE'
 return
}
$out.registryPresent=$true
try {
 $root=Get-ItemProperty -LiteralPath $registryPath -ErrorAction Stop
 if ([string]$root.RootKeyFingerprint -cnotmatch '^[a-f0-9]{64}$' -or
     [string]$root.RootKeyFingerprint -cne $ExpectedRootFingerprint) {
  Emit 'ROOT_FINGERPRINT_MISMATCH'
  return
 }
 $out.publisherKeyFingerprintMatch=$true
 # Check *effective broad write rules*, not just named primary owner. A Windows
 # administrator can still change machine policy: only independently signed
 # bootstrap policy can turn such an observation into a trusted root.
 $acl=Get-Acl -LiteralPath $registryPath -ErrorAction Stop
 foreach ($rule in $acl.Access) {
  if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) { continue }
  $identity=$rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
  if (@('S-1-1-0','S-1-5-11','S-1-5-32-545') -contains $identity) {
   $write=[Security.AccessControl.RegistryRights]::WriteKey
   $set=[Security.AccessControl.RegistryRights]::SetValue
   $create=[Security.AccessControl.RegistryRights]::CreateSubKey
   $full=[Security.AccessControl.RegistryRights]::FullControl
   if (($rule.RegistryRights -band $write) -ne 0 -or
       ($rule.RegistryRights -band $set) -ne 0 -or
       ($rule.RegistryRights -band $create) -ne 0 -or
       ($rule.RegistryRights -band $full) -ne 0) {
    Emit 'TRUST_ROOT_BROAD_WRITE_ACCESS'
    return
   }
  }
 }
 $out.broadWriteAclDenied='OBSERVED'
 Emit 'LOCAL_TRUST_ROOT_CANDIDATE_ONLY'
} catch {
 Emit 'ROOT_ACL_OR_CONTENT_NOT_VERIFIED'
}
