# Native Windows PowerShell 5.1 safety proof for #3278.
# Fixtures run in a unique temporary root. Never change the owner's launcher.
$ErrorActionPreference = 'Stop'
$root = Join-Path ([System.IO.Path]::GetTempPath()) ('plotpickle-mcp-catalog-fixture-' + [Guid]::NewGuid().ToString('N'))
$tunnel = Join-Path $root 'scripts\engineering-team\windows\tunnel'
$catalogDir = Join-Path $root 'config\mcp'
$launcher = Join-Path $root 'Start-PlotPickle-Tunnel-Authenticated.ps1'
$sourceTunnel = $PSScriptRoot
$sourceCatalog = Join-Path ([System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..\..'))) 'config\mcp\factory-tool-catalog.json'

function Assert-True([bool]$condition, [string]$message) {
    if (-not $condition) { throw ('FIXTURE_ASSERTION_FAILED: ' + $message) }
}
function Assert-Reject([scriptblock]$action, [string]$message) {
    $failed = $false
    try { & $action | Out-Null } catch { $failed = $true }
    Assert-True $failed $message
}
try {
    New-Item -ItemType Directory -Path $tunnel -Force | Out-Null
    New-Item -ItemType Directory -Path $catalogDir -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $sourceTunnel 'Assert-PlotPickleMcpCatalog.ps1') -Destination $tunnel
    Copy-Item -LiteralPath (Join-Path $sourceTunnel 'Upgrade-PlotPickleTunnelCatalog.ps1') -Destination $tunnel
    Copy-Item -LiteralPath $sourceCatalog -Destination $catalogDir
    $assertion = Join-Path $tunnel 'Assert-PlotPickleMcpCatalog.ps1'
    $upgrade = Join-Path $tunnel 'Upgrade-PlotPickleTunnelCatalog.ps1'
    $catalog = Get-Content -LiteralPath (Join-Path $catalogDir 'factory-tool-catalog.json') -Raw | ConvertFrom-Json
    $public = @($catalog.public)
    $auth = @($catalog.public) + @($catalog.control) + @($catalog.conversation) + @($catalog.storage)
    $engineering = @($auth) + @($catalog.engineeringOptIn)
    Assert-True ($public.Count -eq 4 -and $auth.Count -eq 10 -and $engineering.Count -eq 11) 'catalogue fixture cardinality'
    & $assertion -PublicTools $public -AuthenticatedTools $auth
    & $assertion -PublicTools $public -AuthenticatedTools $engineering -EngineeringEnabled
    Assert-Reject { & $assertion -PublicTools (@($public) + @('fabricated')) -AuthenticatedTools $auth } 'unexpected public tool rejected'
    Assert-Reject { & $assertion -PublicTools $public -AuthenticatedTools (@($auth) + @('fabricated')) } 'unexpected authenticated tool rejected'
    Assert-Reject { & $assertion -PublicTools $public -AuthenticatedTools $public } 'missing privileged tools rejected'
    Assert-Reject { & $assertion -PublicTools $public -AuthenticatedTools $auth -EngineeringEnabled } 'opt-in list rejected if missing engineering tool'
    $fixture = @'
$plain = @{result = @{tools = @()}}
$headers = @{}
$token = 'FIXTURE_TOKEN_NOT_A_REAL_CREDENTIAL'
$uri = 'http://127.0.0.1'
$body = '{}'
        $plainTools = @($plain.result.tools)
        $headers['x-plotpickle-factory-control-token'] = $token
        $auth = Invoke-RestMethod -Uri $uri -Method Post -ContentType 'application/json' `
            -Headers $headers -Body $body -TimeoutSec 8
        $expectedCount = 9
        Write-Host ('  Verified 4 public and ' + $expectedCount + ' authenticated MCP tools.') -ForegroundColor Green
'@
    $fixture = $fixture.Replace("`n", "`r`n")
    [System.IO.File]::WriteAllText($launcher, $fixture, [System.Text.UTF8Encoding]::new($true))
    $before = [System.IO.File]::ReadAllText($launcher)
    & $upgrade
    $after = [System.IO.File]::ReadAllText($launcher)
    Assert-True ($after -ne $before -and $after.Contains('Assert-PlotPickleMcpCatalog.ps1')) 'replaced exact fixture'
    $backup = @(Get-ChildItem -LiteralPath $root -Filter 'Start-PlotPickle-Tunnel-Authenticated.ps1.catalog-backup-*' -File)
    Assert-True ($backup.Count -eq 1) 'one rollback backup'
    Assert-True ([System.IO.File]::ReadAllText($backup[0].FullName) -eq $before) 'backup retains original'
    $tokens = $null
    $parseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($launcher, [ref]$tokens, [ref]$parseErrors) | Out-Null
    Assert-True ($parseErrors.Count -eq 0) 'PowerShell 5.1 parser accepts upgraded script'
    & $upgrade
    Assert-True ([System.IO.File]::ReadAllText($launcher) -eq $after) 'second upgrade idempotent'
    Assert-True (@(Get-ChildItem -LiteralPath $root -Filter 'Start-PlotPickle-Tunnel-Authenticated.ps1.catalog-backup-*' -File).Count -eq 1) 'idempotent backup count'
    [System.IO.File]::WriteAllText($launcher, '$plainTools = @(42)')
    Assert-Reject { & $upgrade } 'unrecognized launcher refused'
    Assert-True ([System.IO.File]::ReadAllText($launcher) -eq '$plainTools = @(42)') 'refused launcher unchanged'
    $badManifest = Join-Path $catalogDir 'factory-tool-catalog.json'
    $originalManifest = [System.IO.File]::ReadAllText($badManifest)
    $brokenManifest = $originalManifest.Replace('"factory_status"', '"factory_observer"')
    [System.IO.File]::WriteAllText($badManifest, $brokenManifest)
    Assert-Reject { & $assertion -PublicTools $public -AuthenticatedTools $auth } 'duplicate manifest tool rejected'
    Write-Output 'PASS: PowerShell 5.1 exact-name, opt-in, invalid-name, atomic backup, idempotence and fail-closed migration fixture.'
} finally {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
