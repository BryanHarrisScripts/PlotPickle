[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $repoRoot "scripts/windows-companion-software.ps1"
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
  (Resolve-Path $scriptPath),
  [ref]$tokens,
  [ref]$parseErrors
)

if ($parseErrors.Count) {
  throw ($parseErrors | ForEach-Object { $_.Message } | Out-String)
}

$helper = $ast.Find({
  param($node)
  $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
    $node.Name -eq "Get-OptionalPropertyValue"
}, $true)

if ($null -eq $helper) {
  throw "Get-OptionalPropertyValue was not found in windows-companion-software.ps1."
}

Invoke-Expression $helper.Extent.Text

$missingProperty = [pscustomobject]@{ RegistryPath = "HKCU:\Malformed" }
if ($null -ne (Get-OptionalPropertyValue -InputObject $missingProperty -Name "DisplayName")) {
  throw "A missing registry property must return null."
}

$nullProperty = [pscustomobject]@{ DisplayName = $null }
if ($null -ne (Get-OptionalPropertyValue -InputObject $nullProperty -Name "DisplayName")) {
  throw "A null registry property must return null."
}

$validProperty = [pscustomobject]@{ DisplayName = "ComfyUI Desktop" }
if ((Get-OptionalPropertyValue -InputObject $validProperty -Name "DisplayName") -ne "ComfyUI Desktop") {
  throw "A valid registry property must be returned unchanged."
}

$throwingProperty = New-Object psobject
$throwingProperty | Add-Member -MemberType ScriptProperty -Name DisplayName -Value { throw "Malformed getter" }
if ($null -ne (Get-OptionalPropertyValue -InputObject $throwingProperty -Name "DisplayName")) {
  throw "A malformed registry property getter must return null."
}

$source = Get-Content -LiteralPath $scriptPath -Raw
foreach ($name in @("DisplayName", "DisplayVersion", "InstallLocation")) {
  $expected = "Get-OptionalPropertyValue -InputObject `$entry -Name `"$name`""
  if (-not $source.Contains($expected)) {
    throw "Find-InstalledApplication must use the guarded property helper for $name."
  }
}

if ($source -match 'PSObject\.Properties\["(?:DisplayName|DisplayVersion|InstallLocation)"\]\.Value') {
  throw "Find-InstalledApplication still contains an unsafe direct registry property dereference."
}

Write-Host "Issue #369 registry-value regression checks passed."
