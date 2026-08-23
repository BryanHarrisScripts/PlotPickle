import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const workflowRoot = new URL(".github/workflows/", root);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #538 leaves seven maintained workflows and exactly four PR gates", async () => {
  const files = (await readdir(workflowRoot)).filter((file) => /\.ya?ml$/.test(file)).sort();
  assert.deepEqual(files, [
    "agent-human-acceptance.yml",
    "quality.yml",
    "release-candidate.yml",
    "repomix-diagnostics.yml",
    "safety.yml",
    "visual.yml",
    "windows-installed-acceptance.yml",
  ]);

  const workflows = new Map(await Promise.all(files.map(async (file) => [file, await source(`.github/workflows/${file}`)])));
  const pullRequestWorkflows = [...workflows].filter(([, workflow]) => /^  pull_request:/m.test(workflow));
  assert.deepEqual(pullRequestWorkflows.map(([file]) => file), [
    "quality.yml",
    "release-candidate.yml",
    "safety.yml",
    "visual.yml",
  ]);

  const checks = [
    ["quality.yml", "PlotPickle Quality Gate", "Quality"],
    ["safety.yml", "PlotPickle Safety Gate", "Safety"],
    ["visual.yml", "PlotPickle Visual Gate", "Visual"],
    ["release-candidate.yml", "PlotPickle Release Readiness Gate", "Release readiness"],
  ];
  for (const [file, workflowName, jobName] of checks) {
    assert.match(workflows.get(file), new RegExp(`^name: ${workflowName}$`, "m"));
    assert.match(workflows.get(file), new RegExp(`^    name: ${jobName}$`, "m"));
  }
});

test("issue #538 keeps deep validation outside the ordinary PR runner path", async () => {
  const [quality, safety, visual, release, human, installed, repomix] = await Promise.all([
    source(".github/workflows/quality.yml"),
    source(".github/workflows/safety.yml"),
    source(".github/workflows/visual.yml"),
    source(".github/workflows/release-candidate.yml"),
    source(".github/workflows/agent-human-acceptance.yml"),
    source(".github/workflows/windows-installed-acceptance.yml"),
    source(".github/workflows/repomix-diagnostics.yml"),
  ]);

  assert.match(quality, /Run complete regression after merge or by request/);
  assert.match(quality, /Dispatch smoke UAT after successful main regression/);
  assert.match(safety, /Scan commits introduced by pull request/);
  assert.match(safety, /Scan complete reachable Git history after merge or by request/);
  assert.match(safety, /if: github\.event_name != 'pull_request'/);
  assert.match(visual, /Post-merge full visual inventory/);
  assert.match(release, /if: github\.event_name != 'pull_request'\n    name: Package/);
  assert.match(release, /Stage and smoke-test one representative package when packaging changed/);
  for (const workflow of [human, installed, repomix]) assert.doesNotMatch(workflow, /^  pull_request:/m);
});

test("issue #538 preserves historical contracts inside consolidated gates", async () => {
  const [quality, safety, visual, release] = await Promise.all([
    source(".github/workflows/quality.yml"),
    source(".github/workflows/safety.yml"),
    source(".github/workflows/visual.yml"),
    source(".github/workflows/release-candidate.yml"),
  ]);
  for (const contract of [
    "issue-287-public-repository-setup",
    "issue-293-public-history-readiness",
    "issue-299-credential-boundary-audit",
  ]) assert.ok(safety.includes(contract), `Safety lost ${contract}`);
  for (const contract of [
    "issue-337-ui-ux-consistency-foundation",
    "issue-349-common-overlays-ux",
    "issue-355-dashboard-command-centre-ux",
    "issue-367-creative-director-actions",
  ]) assert.ok(visual.includes(contract), `Visual lost ${contract}`);
  assert.match(quality, /npm run test:changed/);
  assert.match(release, /issue-124-release-hardening/);
});
