param(
  [string]$Runtime = "win-x64"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$project = Join-Path $root "DeveloperWorkbench.csproj"
$output = Join-Path $root "dist\$Runtime"

if (Test-Path $output) {
  Remove-Item -Recurse -Force $output
}

Write-Host "Publishing PlotPickle Developer Workbench for $Runtime..."
dotnet publish $project `
  --configuration Release `
  --runtime $Runtime `
  --self-contained true `
  -p:PublishSingleFile=true `
  -p:PublishTrimmed=false `
  --output $output

$exe = Join-Path $output "PlotPickleDeveloperWorkbench.exe"
if (-not (Test-Path $exe)) {
  throw "Expected Workbench executable was not produced: $exe"
}

Write-Host "Developer Workbench ready: $exe"
