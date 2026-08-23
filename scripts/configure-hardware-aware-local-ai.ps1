[CmdletBinding()]
param(
  [ValidateSet("Report", "Configure")]
  [string]$Mode = "Report",
  [switch]$ConfigureComfyUI,
  [switch]$StartRetrieval
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PlotPickleHome = if ($env:PLOTPICKLE_HOME) { $env:PLOTPICKLE_HOME } elseif ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "PlotPickle" } else { Join-Path $HOME ".plotpickle" }
$RuntimeRoot = Join-Path $PlotPickleHome "runtimes"
$ModelRoot = Join-Path $PlotPickleHome "models"
$RagRoot = Join-Path $RuntimeRoot "curriculum-rag"
$RagRequirements = Join-Path $Root "services\curriculum-rag\requirements.txt"
$RagServer = Join-Path $Root "services\curriculum-rag\server.py"
$RagStarter = Join-Path $Root "scripts\start-curriculum-rag.ps1"
$CpuTorchIndex = "https://download.pytorch.org/whl/cpu"
$MinimumRagPythonMajor = 3
$MinimumRagPythonMinor = 10
$RagConfigured = $false
$ManagedInstanceCore = Join-Path $Root "scripts\comfyui-managed-instance-core.ps1"
if (-not (Test-Path -LiteralPath $ManagedInstanceCore -PathType Leaf)) { throw "PlotPickle's ComfyUI managed-instance inspector is missing." }
. $ManagedInstanceCore
$PascalStack = Get-PlotPicklePascalCu126Stack
$PascalTorchIndex = "https://download.pytorch.org/whl/cu126"
if ($PascalTorchIndex -ne $PascalStack.IndexUrl) { throw "PlotPickle's Pascal CUDA 12.6 installer channel does not match the managed-instance compatibility policy." }

function Get-NvidiaProfile {
  $result = [ordered]@{ Name = ""; VramMB = 0; ComputeCapability = ""; Generation = "none" }
  $smi = Get-Command "nvidia-smi.exe" -ErrorAction SilentlyContinue
  if (-not $smi) { $smi = Get-Command "nvidia-smi" -ErrorAction SilentlyContinue }
  if (-not $smi) { return [pscustomobject]$result }
  try {
    $line = (& $smi.Source --query-gpu=name,memory.total,compute_cap --format=csv,noheader,nounits 2>$null | Select-Object -First 1)
    if (-not $line) { $line = (& $smi.Source --query-gpu=name,memory.total --format=csv,noheader,nounits 2>$null | Select-Object -First 1) }
    $parts = @([string]$line -split "," | ForEach-Object { $_.Trim() })
    if ($parts.Count -ge 1) { $result.Name = $parts[0] }
    if ($parts.Count -ge 2) {
      $parsedVram = 0
      if ([int]::TryParse($parts[1], [ref]$parsedVram)) { $result.VramMB = $parsedVram }
    }
    if ($parts.Count -ge 3) { $result.ComputeCapability = $parts[2] }
  }
  catch { return [pscustomobject]$result }

  $major = 0
  if ($result.ComputeCapability -match "^(\d+)") { $major = [int]$Matches[1] }
  if ($major -eq 6 -or $result.Name -match "GTX\s*10\d{2}|Titan\s+Xp|Titan\s+X.*Pascal") { $result.Generation = "pascal" }
  elseif ($major -eq 7 -or $result.Name -match "RTX\s*20|GTX\s*16") { $result.Generation = "turing" }
  elseif ($major -eq 8 -or $result.Name -match "RTX\s*30") { $result.Generation = "ampere" }
  elseif ($major -eq 9 -or $result.Name -match "RTX\s*40") { $result.Generation = "ada" }
  elseif ($major -ge 10 -or $result.Name -match "RTX\s*50") { $result.Generation = "blackwell" }
  elseif ($result.Name) { $result.Generation = "other" }
  return [pscustomobject]$result
}

function Get-RamGB {
  try { return [math]::Round(([double](Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory) / 1GB, 1) }
  catch { return [math]::Round(([double][GC]::GetGCMemoryInfo().TotalAvailableMemoryBytes) / 1GB, 1) }
}

function Get-HardwareProfile {
  param([Parameter(Mandatory = $true)]$Gpu, [Parameter(Mandatory = $true)][double]$RamGB)
  $vramGB = [math]::Round($Gpu.VramMB / 1024, 1)
  if ($Gpu.Name -and $vramGB -ge 22) { return "nvidia-24gb-plus" }
  if ($Gpu.Name -and $vramGB -ge 14) { return "nvidia-16gb" }
  if ($Gpu.Name -and $Gpu.Generation -eq "pascal" -and $RamGB -ge 28) { return "nvidia-pascal-8gb-32gb" }
  if ($Gpu.Name -and $vramGB -ge 6 -and $RamGB -ge 24) { return "nvidia-8gb-modern" }
  return "cpu-local"
}

function Find-ComfyPython {
  foreach ($instance in @(Get-ComfyManagedInstances)) {
    if ($instance.State -eq "installed" -and $instance.PythonPath) { return $instance.PythonPath }
  }

  $candidates = New-Object System.Collections.Generic.List[string]
  if ($env:LOCALAPPDATA) {
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Programs\ComfyUI\resources\ComfyUI\.venv\Scripts\python.exe"))
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Programs\ComfyUI Desktop\resources\ComfyUI\.venv\Scripts\python.exe"))
    $candidates.Add((Join-Path $env:LOCALAPPDATA "ComfyUI\.venv\Scripts\python.exe"))
  }
  foreach ($candidate in $candidates) { if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate } }
  return ""
}

function Get-PythonVersion {
  param([Parameter(Mandatory = $true)][string[]]$Python)
  if (-not $Python.Count) { return $null }
  $exe = $Python[0]
  $prefix = if ($Python.Count -gt 1) { @($Python[1..($Python.Count - 1)]) } else { @() }
  $versionText = $null
  $exitCode = 1
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    # Windows PowerShell can promote native stderr from an unavailable py.exe
    # selector into a terminating error while the rest of this script uses Stop.
    # Version discovery is passive: a failed candidate should simply be skipped.
    $ErrorActionPreference = "Continue"
    $versionText = (& $exe @prefix -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null | Select-Object -First 1)
    $exitCode = $LASTEXITCODE
  }
  catch {
    return $null
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($exitCode -ne 0 -or -not $versionText -or ([string]$versionText -notmatch "^(\d+)\.(\d+)$")) { return $null }
  return [pscustomobject]@{ Major = [int]$Matches[1]; Minor = [int]$Matches[2]; Text = [string]$versionText }
}

function Test-RagPythonVersion {
  param([Parameter(Mandatory = $true)][string[]]$Python)
  $version = Get-PythonVersion -Python $Python
  if (-not $version) { return $false }
  return ($version.Major -gt $MinimumRagPythonMajor) -or ($version.Major -eq $MinimumRagPythonMajor -and $version.Minor -ge $MinimumRagPythonMinor)
}

function Find-RagPython {
  $python = Get-Command "python.exe" -ErrorAction SilentlyContinue
  if ($python) {
    $candidate = @($python.Source)
    if (Test-RagPythonVersion -Python $candidate) { return $candidate }
  }

  $py = Get-Command "py.exe" -ErrorAction SilentlyContinue
  if ($py) {
    foreach ($selector in @("-3.13", "-3.12", "-3.11", "-3.10")) {
      $candidate = @($py.Source, $selector)
      if (Test-RagPythonVersion -Python $candidate) { return $candidate }
    }
  }
  return @()
}

function Configure-RetrievalService {
  if (-not (Test-Path -LiteralPath $RagRequirements -PathType Leaf) -or -not (Test-Path -LiteralPath $RagServer -PathType Leaf)) { throw "The PlotPickle curriculum RAG service files are missing." }
  $script:RagConfigured = $false
  New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
  $venvPython = Join-Path $RagRoot "Scripts\python.exe"
  $basePython = @()

  if (Test-Path -LiteralPath $venvPython -PathType Leaf) {
    if (-not (Test-RagPythonVersion -Python @($venvPython))) {
      $basePython = @(Find-RagPython)
      if (-not $basePython.Count) {
        Write-Warning "The existing PlotPickle curriculum RAG environment uses Python older than 3.10, and no separate Python 3.10+ interpreter was found. The bounded lexical fallback remains active. PlotPickle will not reuse Comfy Desktop's managed Python or install Python silently."
        return
      }
      Write-Host "[RAG] Replacing the PlotPickle-owned legacy RAG environment with Python 3.10+..."
      Remove-Item -LiteralPath $RagRoot -Recurse -Force
    }
  }

  if (-not (Test-Path -LiteralPath $venvPython -PathType Leaf)) {
    if (-not $basePython.Count) { $basePython = @(Find-RagPython) }
    if (-not $basePython.Count) {
      Write-Warning "Python 3.10+ was not detected for curriculum RAG. The bounded lexical fallback remains active. PlotPickle will not reuse Comfy Desktop's managed Python or install Python silently."
      return
    }
    Write-Host "[RAG] Creating CPU-only curriculum retrieval environment with Python 3.10+..."
    $exe = $basePython[0]
    $prefix = if ($basePython.Count -gt 1) { @($basePython[1..($basePython.Count - 1)]) } else { @() }
    & $exe @prefix -m venv $RagRoot
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "Could not create the curriculum RAG Python 3.10+ environment. The bounded lexical fallback remains active."
      return
    }
  }

  Write-Host "[RAG] Installing CPU PyTorch so embedding/reranking never occupies creative GPU VRAM..."
  & $venvPython -m pip install --upgrade pip
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Could not update pip for curriculum RAG. The bounded lexical fallback remains active."
    return
  }
  & $venvPython -m pip install --upgrade torch --index-url $CpuTorchIndex
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Could not install CPU PyTorch for curriculum RAG. The bounded lexical fallback remains active."
    return
  }
  & $venvPython -m pip install -r $RagRequirements
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Could not install curriculum RAG dependencies. The bounded lexical fallback remains active."
    return
  }
  $script:RagConfigured = $true
  Write-Host "[OK] Qwen3-Embedding-0.6B and Qwen3-Reranker-0.6B will load on CPU when the retrieval service starts."
}

function Configure-PascalComfyUI {
  $python = Find-ComfyPython
  if (-not $python) {
    Write-Warning "ComfyUI's Python environment was not found automatically. PlotPickle will not alter an unknown Python installation."
    return
  }
  Write-Host "[PASCAL] Explicit repair approved. Pinning this detected ComfyUI environment to the current reviewed CUDA 12.6 stack..."
  Write-Host "         torch=$($PascalStack.Torch) | torchvision=$($PascalStack.TorchVision) | torchaudio=$($PascalStack.TorchAudio)"
  & $python -m pip install --upgrade "torch==$($PascalStack.Torch)" "torchvision==$($PascalStack.TorchVision)" "torchaudio==$($PascalStack.TorchAudio)" --index-url $PascalTorchIndex
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "The CUDA 12.6 PyTorch repair did not complete. PlotPickle will not switch channels, install a model, or enable cloud fallback."
    return
  }
  Write-Host "[OK] ComfyUI is pinned to the reviewed CUDA 12.6 Pascal stack. CUDA 13 packages were not selected."
}

function Write-ModelPlan {
  Write-Host ""
  Write-Host "Recommended local model roles"
  Write-Host "  Fast:            Qwen3.5-4B GGUF, Q6_K or Q8"
  Write-Host "  Quality:         Qwen3.5-9B GGUF, Q4_K_M"
  Write-Host "  Deep reasoning:  gpt-oss-20b MXFP4, on demand"
  Write-Host "  Retrieval CPU:   Qwen3-Embedding-0.6B + Qwen3-Reranker-0.6B"
  Write-Host "  Images:          ComfyUI + SDXL 1.0"
  Write-Host "  Video:           ComfyUI + LTX-Video 2B 0.9.8 Distilled"
  Write-Host "  Health only:     SmolLM2 135M"
  Write-Host ""
  Write-Host "Model root: $ModelRoot"
  Write-Host "PlotPickle never promotes SmolLM2 into a production story or Creative Room role."
}

$gpu = Get-NvidiaProfile
$ramGB = Get-RamGB
$profile = Get-HardwareProfile -Gpu $gpu -RamGB $ramGB
$vramGB = [math]::Round($gpu.VramMB / 1024, 1)

Write-Host "------------------------------------------------------------"
Write-Host " PlotPickle Hardware-Aware Local AI"
Write-Host "------------------------------------------------------------"
Write-Host "RAM:            $ramGB GB"
Write-Host "GPU:            $(if ($gpu.Name) { $gpu.Name } else { 'No NVIDIA GPU detected' })"
Write-Host "VRAM:           $vramGB GB"
Write-Host "GPU generation: $($gpu.Generation)"
Write-Host "Profile:        $profile"
Write-Host ""

$llama = Get-Command "llama-server.exe" -ErrorAction SilentlyContinue
if (-not $llama) { $llama = Get-Command "llama-server" -ErrorAction SilentlyContinue }
$lms = Get-Command "lms.exe" -ErrorAction SilentlyContinue
if (-not $lms) { $lms = Get-Command "lms" -ErrorAction SilentlyContinue }
$ollama = Get-Command "ollama.exe" -ErrorAction SilentlyContinue
if (-not $ollama) { $ollama = Get-Command "ollama" -ErrorAction SilentlyContinue }

Write-Host "Runtime preference: llama.cpp -> LM Studio -> Ollama -> other OpenAI-compatible"
Write-Host "llama.cpp: $(if ($llama) { $llama.Source } else { 'not detected; recommended install' })"
Write-Host "LM Studio:  $(if ($lms) { $lms.Source } else { 'not detected; optional' })"
Write-Host "Ollama:     $(if ($ollama) { $ollama.Source } else { 'not detected; optional' })"

if ($gpu.Generation -eq "pascal") {
  Write-Host ""
  Write-Host "[PASCAL SAFE MODE]"
  Write-Host "PyTorch/ComfyUI stack:    $($PascalStack.Torch) / CUDA 12.6"
  Write-Host "llama.cpp build:          prefer CUDA 12.x"
  Write-Host "Fallback:                 Vulkan"
  Write-Host "CUDA 13 auto-install:     disabled"
  Write-Host "CPU/GPU model split:      enabled"
}

Write-ModelPlan

if ($Mode -eq "Report") {
  Write-Host ""
  Write-Host "Run this script with -Mode Configure to create the CPU curriculum RAG environment."
  Write-Host "Use -ConfigureComfyUI as well only when you explicitly approve repairing the detected Pascal ComfyUI environment to the reviewed CUDA 12.6 stack. Passive startup and verification never make this change."
  exit 0
}

New-Item -ItemType Directory -Force -Path $RuntimeRoot, $ModelRoot | Out-Null
if ($gpu.Generation -eq "pascal" -and $ConfigureComfyUI) { Configure-PascalComfyUI }
Configure-RetrievalService
if (-not $RagConfigured) { Write-Host "[RAG] Semantic retrieval is not configured; PlotPickle will retain its bounded lexical fallback." }

if ($StartRetrieval -and $RagConfigured -and (Test-Path -LiteralPath $RagStarter -PathType Leaf)) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RagStarter
  if ($LASTEXITCODE -ne 0) { Write-Warning "The curriculum RAG service did not start cleanly; PlotPickle will retain its bounded lexical fallback." }
}
elseif ($StartRetrieval -and -not $RagConfigured) {
  Write-Warning "Curriculum RAG was not started because its Python 3.10+ environment is not ready. The bounded lexical fallback remains active."
}

Write-Host ""
Write-Host "[READY] Hardware-aware local AI configuration completed."
Write-Host "The Settings > AI Routing screen will detect running OpenAI-compatible runtimes and show any missing Fast, Quality, Deep, Image or Video role."
