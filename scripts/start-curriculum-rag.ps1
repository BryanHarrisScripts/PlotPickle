[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PlotPickleHome = if ($env:PLOTPICKLE_HOME) { $env:PLOTPICKLE_HOME } elseif ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "PlotPickle" } else { Join-Path $HOME ".plotpickle" }
$Python = Join-Path $PlotPickleHome "runtimes\curriculum-rag\Scripts\python.exe"
$Server = Join-Path $Root "services\curriculum-rag\server.py"
$Health = "http://127.0.0.1:8091/health"
$LogRoot = Join-Path $PlotPickleHome "logs"
$OutLog = Join-Path $LogRoot "curriculum-rag.out.log"
$ErrLog = Join-Path $LogRoot "curriculum-rag.err.log"

function Test-RagHealth {
  try {
    $response = Invoke-RestMethod -Uri $Health -Method Get -TimeoutSec 2
    return [bool]$response.ok
  }
  catch { return $false }
}

if (Test-RagHealth) {
  Write-Host "[OK] PlotPickle curriculum RAG is already running on CPU at $Health"
  exit 0
}

if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) {
  Write-Warning "The curriculum RAG environment is not configured. Run scripts\configure-hardware-aware-local-ai.ps1 -Mode Configure first."
  exit 3
}
if (-not (Test-Path -LiteralPath $Server -PathType Leaf)) {
  Write-Warning "The curriculum RAG server file is missing."
  exit 1
}

New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
$environment = @{
  PLOTPICKLE_RAG_HOST = "127.0.0.1"
  PLOTPICKLE_RAG_PORT = "8091"
  PLOTPICKLE_EMBEDDING_MODEL = "Qwen/Qwen3-Embedding-0.6B"
  PLOTPICKLE_RERANKER_MODEL = "Qwen/Qwen3-Reranker-0.6B"
  CUDA_VISIBLE_DEVICES = ""
}

$previous = @{}
foreach ($name in $environment.Keys) {
  $previous[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
  [Environment]::SetEnvironmentVariable($name, $environment[$name], "Process")
}
try {
  Start-Process -FilePath $Python -ArgumentList @($Server) -WindowStyle Hidden -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog | Out-Null
}
finally {
  foreach ($name in $environment.Keys) {
    [Environment]::SetEnvironmentVariable($name, $previous[$name], "Process")
  }
}

for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
  Start-Sleep -Milliseconds 500
  if (Test-RagHealth) {
    Write-Host "[OK] PlotPickle curriculum RAG started on CPU at $Health"
    exit 0
  }
}

Write-Warning "The curriculum RAG process was started but did not report healthy within ten seconds. Model loading may still be initializing. PlotPickle will use bounded lexical retrieval until the service is ready."
exit 2
