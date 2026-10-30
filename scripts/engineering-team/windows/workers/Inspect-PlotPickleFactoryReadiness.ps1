#Requires -Version 5.1
<#
  #3142 Owner-Windows preflight, READ ONLY.
  Intentionally does not register/start/stop tasks, create keys, modify STOP,
  issue model grants, enroll F00, run unadmitted tests or merge code.
#>
[CmdletBinding()]
param([switch]$Status)
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'OWNER_WINDOWS_ONLY' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path

function Read-GitValue([string[]]$GitArgs) {
  try {
    $value = & git.exe -C $repo @GitArgs 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return (@($value) -join "`n").Trim()
  } catch { return $null }
}
function Read-TaskState([string]$TaskName) {
  try {
    $items = @(Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop)
    if ($items.Count -ne 1) {
      return [pscustomobject]@{ state='UNKNOWN'; count=$items.Count; processVerified=$false }
    }
    return [pscustomobject]@{
      state=[string]$items[0].State; count=1; processVerified=$false
    }
  } catch {
    return [pscustomobject]@{ state='NOT_INSTALLED_OR_UNREADABLE'; count=$null; processVerified=$false }
  }
}
$head = Read-GitValue -GitArgs @('rev-parse','HEAD')
$branch = Read-GitValue -GitArgs @('branch','--show-current')
$dirty = Read-GitValue -GitArgs @('status','--porcelain','--untracked-files=no')
$sourceObserved = $head -cmatch '^[a-f0-9]{40}$' -and $branch -ceq 'main' -and $null -ne $dirty
$clean = $sourceObserved -and $dirty.Length -eq 0
$supervisor = $null
$supervisorScript = Join-Path $repo 'scripts\engineering-team\windows\supervisor\unattended-supervisor.mjs'
try {
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  if (Test-Path -LiteralPath $supervisorScript -PathType Leaf) {
    $raw = & $node $supervisorScript --status
    if ($LASTEXITCODE -eq 0) { $supervisor = ($raw | ConvertFrom-Json -ErrorAction Stop) }
  }
} catch { $supervisor = $null }
$supervisorState = if ($null -eq $supervisor) { 'UNKNOWN' } else { [string]$supervisor.state }
$supervisorHeadMatches = $clean -and $null -ne $supervisor -and
  $supervisorState -ceq 'RUNNING' -and $supervisor.exactSha -ceq $head
$tasks = @()
foreach ($name in @('PlotPickleIndependentSupervisor','PlotPickleCodingDispatcher',
                     'PlotPickleCodingWorker1','PlotPickleCodingWorker2','PlotPickleSoftwareFactory')) {
  $task = Read-TaskState $name
  $tasks += [pscustomobject]@{ name=$name; state=$task.state; count=$task.count;
    processVerified=$false }
}
$reviewer = 'NOT_INSTALLED_OR_UNREADABLE'
try {
  $svc = @(Get-Service -Name 'PlotPickleLaneA' -ErrorAction Stop)
  if ($svc.Count -eq 1) { $reviewer = 'SCM_' + [string]$svc[0].Status + '_NOT_INDEPENDENTLY_QUALIFIED' }
} catch {}
[pscustomobject]@{
  schemaVersion = 'PP-FACTORY-LOCAL-READINESS-V1'
  scope = 'READ_ONLY_OWNER_HOST_OBSERVATION_NOT_PRODUCT_GATE'
  state = 'RELEASE_GATED'
  sourceHead = if ($head -cmatch '^[a-f0-9]{40}$') { $head } else { $null }
  branch = $branch
  cleanMain = [bool]$clean
  supervisorState = $supervisorState
  supervisorHeadMatches = [bool]$supervisorHeadMatches
  reviewerService = $reviewer
  tasks = $tasks
  codingDispatcherVerified = $false
  codingWorker1Verified = $false
  codingWorker2Verified = $false
  independentW8W9Admitted = $false
  ownerWindowsProductGatePassed = $false
  twoGenuineAutonomousCyclesProven = $false
  automaticMergeEnabled = $false
  modelInvoked = $false
  hostMutationPerformed = $false
} | ConvertTo-Json -Depth 6 -Compress
