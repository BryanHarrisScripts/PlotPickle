import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1571 local QA scheduling reuses the existing Guest Mastra runtime and current policy", async () => {
  const source = await read("build/autonomous-guest/qa/campaign-runtime.ts");
  assert.ok(source.includes("startAutonomousGuestSchedulerRuntime"));
  assert.ok(source.includes("createAutonomousQaTaskPolicyResolver"));
  assert.ok(source.includes("getAutonomousGuestAuthority"));
  assert.ok(source.includes("delegated Guest authority"));
  assert.ok(source.includes('task.taskKind.startsWith("qa:")'));
  assert.ok(source.includes("snapshot.currentRevision === task.baseRevision"));
  assert.ok(source.includes("snapshot.providerAllowed"));
  assert.ok(source.includes("snapshot.budgetAllowed"));
  assert.doesNotMatch(source, /new Mastra|writeFile|applyStoryCommand|saveActiveLibraryProject|browser_navigate/);
});

test("#1571 continuous QA covers PR, main, on-demand, daily smoke and weekly deep campaigns", async () => {
  const workflow = await read(".github/workflows/autonomous-qa-campaign.yml");
  assert.match(workflow, /pull_request:\n\s+branches: \[main\]/);
  assert.match(workflow, /push:\n\s+branches: \[main\]/);
  assert.ok(workflow.includes("workflow_dispatch:"));
  assert.ok(workflow.includes("cron: '17 7 * * *'"));
  assert.ok(workflow.includes("cron: '43 8 * * 0'"));
  assert.ok(workflow.includes("node --test tests/issue-1571-autonomous-qa-*.test.mjs"));
  assert.ok(workflow.includes("npm run build"));
});

test("#1571 deep campaigns reuse the real Afterglow and Windows installer workflows", async () => {
  const [qa, story, windows] = await Promise.all([
    read(".github/workflows/autonomous-qa-campaign.yml"),
    read(".github/workflows/autonomous-story-reference.yml"),
    read(".github/workflows/windows-installer.yml"),
  ]);
  assert.ok(qa.includes("uses: ./.github/workflows/autonomous-story-reference.yml"));
  assert.ok(qa.includes("uses: ./.github/workflows/windows-installer.yml"));
  assert.ok(story.includes("workflow_call:"));
  assert.ok(story.includes("run-autonomous-story-reference.mjs"));
  assert.ok(windows.includes("workflow_call:"));
  assert.ok(windows.includes("Build PlotPickleSetup.exe"));
  assert.ok(windows.includes("Run install and uninstall smoke"));
});

test("#1571 continuous QA remains read-only at the GitHub workflow boundary", async () => {
  const workflow = await read(".github/workflows/autonomous-qa-campaign.yml");
  assert.match(workflow, /permissions:\n\s+contents: read/);
  assert.doesNotMatch(workflow, /issues: write|pull-requests: write|contents: write|gh issue|gh pr|git push/);
});
