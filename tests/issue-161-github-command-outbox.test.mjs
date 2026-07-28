import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (filePath) => readFile(new URL(filePath, root), "utf8");

async function outboxContract() {
  const raw = (await source("lib/github-command-outbox.ts")).replace(/\r\n?/g, "\n");
  const compiled = stripTypeScriptTypes(raw, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`);
}

async function serviceContract(home) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "plotpickle-command-service-"));
  const libRaw = (await source("lib/github-command-outbox.ts")).replace(/\r\n?/g, "\n");
  const serviceRaw = (await source("build/github-command-service.ts")).replace(/\r\n?/g, "\n")
    .replace('from "../lib/github-command-outbox";', 'from "./github-command-outbox.mjs";')
    .replace('import { persistentHome } from "./local-credentials";', 'const persistentHome = () => process.env.PLOTPICKLE_HOME || "";');
  await writeFile(path.join(directory, "github-command-outbox.mjs"), stripTypeScriptTypes(libRaw, { mode: "transform" }), "utf8");
  await writeFile(path.join(directory, "github-command-service.mjs"), stripTypeScriptTypes(serviceRaw, { mode: "transform" }), "utf8");
  process.env.PLOTPICKLE_HOME = home;
  const service = await import(`${pathToFileURL(path.join(directory, "github-command-service.mjs")).href}?v=${Date.now()}`);
  return { service, directory };
}

const command = (overrides = {}) => ({
  type: "publish-project",
  projectId: "story-161",
  repository: "BryanHarrisScripts/PlotPickle-Story",
  branch: "main",
  baseCommit: "abc123",
  payload: { project: { id: "story-161", title: "Durable Outbox" }, expectedRemoteCommit: "abc123" },
  ...overrides,
});

test("issue #161 rejects credentials recursively before a command can enter the outbox", async () => {
  const contract = await outboxContract();
  const safe = contract.safeGitHubCommandPayload({ project: { id: "story-161" }, expectedRemoteCommit: "abc123" });
  assert.equal(safe.project.id, "story-161");
  for (const unsafe of [
    { token: "secret" },
    { nested: { access_token: "secret" } },
    { metadata: { refreshToken: "secret" } },
    { authorization: "Bearer secret" },
    { privateKey: "secret" },
    { client_secret: "secret" },
    { cookie: "secret" },
  ]) assert.throws(() => contract.safeGitHubCommandPayload(unsafe), /forbidden credential field/i);
  assert.throws(() => contract.normalizeGitHubCommandDraft(command({ repository: "not-a-repository" })), /owner\/repository/i);
});

test("issue #161 creates deterministic idempotency keys and deduplicates equivalent writes", async () => {
  const contract = await outboxContract();
  const first = command({ payload: { z: 1, project: { title: "Same", id: "story-161" } } });
  const second = command({ payload: { project: { id: "story-161", title: "Same" }, z: 1 } });
  assert.equal(contract.githubCommandIdempotencyKey(first), contract.githubCommandIdempotencyKey(second));
  const queued = contract.enqueueGitHubCommand(contract.emptyGitHubCommandOutbox("2026-07-27T20:00:00.000Z"), first, "2026-07-27T20:00:00.000Z");
  const duplicate = contract.enqueueGitHubCommand(queued.outbox, second, "2026-07-27T20:01:00.000Z");
  assert.equal(queued.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.outbox.entries.length, 1);
  assert.equal(contract.publicGitHubCommandEntry(queued.entry).payload, undefined);
});

test("issue #161 uses explicit states and bounded retry classification", async () => {
  const contract = await outboxContract();
  const queued = contract.enqueueGitHubCommand(contract.emptyGitHubCommandOutbox(), command(), "2026-07-27T20:00:00.000Z");
  const sending = contract.markGitHubCommandSending(queued.outbox, queued.entry.id, "2026-07-27T20:00:01.000Z");
  assert.equal(sending.entry.state, "sending");
  assert.equal(sending.entry.attempts, 1);
  const transient = contract.recordGitHubCommandFailure(sending.outbox, queued.entry.id, { status: 503, message: "Service unavailable" }, "2026-07-27T20:00:02.000Z");
  assert.equal(transient.entry.state, "retryable");
  assert.equal(transient.entry.failureClass, "transient");
  assert.ok(Date.parse(transient.entry.nextAttemptAt) > Date.parse("2026-07-27T20:00:02.000Z"));
  assert.ok(contract.githubCommandRetryDelayMs(99) <= contract.GITHUB_COMMAND_MAX_DELAY_MS);
  const interrupted = contract.recoverInterruptedGitHubCommands({
    ...sending.outbox,
    entries: sending.outbox.entries.map((entry) => ({ ...entry, lastAttemptAt: "2026-07-27T19:00:00.000Z" })),
  }, "2026-07-27T20:00:00.000Z");
  assert.equal(interrupted.changed, true);
  assert.equal(interrupted.outbox.entries[0].state, "retryable");

  assert.equal(contract.classifyGitHubCommandFailure({ status: 0, message: "Failed to fetch" }).classification, "offline");
  assert.equal(contract.classifyGitHubCommandFailure({ status: 401, message: "Bad credentials" }).classification, "authentication");
  assert.equal(contract.classifyGitHubCommandFailure({ status: 403, message: "API rate limit exceeded" }).classification, "rate-limited");
  assert.equal(contract.classifyGitHubCommandFailure({ status: 429, message: "Too many requests" }).classification, "rate-limited");
  assert.equal(contract.classifyGitHubCommandFailure({ status: 409, message: "non-fast-forward" }).classification, "review-required");
});

test("issue #161 persists a human-readable non-secret outbox before execution", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-home-"));
  const { service, directory } = await serviceContract(home);
  try {
    const queued = await service.enqueuePersistentGitHubCommand(command());
    assert.equal(queued.created, true);
    assert.equal(queued.entry.state, "pending");
    assert.equal(queued.entry.payload, undefined);

    const filePath = path.join(home, "github", "outbox.json");
    const sourceText = await readFile(filePath, "utf8");
    const stored = JSON.parse(sourceText);
    assert.equal(stored.entries[0].state, "pending");
    assert.equal(stored.entries[0].payload.project.id, "story-161");
    assert.doesNotMatch(sourceText, /authorization|accessToken|refreshToken|privateKey|clientSecret/i);

    const result = await service.runGitHubCommand(command(), async ({ idempotencyKey }) => ({ idempotencyKey, commit: "def456" }));
    assert.equal(result.ok, true);
    assert.equal(result.status, "completed");
    assert.equal(result.result.commit, "def456");

    const duplicate = await service.runGitHubCommand(command(), async () => { throw new Error("must not execute"); });
    assert.equal(duplicate.ok, true);
    assert.equal(duplicate.deduplicated, true);
    assert.equal(duplicate.result, null);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    delete process.env.PLOTPICKLE_HOME;
  }
});

test("issue #161 records authentication and review failures without hiding them as retries", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-home-"));
  const { service, directory } = await serviceContract(home);
  try {
    const auth = await service.runGitHubCommand(command({ payload: { project: { id: "auth" } } }), async () => {
      const error = new Error("Bad credentials");
      error.status = 401;
      throw error;
    });
    assert.equal(auth.ok, false);
    assert.equal(auth.command.state, "needs-authentication");

    const review = await service.runGitHubCommand(command({ payload: { project: { id: "review" } } }), async () => {
      const error = new Error("The approved branch changed after preview");
      error.status = 409;
      throw error;
    });
    assert.equal(review.ok, false);
    assert.equal(review.command.state, "needs-review");
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    delete process.env.PLOTPICKLE_HOME;
  }
});

test("issue #161 claims duplicate concurrent commands only once", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-home-"));
  const { service, directory } = await serviceContract(home);
  let executions = 0;
  try {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const first = service.runGitHubCommand(command({ payload: { project: { id: "concurrent" } } }), async () => {
      executions += 1;
      await gate;
      return { commit: "one" };
    });
    await new Promise((resolve) => setTimeout(resolve, 15));
    const second = await service.runGitHubCommand(command({ payload: { project: { id: "concurrent" } } }), async () => {
      executions += 1;
      return { commit: "two" };
    });
    assert.equal(second.ok, false);
    assert.equal(second.status, "active");
    release();
    const completed = await first;
    assert.equal(completed.ok, true);
    assert.equal(executions, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    delete process.env.PLOTPICKLE_HOME;
  }
});

test("issue #161 keeps the command foundation separate from browser interception and repository repair", async () => {
  const [outbox, service, docs] = await Promise.all([
    source("lib/github-command-outbox.ts"),
    source("build/github-command-service.ts"),
    source("docs/issue-161-github-command-outbox.md"),
  ]);
  assert.doesNotMatch(`${outbox}\n${service}`, /window\.fetch|recreate.*branch|adopt.*repository/i);
  for (const phrase of [
    "persistentHome()",
    'GITHUB_COMMAND_OUTBOX_DIRECTORY = "github"',
    'GITHUB_COMMAND_OUTBOX_FILE = "outbox.json"',
    "runGitHubCommand",
    "idempotencyKey",
    "safeGitHubCommandPayload",
  ]) assert.ok(`${outbox}\n${service}`.includes(phrase), `Phase 6A is missing: ${phrase}`);
  for (const phrase of ["non-secret", "written before execution", "No browser interception", "Phase 6B", "Phase 6C"]) {
    assert.ok(docs.includes(phrase), `Phase 6A documentation is missing: ${phrase}`);
  }
});
