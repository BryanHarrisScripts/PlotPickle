[CmdletBinding()]
param(
  [ValidateSet("Report", "Maintain")]
  [string]$Mode = "Maintain",

  [switch]$NoPrompt
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$LocalAiInstaller = Join-Path $ScriptRoot "install-local-ai-tool.ps1"
$BuzzInstaller = Join-Path $ScriptRoot "install-buzz-desktop.ps1"
$StarterModel = "smollm2:135m-instruct-q2_K"
$OllamaTagsUrl = "http://127.0.0.1:11434/api/tags"
$OllamaVersionUrl = "http://127.0.0.1:11434/api/version"
$PowerShell = Get-Command "powershell.exe" -ErrorAction SilentlyContinue
$Winget = Get-Command "winget.exe" -ErrorAction SilentlyContinue

function Find-OllamaExecutable {
  $command = Get-Command "ollama.exe" -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  if ($env:LOCALAPPDATA) {
    $candidate = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }
  return ""
}

function Get-OptionalPropertyValue {
  param(
    [AllowNull()][object]$InputObject,
    [Parameter(Mandatory = $true)][string]$Name
  )

  if ($null -eq $InputObject) { return $null }
  try {
    $property = $InputObject.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
  }
  catch {
    return $null
  }
}

function Find-InstalledApplication {
  param([Parameter(Mandatory = $true)][string]$Pattern)

  $registryRoots = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )
  foreach ($root in $registryRoots) {
    foreach ($entry in @(Get-ItemProperty -Path $root -ErrorAction SilentlyContinue)) {
      $displayName = [string](Get-OptionalPropertyValue -InputObject $entry -Name "DisplayName")
      if (-not $displayName -or $displayName -notmatch $Pattern) { continue }
      $displayVersion = [string](Get-OptionalPropertyValue -InputObject $entry -Name "DisplayVersion")
      $installLocation = [string](Get-OptionalPropertyValue -InputObject $entry -Name "InstallLocation")
      return [pscustomobject]@{
        Name = $displayName
        Version = $displayVersion
        Location = $installLocation
      }
    }
  }
  return $null
}

function Find-BuzzCli {
  $roots = New-Object System.Collections.Generic.List[string]
  if ($env:LOCALAPPDATA) {
    $roots.Add((Join-Path $env:LOCALAPPDATA "Buzz"))
    $roots.Add((Join-Path $env:LOCALAPPDATA "Programs\Buzz"))
  }
  if ($env:ProgramFiles) { $roots.Add((Join-Path $env:ProgramFiles "Buzz")) }
  if (${env:ProgramFiles(x86)}) { $roots.Add((Join-Path ${env:ProgramFiles(x86)} "Buzz")) }

  foreach ($rootPath in $roots) {
    foreach ($relative in @("buzz.exe", "resources\buzz.exe", "buzz-x86_64-pc-windows-msvc.exe", "resources\buzz-x86_64-pc-windows-msvc.exe")) {
      $candidate = Join-Path $rootPath $relative
      if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        return (Resolve-Path -LiteralPath $candidate).Path
      }
    }
  }
  return ""
}

function Find-GitHubCli {
  $command = Get-Command "gh.exe" -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $candidates = New-Object System.Collections.Generic.List[string]
  if ($env:ProgramFiles) { $candidates.Add((Join-Path $env:ProgramFiles "GitHub CLI\gh.exe")) }
  if ($env:LOCALAPPDATA) {
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Programs\GitHub CLI\gh.exe"))
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\gh.exe"))
  }
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }
  return ""
}

function Get-FileVersion {
  param([string]$Path)
  if (-not $Path -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) { return "" }
  try {
    $item = Get-Item -LiteralPath $Path
    foreach ($value in @($item.VersionInfo.ProductVersion, $item.VersionInfo.FileVersion)) {
      if ($value -and [string]$value -match "\d+(?:\.\d+){1,3}") { return $Matches[0] }
    }
  }
  catch { }
  return ""
}

function Get-CommandInventory {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$CommandName,
    [string[]]$VersionArguments = @("--version")
  )

  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if (-not $command) {
    return [pscustomobject]@{ Name = $Name; Installed = $false; Version = ""; Detail = "Not detected" }
  }
  $version = ""
  try {
    $output = & $command.Source @VersionArguments 2>$null | Select-Object -First 1
    if ($output) { $version = ([string]$output).Trim() }
  }
  catch { }
  return [pscustomobject]@{
    Name = $Name
    Installed = $true
    Version = $version
    Detail = $command.Source
  }
}

function Get-OllamaInventory {
  $executable = Find-OllamaExecutable
  $models = @()
  $version = ""
  $running = $false
  try {
    $tags = Invoke-RestMethod -Uri $OllamaTagsUrl -Method Get -TimeoutSec 3
    $running = $true
    $models = @($tags.models | ForEach-Object {
      if ($_.name) { [string]$_.name } elseif ($_.model) { [string]$_.model }
    } | Where-Object { $_ })
    try {
      $versionResponse = Invoke-RestMethod -Uri $OllamaVersionUrl -Method Get -TimeoutSec 3
      if ($versionResponse.version) { $version = [string]$versionResponse.version }
    }
    catch { }
  }
  catch { }

  if (-not $version) { $version = Get-FileVersion -Path $executable }
  $detail = if ($running) {
    if ($models.Count) { "$($models.Count) model(s): $($models -join ', ')" } else { "Running with no installed models" }
  } elseif ($executable) {
    "Installed but not running"
  } else {
    "Not detected"
  }

  return [pscustomobject]@{
    Name = "Ollama"
    Installed = [bool]($executable -or $running)
    Running = $running
    Version = $version
    Detail = $detail
    Models = $models
    Path = $executable
  }
}

function Get-CuratedInventory {
  $items = New-Object System.Collections.Generic.List[object]
  $items.Add((Get-CommandInventory -Name "Node.js" -CommandName "node.exe" -VersionArguments @("--version")))
  $items.Add((Get-CommandInventory -Name "npm" -CommandName "npm.cmd" -VersionArguments @("--version")))
  $items.Add((Get-OllamaInventory))

  $comfy = Find-InstalledApplication -Pattern "^(ComfyUI|Comfy Desktop)"
  $items.Add([pscustomobject]@{
    Name = "ComfyUI Desktop"
    Installed = [bool]$comfy
    Version = if ($comfy) { $comfy.Version } else { "" }
    Detail = if ($comfy) { if ($comfy.Location) { $comfy.Location } else { $comfy.Name } } else { "Not detected" }
  })

  $buzzPath = Find-BuzzCli
  $items.Add([pscustomobject]@{
    Name = "Buzz Desktop / CLI"
    Installed = [bool]$buzzPath
    Version = Get-FileVersion -Path $buzzPath
    Detail = if ($buzzPath) { $buzzPath } else { "Not detected" }
  })

  $items.Add((Get-CommandInventory -Name "Git" -CommandName "git.exe" -VersionArguments @("--version")))
  $githubCli = Find-GitHubCli
  $githubCliVersion = ""
  if ($githubCli) {
    try {
      $githubCliVersion = [string](& $githubCli --version 2>$null | Select-Object -First 1)
    }
    catch { }
  }
  $items.Add([pscustomobject]@{
    Name = "GitHub CLI"
    Installed = [bool]$githubCli
    Version = $githubCliVersion.Trim()
    Detail = if ($githubCli) { $githubCli } else { "Not detected" }
  })
  return $items
}

function Write-Inventory {
  param([Parameter(Mandatory = $true)][string]$Heading)
  Write-Host ""
  Write-Host "------------------------------------------------------------"
  Write-Host "  $Heading"
  Write-Host "------------------------------------------------------------"
  foreach ($item in @(Get-CuratedInventory)) {
    $marker = if ($item.Installed) { "OK" } else { "OPTIONAL" }
    $version = if ($item.Version) { " $($item.Version)" } else { "" }
    Write-Host "[$marker] $($item.Name)$version"
    Write-Host "       $($item.Detail)"
  }
}

function Test-WingetPackageInstalled {
  param([Parameter(Mandatory = $true)][string]$PackageId)
  if (-not $Winget) { return $false }
  try {
    $output = & $Winget.Source list --id $PackageId --exact --accept-source-agreements --disable-interactivity 2>$null | Out-String
    return $LASTEXITCODE -eq 0 -and $output -match [regex]::Escape($PackageId)
  }
  catch { return $false }
}

function Invoke-WingetUpgrade {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string[]]$PackageIds
  )

  if (-not $Winget) {
    Write-Host "[SKIP] $Label update check: Windows Package Manager is unavailable."
    return
  }

  $packageId = $PackageIds | Where-Object { Test-WingetPackageInstalled -PackageId $_ } | Select-Object -First 1
  if (-not $packageId) {
    Write-Host "[SKIP] $Label is not managed by a reviewed winget package on this computer."
    return
  }

  Write-Host "[UPDATE] Checking $Label through trusted package $packageId..."
  try {
    & $Winget.Source upgrade --id $packageId --exact --source winget --include-unknown --accept-source-agreements --accept-package-agreements --disable-interactivity
    if ($LASTEXITCODE -eq 0) {
      Write-Host "[OK] $Label update check completed."
    } else {
      Write-Warning "$Label update check exited with code $LASTEXITCODE. PlotPickle will continue."
    }
  }
  catch {
    Write-Warning "$Label update check failed: $($_.Exception.Message). PlotPickle will continue."
  }
}

function Install-OptionalWingetPackage {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$PackageId,
    [Parameter(Mandatory = $true)][string]$ManualUrl
  )

  if (-not $Winget) {
    Write-Warning "$Label cannot be installed automatically because Windows Package Manager is unavailable."
    Write-Host "Install it manually from $ManualUrl"
    return 1
  }

  Write-Host "Opening the visible Windows Package Manager installation for $Label."
  Write-Host "PlotPickle uses only the reviewed package ID $PackageId and does not sign in on your behalf."
  try {
    & $Winget.Source install --id $PackageId --exact --source winget --interactive --accept-source-agreements --accept-package-agreements
    $code = $LASTEXITCODE
    if ($code -ne 0) {
      Write-Warning "$Label installation exited with code $code. PlotPickle will continue."
      return $code
    }
    Write-Host "[OK] $Label installation completed."
    return 0
  }
  catch {
    Write-Warning "$Label installation failed: $($_.Exception.Message). PlotPickle will continue."
    return 1
  }
}

function Invoke-ReviewedScript {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$Label
  )

  if (-not $PowerShell -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Write-Warning "$Label maintenance script is unavailable. PlotPickle will continue."
    return 1
  }
  try {
    $allArguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $Path) + $Arguments
    & $PowerShell.Source @allArguments
    $code = $LASTEXITCODE
    if ($code -ne 0) { Write-Warning "$Label maintenance exited with code $code. PlotPickle will continue." }
    return $code
  }
  catch {
    Write-Warning "$Label maintenance failed: $($_.Exception.Message). PlotPickle will continue."
    return 1
  }
}

Write-Host "PlotPickle inventories only software relevant to its local workflow."
Write-Host "Unrelated installed applications are never enumerated."
Write-Inventory -Heading "PLOTPICKLE COMPANION SOFTWARE - BEFORE MAINTENANCE"

if ($Mode -eq "Maintain") {
  Write-Host ""
  Write-Host "Automatic updates are best-effort and restricted to reviewed package IDs or pinned installers."
  Write-Host "A third-party update failure never blocks core PlotPickle or No AI mode."

  Invoke-WingetUpgrade -Label "Node.js" -PackageIds @("OpenJS.NodeJS.LTS", "OpenJS.NodeJS")
  Invoke-WingetUpgrade -Label "Git" -PackageIds @("Git.Git")
  Invoke-WingetUpgrade -Label "GitHub CLI" -PackageIds @("GitHub.cli")

  $githubCli = Find-GitHubCli
  if (-not $githubCli) {
    Write-Host "[ACTION] GitHub CLI is not installed. It remains optional for repository and CI workflows."
    if (-not $NoPrompt) {
      $answer = Read-Host "Install GitHub CLI now? [Y/N]"
      if ($answer -match "^(?i:y|yes)$") {
        [void](Install-OptionalWingetPackage -Label "GitHub CLI" -PackageId "GitHub.cli" -ManualUrl "https://cli.github.com/")
      }
    }
    $githubCli = Find-GitHubCli
    if ($githubCli) {
      Write-Host "[SUCCESS] GitHub CLI is available at $githubCli"
      Write-Host "[NEXT] Run 'gh auth login' yourself when you are ready to connect a GitHub account."
    } else {
      Write-Host "[SKIP] GitHub CLI was not installed. PlotPickle will continue normally."
      Write-Host "       Install later from https://cli.github.com/ and then run 'gh auth login'."
    }
  }

  $ollama = Get-OllamaInventory
  if ($ollama.Installed) {
    [void](Invoke-ReviewedScript -Path $LocalAiInstaller -Arguments @("-Tool", "Ollama", "-Maintain") -Label "Ollama")
  } else {
    Write-Host "[ACTION] Ollama is not installed. Local AI remains optional."
    if (-not $NoPrompt) {
      $answer = Read-Host "Open the reviewed Ollama installer now? [Y/N]"
      if ($answer -match "^(?i:y|yes)$") {
        [void](Invoke-ReviewedScript -Path $LocalAiInstaller -Arguments @("-Tool", "Ollama", "-Install") -Label "Ollama installer")
        $afterInstall = Get-OllamaInventory
        if ($afterInstall.Installed) {
          [void](Invoke-ReviewedScript -Path $LocalAiInstaller -Arguments @("-Tool", "Ollama", "-Maintain") -Label "Ollama")
        }
      }
    }
    $afterPrompt = Get-OllamaInventory
    if (-not $afterPrompt.Installed -or -not $afterPrompt.Running) {
      Write-Host "[REVISIT] Finish or start Ollama, then run Start-PlotPickle.bat again."
      Write-Host "          Settings > Local writing & planning > Ollama also provides the reviewed installer and starter-model action."
    }
  }

  $comfy = Find-InstalledApplication -Pattern "^(ComfyUI|Comfy Desktop)"
  if ($comfy) {
    [void](Invoke-ReviewedScript -Path $LocalAiInstaller -Arguments @("-Tool", "ComfyUI", "-Maintain") -Label "ComfyUI")
  }

  $buzzPath = Find-BuzzCli
  if ($buzzPath) {
    [void](Invoke-ReviewedScript -Path $BuzzInstaller -Arguments @("-Maintain") -Label "Buzz Desktop")
  }
}

Write-Inventory -Heading "PLOTPICKLE COMPANION SOFTWARE - READY STATE"
$finalOllama = Get-OllamaInventory
if ($finalOllama.Running -and -not $finalOllama.Models.Count) {
  Write-Warning "Ollama is running but still has no installed model. The reviewed starter is $StarterModel."
  Write-Host "Open Settings > Local writing & planning > Ollama and choose Install starter model, or rerun this installer."
}

Write-Host ""
Write-Host "Companion inventory and maintenance completed. PlotPickle will continue."
exit 0
