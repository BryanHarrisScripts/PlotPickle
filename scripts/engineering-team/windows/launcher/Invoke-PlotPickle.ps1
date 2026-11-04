#Requires -Version 5.1
[CmdletBinding()]
param([Parameter(Mandatory)][ValidateSet('start','restart','status','recover-tunnel')][string]$Command)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..\..')).Path
$console = Join-Path $PSScriptRoot 'Start-PlotPickle-Console.ps1'
if (-not (Test-Path -LiteralPath $console -PathType Leaf)) { throw 'PLOTPICKLE_CONSOLE_MISSING' }
switch ($Command) {
    'status' { & $console -Mode Status -RepoRoot $repo; break }
    'start' { & $console -Mode Launch -RepoRoot $repo; break }
    'restart' { & $console -Mode Restart -RepoRoot $repo; break }
    'recover-tunnel' { & $console -Mode Tunnel -RepoRoot $repo; break }
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
