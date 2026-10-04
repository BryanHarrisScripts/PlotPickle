param(
  [Parameter(Mandatory=$true)][ValidateSet('Start','Stop','Status')][string]$Action,
  [string]$HunkCommand,
  [string]$RepositoryRoot,
  [string]$AgentContext,
  [int]$PullRequest = 0,
  [int]$OwnedPid = 0,
  [string]$OwnedStartTicks
)
$ErrorActionPreference = 'Stop'
if ($Action -eq 'Start') {
  if (-not [IO.Path]::IsPathRooted($HunkCommand) -or -not (Test-Path -LiteralPath $HunkCommand -PathType Leaf)) { throw 'Hunk executable is unavailable.' }
  if (-not [IO.Path]::IsPathRooted($RepositoryRoot) -or -not (Test-Path -LiteralPath (Join-Path $RepositoryRoot '.git'))) { throw 'The current checkout is unavailable.' }
  $reviewArgs = @('--no-extensions', 'diff')
  if ($PullRequest -gt 0) { $reviewArgs = @('--no-extensions', 'gh', 'pr', [string]$PullRequest, '--repo', 'BryanHarrisScripts/PlotPickle') }
  if ($AgentContext) {
    if (-not [IO.Path]::IsPathRooted($AgentContext) -or -not (Test-Path -LiteralPath $AgentContext -PathType Leaf) -or $AgentContext.Contains('"')) { throw 'Agent review notes are unavailable.' }
    $reviewArgs += @('--agent-context', ('"' + $AgentContext + '"'))
  }
  # Only fixed words and a validated integer enter ArgumentList. Neither Human
  # narration nor arbitrary commands, revisions, paths or URLs enter the shell.
  $child = Start-Process -FilePath $HunkCommand -ArgumentList $reviewArgs -WorkingDirectory $RepositoryRoot -PassThru
  Start-Sleep -Milliseconds 500
  $child.Refresh()
  if ($child.HasExited) { throw 'Hunk exited before opening its review window.' }
  @{ pid = $child.Id; startTicks = [string]$child.StartTime.ToUniversalTime().Ticks } | ConvertTo-Json -Compress
} else {
  if ($OwnedPid -le 0 -or $OwnedStartTicks -notmatch '^\d+$') { throw 'Invalid owned review process.' }
  $child = Get-Process -Id $OwnedPid -ErrorAction SilentlyContinue
  if ($Action -eq 'Status') {
    $running = $child -and ([string]$child.StartTime.ToUniversalTime().Ticks -eq $OwnedStartTicks)
    @{ running = [bool]$running } | ConvertTo-Json -Compress
    exit 0
  }
  if ($child) {
    if ([string]$child.StartTime.ToUniversalTime().Ticks -ne $OwnedStartTicks) { throw 'Review process identity changed; cancellation was denied.' }
    & taskkill.exe /PID $OwnedPid /T /F | Out-Null
    if ($LASTEXITCODE -ne 0 -and (Get-Process -Id $OwnedPid -ErrorAction SilentlyContinue)) { throw 'Owned Hunk review did not stop.' }
  }
  @{ stopped = $true } | ConvertTo-Json -Compress
}
