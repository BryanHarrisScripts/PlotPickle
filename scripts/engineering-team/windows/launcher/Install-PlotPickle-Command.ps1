#Requires -Version 5.1
[CmdletBinding()]
param([switch]$Install, [switch]$Status)
$ErrorActionPreference = 'Stop'
if ($Install.IsPresent -eq $Status.IsPresent) { throw 'CHOOSE_INSTALL_OR_STATUS' }
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..\..')).Path
$entry = Join-Path $PSScriptRoot 'PlotPickle.cmd'
$bin = Join-Path $env:APPDATA 'npm'
$shim = Join-Path $bin 'PlotPickle.cmd'
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcut = Join-Path $desktop 'PlotPickle Factory.lnk'
$pathEntries = @($env:PATH -split ';' | ForEach-Object { $_.TrimEnd('\') })
if ($pathEntries -notcontains $bin.TrimEnd('\')) { throw 'USER_COMMAND_DIRECTORY_NOT_ON_PATH' }
if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) { throw 'PLOTPICKLE_COMMAND_MISSING' }
$commandText = "@echo off`r`ncall `"$entry`" %*`r`nexit /b %ERRORLEVEL%`r`n"
if ($Status) {
    [pscustomobject]@{
        state = if ((Test-Path -LiteralPath $shim -PathType Leaf) -and
            (Get-Content -LiteralPath $shim -Raw) -ceq $commandText -and
            (Test-Path -LiteralPath $shortcut -PathType Leaf)) { 'INSTALLED_UNVERIFIED_SHORTCUT' } else { 'NOT_INSTALLED_OR_CHANGED' }
        command = $shim; shortcut = $shortcut; repo = $repo
    } | ConvertTo-Json -Compress
    return
}
$branch = (& git.exe -C $repo branch --show-current).Trim()
$dirty = & git.exe -C $repo status --porcelain --untracked-files=no
$origin = (& git.exe -C $repo remote get-url origin).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -cne 'main' -or $dirty -or
    $origin -cnotmatch '^(https://github[.]com/BryanHarrisScripts/PlotPickle([.]git)?|git@github[.]com:BryanHarrisScripts/PlotPickle([.]git)?)$') {
    throw 'CLEAN_TRUSTED_MAIN_REQUIRED'
}
if (Test-Path -LiteralPath $shim -PathType Leaf) {
    if ((Get-Content -LiteralPath $shim -Raw) -cne $commandText) { throw 'EXISTING_COMMAND_WILL_NOT_BE_OVERWRITTEN' }
} else {
    if (-not (Test-Path -LiteralPath $bin -PathType Container)) { throw 'USER_COMMAND_DIRECTORY_MISSING' }
    Set-Content -LiteralPath $shim -Value $commandText -Encoding Ascii -NoNewline
}
if (Test-Path -LiteralPath $shortcut -PathType Leaf) { throw 'EXISTING_SHORTCUT_WILL_NOT_BE_OVERWRITTEN' }
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($shortcut)
$link.TargetPath = $shim
$link.Arguments = 'start'
$link.WorkingDirectory = $repo
$link.Description = 'Start the existing PlotPickle Factory console'
$link.Save()
[pscustomobject]@{state='INSTALLED';command=$shim;shortcut=$shortcut;sourceHead=(& git.exe -C $repo rev-parse HEAD).Trim()} | ConvertTo-Json -Compress
