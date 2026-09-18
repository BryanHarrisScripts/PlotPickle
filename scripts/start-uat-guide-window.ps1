param(
  [Parameter(Mandatory=$true)][string]$Node,
  [Parameter(Mandatory=$true)][string]$Script,
  [Parameter(Mandatory=$true)][string]$Server,
  [Parameter(Mandatory=$true)][string]$RunId,
  [Parameter(Mandatory=$true)][string]$StatusFile
)

$ErrorActionPreference = "Stop"
$arguments = @(
  $Script,
  "--server", $Server,
  "--run-id", $RunId,
  "--status-file", $StatusFile,
  "--stay-open"
)

Start-Process -FilePath $Node -ArgumentList $arguments -WorkingDirectory (Split-Path -Parent (Split-Path -Parent $Script)) -WindowStyle Normal
