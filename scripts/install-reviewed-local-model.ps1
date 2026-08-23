[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Fast", "Quality", "Deep")]
  [string]$Role,

  [Parameter(Mandatory = $true)]
  [ValidatePattern("^https://")]
  [string]$Url,

  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[A-Fa-f0-9]{64}$")]
  [string]$Sha256,

  [string]$FileName = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$PlotPickleHome = if ($env:PLOTPICKLE_HOME) { $env:PLOTPICKLE_HOME } elseif ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "PlotPickle" } else { Join-Path $HOME ".plotpickle" }
$TextModelRoot = Join-Path $PlotPickleHome "models\text"
$RuntimeSettingsPath = Join-Path $PlotPickleHome "local-runtime.json"

$roleKey = $Role.ToLowerInvariant()
$recommended = switch ($roleKey) {
  "fast"    { @{ Name = "Qwen3.5-4B GGUF"; Quant = "Q6_K or Q8" } }
  "quality" { @{ Name = "Qwen3.5-9B GGUF"; Quant = "Q4_K_M" } }
  "deep"    { @{ Name = "gpt-oss-20b MXFP4"; Quant = "MXFP4-compatible GGUF" } }
}

$uri = [Uri]$Url
if ($uri.Scheme -ne "https") { throw "Only HTTPS model downloads are accepted." }
if ($uri.UserInfo) { throw "Do not place credentials in a model URL." }

if (-not $FileName) {
  $FileName = [IO.Path]::GetFileName($uri.AbsolutePath)
}
if (-not $FileName -or $FileName -notmatch "^[A-Za-z0-9][A-Za-z0-9._-]*\.gguf$") {
  throw "The reviewed local model must be a .gguf file with a simple file name."
}

New-Item -ItemType Directory -Force -Path $TextModelRoot | Out-Null
$target = Join-Path $TextModelRoot $FileName
$temp = "$target.download"

Write-Host "------------------------------------------------------------"
Write-Host " PlotPickle reviewed local model install"
Write-Host "------------------------------------------------------------"
Write-Host "Role:          $Role"
Write-Host "Recommended:   $($recommended.Name)"
Write-Host "Quantization:  $($recommended.Quant)"
Write-Host "Source host:   $($uri.Host)"
Write-Host "Target:        $target"
Write-Host "SHA-256:       $Sha256"
Write-Host ""
Write-Host "PlotPickle will not substitute an unreviewed community model automatically."
Write-Host "The exact HTTPS source and SHA-256 must be supplied for every production model install."
Write-Host ""

try {
  if (Test-Path -LiteralPath $temp) { Remove-Item -Force -LiteralPath $temp }
  Invoke-WebRequest -Uri $Url -OutFile $temp -UseBasicParsing
  $actual = (Get-FileHash -LiteralPath $temp -Algorithm SHA256).Hash.ToLowerInvariant()
  $expected = $Sha256.ToLowerInvariant()
  if ($actual -ne $expected) {
    throw "SHA-256 verification failed. Expected $expected but downloaded $actual. The file was not installed."
  }
  Move-Item -Force -LiteralPath $temp -Destination $target
}
catch {
  if (Test-Path -LiteralPath $temp) { Remove-Item -Force -LiteralPath $temp }
  throw
}

$settings = $null
if (Test-Path -LiteralPath $RuntimeSettingsPath -PathType Leaf) {
  try { $settings = Get-Content -Raw -LiteralPath $RuntimeSettingsPath | ConvertFrom-Json }
  catch { throw "The existing PlotPickle local-runtime.json could not be parsed. The verified model remains installed at $target but its role was not changed." }
}
if (-not $settings) {
  $settings = [pscustomobject]@{
    version = 1
    preferredRuntime = "auto"
    contextTokens = 16384
    endpointOverrides = [pscustomobject]@{}
    modelOverrides = [pscustomobject]@{}
    managedLlama = [pscustomobject]@{
      enabled = $false
      executable = ""
      port = 8080
      modelPaths = [pscustomobject]@{}
      gpuLayers = [pscustomobject]@{ fast = 99; quality = 24; deep = 8 }
    }
  }
}
if (-not $settings.managedLlama) {
  $settings | Add-Member -NotePropertyName managedLlama -NotePropertyValue ([pscustomobject]@{
    enabled = $false
    executable = ""
    port = 8080
    modelPaths = [pscustomobject]@{}
    gpuLayers = [pscustomobject]@{ fast = 99; quality = 24; deep = 8 }
  }) -Force
}
if (-not $settings.managedLlama.modelPaths) {
  $settings.managedLlama | Add-Member -NotePropertyName modelPaths -NotePropertyValue ([pscustomobject]@{}) -Force
}
$settings.managedLlama.modelPaths | Add-Member -NotePropertyName $roleKey -NotePropertyValue $target -Force

$settings | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $RuntimeSettingsPath -Encoding UTF8

Write-Host "[OK] Verified model installed and assigned to the $Role role."
Write-Host "PlotPickle will detect it on the next local runtime refresh."
