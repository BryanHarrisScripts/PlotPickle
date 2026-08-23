[CmdletBinding()]
param(
  [ValidateSet("Plan", "Archive", "Reset")]
  [string]$Mode = "",
  [string]$RelayUrl = "",
  [string]$BuzzCli = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$UtilitiesRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $UtilitiesRoot
$CleanupScript = Join-Path $ProjectRoot "scripts\clean-buzz-community.mjs"
$RetainedRooms = @("great-hall", "story-council", "wyrmwood-ring", "marquee")

function Find-NodeExecutable {
  $command = Get-Command "node.exe" -ErrorAction SilentlyContinue
  if (-not $command) { $command = Get-Command "node" -ErrorAction SilentlyContinue }
  if (-not $command) { throw "Node.js is required. Run Start-PlotPickle.bat once, then try this utility again." }
  return $command.Source
}

function Find-BuzzExecutable {
  param([string]$Requested)
  $candidates = New-Object System.Collections.Generic.List[string]
  if ($Requested) { $candidates.Add($Requested) }
  if ($env:BUZZ_CLI_PATH) { $candidates.Add($env:BUZZ_CLI_PATH) }
  foreach ($name in @("buzz.exe", "buzz")) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command) { $candidates.Add($command.Source) }
  }
  $roots = New-Object System.Collections.Generic.List[string]
  if ($env:LOCALAPPDATA) {
    $roots.Add((Join-Path $env:LOCALAPPDATA "Buzz"))
    $roots.Add((Join-Path $env:LOCALAPPDATA "Programs\Buzz"))
  }
  if ($env:ProgramFiles) { $roots.Add((Join-Path $env:ProgramFiles "Buzz")) }
  if (${env:ProgramFiles(x86)}) { $roots.Add((Join-Path ${env:ProgramFiles(x86)} "Buzz")) }
  foreach ($rootPath in $roots) {
    foreach ($relativePath in @("buzz.exe", "binaries\buzz.exe", "resources\buzz.exe", "resources\binaries\buzz.exe")) {
      $candidates.Add((Join-Path $rootPath $relativePath))
    }
  }
  foreach ($candidate in $candidates | Select-Object -Unique) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return (Resolve-Path -LiteralPath $candidate).Path }
  }
  throw "BUZZ CLI was not found. Install BUZZ Desktop or rerun with -BuzzCli C:\path\to\buzz.exe."
}

function Test-RelayUrl {
  param([string]$Value)
  $uri = $null
  if (-not [Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$uri)) { return $false }
  if ($uri.Scheme -notin @("http", "https", "ws", "wss")) { return $false }
  return -not $uri.UserInfo
}

function Convert-SecureValue {
  param([Security.SecureString]$Value)
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

if (-not (Test-Path -LiteralPath $CleanupScript -PathType Leaf)) { throw "The BUZZ cleanup implementation is missing from this PlotPickle download." }
$node = Find-NodeExecutable
$buzz = Find-BuzzExecutable -Requested $BuzzCli

Write-Host ""
Write-Host "PLOTPICKLE / BUZZ COMMUNITY CLEANUP"
Write-Host ""
Write-Host "Retained rooms: great-hall, story-council, wyrmwood-ring, marquee"
Write-Host "Legacy machine rooms are archived by default; retained-room history is never reset unless you choose Reset."
Write-Host ""

if (-not $Mode) {
  Write-Host "1. PLAN only - inspect rooms, recent message window and members"
  Write-Host "2. ARCHIVE the nine legacy rooms"
  Write-Host "3. RESET one retained room to a clean empty channel"
  $choice = (Read-Host "Choose 1, 2 or 3").Trim()
  $Mode = switch ($choice) { "1" { "Plan" } "2" { "Archive" } "3" { "Reset" } default { throw "Choose 1, 2 or 3." } }
}

if (-not $RelayUrl) { $RelayUrl = (Read-Host "BUZZ relay URL").Trim() }
if (-not (Test-RelayUrl -Value $RelayUrl)) { throw "Enter a complete http, https, ws or wss BUZZ relay URL without embedded credentials." }

$room = ""
$confirmation = ""
if ($Mode -eq "Archive") {
  Write-Host ""
  Write-Host "This archives only the nine retired rooms. It does not reset Great Hall, Story Workshop, Wyrmwood or Marquee."
  $confirmation = (Read-Host "Type ARCHIVE 9 LEGACY ROOMS to continue").Trim()
  if ($confirmation -cne "ARCHIVE 9 LEGACY ROOMS") { throw "Confirmation did not match. Nothing was changed." }
}
if ($Mode -eq "Reset") {
  Write-Host ""
  for ($index = 0; $index -lt $RetainedRooms.Count; $index++) { Write-Host "$($index + 1). $($RetainedRooms[$index])" }
  $selection = 0
  if (-not [int]::TryParse((Read-Host "Choose the retained room to reset"), [ref]$selection) -or $selection -lt 1 -or $selection -gt $RetainedRooms.Count) {
    throw "Choose a number from 1 to $($RetainedRooms.Count)."
  }
  $room = $RetainedRooms[$selection - 1]
  Write-Host "RESET permanently replaces $room with a new empty BUZZ channel and restores its membership."
  $confirmation = (Read-Host "Type RESET $room to continue").Trim()
  if ($confirmation -cne "RESET $room") { throw "Confirmation did not match. Nothing was changed." }
}

$secureKey = Read-Host "Human/admin BUZZ private key" -AsSecureString
$privateKey = ""
try {
  $privateKey = Convert-SecureValue -Value $secureKey
  if (-not $privateKey) { throw "The Human/admin BUZZ private key cannot be empty." }
  $env:BUZZ_RELAY_URL = $RelayUrl
  $env:BUZZ_PRIVATE_KEY = $privateKey
  $env:BUZZ_AUTH_TAG = ""
  $arguments = @($CleanupScript, "--mode=$($Mode.ToLowerInvariant())", "--cli=$buzz")
  if ($room) { $arguments += "--room=$room" }
  if ($confirmation) { $arguments += "--confirm=$confirmation" }
  & $node @arguments
  if ($LASTEXITCODE -ne 0) { throw "BUZZ cleanup stopped with exit code $LASTEXITCODE. No later action was attempted." }
}
finally {
  foreach ($name in @("BUZZ_RELAY_URL", "BUZZ_PRIVATE_KEY", "BUZZ_AUTH_TAG")) {
    [Environment]::SetEnvironmentVariable($name, $null, "Process")
  }
  $privateKey = ""
}
