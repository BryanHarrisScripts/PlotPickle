param(
  [Parameter(Mandatory=$true)][string]$Node,
  [Parameter(Mandatory=$true)][string]$Script,
  [Parameter(Mandatory=$true)][string]$Server,
  [Parameter(Mandatory=$true)][string]$RunId,
  [Parameter(Mandatory=$true)][string]$StatusFile
)

$ErrorActionPreference = "Stop"

function Quote-ProcessArgument([string]$Value) {
  return '"' + $Value.Replace('"', '\"') + '"'
}

$arguments = @(
  (Quote-ProcessArgument $Script),
  "--server", (Quote-ProcessArgument $Server),
  "--run-id", (Quote-ProcessArgument $RunId),
  "--status-file", (Quote-ProcessArgument $StatusFile),
  "--stay-open"
)

$workingDirectory = Split-Path -Parent (Split-Path -Parent $Script)
Start-Process -FilePath $Node -ArgumentList $arguments -WorkingDirectory $workingDirectory -WindowStyle Normal
