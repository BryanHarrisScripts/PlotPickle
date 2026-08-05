[CmdletBinding()]
param(
  [ValidateSet("Inventory", "Maintain", "BootstrapOllama")]
  [string]$Mode = "Inventory",

  [string]$BootstrapModel = "smollm:135m"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

$OllamaEndpoint = "http://127.0.0.1:11434"
$ComfyEndpoint = "http://127.0.0.1:8188"
$ManagedPackages = @(
  @{ Label = "Ollama"; PackageId = "Ollama.Ollama" },
  @{ Label = "ComfyUI Desktop"; PackageId = "Comfy.ComfyUI-Desktop" },
  @{ Label = "Git"; PackageId = "Git.Git" },
  @{ Label = "GitHub CLI"; PackageId = "GitHub.cli" },
  @{ Label = "Node.js LTS"; PackageId = "OpenJS.NodeJS.LTS" }
)

function Write-Heading([string]$Text) {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Cyan
  Write-Host "  $Text" -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor Cyan
  Write-Host ""
}

function Invoke-CommandText {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [string[]]$Arguments = @()
  )
  try {
    $resolved = Get-Command $Command -ErrorAction SilentlyContinue
    if (-not $resolved) { return "" }
    $output = & $resolved.Source @Arguments 2>$null | Out-String
    return $output.Trim()
  } catch {
    return ""
  }
}

function Find-RegistryApplication {
  param([Parameter(Mandatory = $true)][string]$Pattern)
  $roots = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )
  foreach ($root in $roots) {
    foreach ($entry in @(Get-ItemProperty -Path $root -ErrorAction SilentlyContinue)) {
      $name = [string]$entry.DisplayName
      if (-not $name -or $name -notmatch $Pattern) { continue }
      return [pscustomobject]@{
        Name = $name
        Version = [string]$entry.DisplayVersion
        Location = [string]$entry.InstallLocation
      }
    }
  }
  return $null
}

function Find-OllamaExecutable {
  $command = Get-Command "ollama.exe" -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  if ($env:LOCALAPPDATA) {
    $candidate = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
  }
  return ""
}

function Get-LoopbackJson {
  param([Parameter(Mandatory = $true)][string]$Uri)
  $url = [Uri]$Uri
  if ($url.Scheme -ne "http" -or $url.Host -notin @("127.0.0.1", "localhost")) {
    throw "Companion health checks are restricted to loopback addresses."
  }
  return Invoke-RestMethod -Uri $url.AbsoluteUri -Method Get -TimeoutSec 4
}

function Get-OllamaState {
  $executable = Find-OllamaExecutable
  $registry = Find-RegistryApplication -Pattern "^Ollama"
  $version = ""
  if ($executable) {
    $versionText = Invoke-CommandText -Command $executable -Arguments @("--version")
    if ($versionText) { $version = ($versionText -replace "(?i)^ollama version\s*", "").Trim() }
  }
  $models = @()
  $reachable = $false
  try {
    $tags = Get-LoopbackJson -Uri "$OllamaEndpoint/api/tags"
    $reachable = $true
    if ($tags.models) {
      $models = @($tags.models | ForEach-Object {
        if ($_.name) { [string]$_.name } elseif ($_.model) { [string]$_.model }
      } | Where-Object { $_ })
    }
    if (-not $version) {
      try {
        $versionResponse = Get-LoopbackJson -Uri "$OllamaEndpoint/api/version"
        if ($versionResponse.version) { $version = [string]$versionResponse.version }
      } catch {}
    }
  } catch {}
  return [pscustomobject]@{
    Installed = [bool]($executable -or $registry)
    Running = $reachable
    Executable = $executable
    Version = $version
    Models = $models
    Location = if ($executable) { $executable } elseif ($registry -and $registry.Location) { $registry.Location } else { "" }
  }
}

function Get-ComfyState {
  $registry = Find-RegistryApplication -Pattern "^(ComfyUI|Comfy Desktop)"
  $running = $false
  $version = if ($registry) { $registry.Version } else { "" }
  try {
    $stats = Get-LoopbackJson -Uri "$ComfyEndpoint/system_stats"
    $running = $true
    if (-not $version -and $stats.system -and $stats.system.comfyui_version) {
      $version = [string]$stats.system.comfyui_version
    }
  } catch {}
  return [pscustomobject]@{
    Installed = [bool]$registry
    Running = $running
    Version = $version
    Location = if ($registry -and $registry.Location) { $registry.Location } else { "" }
  }
}

function Get-BuzzState {
  $registry = Find-RegistryApplication -Pattern "^Buzz(?: Desktop)?"
  $command = Get-Command "buzz.exe" -ErrorAction SilentlyContinue
  $candidate = ""
  if ($env:LOCALAPPDATA) {
    foreach ($relative in @("Programs\Buzz\Buzz.exe", "Buzz\Buzz.exe")) {
      $path = Join-Path $env:LOCALAPPDATA $relative
      if (Test-Path -LiteralPath $path -PathType Leaf) { $candidate = $path; break }
    }
  }
  return [pscustomobject]@{
    Installed = [bool]($registry -or $command -or $candidate)
    Version = if ($registry) { $registry.Version } else { "" }
    Location = if ($command) { $command.Source } elseif ($candidate) { $candidate } elseif ($registry -and $registry.Location) { $registry.Location } else { "" }
  }
}

function Get-CommandState {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$Command,
    [string[]]$VersionArguments = @("--version")
  )
  $resolved = Get-Command $Command -ErrorAction SilentlyContinue
  return [pscustomobject]@{
    Label = $Label
    Installed = [bool]$resolved
    Version = if ($resolved) { Invoke-CommandText -Command $resolved.Source -Arguments $VersionArguments } else { "" }
    Location = if ($resolved) { $resolved.Source } else { "" }
  }
}

function Write-InventoryRow {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][bool]$Installed,
    [bool]$Running = $false,
    [string]$Version = "",
    [string]$Location = "",
    [string]$Detail = ""
  )
  $status = if (-not $Installed) { "NOT INSTALLED" } elseif ($Running) { "INSTALLED / RUNNING" } else { "INSTALLED" }
  $colour = if (-not $Installed) { "DarkYellow" } elseif ($Running) { "Green" } else { "White" }
  Write-Host ("  [{0}] {1}" -f $status, $Label) -ForegroundColor $colour
  if ($Version) { Write-Host "      Version:  $Version" }
  if ($Location) { Write-Host "      Location: $Location" }
  if ($Detail) { Write-Host "      Detail:   $Detail" }
  Write-Output ("PLOTPICKLE_COMPANION={0}|{1}|{2}|{3}" -f $Label, $status, $Version, $Location)
}

function Write-CompanionInventory {
  Write-Heading "PLOTPICKLE COMPANION SOFTWARE INVENTORY"
  $node = Get-CommandState -Label "Node.js" -Command "node.exe"
  $npm = Get-CommandState -Label "npm" -Command "npm.cmd"
  $git = Get-CommandState -Label "Git" -Command "git.exe"
  $github = Get-CommandState -Label "GitHub CLI" -Command "gh.exe"
  $winget = Get-CommandState -Label "Windows Package Manager" -Command "winget.exe"
  $ollama = Get-OllamaState
  $comfy = Get-ComfyState
  $buzz = Get-BuzzState

  Write-InventoryRow -Label $node.Label -Installed $node.Installed -Version $node.Version -Location $node.Location
  Write-InventoryRow -Label $npm.Label -Installed $npm.Installed -Version $npm.Version -Location $npm.Location
  Write-InventoryRow -Label $git.Label -Installed $git.Installed -Version $git.Version -Location $git.Location
  Write-InventoryRow -Label $github.Label -Installed $github.Installed -Version $github.Version -Location $github.Location
  Write-InventoryRow -Label $winget.Label -Installed $winget.Installed -Version $winget.Version -Location $winget.Location
  $ollamaDetail = if ($ollama.Running) { "$($ollama.Models.Count) installed model(s): $($ollama.Models -join ', ')" } elseif ($ollama.Installed) { "Installed but the local API is not responding on 127.0.0.1:11434." } else { "Install Ollama, then rerun PlotPickle setup to receive the bootstrap model." }
  Write-InventoryRow -Label "Ollama" -Installed $ollama.Installed -Running $ollama.Running -Version $ollama.Version -Location $ollama.Location -Detail $ollamaDetail
  Write-InventoryRow -Label "ComfyUI Desktop" -Installed $comfy.Installed -Running $comfy.Running -Version $comfy.Version -Location $comfy.Location -Detail $(if ($comfy.Running) { "Local API responding on 127.0.0.1:8188." } else { "Optional local image engine." })
  Write-InventoryRow -Label "Buzz Desktop" -Installed $buzz.Installed -Version $buzz.Version -Location $buzz.Location -Detail "Detected and listed only; PlotPickle has no reviewed package ID for automatic replacement."
  return $ollama
}

function Test-WingetPackageInstalled {
  param([Parameter(Mandatory = $true)][string]$PackageId)
  $winget = Get-Command "winget.exe" -ErrorAction SilentlyContinue
  if (-not $winget) { return $false }
  try {
    $output = & $winget.Source list --id $PackageId --exact --source winget --accept-source-agreements 2>&1 | Out-String
    return $LASTEXITCODE -eq 0 -and $output -match [regex]::Escape($PackageId)
  } catch {
    return $false
  }
}

function Update-ManagedPackage {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$PackageId
  )
  $winget = Get-Command "winget.exe" -ErrorAction SilentlyContinue
  if (-not $winget) {
    Write-Host "  [SKIP] $Label — Windows Package Manager is unavailable." -ForegroundColor DarkYellow
    return
  }
  if (-not (Test-WingetPackageInstalled -PackageId $PackageId)) {
    Write-Host "  [LISTED] $Label — not managed by exact package $PackageId; no replacement attempted."
    return
  }
  Write-Host "  [UPDATE] $Label ($PackageId)" -ForegroundColor Cyan
  try {
    & $winget.Source upgrade --id $PackageId --exact --source winget --interactive --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  [OK] $Label update check completed." -ForegroundColor Green
    } else {
      Write-Host "  [WARNING] $Label update check returned code $LASTEXITCODE. PlotPickle setup will continue." -ForegroundColor Yellow
    }
  } catch {
    Write-Host "  [WARNING] $Label could not be updated: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

function Wait-ForOllama([int]$Seconds = 20) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      [void](Get-LoopbackJson -Uri "$OllamaEndpoint/api/tags")
      return $true
    } catch {
      Start-Sleep -Milliseconds 750
    }
  }
  return $false
}

function Install-OllamaBootstrapModel {
  $ollama = Get-OllamaState
  if (-not $ollama.Installed) {
    Write-Host "[DEFERRED] Ollama is not installed. PlotPickle remains usable without AI." -ForegroundColor Yellow
    Write-Host "Install Ollama from https://ollama.com/download/windows, then rerun Start-PlotPickle.bat or the Ollama Settings installer."
    Write-Output "PLOTPICKLE_OLLAMA_BOOTSTRAP=deferred-missing-ollama"
    return
  }
  if (-not $ollama.Running) {
    Write-Host "[DEFERRED] Ollama is installed but not responding on 127.0.0.1:11434." -ForegroundColor Yellow
    Write-Host "Start Ollama, then rerun PlotPickle setup to install $BootstrapModel."
    Write-Output "PLOTPICKLE_OLLAMA_BOOTSTRAP=deferred-not-running"
    return
  }
  if ($ollama.Models.Count -gt 0) {
    Write-Host "[OK] Ollama already has $($ollama.Models.Count) installed model(s); no bootstrap download is needed." -ForegroundColor Green
    Write-Output "PLOTPICKLE_OLLAMA_BOOTSTRAP=already-ready"
    return
  }
  if (-not $ollama.Executable) {
    Write-Host "[DEFERRED] Ollama is responding, but ollama.exe could not be located for the model download." -ForegroundColor Yellow
    Write-Output "PLOTPICKLE_OLLAMA_BOOTSTRAP=deferred-executable-missing"
    return
  }

  Write-Heading "INSTALLING THE LOWEST-FOOTPRINT OLLAMA MODEL"
  Write-Host "Ollama is running but has no installed models."
  Write-Host "PlotPickle will now pull $BootstrapModel as the local starter model."
  Write-Host "This is a local model download only; it does not enable a cloud provider or paid fallback."
  try {
    & $ollama.Executable pull $BootstrapModel
    if ($LASTEXITCODE -ne 0) { throw "ollama pull returned code $LASTEXITCODE" }
    [void](Wait-ForOllama -Seconds 20)
    $verified = Get-OllamaState
    if ($verified.Models -notcontains $BootstrapModel -and -not ($verified.Models | Where-Object { $_ -like "$BootstrapModel*" })) {
      throw "$BootstrapModel was not reported by Ollama after the pull completed."
    }
    Write-Host "[SUCCESS] $BootstrapModel is installed and available to PlotPickle." -ForegroundColor Green
    Write-Output "PLOTPICKLE_OLLAMA_BOOTSTRAP=installed"
    Write-Output "PLOTPICKLE_OLLAMA_BOOTSTRAP_MODEL=$BootstrapModel"
  } catch {
    Write-Host "[WARNING] The starter model could not be installed: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "PlotPickle will continue. Open Ollama Settings and retry after Ollama is fully running."
    Write-Output "PLOTPICKLE_OLLAMA_BOOTSTRAP=failed"
  }
}

try {
  if ($Mode -eq "Maintain") {
    Write-Heading "UPDATING INSTALLED PLOTPICKLE COMPANIONS"
    Write-Host "Only exact reviewed Windows Package Manager IDs are updated."
    Write-Host "This maintenance runs during an explicit PlotPickle install/update, never during ordinary startup."
    foreach ($package in $ManagedPackages) {
      Update-ManagedPackage -Label ([string]$package.Label) -PackageId ([string]$package.PackageId)
    }
    [void](Write-CompanionInventory)
    Install-OllamaBootstrapModel
    [void](Write-CompanionInventory)
  } elseif ($Mode -eq "BootstrapOllama") {
    Install-OllamaBootstrapModel
    [void](Write-CompanionInventory)
  } else {
    [void](Write-CompanionInventory)
  }
} catch {
  Write-Host "[WARNING] Companion-software maintenance did not finish: $($_.Exception.Message)" -ForegroundColor Yellow
  Write-Host "PlotPickle setup will continue; no story data or credentials were changed."
  Write-Output "PLOTPICKLE_COMPANION_MAINTENANCE=warning"
}

exit 0
