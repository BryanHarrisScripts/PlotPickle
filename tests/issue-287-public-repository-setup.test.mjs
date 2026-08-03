import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const text = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const requiredChecks = [
  "build-test-lint",
  "validate",
  "audit",
  "Pack active Phase 5 branch",
  "Package windows",
  "Package macos",
  "Package linux",
  "Full history audit",
];

const pinnedCodeqlSha = "f205ea1c3313d32999d8d6a48b4f6530d4437b38";

test("public repository settings preserve the established green gates", async () => {
  const settings = JSON.parse(await text("config/public-repository.settings.json"));
  assert.equal(settings.repository.visibility, "public");
  assert.equal(settings.repository.allow_squash_merge, true);
  assert.equal(settings.repository.allow_merge_commit, false);
  assert.equal(settings.repository.allow_rebase_merge, false);
  assert.equal(settings.repository.allow_update_branch, true);
  assert.equal(settings.main_branch.require_pull_request, true);
  assert.equal(settings.main_branch.block_force_pushes, true);
  assert.equal(settings.main_branch.block_deletions, true);
  assert.deepEqual(settings.main_branch.required_checks, requiredChecks);
});

test("security automation stays safe while private and activates when public", async () => {
  const workflow = await text(".github/workflows/public-security.yml");
  assert.match(workflow, /github\.event\.repository\.private == false/);
  assert.match(workflow, new RegExp(`github/codeql-action/init@${pinnedCodeqlSha}`));
  assert.match(workflow, new RegExp(`github/codeql-action/analyze@${pinnedCodeqlSha}`));
  assert.match(workflow, /actions\/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294/);
  assert.match(workflow, /fail-on-severity: high/);
});

test("administrator scripts default to dry-run and require an explicit publication switch", async () => {
  const powershell = await text("scripts/configure-public-repository.ps1");
  const shell = await text("scripts/configure-public-repository.sh");
  assert.match(powershell, /\[switch\]\$Apply/);
  assert.match(powershell, /\[switch\]\$MakePublic/);
  assert.match(powershell, /Repository visibility will not change/);
  assert.match(shell, /apply=false/);
  assert.match(shell, /make_public=false/);
  assert.match(shell, /--make-public/);
  for (const check of requiredChecks) {
    assert.match(await text("config/public-repository.settings.json"), new RegExp(check.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("public contribution routes protect secrets and private story material", async () => {
  const bug = await text(".github/ISSUE_TEMPLATE/bug-report.yml");
  const feature = await text(".github/ISSUE_TEMPLATE/feature-request.yml");
  const pullRequest = await text(".github/PULL_REQUEST_TEMPLATE.md");
  const checklist = await text("docs/PUBLIC_RELEASE_CHECKLIST.md");
  assert.match(bug, /Remove API keys, tokens, personal information, unpublished story text/);
  assert.match(bug, /unpublished story material/);
  assert.match(feature, /private story material/);
  assert.match(pullRequest, /No API keys, OAuth secrets, tokens, certificates or private keys/);
  assert.match(checklist, /Git history/);
  assert.match(checklist, /-Apply -MakePublic/);
  assert.match(checklist, /Windows, macOS and Linux archives/);
});

test("release and ownership metadata are present", async () => {
  const codeowners = await text(".github/CODEOWNERS");
  const release = await text(".github/release.yml");
  const dependabot = await text(".github/dependabot.yml");
  assert.match(codeowners, /@BryanHarrisScripts/);
  assert.match(release, /title: Security/);
  assert.match(release, /title: Dependencies/);
  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
  assert.match(dependabot, /timezone: America\/Toronto/);
});
