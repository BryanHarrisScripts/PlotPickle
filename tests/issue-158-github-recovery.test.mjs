import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (filePath) => readFile(new URL(filePath, root), "utf8");

async function recoveryContract() {
  const raw = (await source("lib/github-recovery.ts")).replace(/\r\n?/g, "\n");
  const compiled = stripTypeScriptTypes(raw, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`);
}

test("issue #158 rejects credentials before a GitHub operation enters the protected queue", async () => {
  const recovery = await recoveryContract();
  const body = recovery.safeGitHubRecoveryBody({
    project: { id: "story-158", metadata: { title: "Recovery Story" } },
    expectedRemoteCommit: "abc123",
  });
  assert.equal(body.project.id, "story-158");
  for (const unsafe of [
    { token: "secret" },
    { nested: { accessToken: "secret" } },
    { authorization: "Bearer secret" },
    { privateKey: "secret" },
    { password: "secret" },
  ]) assert.throws(() => recovery.safeGitHubRecoveryBody(unsafe), /credential field/i);
  assert.equal(recovery.redactGitHubRecoveryMessage("Bearer abc.def and github_pat_secret"), "[redacted] and [redacted]");
});

test("issue #158 classifies offline, authorization, repository, branch and conflict failures separately", async () => {
  const recovery = await recoveryContract();
  assert.equal(recovery.classifyGitHubRecoveryFailure({ status: 0, message: "Failed to fetch" }).classification, "offline");
  assert.equal(recovery.classifyGitHubRecoveryFailure({ status: 401, message: "Bad credentials" }).classification, "authorization-expired");
  assert.equal(recovery.classifyGitHubRecoveryFailure({ status: 404, message: "Repository not found" }).classification, "repository-missing");
  assert.equal(recovery.classifyGitHubRecoveryFailure({ status: 404, message: "Reference heads/main not found" }).classification, "branch-missing");
  assert.equal(recovery.classifyGitHubRecoveryFailure({ status: 409, message: "The approved branch changed after preview" }).classification, "conflict-review");
  assert.equal(recovery.classifyGitHubRecoveryFailure({ status: 503, message: "Service unavailable" }).retryable, true);
  assert.equal(recovery.classifyGitHubRecoveryFailure({ status: 403, message: "API rate limit exceeded" }).classification, "rate-limited");
});

test("issue #158 deduplicates queued writes and applies bounded retry state", async () => {
  const recovery = await recoveryContract();
  const now = "2026-07-27T20:00:00.000Z";
  const first = recovery.enqueueGitHubRecoveryOperation(recovery.emptyGitHubRecoveryQueue(now), {
    path: "/api/local-github-sync/publish",
    body: { project: { id: "story-158" }, expectedRemoteCommit: "abc123" },
    label: "Publish approved project files",
    failure: { status: 0, message: "Offline" },
    now,
  });
  assert.equal(first.created, true);
  assert.equal(first.entry.state, "queued");
  assert.equal(first.entry.attempts, 0);
  assert.ok(Date.parse(first.entry.nextRetryAt) > Date.parse(now));

  const duplicate = recovery.enqueueGitHubRecoveryOperation(first.queue, {
    path: "/api/local-github-sync/publish",
    body: { project: { id: "story-158" }, expectedRemoteCommit: "abc123" },
    failure: { status: 503, message: "Temporary" },
    now: "2026-07-27T20:00:02.000Z",
  });
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.queue.entries.length, 1);

  const failed = recovery.recordGitHubRecoveryFailure(first.queue, first.entry.id, { status: 503, message: "Temporary" }, "2026-07-27T20:01:00.000Z");
  assert.equal(failed.entry.attempts, 1);
  assert.equal(failed.entry.classification, "transient");
  assert.ok(recovery.githubRecoveryDelayMs(20) <= recovery.GITHUB_RECOVERY_MAX_DELAY_MS);
  assert.equal(recovery.publicGitHubRecoveryEntry(failed.entry).body, undefined);
});

test("issue #158 reuses existing GitHub APIs and exposes guarded recovery actions", async () => {
  const [gateway, component, layout, vite, docs] = await Promise.all([
    source("build/github-recovery-gateway.ts"),
    source("app/github-recovery-centre.tsx"),
    source("app/layout.tsx"),
    source("vite.config.ts"),
    source("docs/issue-158-github-recovery.md"),
  ]);
  for (const path of [
    "/api/local-github-sync/publish",
    "/api/local-github-sync/release-snapshot",
    "/api/local-github/submit-proposal",
    "/api/local-github/approve-proposal",
    "/api/local-github/decline-proposal",
    "/api/local-collaboration/policy",
  ]) assert.ok(gateway.includes(path) || component.includes(path), `Recovery coverage is missing ${path}`);
  for (const phrase of [
    "writeCredentialJson(QUEUE_FILE",
    "X-PlotPickle-Recovery-Retry",
    "requiresReadinessCheck: true",
    "Only the Project Lead workspace",
    "force: false",
    "The recovered repository or branch belongs to a different PlotPickle project",
    "last verified approved commit",
  ]) assert.ok(gateway.includes(phrase), `Recovery gateway is missing: ${phrase}`);
  assert.doesNotMatch(gateway, /force:\s*true/);
  for (const phrase of [
    "Keep writing locally. Recover GitHub deliberately.",
    "Local writing, backups and exports remain available",
    "Retry due operations",
    "Diagnose repository",
    "Project Lead: recreate approved branch",
    "Credentials are rejected before an operation is stored",
  ]) assert.ok(component.includes(phrase), `Recovery UI is missing: ${phrase}`);
  assert.match(layout, /<GitHubRecoveryCentre \/>/);
  assert.ok(vite.indexOf("githubRecoveryGateway()") < vite.indexOf("githubProjectSyncGateway()"));
  for (const phrase of ["bounded exponential backoff", "repository moves or renames", "deleted approved branch", "never force-pushes", "review candidate", "credential-protected queue"]) {
    assert.ok(docs.includes(phrase), `Recovery documentation is missing: ${phrase}`);
  }
});

test("issue #158 recovery test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-158-github-recovery\.test\.mjs/);
  assert.equal(packageJson.scripts["test:github-recovery"], "node --test tests/issue-158-github-recovery.test.mjs");
});
