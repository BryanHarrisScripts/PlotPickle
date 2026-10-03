import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import { createInMemoryAuthStateStore, createPlotPickleAuthService } from "../core/auth/plotpickle-auth-core.mjs";
import { createProfilePrivateStorageService } from "../core/storage/profile-private/profile-private-storage-core.mjs";
import { createServerSessionBoundary } from "../core/auth/server-session/server-session-boundary-core.mjs";

const temp = await mkdtemp(path.resolve("node_modules/.outline-gateway-test-"));
await build({ stdin: { contents: `
export { storyArchitectTokenUpperBound } from "./build/mastra-agent-runtime.ts";
export { createOutlineTaskGateway, outlineCredentialReceipt } from "./build/projects/outline-task-gateway.ts";
export { createOutlineTaskHttpHandlers } from "./build/projects/outline-task-http.ts";
export { normalizeLibraryProject } from "./core/storage/library-project.ts";
export { outlineAssessmentMaterialReceipt } from "./modules/plan/outline-agent-assessment.ts";
export { importOutlineTaskFindings } from "./modules/plan/assessments/outline-task-browser.ts";
`, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", packages: "external", outfile: path.join(temp, "test.mjs"), logLevel: "silent" });
const { storyArchitectTokenUpperBound, createOutlineTaskGateway, outlineCredentialReceipt, createOutlineTaskHttpHandlers, normalizeLibraryProject, outlineAssessmentMaterialReceipt, importOutlineTaskFindings } = await import(pathToFileURL(path.join(temp, "test.mjs")).href);
test.after(() => rm(temp, { recursive: true, force: true }));
const output = JSON.stringify({ structural: { state: "unresolved", reason: "Synthetic supplied material does not establish a turn.", passageIds: [] }, characters: [], miniBlocks: [1,2,3,4].map((ordinal) => ({ ordinal, state: "unsupported", reason: "No synthetic screenplay supplied.", passageIds: [], storyboardCue: "" })) });

test("credential recovery identity survives reopen and changes on rotation or profile change", async () => {
  const first = await outlineCredentialReceipt("synthetic-key-before", "synthetic-profile-a");
  assert.equal(await outlineCredentialReceipt("synthetic-key-before", "synthetic-profile-a"), first);
  assert.notEqual(await outlineCredentialReceipt("synthetic-key-after", "synthetic-profile-a"), first);
  assert.notEqual(await outlineCredentialReceipt("synthetic-key-before", "synthetic-profile-b"), first);
  assert.match(first, /^[a-f0-9]{64}$/u);
  assert.equal(await outlineCredentialReceipt("", "synthetic-profile-a"), "unconfigured");
});

async function fixture(t) {
  const home = await mkdtemp(path.join(temp, "private-"));
  const auth = await createPlotPickleAuthService({ nodeId: "synthetic-gateway", accessMode: "desktop-loopback", stateStore: createInMemoryAuthStateStore() });
  const owner = await auth.createFirstProfile({ displayName: "Synthetic owner", password: "Synthetic long password gateway 2711" });
  const privateStorage = createProfilePrivateStorageService({ root: home, authService: auth, normalizeProject: normalizeLibraryProject });
  const project = normalizeLibraryProject({ id: "gateway-project", title: "Synthetic gateway story" });
  await privateStorage.saveProject(owner.authContext, { project, activate: true });
  const boundary = createServerSessionBoundary({ authService: auth, exposure: { accessMode: "desktop-loopback", externalOrigin: "http://127.0.0.1:3000", allowedOrigins: ["http://127.0.0.1:3000"], allowedHosts: ["127.0.0.1:3000"] } });
  const runtime = { auth, privateStorage, home, boundaryFor: () => boundary };
  const browser = auth.createBrowserSession(owner.authContext, { deviceLabel: "Fixture", originLabel: "127.0.0.1:3000" });
  let calls = 0, opens = 0;
  let blockAfter = Infinity;
  let entered;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const started = new Promise((resolve) => { entered = resolve; });
  const ports = {
    resolveExecution: async () => ({ provider: "local", model: "synthetic", receipt: "fixture-route-v1", grantedCapabilities: ["project-context-read", "proposal-draft"], tokenUpperBound: 2000, cloudCostUpperBoundUsd: 0,
      execute: async (input) => { calls++; if (calls > blockAfter) { entered(); await gate; input.signal.throwIfAborted(); } await input.onAssessmentUsage({ totalTokens: 90 }); return output; } }),
    openScheduler: async (_id, controller) => { opens++; let closed = false; return {
      async run(input) { for (const step of input.steps) { if (closed) return false; await controller.authorize(input.scope, step); await controller.executeStep(input.scope, step); } return true; },
      async close() { closed = true; release(); },
    }; },
  };
  let host = createOutlineTaskGateway(runtime, ports);
  const http = createOutlineTaskHttpHandlers(async () => runtime, () => host);
  function request(method, body, { cookie = true, csrf = true, origin = "http://127.0.0.1:3000" } = {}) {
    return new Request("http://127.0.0.1:3000/api/outline/tasks", { method, headers: { host: "127.0.0.1:3000", origin,
      ...(cookie ? { cookie: `ppsid=${browser.cookieValue}` } : {}), ...(csrf ? { "X-PlotPickle-CSRF": browser.csrfToken } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  t.after(async () => { release(); await host.close(); privateStorage.close(); auth.close(); await rm(home, { recursive: true, force: true }); });
  return { auth, context: owner.authContext, project, privateStorage, http, request, started,
    get host() { return host; }, get calls() { return calls; }, get opens() { return opens; }, set blockAfter(value) { blockAfter = value; },
    async reopen() { release(); await host.close(); host = createOutlineTaskGateway(runtime, ports); },
    async start() { return http.POST(request("POST", { action: "start", blocks: [1,2,3,4,5,6], projectId: project.id, materialReceipt: await outlineAssessmentMaterialReceipt(project) })); },
  };
}
async function settled(f, id) {
  for (let i = 0; i < 100; i++) { const task = await f.host.status(f.context, id); if (!task.running) return task; await new Promise((resolve) => setTimeout(resolve, 10)); }
  assert.fail("Task did not settle");
}

test("authenticated HTTP rejects missing CSRF, foreign origin and task/profile/project claims before inference", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.http.GET(f.request("GET", null, { cookie: false }))).status, 403);
  for (const options of [{ csrf: false }, { origin: "http://evil.example" }, { cookie: false }]) {
    const response = await f.http.POST(f.request("POST", { action: "start", projectId: f.project.id, blocks: [1] }, options));
    assert.notEqual(response.status, 202);
  }
  assert.equal((await f.http.POST(f.request("POST", { action: "start", projectId: "foreign", blocks: [1] }))).status, 409);
  assert.equal((await f.http.POST(f.request("POST", { action: "resume", projectId: f.project.id, taskId: "../foreign" }))).status, 400);
  assert.equal(f.calls, 0); assert.equal(f.opens, 0);
});

test("HTTP task discovery is inference-free; duplicate starts share one protected admission and import is idempotent", async (t) => {
  const f = await fixture(t); f.blockAfter = 0;
  assert.deepEqual((await (await f.http.GET(f.request("GET"))).json()).tasks, []);
  const [a, b] = await Promise.all([f.start(), f.start()]);
  assert.equal(a.status, 202); assert.equal(b.status, 202);
  const first = (await a.json()).task, second = (await b.json()).task;
  assert.equal(first.scope.runId, second.scope.runId);
  await f.started;
  assert.equal(f.opens, 1); assert.equal(f.calls, 1);
  await f.host.cancel(f.context, first.scope.runId);
  const cancelled = await settled(f, first.scope.runId);
  assert.equal(cancelled.run.state, "cancelled");
  assert.equal(cancelled.proposals.length, 0);
  await assert.rejects(f.host.resume(f.context, first.scope.runId), /cancelled/);
  assert.equal(f.opens, 1);
  await assert.rejects(f.host.resume(f.context, "outline-task-00000000-0000-0000-0000-000000000000"));
});

test("saved advisory results import once, survive gateway reopen, and stale material is rejected", async (t) => {
  const f = await fixture(t);
  const response = await f.start(); assert.equal(response.status, 202);
  const id = (await response.json()).task.scope.runId;
  const task = await settled(f, id);
  assert.equal(task.run.state, "waiting-for-writer"); assert.equal(f.calls, 6);
  const imported = await importOutlineTaskFindings(f.project, task);
  assert.equal(imported.sourceEvidence.outlineAssessmentRuns.length, 1);
  assert.equal(imported.sourceEvidence.outlineAssessments.length, 6);
  assert.deepEqual(imported.structure, f.project.structure);
  assert.equal(await importOutlineTaskFindings(imported, task), imported);
  await f.reopen();
  const discovery = (await (await f.http.GET(f.request("GET"))).json()).tasks;
  assert.equal(discovery.length, 1); assert.equal(f.calls, 6); assert.equal(f.opens, 1);
  await assert.rejects(importOutlineTaskFindings({ ...imported, title: "Writer edited title" }, task), /changed story material/);
  const other = await f.auth.createProfile({ displayName: "Other", password: "Synthetic long password gateway 2711" }, f.context);
  assert.deepEqual(await f.host.list(other.authContext), []);
  await assert.rejects(f.host.status(other.authContext, id), /not found/);
});


test("configured worker reservation covers worst-case bounded serialization and its retry", () => {
  const quote = storyArchitectTokenUpperBound();
  assert.ok(Number.isSafeInteger(quote));
  assert.ok(quote >= 2 * (12_000 * 6 + 1800 + 8192));
  assert.ok(6 * quote <= 2_000_000, "All six Blocks fit the unchanged Act review budget.");
  assert.throws(() => storyArchitectTokenUpperBound(12_001), /context bound/);
});
