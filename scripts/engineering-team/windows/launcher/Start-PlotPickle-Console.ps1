#Requires -Version 5.1
<#
  Owner-session Windows Terminal view of the existing PlotPickle processes.
  Only the app and the existing interactive tunnel run in tabs. Scheduled
  services keep their own Windows owners and are observed from tabs.
#>
[CmdletBinding()]
param(
    [ValidateSet('Launch','Status','Watch','App','Tunnel')][string]$Mode = 'Launch',
    [ValidateSet('All','Factory','App','Tunnel','Supervisor','Dispatcher','Worker1','Recovery','Merge')]
    [string]$Role = 'All',
    [string]$RepoRoot = ''
)
$ErrorActionPreference = 'Stop'
$selectedRoot = if ($RepoRoot) { $RepoRoot } else { Join-Path $PSScriptRoot '..\..\..\..' }
$repo = (Resolve-Path -LiteralPath $selectedRoot).Path
$expectedOrigin = '^(https://github[.]com/BryanHarrisScripts/PlotPickle([.]git)?|git@github[.]com:BryanHarrisScripts/PlotPickle([.]git)?)$'
$supervisorScript = Join-Path $repo 'scripts\engineering-team\windows\supervisor\unattended-supervisor.mjs'
$workerScript = Join-Path $repo 'scripts\engineering-team\gateway\worker-pool\worker-host.mjs'
$factoryScript = Join-Path $repo 'scripts\engineering-team\windows\autonomous-queue.mjs'

function Read-Git([string[]]$Arguments) {
    $value = & git.exe -C $repo @Arguments 2>$null
    if ($LASTEXITCODE -ne 0) { throw ('GIT_FAILED: ' + ($Arguments -join ' ')) }
    return (@($value) -join "`n").Trim()
}
function Read-Source {
    $branch = Read-Git -Arguments @('branch','--show-current')
    $head = Read-Git -Arguments @('rev-parse','HEAD')
    $dirty = Read-Git -Arguments @('status','--porcelain','--untracked-files=no')
    $origin = Read-Git -Arguments @('remote','get-url','origin')
    if ($branch -cne 'main' -or $head -cnotmatch '^[a-f0-9]{40}$' -or
        $dirty -or $origin -cnotmatch $expectedOrigin) { throw 'CLEAN_TRUSTED_MAIN_REQUIRED' }
    return $head
}
function Read-Task([string]$Name) {
    try {
        $items = @(Get-ScheduledTask -TaskName $Name -ErrorAction Stop)
        if ($items.Count -ne 1) { return 'UNKNOWN' }
        return [string]$items[0].State
    } catch { return 'NOT_INSTALLED_OR_UNREADABLE' }
}
function Read-Http([string]$Url) {
    try {
        $reply = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        if ($reply.StatusCode -eq 200) { return 'RESPONDING' }
    } catch { }
    return 'NOT_RESPONDING'
}
function Read-TunnelLauncherState {
    $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    try {
        $matches = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
            Where-Object { $_.ProcessId -ne $PID -and
                $_.CommandLine -like '*Start-PlotPickle-Tunnel-Authenticated.ps1*' })
        foreach ($process in $matches) {
            $owner = (Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid).Sid
            if ($owner -cne $sid) { return 'UNVERIFIED_PROCESS' }
            return 'OWNED_PROCESS'
        }
        return 'ABSENT'
    } catch { return 'UNKNOWN' }
}
function Read-TunnelState {
    if ((Read-Http 'http://127.0.0.1:8080/readyz') -eq 'RESPONDING') { return 'RESPONDING' }
    $launcher = Read-TunnelLauncherState
    if ($launcher -eq 'OWNED_PROCESS') { return 'PROMPT_OR_STARTING' }
    if ($launcher -ne 'ABSENT') { return 'UNKNOWN_LAUNCHER' }
    return 'NOT_RESPONDING'
}
function Read-AppState {
    if ((Read-Http 'http://127.0.0.1:4173/') -eq 'RESPONDING') { return 'RESPONDING' }
    $runtime = Join-Path $repo 'scripts\windows-runtime.mjs'
    try {
        $description = @(& node.exe $runtime describe)
        if ($LASTEXITCODE -ne 0) { return 'RUNTIME_UNKNOWN' }
        if ($description -contains 'Runtime ready: no') { return 'RUNTIME_NOT_READY' }
        if ($description -notcontains 'Runtime ready: yes') { return 'RUNTIME_UNKNOWN' }
    } catch { return 'RUNTIME_UNKNOWN' }
    return 'NOT_RESPONDING'
}
function Read-NodeState([string]$Script) {
    try {
        $value = & node.exe $Script --status 2>$null
        if ($LASTEXITCODE -ne 0) { return $null }
        return (@($value) -join "`n") | ConvertFrom-Json
    } catch { return $null }
}
function Read-Marker([string]$Path) {
    try {
        $null = Get-Item -LiteralPath $Path -ErrorAction Stop
        return 'PRESENT'
    } catch [System.Management.Automation.ItemNotFoundException] {
        return 'ABSENT'
    } catch { return 'UNKNOWN' }
}
function Show-Status([string]$SelectedRole) {
    $head = $null
    $remote = $null
    $source = 'See Console tab'
    if ($SelectedRole -eq 'All') {
        try {
            $head = Read-Source
            $remote = Read-Git -Arguments @('rev-parse','origin/main')
            $source = if ($head -ceq $remote) { 'LOCAL_MAIN_MATCHES_FETCHED_ORIGIN_MAIN' } else { 'MAIN_MISMATCH' }
        } catch { $source = $_.Exception.Message }
    }
    $rows = @()
    if ($SelectedRole -in @('All','Factory')) {
        $factory = Read-NodeState $factoryScript
        $factoryState = if ($null -eq $factory) { 'UNKNOWN' } else { [string]$factory.state }
        $rows += [pscustomobject]@{Role='Factory'; State=$factoryState; Detail='Legacy queue observation; no second Factory launched'}
    }
    if ($SelectedRole -in @('All','App')) {
        $rows += [pscustomobject]@{Role='App'; State=(Read-AppState); Detail='Local HTTP and matching managed runtime only'}
    }
    if ($SelectedRole -in @('All','Tunnel')) {
        $rows += [pscustomobject]@{Role='Tunnel'; State=(Read-TunnelState); Detail='Existing tunnel endpoint; source digest not attested here'}
    }
    if ($SelectedRole -in @('All','Supervisor')) {
        $supervisor = Read-NodeState $supervisorScript
        $supervisorState = if ($null -eq $supervisor) { 'UNKNOWN' } else { [string]$supervisor.state }
        if ($head -and $supervisor.exactSha -and $supervisor.exactSha -cne $head) {
            $supervisorState += ' (SOURCE_MISMATCH)'
        }
        $rows += [pscustomobject]@{Role='Supervisor'; State=$supervisorState; Detail=('Task ' + (Read-Task 'PlotPickleIndependentSupervisor') + '; task owner not checked here')}
    }
    if ($SelectedRole -in @('All','Dispatcher')) {
        $worker = Read-NodeState $workerScript
        $workerState = if ($null -eq $worker) { 'UNKNOWN' } else { [string]$worker.state }
        $rows += [pscustomobject]@{Role='Dispatcher'; State=(Read-Task 'PlotPickleCodingDispatcher'); Detail=('Worker host ' + $workerState + '; task owner not checked here')}
    }
    if ($SelectedRole -in @('All','Worker1')) {
        $rows += [pscustomobject]@{Role='Worker1'; State=(Read-Task 'PlotPickleCodingWorker1'); Detail='Grant controlled; task owner not checked here'}
    }
    if ($SelectedRole -in @('All','Recovery')) {
        $rows += [pscustomobject]@{Role='Recovery'; State=(Read-Task 'PlotPickleServiceManagerPilot'); Detail='Owner logon pilot; task owner not checked here'}
    }
    if ($SelectedRole -in @('All','Merge')) {
        $rows += [pscustomobject]@{Role='Merge'; State='NOT_ENABLED'; Detail='Exact-head gates and separate release authority required'}
    }
    Clear-Host
    Write-Host ('PlotPickle console  ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
    Write-Host ('Source: ' + $source)
    if ($head) { Write-Host ('Local:  ' + $head) }
    if ($remote) { Write-Host ('Fetched: ' + $remote) }
    if ($SelectedRole -in @('All','Supervisor')) {
        $private = Join-Path $env:LOCALAPPDATA 'PlotPickle\engineering-team\supervisor'
        $stop = Read-Marker (Join-Path $private 'stop-request.json')
        $pause = Read-Marker (Join-Path $private 'pause-request.json')
        Write-Host ('STOP: ' + $stop + '  PAUSE: ' + $pause)
    }
    $rows | Format-Table -AutoSize | Out-Host
    Write-Host 'Observations are not Product Gate, worker execution, or merge proof.'
}
function Sync-Main {
    $head = Read-Source
    $env:GIT_TERMINAL_PROMPT = '0'
    $env:GCM_INTERACTIVE = 'Never'
    & git.exe -C $repo fetch --quiet origin main
    if ($LASTEXITCODE -ne 0) { throw 'GITHUB_MAIN_FETCH_FAILED' }
    $remote = Read-Git -Arguments @('rev-parse','origin/main')
    if ($head -ceq $remote) { return }
    & git.exe -C $repo merge-base --is-ancestor HEAD origin/main
    if ($LASTEXITCODE -ne 0) { throw 'MAIN_NOT_FAST_FORWARDABLE' }
    $guard = Join-Path $repo 'scripts\engineering-team\windows\launcher\factory-startup-guard.mjs'
    $null = & node.exe $guard --update-check
    if ($LASTEXITCODE -ne 0) { throw 'MAIN_BEHIND_FACTORY_RUNTIME_PROTECTED_RESTART_REQUIRED' }
    if ((Read-Http 'http://127.0.0.1:4173/') -ne 'NOT_RESPONDING' -or
        (Read-TunnelLauncherState) -ne 'ABSENT') {
        throw 'MAIN_BEHIND_APP_OR_TUNNEL_STILL_ACTIVE'
    }
    foreach ($taskName in @('PlotPickleIndependentSupervisor','PlotPickleCodingDispatcher',
            'PlotPickleCodingWorker1','PlotPickleServiceManagerPilot')) {
        if ((Read-Task $taskName) -notin @('Ready','Disabled')) {
            throw ('MAIN_BEHIND_TASK_NOT_QUIESCENT: ' + $taskName)
        }
    }
    $activeSource = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
        Where-Object { $_.CommandLine -match 'unattended-supervisor[.]mjs|supervisor-recovery-agent[.]mjs|worker-host[.]mjs|factory-readonly-server[.]mjs' })
    if ($activeSource.Count -gt 0) { throw 'MAIN_BEHIND_FACTORY_SOURCE_PROCESS_ACTIVE' }
    $activeApp = @(Get-CimInstance Win32_Process |
        Where-Object { $_.Name -in @('cmd.exe','node.exe') -and
            $_.CommandLine -like ('*' + $repo + '*') -and
            $_.CommandLine -match 'Start-PlotPickle[.]bat|vite|vinext' -and
            $_.CommandLine -notmatch 'Start-PlotPickle[.]bat --console(?:-status)?' })
    if ($activeApp.Count -gt 0) { throw 'MAIN_BEHIND_APP_SOURCE_PROCESS_ACTIVE' }
    & git.exe -C $repo merge --ff-only origin/main
    if ($LASTEXITCODE -ne 0) { throw 'MAIN_FAST_FORWARD_FAILED' }
    if ((Read-Source) -cne $remote) { throw 'MAIN_POST_SYNC_MISMATCH' }
    Write-Host ('Fast-forwarded main to ' + $remote + '. Loading the updated launcher.')
    & powershell.exe -NoProfile -File (Join-Path $repo 'scripts\engineering-team\windows\launcher\Start-PlotPickle-Console.ps1') -Mode Launch -RepoRoot $repo
    if ($LASTEXITCODE -ne 0) { throw 'UPDATED_LAUNCHER_FAILED' }
    exit 0
}
if ($Mode -eq 'Status') { Show-Status $Role; return }
if ($Mode -eq 'Watch') {
    while ($true) { Show-Status $Role; Start-Sleep -Seconds 30 }
}
if ($Mode -eq 'App') {
    if ((Read-AppState) -eq 'RESPONDING') {
        Write-Host 'PlotPickle app already responds on 4173. Showing status.'
        while ($true) { Show-Status 'App'; Start-Sleep -Seconds 30 }
    }
    $guard = Join-Path $repo 'scripts\engineering-team\windows\launcher\factory-startup-guard.mjs'
    $null = & node.exe $guard --update-check
    if ($LASTEXITCODE -ne 0 -and (Read-AppState) -eq 'RUNTIME_NOT_READY') {
        Write-Host 'App startup is blocked: the matching runtime is not ready while Factory ownership protects it.'
        while ($true) { Show-Status 'App'; Start-Sleep -Seconds 30 }
    }
    & (Join-Path $repo 'Start-PlotPickle.bat') --normal
    return
}
if ($Mode -eq 'Tunnel') {
    $tunnelState = Read-TunnelState
    if ($tunnelState -ne 'NOT_RESPONDING') {
        Write-Host ('Existing tunnel is ' + $tunnelState + '. Showing status.')
        while ($true) { Show-Status 'Tunnel'; Start-Sleep -Seconds 30 }
    }
    $launcher = Join-Path $repo 'Start-PlotPickle-Tunnel-Authenticated.ps1'
    if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) { throw 'LOCAL_OWNER_TUNNEL_LAUNCHER_MISSING' }
    $env:PLOTPICKLE_FACTORY_ENGINEERING_ENABLED = '1'
    & $launcher
    return
}
if ($Mode -ne 'Launch') { throw 'UNSUPPORTED_MODE' }
Sync-Main
$currentHead = Read-Source
$supervisorBeforeLaunch = Read-NodeState $supervisorScript
if ($null -eq $supervisorBeforeLaunch) { throw 'SUPERVISOR_STATUS_UNVERIFIABLE' }
if ($supervisorBeforeLaunch.state -eq 'RUNNING' -and
    $supervisorBeforeLaunch.exactSha -cne $currentHead) {
    throw 'SUPERVISOR_SOURCE_MISMATCH_REQUIRES_OWNER_MIGRATION'
}
$terminal = Get-Command wt.exe -ErrorAction Stop
$script = $PSCommandPath
$tabs = @(
    @('Factory','#19806E','Watch'), @('App','#358A55','App'),
    @('Tunnel','#337AAB','Tunnel'), @('Supervisor','#B87A35','Watch'),
    @('Dispatcher','#A76542','Watch'), @('Worker1','#5963A5','Watch'),
    @('Recovery','#A34B55','Watch'), @('Merge','#82558A','Watch')
)
$arguments = @('-w','new')
foreach ($tab in $tabs) {
    if ($arguments.Count -gt 2) { $arguments += ';' }
    $arguments += @('new-tab','--title',('PlotPickle ' + $tab[0]),'--tabColor',$tab[1],
        '--suppressApplicationTitle','-d',$repo,'powershell.exe','-NoProfile','-NoExit',
        '-File',$script,'-Mode',$tab[2],'-Role',$tab[0],'-RepoRoot',$repo)
}
$arguments += @(';','new-tab','--title','PlotPickle Console','--tabColor','#E0A527',
    '--suppressApplicationTitle','-d',$repo,'powershell.exe','-NoProfile','-NoExit',
    '-File',$script,'-Mode','Watch','-Role','All','-RepoRoot',$repo)
& $terminal.Source @arguments
if ($LASTEXITCODE -ne 0) { throw 'WINDOWS_TERMINAL_LAUNCH_FAILED' }
