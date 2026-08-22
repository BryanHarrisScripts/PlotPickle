[CmdletBinding()]
param(
  [string]$RelayUrl = "",
  [string]$BuzzCli = "",
  [switch]$PlanOnly,
  [switch]$SkipAgentDrafts
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptRoot
$BootstrapScript = Join-Path $ScriptRoot "bootstrap-buzz-guildhall.mjs"
$AgentScript = Join-Path $ScriptRoot "provision-community-agents.mjs"

function Find-NodeExecutable {
  $command = Get-Command "node.exe" -ErrorAction SilentlyContinue
  if (-not $command) { $command = Get-Command "node" -ErrorAction SilentlyContinue }
  if (-not $command) { throw "Node.js is required. Install the PlotPickle prerequisites, then run this setup again." }
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

function Invoke-NodeScript {
  param(
    [string]$Node,
    [string]$Script,
    [string[]]$Arguments
  )
  $output = & $Node $Script @Arguments | Out-String
  if ($LASTEXITCODE -ne 0) { throw "The setup command failed. Review the redacted message above, correct it, and rerun this launcher." }
  return $output.Trim()
}

if (-not (Test-Path -LiteralPath $BootstrapScript -PathType Leaf) -or -not (Test-Path -LiteralPath $AgentScript -PathType Leaf)) {
  throw "The PlotPickle BUZZ setup scripts are missing. Run this launcher from a complete PlotPickle checkout."
}

$node = Find-NodeExecutable
$buzz = Find-BuzzExecutable -Requested $BuzzCli

Write-Host ""
Write-Host "PLOTPICKLE / BUZZ ONE-TIME COMMUNITY SETUP"
Write-Host "This idempotent setup creates only missing channels and verifies Agent room membership."
Write-Host "Secrets are requested in hidden prompts, passed only to child processes, and cleared before exit."
Write-Host ""
Write-Host "BUZZ CLI: $buzz"

Write-Host ""
Write-Host "CHANNEL PLAN"
Invoke-NodeScript -Node $node -Script $BootstrapScript -Arguments @("--json") | Write-Host
Write-Host ""
Write-Host "AGENT PLAN"
Invoke-NodeScript -Node $node -Script $AgentScript -Arguments @() | Write-Host

if ($PlanOnly) {
  Write-Host "Plan only: nothing was changed."
  exit 0
}

if (-not $RelayUrl) { $RelayUrl = (Read-Host "BUZZ relay URL").Trim() }
if (-not (Test-RelayUrl -Value $RelayUrl)) {
  throw "Enter a complete http, https, ws or wss BUZZ relay URL without embedded credentials."
}

$confirmation = Read-Host "Type SET UP to create missing channels and provision memberships"
if ($confirmation -cne "SET UP") {
  Write-Host "Cancelled. Nothing was changed."
  exit 0
}

$humanSecure = Read-Host "Human/admin BUZZ private key" -AsSecureString
$provisionerSecure = $null
$authTagSecure = $null
$humanKey = ""
$provisionerKey = ""
$authTag = ""

if (-not $SkipAgentDrafts) {
  $draftChoice = Read-Host "Do you have the BUZZ owner/provisioner credential and BUZZ_AUTH_TAG for missing Agent drafts? (y/N)"
  if ($draftChoice -match "^(?i:y|yes)$") {
    $provisionerSecure = Read-Host "BUZZ owner/provisioner private key" -AsSecureString
    $authTagSecure = Read-Host "BUZZ_AUTH_TAG" -AsSecureString
  }
}

try {
  $humanKey = Convert-SecureValue -Value $humanSecure
  if (-not $humanKey) { throw "The Human/admin BUZZ private key cannot be empty." }
  if ($provisionerSecure) { $provisionerKey = Convert-SecureValue -Value $provisionerSecure }
  if ($authTagSecure) { $authTag = Convert-SecureValue -Value $authTagSecure }

  $env:BUZZ_RELAY_URL = $RelayUrl
  $env:BUZZ_PRIVATE_KEY = $humanKey
  $env:BUZZ_CLI_PATH = $buzz
  $env:PLOTPICKLE_BUZZ_CLI = $buzz
  $env:PLOTPICKLE_BUZZ_PROVISIONER_PRIVATE_KEY = $provisionerKey
  $env:BUZZ_AUTH_TAG = $authTag

  Write-Host ""
  Write-Host "Preparing BUZZ channels..."
  $channelResult = Invoke-NodeScript -Node $node -Script $BootstrapScript -Arguments @("--apply", "--json", "--cli=$buzz") | ConvertFrom-Json
  Write-Host "Channels ready: $($channelResult.readyRooms). Created: $($channelResult.created.Count). Kept: $($channelResult.kept.Count)."

  Write-Host "Provisioning PlotPickle Agent identities and room memberships..."
  $agentResult = Invoke-NodeScript -Node $node -Script $AgentScript -Arguments @("--apply") | ConvertFrom-Json
  $ready = @($agentResult.agents | Where-Object { $_.status -eq "ready" })
  $pending = @($agentResult.agents | Where-Object { $_.status -eq "awaiting-owner-approval" })
  $ownerRequired = @($agentResult.agents | Where-Object { $_.status -eq "owner-provisioner-required" })
  $attention = @($agentResult.agents | Where-Object { $_.status -notin @("ready", "awaiting-owner-approval", "owner-provisioner-required") })

  Write-Host "Agents ready: $($ready.Count)/$($agentResult.agents.Count)."
  if ($pending.Count) {
    Write-Host "$($pending.Count) Agent draft(s) await your approval in BUZZ Desktop. Approve them, then rerun this launcher to verify identities and memberships."
  }
  if ($ownerRequired.Count) {
    Write-Host "$($ownerRequired.Count) Agent(s) still need the BUZZ owner/provisioner credential and BUZZ_AUTH_TAG. Rerun when those are available."
  }
  foreach ($agent in $attention) { Write-Warning "$($agent.displayName): $($agent.status)" }
  if (-not $pending.Count -and -not $ownerRequired.Count -and -not $attention.Count) {
    Write-Host "PlotPickle Community setup is complete. Every discovered Agent is verified in its contributed BUZZ rooms."
  }
}
finally {
  foreach ($name in @(
    "BUZZ_RELAY_URL",
    "BUZZ_PRIVATE_KEY",
    "BUZZ_CLI_PATH",
    "PLOTPICKLE_BUZZ_CLI",
    "PLOTPICKLE_BUZZ_PROVISIONER_PRIVATE_KEY",
    "BUZZ_AUTH_TAG"
  )) {
    [Environment]::SetEnvironmentVariable($name, $null, "Process")
  }
  $humanKey = ""
  $provisionerKey = ""
  $authTag = ""
}
