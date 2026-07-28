import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (filePath) => readFile(new URL(filePath, root), "utf8");

async function contractModule(filePath) {
  const raw = (await source(filePath)).replace(/\r\n?/g, "\n");
  const withoutTypeImports = raw.replace(/^import type[^;]+;\n/gm, "");
  const compiled = stripTypeScriptTypes(withoutTypeImports, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`);
}

function commandDraft(label = "Publish approved story") {
  return {
    type: "publish-project",
    projectId: "afterglow",
    repository: "BryanHarrisScripts/Afterglow",
    branch: "main",
    baseCommit: "a".repeat(40),
    payload: { changedPaths: ["project/story/premise.json"] },
    label,
  };
}

async function gatewayContract(home) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "plotpickle-recovery-gateway-"));
  const outboxRaw = (await source("lib/github-command-outbox.ts")).replace(/\r\n?/g, "\n");
  const statusRaw = (await source("lib/github-recovery-status.ts")).replace(/\r\n?/g, "\n")
    .replace('from "./github-command-outbox";', 'from "./github-command-outbox.mjs";');
  const serviceRaw = (await source("build/github-command-service.ts")).replace(/\r\n?/g, "\n")
    .replace('from "../lib/github-command-outbox";', 'from "./github-command-outbox.mjs";')
    .replace('from "./local-credentials";', 'from "./local-credentials.mjs";');
  const gatewayRaw = (await source("build/github-command-gateway.ts")).replace(/\r\n?/g, "\n")
    .replace('from "./github-command-service";', 'from "./github-command-service.mjs";')
    .replace('from "../lib/github-command-outbox";', 'from "./github-command-outbox.mjs";')
    .replace('from "../lib/github-recovery-status";', 'from "./github-recovery-status.mjs";')
    .replace('from "./local-credentials";', 'from "./local-credentials.mjs";');
  await Promise.all([
    writeFile(path.join(directory, "github-command-outbox.mjs"), stripTypeScriptTypes(outboxRaw, { mode: "transform" }), "utf8"),
    writeFile(path.join(directory, "github-recovery-status.mjs"), stripTypeScriptTypes(statusRaw, { mode: "transform" }), "utf8"),
    writeFile(path.join(directory, "github-command-service.mjs"), stripTypeScriptTypes(serviceRaw, { mode: "transform" }), "utf8"),
    writeFile(path.join(directory, "github-command-gateway.mjs"), stripTypeScriptTypes(gatewayRaw, { mode: "transform" }), "utf8"),
    writeFile(path.join(directory, "local-credentials.mjs"), [
      'export const persistentHome = () => process.env.PLOTPICKLE_HOME || "";',
      'export const readCredentialJson = async () => JSON.parse(process.env.PLOTPICKLE_TEST_GITHUB_CONNECTION || "null");',
    ].join("\n"), "utf8"),
  ]);
  process.env.PLOTPICKLE_HOME = home;
  process.env.PLOTPICKLE_TEST_GITHUB_CONNECTION = JSON.stringify({ readiness: { ready: false } });
  const version = Date.now();
  const service = await import(`${pathToFileURL(path.join(directory, "github-command-service.mjs")).href}?v=${version}`);
  const gateway = await import(`${pathToFileURL(path.join(directory, "github-command-gateway.mjs")).href}?v=${version}`);
  return { service, gateway, directory };
}

function invokeGateway(handler, url, method = "GET", remoteAddress = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const response = {
      statusCode: 0,
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      end(body = "") {
        try { resolve({ statusCode: this.statusCode, headers: this.headers, body: JSON.parse(body || "{}") }); }
        catch (error) { reject(error); }
      },
    };
    handler({ method, url, socket: { remoteAddress }, headers: { host: "127.0.0.1:4173", origin: "http://127.0.0.1:4173" } }, response, () => reject(new Error("Recovery request unexpectedly bypassed the gateway.")));
  });
}

test("issue #163 prepares only retryable commands and never replays them", async () => {
  const contract = await contractModule("lib/github-command-outbox.ts");
  const queued = contract.enqueueGitHubCommand(contract.emptyGitHubCommandOutbox("2026-07-28T00:00:00.000Z"), commandDraft(), "2026-07-28T00:00:00.000Z");
  const sending = contract.markGitHubCommandSending(queued.outbox, queued.entry.id, "2026-07-28T00:00:01.000Z");
  const failed = contract.recordGitHubCommandFailure(sending.outbox, queued.entry.id, { status: 503, message: "GitHub temporarily unavailable" }, "2026-07-28T00:00:02.000Z");
  assert.equal(failed.entry.state, "retryable");
  const prepared = contract.retryGitHubCommand(failed.outbox, queued.entry.id, "2026-07-28T00:00:03.000Z");
  assert.equal(prepared.entry.state, "pending");
  assert.equal(prepared.entry.attempts, 1);
  assert.equal(prepared.entry.lastError, "GitHub temporarily unavailable");
  assert.equal(prepared.entry.nextAttemptAt, "");
  assert.throws(() => contract.retryGitHubCommand(prepared.outbox, queued.entry.id), /cannot be prepared for retry from pending/i);
});

test("issue #163 keeps authentication and review failures stopped for a person", async () => {
  const contract = await contractModule("lib/github-command-outbox.ts");
  const base = contract.enqueueGitHubCommand(contract.emptyGitHubCommandOutbox(), commandDraft());
  const sending = contract.markGitHubCommandSending(base.outbox, base.entry.id);
  const authentication = contract.recordGitHubCommandFailure(sending.outbox, base.entry.id, { status: 401, message: "Token expired" });
  assert.equal(authentication.entry.state, "needs-authentication");
  assert.throws(() => contract.retryGitHubCommand(authentication.outbox, base.entry.id), /needs-authentication/i);
  const reconnected = contract.retryGitHubCommand(authentication.outbox, base.entry.id, "2026-07-28T00:00:04.000Z", { authenticationReady: true });
  assert.equal(reconnected.entry.state, "pending");

  const second = contract.enqueueGitHubCommand(authentication.outbox, {
    ...commandDraft("Create Story Proposal"),
    type: "submit-proposal",
    payload: { selectedGroups: ["dialogue"] },
  });
  const secondSending = contract.markGitHubCommandSending(second.outbox, second.entry.id);
  const review = contract.recordGitHubCommandFailure(secondSending.outbox, second.entry.id, { status: 409, message: "Remote branch changed after preview" });
  assert.equal(review.entry.state, "needs-review");
  assert.throws(() => contract.retryGitHubCommand(review.outbox, second.entry.id, undefined, { authenticationReady: true }), /needs-review/i);
});

test("issue #163 cancellation preserves an audit entry and rejects unsafe states", async () => {
  const contract = await contractModule("lib/github-command-outbox.ts");
  const queued = contract.enqueueGitHubCommand(contract.emptyGitHubCommandOutbox(), commandDraft());
  const cancelled = contract.cancelGitHubCommand(queued.outbox, queued.entry.id);
  assert.equal(cancelled.entry.state, "cancelled");
  assert.equal(cancelled.outbox.entries.length, 1);
  assert.equal(cancelled.entry.payloadHash, queued.entry.payloadHash);
  assert.throws(() => contract.cancelGitHubCommand(cancelled.outbox, queued.entry.id), /cannot be cancelled from cancelled/i);

  const active = contract.enqueueGitHubCommand(contract.emptyGitHubCommandOutbox(), commandDraft("Submit proposal"));
  const sending = contract.markGitHubCommandSending(active.outbox, active.entry.id);
  assert.throws(() => contract.cancelGitHubCommand(sending.outbox, active.entry.id), /cannot be cancelled from sending/i);
  const completed = contract.markGitHubCommandCompleted(sending.outbox, active.entry.id);
  assert.throws(() => contract.cancelGitHubCommand(completed.outbox, active.entry.id), /cannot be cancelled from completed/i);
});

test("issue #163 summarizes green, amber, red and review-required recovery states", async () => {
  const recovery = await contractModule("lib/github-recovery-status.ts");
  assert.equal(recovery.summarizeGitHubRecovery([]).tone, "ready");
  const base = {
    version: 1,
    id: "ghcmd_123456789012345678901234",
    idempotencyKey: "plotpickle-gh-test",
    type: "publish-project",
    projectId: "afterglow",
    repository: "BryanHarrisScripts/Afterglow",
    branch: "main",
    baseCommit: "",
    payloadHash: "a".repeat(64),
    label: "Publish story",
    attempts: 1,
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
    lastAttemptAt: "",
    nextAttemptAt: "",
    completedAt: "",
    lastStatus: 0,
    lastError: "",
    failureClass: "",
  };
  assert.equal(recovery.summarizeGitHubRecovery([{ ...base, state: "retryable" }]).tone, "pending");
  assert.equal(recovery.summarizeGitHubRecovery([{ ...base, state: "needs-review" }]).tone, "review");
  assert.equal(recovery.summarizeGitHubRecovery([{ ...base, state: "needs-authentication" }, { ...base, id: "ghcmd_abcdefghijklmnopqrstuvwx", state: "needs-review" }]).tone, "authentication");
  assert.equal(recovery.summarizeGitHubRecovery([{ ...base, state: "completed" }]).activeCount, 0);
  assert.equal(recovery.summarizeGitHubRecovery([{ ...base, state: "completed" }]).terminalCount, 1);
});

test("issue #163 serves public snapshots and verifies authentication before retry", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-recovery-home-"));
  const { service, gateway, directory } = await gatewayContract(home);
  try {
    const queued = await service.enqueuePersistentGitHubCommand(commandDraft());
    await service.beginPersistentGitHubCommand(queued.entry.id);
    await service.failPersistentGitHubCommand(queued.entry.id, { status: 503, message: "GitHub unavailable" });

    let middleware;
    gateway.githubCommandGateway().configureServer({ middlewares: { use(handler) { middleware = handler; } } });
    assert.equal(typeof middleware, "function");

    const snapshot = await invokeGateway(middleware, "/api/local-github-commands");
    assert.equal(snapshot.statusCode, 200);
    assert.equal(snapshot.body.payloadsExposed, false);
    assert.equal(snapshot.body.commands[0].payload, undefined);
    assert.equal(snapshot.body.summary.tone, "pending");

    const retried = await invokeGateway(middleware, `/api/local-github-commands/${queued.entry.id}/retry`, "POST");
    assert.equal(retried.statusCode, 200);
    assert.equal(retried.body.command.state, "pending");

    const authDraft = { ...commandDraft("Publish after reconnect"), payload: { changedPaths: ["project/story/logline.json"] } };
    const auth = await service.enqueuePersistentGitHubCommand(authDraft);
    await service.beginPersistentGitHubCommand(auth.entry.id);
    await service.failPersistentGitHubCommand(auth.entry.id, { status: 401, message: "Token expired" });
    const blocked = await invokeGateway(middleware, `/api/local-github-commands/${auth.entry.id}/retry`, "POST");
    assert.equal(blocked.statusCode, 400);
    assert.match(blocked.body.message, /needs-authentication/i);

    process.env.PLOTPICKLE_TEST_GITHUB_CONNECTION = JSON.stringify({ readiness: { ready: true } });
    const reconnected = await invokeGateway(middleware, `/api/local-github-commands/${auth.entry.id}/retry`, "POST");
    assert.equal(reconnected.statusCode, 200);
    assert.equal(reconnected.body.command.state, "pending");

    const forbidden = await invokeGateway(middleware, "/api/local-github-commands", "GET", "192.0.2.1");
    assert.equal(forbidden.statusCode, 403);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    delete process.env.PLOTPICKLE_HOME;
    delete process.env.PLOTPICKLE_TEST_GITHUB_CONNECTION;
  }
});

test("issue #163 exposes a local-only public API without payloads", async () => {
  const [gateway, service] = await Promise.all([
    source("build/github-command-gateway.ts"),
    source("build/github-command-service.ts"),
  ]);
  for (const phrase of [
    'const API = "/api/local-github-commands"',
    'match[2] === "retry"',
    "cancelPersistentGitHubCommand",
    "retryPersistentGitHubCommand",
    "publicGitHubCommandEntry",
    "readCredentialJson",
    "authenticationReady",
    "payloadsExposed: false",
    "isLocalRequest",
    "GitHub recovery accepts requests only from this local PlotPickle server",
  ]) assert.ok(`${gateway}\n${service}`.includes(phrase), `Recovery API is missing: ${phrase}`);
  assert.doesNotMatch(gateway, /command\.payload|entry\.payload|Authorization|Bearer/);
});

test("issue #163 mounts a passive Recovery Centre inside collaboration", async () => {
  const [component, styles, collaboration, vite, docs] = await Promise.all([
    source("app/github-recovery-centre.tsx"),
    source("app/github-recovery-centre.module.css"),
    source("app/github-collaboration.tsx"),
    source("vite.config.ts"),
    source("docs/issue-163-github-recovery-centre.md"),
  ]);
  for (const phrase of [
    "GitHub Recovery Centre",
    "Passive by design",
    "No GitHub recovery work is waiting.",
    "Mark ready to retry",
    "Mark ready after reconnect",
    "Cancel command",
    "PlotPickle has not sent it automatically",
  ]) assert.ok(component.includes(phrase), `Recovery Centre is missing: ${phrase}`);
  for (const className of ["centre", "indicator", "boundary", "commands", "command", "cancel", "empty"]) {
    assert.ok(styles.includes(`.${className}`), `Recovery Centre styling is missing: ${className}`);
  }
  assert.match(collaboration, /import GitHubRecoveryCentre from "\.\/github-recovery-centre"/);
  assert.match(collaboration, /<GitHubRecoveryCentre connected=\{status\.connected\} ready=\{status\.ready\}/);
  assert.match(vite, /githubCommandGateway\(\)/);
  assert.doesNotMatch(component, /window\.fetch\s*=|globalThis\.fetch\s*=|setInterval\(/);
  assert.doesNotMatch(collaboration, /github-recovery-centre.*layout/i);
  for (const phrase of ["local-only API", "never leave the local server process", "does not replace `window.fetch`", "Phase 6C"]) {
    assert.ok(docs.includes(phrase), `Recovery documentation is missing: ${phrase}`);
  }
});

test("issue #163 focused test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  const phaseF = await source("tests/phase-f-collaboration-release.test.mjs");
  assert.equal(packageJson.scripts["test:github-recovery-centre"], "node --test tests/issue-163-github-recovery-centre.test.mjs");
  assert.match(phaseF, /issue-163-github-recovery-centre\.test\.mjs/);
});
