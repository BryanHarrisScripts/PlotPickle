# Source-controlled, no network and no secrets. The separately provisioned
# launcher passes observed names (not its token) after real authenticated MCP calls.
param(
    [Parameter(Mandatory=$true)][string[]]$PublicTools,
    [Parameter(Mandatory=$true)][string[]]$AuthenticatedTools,
    [switch]$EngineeringEnabled
)
$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..\..'))
$manifestPath = Join-Path $repoRoot 'config\mcp\factory-tool-catalog.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw 'MCP_CATALOG_MANIFEST_MISSING'
}
$catalog = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($catalog.schemaVersion -ne 1) { throw 'MCP_CATALOG_VERSION_UNVERIFIED' }

$groups = @('public','control','conversation','storage','diagnostics','engineeringOptIn')
foreach ($key in $groups) {
    $values = @($catalog.$key)
    if ($values.Count -eq 0 -or @($values | Where-Object {
        $_ -isnot [string] -or $_ -notmatch '^[a-z][a-z0-9_]{1,79}$'
    }).Count -ne 0) { throw 'MCP_CATALOG_SCHEMA_UNVERIFIED' }
}
$declared = @($catalog.public) + @($catalog.control) + @($catalog.conversation) +
    @($catalog.storage) + @($catalog.diagnostics) + @($catalog.engineeringOptIn)
if (@($declared | Sort-Object -Unique).Count -ne $declared.Count) {
    throw 'MCP_CATALOG_DUPLICATE_DECLARATION'
}
$expectedPublic = @($catalog.public)
$expectedAuth = @($catalog.public) + @($catalog.control) + @($catalog.conversation) +
    @($catalog.storage) + @($catalog.diagnostics)
if ($EngineeringEnabled) { $expectedAuth += @($catalog.engineeringOptIn) }

function Assert-SameNames([string[]]$expected, [string[]]$observed, [string]$label) {
    if ($observed.Count -ne $expected.Count -or
        @($observed | Sort-Object -Unique).Count -ne $observed.Count -or
        (Compare-Object -ReferenceObject ($expected | Sort-Object) -DifferenceObject ($observed | Sort-Object))) {
        throw ('MCP_CATALOG_' + $label + '_MISMATCH')
    }
}
Assert-SameNames $expectedPublic $PublicTools 'PUBLIC'
Assert-SameNames $expectedAuth $AuthenticatedTools 'AUTHENTICATED'
Write-Host ('  Verified named MCP catalogue: ' + $expectedPublic.Count +
    ' public, ' + $expectedAuth.Count + ' authenticated (reviewed local manifest).') -ForegroundColor Green
