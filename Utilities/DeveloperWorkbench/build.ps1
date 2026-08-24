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

Write-Host "Developer Workbench ready: $exe"
Write-Host "Embedded identity: build-$buildNumber · sha-$shortSha"