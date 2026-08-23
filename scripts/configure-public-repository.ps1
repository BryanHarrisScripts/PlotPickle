[CmdletBinding()]
param(
  [string]$Repository = $env:GITHUB_REPOSITORY,
  [switch]$Apply,
  [switch]$MakePublic
)

$ErrorActionPreference = "Stop"

if (-not $Repository) {
  $Repository = (gh repo view --json nameWithOwner --jq .nameWithOwner 2>$null)
}
if (-not $Repository -or $Repository -notmatch "^[^/]+/[^/]+$") {
  throw "Supply -Repository owner/name or run inside the PlotPickle checkout."
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI is required. Install it from https://cli.github.com/ and run 'gh auth login'."
}
gh auth status 1>$null
if ($LASTEXITCODE -ne 0) { throw "GitHub CLI is not authenticated." }

$root = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $root "config/public-repository.settings.json"
if (-not (Test-Path $configPath)) { throw "Missing $configPath" }
$config = Get-Content $configPath -Raw | ConvertFrom-Json

function Invoke-GhJson {
  param(
    [Parameter(Mandatory)][ValidateSet("GET", "POST", "PUT", "PATCH", "DELETE")][string]$Method,
    [Parameter(Mandatory)][string]$Endpoint,
    [object]$Body,
    [switch]$IgnoreFailure
  )

  $display = "$Method /$Endpoint"
  if (-not $Apply) {
    Write-Host "DRY RUN  $display"
    return
  }

  try {
    if ($null -eq $Body) {
      gh api --method $Method $Endpoint 1>$null
    } else {
      $json = $Body | ConvertTo-Json -Depth 20 -Compress
      $json | gh api --method $Method $Endpoint --input - 1>$null
    }
    if ($LASTEXITCODE -ne 0) { throw "gh api returned exit code $LASTEXITCODE" }
    Write-Host "APPLIED  $display" -ForegroundColor Green
  } catch {
    if ($IgnoreFailure) {
      Write-Warning "$display could not be applied: $($_.Exception.Message)"
    } else {
      throw
    }
  }
}

$repositorySettings = [ordered]@{
  has_issues = [bool]$config.repository.has_issues
  has_projects = [bool]$config.repository.has_projects
  has_wiki = [bool]$config.repository.has_wiki
  has_discussions = [bool]$config.repository.has_discussions
  delete_branch_on_merge = [bool]$config.repository.delete_branch_on_merge
  allow_squash_merge = [bool]$config.repository.allow_squash_merge
  allow_merge_commit = [bool]$config.repository.allow_merge_commit
  allow_rebase_merge = [bool]$config.repository.allow_rebase_merge
  allow_auto_merge = [bool]$config.repository.allow_auto_merge
  allow_update_branch = [bool]$config.repository.allow_update_branch
  description = "Local-first visual story development, screenplay structure, collaboration, and Graphic Novel creation."
  homepage = "https://github.com/$Repository#readme"
}

if ($MakePublic) {
  $repositorySettings.visibility = "public"
} else {
  Write-Host "Repository visibility will not change. Add -MakePublic for the final publication step." -ForegroundColor Yellow
}

Invoke-GhJson PATCH "repos/$Repository" $repositorySettings
Invoke-GhJson PUT "repos/$Repository/vulnerability-alerts" $null -IgnoreFailure
Invoke-GhJson PUT "repos/$Repository/automated-security-fixes" $null -IgnoreFailure
Invoke-GhJson PUT "repos/$Repository/private-vulnerability-reporting" $null -IgnoreFailure

$securitySettings = [ordered]@{
  security_and_analysis = [ordered]@{
    secret_scanning = @{ status = "enabled" }
    secret_scanning_push_protection = @{ status = "enabled" }
  }
}
Invoke-GhJson PATCH "repos/$Repository" $securitySettings -IgnoreFailure

$protection = [ordered]@{
  required_status_checks = [ordered]@{
    strict = $true
    contexts = @($config.main_branch.required_checks)
  }
  enforce_admins = $true
  required_pull_request_reviews = [ordered]@{
    dismiss_stale_reviews = [bool]$config.main_branch.dismiss_stale_reviews
    require_code_owner_reviews = [bool]$config.main_branch.require_code_owner_review
    required_approving_review_count = [int]$config.main_branch.required_approvals
    require_last_push_approval = $false
  }
  restrictions = $null
  required_linear_history = [bool]$config.main_branch.require_linear_history
  allow_force_pushes = -not [bool]$config.main_branch.block_force_pushes
  allow_deletions = -not [bool]$config.main_branch.block_deletions
  block_creations = $false
  required_conversation_resolution = [bool]$config.main_branch.require_conversation_resolution
  lock_branch = $false
  allow_fork_syncing = $true
}
Invoke-GhJson PUT "repos/$Repository/branches/main/protection" $protection

$topics = @{ names = @("plotpickle", "screenwriting", "story-development", "graphic-novel", "local-first", "open-source") }
Invoke-GhJson PUT "repos/$Repository/topics" $topics -IgnoreFailure

$labels = @(
  @{ name = "bug"; color = "d73a4a"; description = "Something is not working" },
  @{ name = "enhancement"; color = "a2eeef"; description = "New or improved capability" },
  @{ name = "security"; color = "b60205"; description = "Security hardening or dependency safety" },
  @{ name = "dependencies"; color = "0366d6"; description = "Dependency maintenance" },
  @{ name = "documentation"; color = "0075ca"; description = "Documentation improvement" },
  @{ name = "triage"; color = "fbca04"; description = "Needs maintainer review" },
  @{ name = "skip-changelog"; color = "ededed"; description = "Exclude from generated release notes" }
)
foreach ($label in $labels) {
  Invoke-GhJson POST "repos/$Repository/labels" $label -IgnoreFailure
}

Write-Host ""
if ($Apply) {
  Write-Host "PlotPickle repository configuration finished." -ForegroundColor Green
  if (-not $MakePublic) {
    Write-Host "Review docs/PUBLIC_RELEASE_CHECKLIST.md, then rerun with -Apply -MakePublic." -ForegroundColor Yellow
  }
} else {
  Write-Host "Dry run complete. Review the operations above, then rerun with -Apply." -ForegroundColor Cyan
}
