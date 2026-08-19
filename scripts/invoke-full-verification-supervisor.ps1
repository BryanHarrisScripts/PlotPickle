param(
  [Parameter(Mandatory = $true)]
  [string]$ResultFile,
  [int]$StartupWaitSeconds = 240,
  [int]$HandshakeTimeoutSeconds = 12
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$SupervisorPath = Join-Path $PSScriptRoot "full-verification-supervisor.mjs"
$HandshakePath = "$ResultFile.supervisor.ready"
$StdoutPath = "$ResultFile.supervisor.stdout.log"
$StderrPath = "$ResultFile.supervisor.stderr.log"
$Process = $null
$StdoutReader = $null
$StderrReader = $null
$StdoutStream = $null
$StderrStream = $null
$ExitCode = 126

function Open-SharedReader {
  param([Parameter(Mandatory = $true)][string]$Path)
  $stream = New-Object System.IO.FileStream(
    $Path,
    [System.IO.FileMode]::Open,
    [System.IO.FileAccess]::Read,
    [System.IO.FileShare]::ReadWrite
  )
  $reader = New-Object System.IO.StreamReader($stream)
  return [pscustomobject]@{ Stream = $stream; Reader = $reader }
}

function Write-AvailableOutput {
  param(
    [Parameter(Mandatory = $true)]$ReaderPair,
    [switch]$IsError
  )
  while (-not $ReaderPair.Reader.EndOfStream) {
    $line = $ReaderPair.Reader.ReadLine()
    if ($null -eq $line) { break }
    if ($IsError) {
      Write-Host $line -ForegroundColor DarkYellow
    } else {
      Write-Host $line
    }
  }
}

function Stop-ProcessTreeBounded {
  param([Parameter(Mandatory = $true)][System.Diagnostics.Process]$Target)
  if ($Target.HasExited) { return }

  try {
    $killer = Start-Process -FilePath "taskkill.exe" -ArgumentList @("/PID", "$($Target.Id)", "/T", "/F") -NoNewWindow -PassThru -ErrorAction Stop
    if (-not $killer.WaitForExit(5000)) {
      try { $killer.Kill() } catch {}
    }
  } catch {
    Write-Host "WARN  Could not start bounded taskkill for verification supervisor PID $($Target.Id): $($_.Exception.Message)" -ForegroundColor Yellow
  }

  try {
    if (-not $Target.WaitForExit(3000)) {
      try { $Target.Kill() } catch {}
      [void]$Target.WaitForExit(2000)
    }
  } catch {}
}

try {
  if (-not (Test-Path -LiteralPath $SupervisorPath -PathType Leaf)) {
    throw "Full Verification supervisor is missing: $SupervisorPath"
  }

  $NodeCommand = Get-Command "node.exe" -ErrorAction SilentlyContinue
  if (-not $NodeCommand) { $NodeCommand = Get-Command "node" -ErrorAction SilentlyContinue }
  if (-not $NodeCommand) { throw "Node.js is not installed or not available on PATH." }

  $ResultDirectory = Split-Path -Parent $ResultFile
  if ($ResultDirectory) { New-Item -ItemType Directory -Force -Path $ResultDirectory | Out-Null }
  foreach ($Path in @($HandshakePath, $StdoutPath, $StderrPath)) {
    Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
  }
  New-Item -ItemType File -Force -Path $StdoutPath | Out-Null
  New-Item -ItemType File -Force -Path $StderrPath | Out-Null

  $ArgumentString = '"{0}" --result-file "{1}" --startup-wait-seconds "{2}" --handshake-file "{3}"' -f $SupervisorPath, $ResultFile, $StartupWaitSeconds, $HandshakePath
  Write-Host "Full Verification launcher ........ START  waiting up to $HandshakeTimeoutSeconds s for watchdog acknowledgement" -ForegroundColor Cyan

  $Process = Start-Process -FilePath $NodeCommand.Source -ArgumentList $ArgumentString -WorkingDirectory $RepoRoot -NoNewWindow -PassThru -RedirectStandardOutput $StdoutPath -RedirectStandardError $StderrPath

  $stdoutPair = Open-SharedReader -Path $StdoutPath
  $stderrPair = Open-SharedReader -Path $StderrPath
  $StdoutStream = $stdoutPair.Stream
  $StdoutReader = $stdoutPair.Reader
  $StderrStream = $stderrPair.Stream
  $StderrReader = $stderrPair.Reader

  $HandshakeDeadline = (Get-Date).AddSeconds([Math]::Max(3, $HandshakeTimeoutSeconds))
  $HandshakeSeen = $false

  while ($true) {
    Write-AvailableOutput -ReaderPair $stdoutPair
    Write-AvailableOutput -ReaderPair $stderrPair -IsError
    $Process.Refresh()

    if (-not $HandshakeSeen -and (Test-Path -LiteralPath $HandshakePath -PathType Leaf)) {
      $HandshakeSeen = $true
      Write-Host "Full Verification launcher ........ ACK  watchdog started" -ForegroundColor Green
    }

    if ($Process.HasExited) { break }

    if (-not $HandshakeSeen -and (Get-Date) -ge $HandshakeDeadline) {
      Write-Host "Full Verification launcher ........ STOP  watchdog did not acknowledge startup within $HandshakeTimeoutSeconds s" -ForegroundColor Red
      Stop-ProcessTreeBounded -Target $Process
      $ExitCode = 125
      break
    }

    Start-Sleep -Milliseconds $(if ($HandshakeSeen) { 250 } else { 100 })
  }

  if ($Process -and $Process.HasExited -and $ExitCode -ne 125) {
    [void]$Process.WaitForExit()
    Write-AvailableOutput -ReaderPair $stdoutPair
    Write-AvailableOutput -ReaderPair $stderrPair -IsError
    $ExitCode = [int]$Process.ExitCode
    if (-not $HandshakeSeen) {
      Write-Host "Full Verification launcher ........ STOP  watchdog process exited before startup acknowledgement (exit $ExitCode)" -ForegroundColor Red
      if ($ExitCode -eq 0) { $ExitCode = 126 }
    } else {
      Write-Host "Full Verification launcher ........ END  watchdog exit $ExitCode" -ForegroundColor DarkGray
    }
  }
} catch {
  Write-Host "Full Verification launcher ........ FAIL  $($_.Exception.Message)" -ForegroundColor Red
  if ($Process -and -not $Process.HasExited) { Stop-ProcessTreeBounded -Target $Process }
  $ExitCode = 126
} finally {
  if ($StdoutReader) { try { $StdoutReader.Dispose() } catch {} }
  if ($StderrReader) { try { $StderrReader.Dispose() } catch {} }
  if ($StdoutStream) { try { $StdoutStream.Dispose() } catch {} }
  if ($StderrStream) { try { $StderrStream.Dispose() } catch {} }
  foreach ($Path in @($HandshakePath, $StdoutPath, $StderrPath)) {
    Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
  }
}

exit $ExitCode
