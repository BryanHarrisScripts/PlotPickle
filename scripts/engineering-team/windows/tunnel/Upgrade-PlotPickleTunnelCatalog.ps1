# One-time migration of the separately provisioned owner launcher.
# Never downloads code, handles a credential, starts or stops processes.
# Subsequent MCP catalogue changes require only an updated reviewed JSON
# manifest via git pull; no launcher text changes.
$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..\..'))
$launcher = Join-Path $repoRoot 'Start-PlotPickle-Tunnel-Authenticated.ps1'
$verifier = Join-Path $repoRoot 'scripts\engineering-team\windows\tunnel\Assert-PlotPickleMcpCatalog.ps1'
if (-not (Test-Path -LiteralPath $launcher -PathType Leaf) -or
    -not (Test-Path -LiteralPath $verifier -PathType Leaf)) {
    throw 'TUNNEL_CATALOG_UPGRADE_FILES_MISSING'
}
$source = [System.IO.File]::ReadAllText($launcher)
if ($source.Contains('Assert-PlotPickleMcpCatalog.ps1')) {
    Write-Host 'MCP catalogue verifier already installed. No changes made.' -ForegroundColor Green
    return
}
$start = '        $plainTools = @($plain.result.tools)'
$ends = @(
    "        Write-Host ('  Verified 4 public and ' + `$expectedCount + ' authenticated MCP tools.') -ForegroundColor Green",
    "        Write-Host '  Verified 3 read-only and 6 authenticated local MCP tools.' -ForegroundColor Green"
)
$first = $source.IndexOf($start, [StringComparison]::Ordinal)
if ($first -lt 0 -or $source.IndexOf($start, $first + 1, [StringComparison]::Ordinal) -ge 0) {
    throw 'TUNNEL_CATALOG_UPGRADE_UNRECOGNIZED_LAUNCHER'
}
$endsFound = @($ends | Where-Object {
    $source.IndexOf($_, $first, [StringComparison]::Ordinal) -ge 0
})
if ($endsFound.Count -ne 1) { throw 'TUNNEL_CATALOG_UPGRADE_UNRECOGNIZED_LAUNCHER' }
$last = $source.IndexOf($endsFound[0], $first, [StringComparison]::Ordinal) + $endsFound[0].Length
$old = $source.Substring($first, $last - $first)
if (-not $old.Contains("Invoke-RestMethod") -or
    -not $old.Contains("x-plotpickle-factory-control-token") -or
    -not $old.Contains("tools")) {
    throw 'TUNNEL_CATALOG_UPGRADE_UNVERIFIED_DISCOVERY'
}
$replacement = @'
        $plainNames = @($plain.result.tools | ForEach-Object { $_.name })
        $headers['x-plotpickle-factory-control-token'] = $token
        $auth = Invoke-RestMethod -Uri $uri -Method Post -ContentType 'application/json' `
            -Headers $headers -Body $body -TimeoutSec 8
        $authNames = @($auth.result.tools | ForEach-Object { $_.name })
        $verifier = Join-Path $PSScriptRoot 'scripts\engineering-team\windows\tunnel\Assert-PlotPickleMcpCatalog.ps1'
        & $verifier -PublicTools $plainNames -AuthenticatedTools $authNames `
            -EngineeringEnabled:($env:PLOTPICKLE_FACTORY_ENGINEERING_ENABLED -eq "1")
'@
$updated = $source.Substring(0, $first) + $replacement + $source.Substring($last)
$temp = Join-Path $repoRoot ('tunnel-catalog-upgrade-' + [Guid]::NewGuid().ToString('N') + '.ps1')
try {
    [System.IO.File]::WriteAllText($temp, $updated, [System.Text.UTF8Encoding]::new($true))
    $tokens = $null
    $parseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($temp, [ref]$tokens, [ref]$parseErrors) | Out-Null
    if ($parseErrors.Count -ne 0) { throw 'TUNNEL_CATALOG_UPGRADE_PARSE_FAILED' }
    $backup = "$launcher.catalog-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')-$([Guid]::NewGuid().ToString('N'))"
    # Atomic same-volume replacement creates the backup as part of the
    # transaction; errors leave the original launcher in place.
    [System.IO.File]::Replace($temp, $launcher, $backup, $false)
    Write-Host 'PASS: Launcher now verifies MCP names against reviewed local GitHub manifest.' -ForegroundColor Green
    Write-Host "Backup: $backup"
} finally {
    Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
}
