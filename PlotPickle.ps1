[CmdletBinding()]
param(
  [switch]$WebMCPTesting,
  [switch]$HumanTesting,
  [switch]$ConversationalUAT
)

$ErrorActionPreference = "Stop"
$launcher = Join-Path $PSScriptRoot "Start-PlotPickle.bat"

$explicitModes = @($WebMCPTesting.IsPresent, $HumanTesting.IsPresent, $ConversationalUAT.IsPresent) | Where-Object { $_ }
if ($explicitModes.Count -gt 1) {
  throw "Choose only one startup mode: -WebMCPTesting, -HumanTesting, or -ConversationalUAT."
}

if (-not (Test-Path -LiteralPath $launcher)) {
  throw "Start-PlotPickle.bat was not found beside PlotPickle.ps1."
}

$mode = if ($WebMCPTesting) {
  "webmcp"
} elseif ($ConversationalUAT) {
  "conversational-uat"
} elseif ($HumanTesting) {
  "normal"
} else {
  $startupOptions = [ordered]@{
    "1" = @{
      Mode = "normal"
      Label = "Open PlotPickle normally"
      Description = "open the pristine current product with no developer UAT overlay."
    }
    "2" = @{
      Mode = "webmcp"
      Label = "WebMCP Testing"
      Description = "start an isolated test session and automatically inspect the interface, navigation, surfaces and Matrix skin."
    }
    "3" = @{
      Mode = "conversational-uat"
      Label = "Conversational UAT"
      Description = "open the governed Human development session with DSDD and conversational UAT tools."
    }
  }

  Write-Host ""
  Write-Host "Choose how PlotPickle should start."
  Write-Host ""

  foreach ($entry in $startupOptions.GetEnumerator()) {
    Write-Host ("[{0}] = {1} - {2}" -f $entry.Key, $entry.Value.Label, $entry.Value.Description)
    Write-Host ""
  }

  Write-Host "Run PlotPickle? [SELECT]: 1/2/3"

  $selection = $null
  $deadline = [DateTime]::UtcNow.AddSeconds(5)
  $lastRemaining = $null

  while (-not $selection -and [DateTime]::UtcNow -lt $deadline) {
    $remaining = [Math]::Max(1, [int][Math]::Ceiling(($deadline - [DateTime]::UtcNow).TotalSeconds))

    if ($remaining -ne $lastRemaining) {
      Write-Host ("[AUTO] Starting [1] in {0}..." -f $remaining)
      $lastRemaining = $remaining
    }

    try {
      if ([Console]::KeyAvailable) {
        $pressed = [Console]::ReadKey($true).KeyChar.ToString()
        if ($startupOptions.Contains($pressed)) {
          $selection = $pressed
          break
        }
      }
    } catch {
      # Some non-interactive PowerShell hosts cannot poll Console.KeyAvailable.
      # Keep the timed default active rather than blocking for input.
    }

    Start-Sleep -Milliseconds 100
  }

  if (-not $selection) {
    $selection = "1"
    Write-Host "[AUTO] No selection received. Starting [1] Open PlotPickle normally."
  } else {
    Write-Host ("[SELECTED] [{0}] {1}" -f $selection, $startupOptions[$selection].Label)
  }

  $startupOptions[$selection].Mode
}

if ($mode -eq "webmcp") {
  Write-Host "[READY] WebMCP Testing selected. Starting an isolated test session; your normal Human profile and credentials will not be used."
  & $launcher --webmcp-testing
} elseif ($mode -eq "conversational-uat") {
  Write-Host "[READY] Conversational UAT selected. Opening the governed Human development session with DSDD enabled."
  & $launcher --conversational-uat
} else {
  Write-Host "[READY] Normal PlotPickle selected. Opening the pristine current product."
  & $launcher --normal
}

exit $LASTEXITCODE
