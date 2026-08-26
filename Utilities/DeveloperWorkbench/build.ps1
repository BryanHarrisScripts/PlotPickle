param(
  [string]$Runtime = "win-x64"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $root "..\..")
$project = Join-Path $root "DeveloperWorkbench.csproj"
$output = Join-Path $root "dist\$Runtime"

$buildNumber = $env:PLOTPICKLE_WORKBENCH_BUILD
if ([string]::IsNullOrWhiteSpace($buildNumber)) {
  $buildNumber = "local"
}

$commitSha = $env:PLOTPICKLE_WORKBENCH_SHA
if ([string]::IsNullOrWhiteSpace($commitSha)) {
  $gitSha = & git -C $repoRoot rev-parse HEAD 2>$null
  if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($gitSha)) {
    $commitSha = $gitSha.Trim()
  } else {
    $commitSha = "unknown"
  }
}
$shortSha = if ($commitSha.Length -gt 12) { $commitSha.Substring(0, 12) } else { $commitSha }

if (Test-Path $output) {
  Remove-Item -Recurse -Force $output
}

Write-Host "Publishing PlotPickle Developer Workbench for $Runtime..."
Write-Host "Build identity: build-$buildNumber · sha-$shortSha"
dotnet publish $project `
  --configuration Release `
  --runtime $Runtime `
  --self-contained true `
  -p:PublishSingleFile=true `
  -p:PublishTrimmed=false `
  "-p:PlotPickleWorkbenchBuild=$buildNumber" `
  "-p:PlotPickleWorkbenchSha=$shortSha" `
  --output $output

$exe = Join-Path $output "PlotPickleDeveloperWorkbench.exe"
if (-not (Test-Path $exe)) {
  throw "Expected Workbench executable was not produced: $exe"
}

Copy-Item (Join-Path $root "local-validation.mjs") (Join-Path $output "local-validation.mjs") -Force
Copy-Item (Join-Path $root "Run-Local-Validation.cmd") (Join-Path $output "Run-Local-Validation.cmd") -Force

function Copy-WorkbenchRuntimeFile([string]$RelativePath) {
  $source = Join-Path $repoRoot $RelativePath
  if (-not (Test-Path $source)) {
    throw "Required Workbench runtime helper is missing: $RelativePath"
  }
  $destination = Join-Path $output $RelativePath
  $destinationDirectory = Split-Path -Parent $destination
  New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
  Copy-Item $source $destination -Force
}

# The downloadable PR/release artifact must be able to run its new reviewer
# features against an ordinary PlotPickle checkout that may not yet contain
# the Workbench branch itself. Keep this list intentionally narrow: these are
# read-only reviewer/runtime helpers, not a second copy of the application.
$runtimeFiles = @(
  "Utilities\DeveloperWorkbench\local-reviewer-inventory.mjs",
  "Utilities\DeveloperWorkbench\second-opinion-review.mjs",
  "Utilities\DeveloperWorkbench\workbench-repomix-evidence.mjs",
  "Utilities\DeveloperWorkbench\workbench-cli.mjs",
  "Utilities\DeveloperWorkbench\pi-managed-node-launch.mjs",
  "Utilities\DeveloperWorkbench\pi-review-instructions.mjs",
  "scripts\developer-repair-model-policy.mjs",
  "scripts\local-repair-capability-cache.mjs",
  "scripts\pi-managed-install.mjs",
  "scripts\pi-worker-runtime.mjs",
  "lib\runtime\ai\local-model\local-model-capabilities.mjs"
)
foreach ($relativePath in $runtimeFiles) {
  Copy-WorkbenchRuntimeFile $relativePath
}

$runtimeManifest = [ordered]@{
  schemaVersion = 1
  build = $buildNumber
  sourceSha = $commitSha
  files = @($runtimeFiles | ForEach-Object { $_.Replace("\", "/") })
}
$runtimeManifest | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $output "workbench-runtime-manifest.json") -Encoding utf8

Write-Host "Developer Workbench ready: $exe"
Write-Host "Local pre-CI launcher: $(Join-Path $output 'Run-Local-Validation.cmd')"
Write-Host "Packaged reviewer runtime helpers: $($runtimeFiles.Count)"
Write-Host "Embedded identity: build-$buildNumber · sha-$shortSha"