<#
  #3302 F00 Lane A — FIXED-SERVICE READ-ONLY Windows inspection.
  No SCM changes, no key-file reads, no account provisioning or activation.
  Do not confuse local process facts with independent registrar attestation.
#>
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'WINDOWS_REQUIRED' }

$serviceName = 'PlotPickleLaneA'
$expectedServiceAccount = 'NT SERVICE\PlotPickleLaneA'
$base = [ordered]@{
    schemaVersion = 1
    serviceName = $serviceName
    actorId = 'PP-F00-D02-W0001'
    roleAlias = 'PP-F00-LA-W0001'
    managerService = 'PlotPickleServiceManager'
    installationChoice = 'always-on'
    observedAtUtc = [DateTime]::UtcNow.ToString('o')
    status = 'UNPROVEN'
    accountObserved = $null
    processRunning = $false
    processTokenSid = $null
    sourceHeadAttested = $false
    keyAclAttested = $false
    independentlyAttested = $false
    canStart = $false
    canAdmit = $false
    canEditCatalogue = $false
    canCode = $false
    canMerge = $false
}
try {
    $service = Get-CimInstance -ClassName Win32_Service -Filter "Name='PlotPickleLaneA'" -ErrorAction Stop
    if ($null -eq $service) {
        $base.status = 'NOT_INSTALLED'
        $base | ConvertTo-Json -Depth 5
        return
    }
    $base.accountObserved = [string]$service.StartName
    if ($service.StartName -cne $expectedServiceAccount) {
        $base.status = 'SERVICE_ACCOUNT_MISMATCH'
        $base | ConvertTo-Json -Depth 5
        return
    }
    if ([string]$service.State -cne 'Running' -or [int]$service.ProcessId -lt 1) {
        $base.status = 'NOT_RUNNING'
        $base | ConvertTo-Json -Depth 5
        return
    }
    $process = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId=$([int]$service.ProcessId)" -ErrorAction Stop
    if ($null -eq $process) {
        $base.status = 'PROCESS_NOT_FOUND'
        $base | ConvertTo-Json -Depth 5
        return
    }
    $token = Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid -ErrorAction Stop
    if ($null -eq $token -or [int]$token.ReturnValue -ne 0 -or
        [string]$token.Sid -notmatch '^S-1-(?:[0-9]+-){2,}[0-9]+$') {
        $base.status = 'PROCESS_TOKEN_UNVERIFIED'
        $base | ConvertTo-Json -Depth 5
        return
    }
    $base.processRunning = $true
    $base.processTokenSid = [string]$token.Sid
    $base.status = 'LOCAL_CANDIDATE_NOT_INDEPENDENTLY_ATTESTED'
} catch {
    # Avoid dumping potentially sensitive CIM/Windows error text or paths.
    $base.status = 'WINDOWS_INSPECTION_UNAVAILABLE'
}
$base | ConvertTo-Json -Depth 5
