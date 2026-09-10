Set-StrictMode -Version Latest

$script:PlotPicklePascalCu126Stack = [ordered]@{
  Torch = "2.10.0+cu126"
  TorchVision = "0.25.0+cu126"
  TorchAudio = "2.10.0+cu126"
  IndexUrl = "https://download.pytorch.org/whl/cu126"
}

function Get-PlotPicklePascalCu126Stack {
  return [pscustomobject]$script:PlotPicklePascalCu126Stack
}

function Get-ComfyDesktopInstallationRegistryFiles {
  $files = New-Object System.Collections.Generic.List[string]
  foreach ($root in @(
    $(if ($env:APPDATA) { Join-Path $env:APPDATA "Comfy Desktop" }),
    $(if ($env:APPDATA) { Join-Path $env:APPDATA "ComfyUI" }),
    $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "Comfy Desktop" }),
    $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "ComfyUI" })
  )) {
    if (-not $root) { continue }
    $candidate = Join-Path $root "installations.json"
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { $files.Add($candidate) }
  }
  return @($files.ToArray() | Select-Object -Unique)
}

function Get-ComfyDesktopRegisteredInstallPaths {
  $paths = New-Object System.Collections.Generic.List[string]
  foreach ($registryFile in @(Get-ComfyDesktopInstallationRegistryFiles)) {
    try {
      $parsed = Get-Content -LiteralPath $registryFile -Raw -ErrorAction Stop | ConvertFrom-Json
      $records = if ($parsed -is [System.Array]) {
        @($parsed)
      } elseif ($null -ne $parsed.PSObject.Properties["installations"]) {
        @($parsed.installations)
      } else {
        @($parsed)
      }
      foreach ($record in $records) {
        if ($null -eq $record) { continue }
        $property = $record.PSObject.Properties["installPath"]
        if ($null -eq $property -or -not $property.Value) { continue }
        $candidate = [Environment]::ExpandEnvironmentVariables([string]$property.Value)
        if (Test-Path -LiteralPath $candidate -PathType Container) {
          $paths.Add((Resolve-Path -LiteralPath $candidate).Path)
        }
      }
    } catch {
      # Comfy Desktop owns this registry. A malformed/stale copy must not block other discovery paths.
    }
  }
  return @($paths.ToArray() | Select-Object -Unique)
}

function Get-ComfyManagedInstallRootCandidates {
  $roots = New-Object System.Collections.Generic.List[string]
  if ($env:LOCALAPPDATA) {
    $roots.Add((Join-Path $env:LOCALAPPDATA "Comfy-Desktop\ComfyUI-Installs"))
    $roots.Add((Join-Path $env:LOCALAPPDATA "Comfy Desktop\ComfyUI-Installs"))
  }
  if ($env:APPDATA) {
    $roots.Add((Join-Path $env:APPDATA "Comfy Desktop\ComfyUI-Installs"))
    $roots.Add((Join-Path $env:APPDATA "ComfyUI\ComfyUI-Installs"))
  }
  if ($env:USERPROFILE) {
    $roots.Add((Join-Path $env:USERPROFILE "ComfyUI-Installs"))
  }
  foreach ($installPath in @(Get-ComfyDesktopRegisteredInstallPaths)) {
    $parent = Split-Path -Parent $installPath
    if ($parent) { $roots.Add($parent) }
  }
  return @($roots.ToArray() | Select-Object -Unique)
}

function Get-ComfyManagedInstances {
  param([string[]]$Roots = @(Get-ComfyManagedInstallRootCandidates))

  $instances = New-Object System.Collections.Generic.List[object]
  foreach ($root in @($Roots | Select-Object -Unique)) {
    if (-not $root -or -not (Test-Path -LiteralPath $root -PathType Container)) { continue }
    foreach ($directory in @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Sort-Object Name)) {
      $engineRoot = ""
      $mainPath = ""
      foreach ($candidateRoot in @((Join-Path $directory.FullName "ComfyUI"), $directory.FullName)) {
        $candidateMain = Join-Path $candidateRoot "main.py"
        if (Test-Path -LiteralPath $candidateMain -PathType Leaf) {
          $engineRoot = $candidateRoot
          $mainPath = $candidateMain
          break
        }
      }
      if (-not $engineRoot) {
        $nestedEngine = Join-Path $directory.FullName "ComfyUI"
        $engineRoot = if (Test-Path -LiteralPath $nestedEngine -PathType Container) { $nestedEngine } else { $directory.FullName }
      }

      $venvRoot = ""
      foreach ($candidateVenv in @((Join-Path $engineRoot ".venv"), (Join-Path $directory.FullName ".venv"))) {
        if (Test-Path -LiteralPath $candidateVenv -PathType Container) {
          $venvRoot = $candidateVenv
          break
        }
      }

      $pythonPath = ""
      if ($venvRoot) {
        foreach ($candidatePython in @((Join-Path $venvRoot "Scripts\python.exe"), (Join-Path $venvRoot "bin\python"))) {
          if (Test-Path -LiteralPath $candidatePython -PathType Leaf) {
            $pythonPath = $candidatePython
            break
          }
        }
      }

      $state = if ($mainPath -and $venvRoot -and $pythonPath) { "installed" } else { "provisioning" }
      $instances.Add([pscustomobject]@{
        Name = $directory.Name
        InstallRoot = $directory.FullName
        EngineRoot = $engineRoot
        MainPath = $mainPath
        VenvRoot = $venvRoot
        PythonPath = $pythonPath
        State = $state
      })
    }
  }
  return $instances.ToArray()
}

function Convert-ComfyCudaTagToVersion {
  param([string]$Tag)
  if ($Tag -notmatch '^cu(\d{2,3})$') { return "" }
  $digits = $Matches[1]
  if ($digits.Length -eq 3) { return "$($digits.Substring(0, 2)).$($digits.Substring(2, 1))" }
  return "$($digits.Substring(0, 1)).$($digits.Substring(1, 1))"
}

function Get-ComfyManagedEnvironmentStack {
  param([Parameter(Mandatory = $true)]$Instance)

  $pythonVersion = ""
  if ($Instance.VenvRoot) {
    $pyvenv = Join-Path $Instance.VenvRoot "pyvenv.cfg"
    if (Test-Path -LiteralPath $pyvenv -PathType Leaf) {
      $versionLine = Get-Content -LiteralPath $pyvenv -ErrorAction SilentlyContinue | Where-Object { $_ -match '^version\s*=\s*(.+)$' } | Select-Object -First 1
      if ($versionLine -and $versionLine -match '^version\s*=\s*(.+)$') { $pythonVersion = $Matches[1].Trim() }
    }
  }

  $sitePackages = if ($Instance.VenvRoot) { Join-Path $Instance.VenvRoot "Lib\site-packages" } else { "" }
  $versions = [ordered]@{ Torch = ""; TorchVision = ""; TorchAudio = "" }
  if ($sitePackages -and (Test-Path -LiteralPath $sitePackages -PathType Container)) {
    foreach ($entry in @(
      @{ Key = "Torch"; Pattern = "torch-*.dist-info"; Regex = '^torch-(.+)\.dist-info$' },
      @{ Key = "TorchVision"; Pattern = "torchvision-*.dist-info"; Regex = '^torchvision-(.+)\.dist-info$' },
      @{ Key = "TorchAudio"; Pattern = "torchaudio-*.dist-info"; Regex = '^torchaudio-(.+)\.dist-info$' }
    )) {
      $match = Get-ChildItem -Path (Join-Path $sitePackages $entry.Pattern) -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
      if ($match -and $match.Name -match $entry.Regex) { $versions[$entry.Key] = $Matches[1] }
    }
  }

  $cudaTag = ""
  if ($versions.Torch -match '\+(cu\d{2,3})$') { $cudaTag = $Matches[1] }
  return [pscustomobject]@{
    Python = $pythonVersion
    Torch = $versions.Torch
    TorchVision = $versions.TorchVision
    TorchAudio = $versions.TorchAudio
    CudaTag = $cudaTag
    CudaVersion = Convert-ComfyCudaTagToVersion $cudaTag
  }
}

function Test-ComfyPascalCu126Stack {
  param([Parameter(Mandatory = $true)]$Stack)
  $expected = Get-PlotPicklePascalCu126Stack
  return $Stack.Torch -eq $expected.Torch -and $Stack.TorchVision -eq $expected.TorchVision -and $Stack.TorchAudio -eq $expected.TorchAudio
}

function Get-ComfyManagedCrashEvidence {
  param([Parameter(Mandatory = $true)]$Instance)
  $logPath = if ($Instance.EngineRoot) { Join-Path $Instance.EngineRoot "user\comfyui.log" } else { "" }
  if (-not $logPath -or -not (Test-Path -LiteralPath $logPath -PathType Leaf)) {
    return [pscustomobject]@{ Found = $false; LogPath = $logPath; Summary = "" }
  }
  $matches = @(Get-Content -LiteralPath $logPath -Tail 160 -ErrorAction SilentlyContinue | Select-String -Pattern 'Windows fatal exception|access violation|0xC0000005|3221225477')
  return [pscustomobject]@{
    Found = $matches.Count -gt 0
    LogPath = $logPath
    Summary = if ($matches.Count) { ($matches | Select-Object -Last 3 | ForEach-Object { $_.Line.Trim() }) -join " | " } else { "" }
  }
}
