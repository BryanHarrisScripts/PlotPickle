import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (file) => readFile(new URL(file, root), "utf8");

async function contract(file) {
  const raw = (await source(file)).replace(/\r\n?/g, "\n").replace(/^import type[^;]+;\n/gm, "");
  return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(raw, { mode: "transform" })).toString("base64")}`);
}

function invoke(handler, url, method = "GET", body, remoteAddress = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
    const request = { method, url, socket: { remoteAddress }, headers: { host: "127.0.0.1:4173", origin: "http://127.0.0.1:4173" }, async *[Symbol.asyncIterator]() { yield* chunks; } };
    const response = { statusCode: 0, headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(value = "{}") { try { resolve({ status: this.statusCode, body: JSON.parse(value) }); } catch (error) { reject(error); } } };
    handler(request, response, () => reject(new Error("Recovery request bypassed its gateway.")));
  });
}

async function runtimeGateway() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "plotpickle-165-"));
  const imports = {
    '../lib/github-repository-recovery': './github-repository-recovery.mjs',
    '../lib/collaboration-invitations': './collaboration-invitations.mjs',
    '../lib/github-command-outbox': './github-command-outbox.mjs',
    '../lib/story-project-repository': './story-project-repository.mjs',
    './github-command-service': './github-command-service.mjs',
    './local-credentials': './local-credentials.mjs',
  };
  let gateway = (await source("build/github-repository-recovery-gateway.ts")).replace(/\r\n?/g, "\n");
  for (const [from, to] of Object.entries(imports)) gateway = gateway.replaceAll(`from "${from}"`, `from "${to}"`);
  const recovery = (await source("lib/github-repository-recovery.ts")).replace(/\r\n?/g, "\n").replace('from "./github-command-outbox"', 'from "./github-command-outbox.mjs"');
  const outbox = (await source("lib/github-command-outbox.ts")).replace(/\r\n?/g, "\n");
  await Promise.all([
    writeFile(path.join(directory, "gateway.mjs"), stripTypeScriptTypes(gateway, { mode: "transform" })),
    writeFile(path.join(directory, "github-repository-recovery.mjs"), stripTypeScriptTypes(recovery, { mode: "transform" })),
    writeFile(path.join(directory, "github-command-outbox.mjs"), stripTypeScriptTypes(outbox, { mode: "transform" })),
    writeFile(path.join(directory, "collaboration-invitations.mjs"), 'export const createCollaborationPolicy=(projectId,updatedBy)=>({projectId,updatedBy}); export const parseCollaborationPolicy=(value)=>value;'),
    writeFile(path.join(directory, "story-project-repository.mjs"), 'export const STORY_PROJECT_MANIFEST_PATH="plotpickle-project.json"; export const inspectStoryProjectManifest=(value)=>({manifest:{...value,canonicalProject:{root:"project"}}});'),
    writeFile(path.join(directory, "github-command-service.mjs"), 'export async function readGitHubCommandOutbox(){return {entries:globalThis.__OUTBOX||[]};}'),
    writeFile(path.join(directory, "local-credentials.mjs"), 'export async function readCredentialJson(name){return structuredClone(globalThis.__CREDS[name]??null)} export async function writeCredentialJson(name,value){globalThis.__CREDS[name]=structuredClone(value)}'),
  ]);
  return { directory, module: await import(`${pathToFileURL(path.join(directory, "gateway.mjs")).href}?${Date.now()}`) };
}

function manifest(projectId = "afterglow") {
  return { format: "plotpickle-story-project", formatVersion: "1.1.0", schemaVersion: "2.3.0", projectId, title: "Afterglow", repository: { owner: "NewOwner", name: "Afterglow-Renamed", defaultBranch: "main" }, canonicalProject: { root: "project" }, portableProject: { path: "stories/afterglow.ppf", legacyCanonicalPath: "stories/afterglow.ppf" } };
}

test("issue #165 verifies same-project repository and branch recovery candidates", async () => {
  const recovery = await contract("lib/github-repository-recovery.ts");
  assert.equal(recovery.repositoryMoved("OldOwner/Afterglow", "NewOwner/Afterglow-Renamed"), true);
  assert.equal(recovery.assertRecoveryProjectIdentity("afterglow", "afterglow"), "afterglow");
  assert.throws(() => recovery.assertRecoveryProjectIdentity("afterglow", "other"), /different PlotPickle project/i);
  const branches = recovery.verifiedRecoveryBranches([{ name: "recovery", commitSha: "a".repeat(40), projectId: "afterglow" }, { name: "wrong", commitSha: "b".repeat(40), projectId: "other" }], "afterglow");
  assert.deepEqual(branches.map((item) => item.name), ["recovery"]);
  const conflict = recovery.conflictReviewCandidates([{ version: 1, id: "one", idempotencyKey: "key", type: "submit-proposal", projectId: "afterglow", repository: "NewOwner/Afterglow-Renamed", branch: "main", baseCommit: "a".repeat(40), payloadHash: "b".repeat(64), label: "Proposal", state: "needs-review", attempts: 1, createdAt: "2026-07-28T00:00:00.000Z", updatedAt: "2026-07-28T00:00:00.000Z", lastAttemptAt: "", nextAttemptAt: "", completedAt: "", lastStatus: 409, lastError: "Branch changed", failureClass: "review-required" }])[0];
  assert.equal(conflict.expectedCommit, "a".repeat(40));
  assert.equal(conflict.payload, undefined);
});

test("issue #165 runtime diagnosis and branch recreation remain local, verified and non-forced", async () => {
  globalThis.__CREDS = {
    "github-connection.json": { version: 1, owner: "OldOwner", repo: "Afterglow", branch: "main", projectPath: "stories/afterglow.ppf", token: "secret", login: "NewOwner", verifiedAt: "2026-07-28T00:00:00.000Z", readiness: { ready: false } },
    "github-project-sync.json": { version: 1, repository: "OldOwner/Afterglow", branch: "main", projectId: "afterglow", remoteCommit: "a".repeat(40) },
  };
  globalThis.__OUTBOX = [];
  const writes = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const pathname = new URL(String(input)).pathname;
    const method = String(init.method || "GET");
    if (pathname === "/repos/OldOwner/Afterglow") return Response.json({ full_name: "NewOwner/Afterglow-Renamed", default_branch: "main" });
    if (pathname === "/repos/NewOwner/Afterglow-Renamed/git/ref/heads/main") return Response.json({ message: "Reference not found" }, { status: 404 });
    if (pathname === "/repos/NewOwner/Afterglow-Renamed/branches") return Response.json([{ name: "recovery", commit: { sha: "b".repeat(40) } }]);
    if (pathname.includes("/contents/plotpickle-project.json")) return Response.json({ content: Buffer.from(JSON.stringify(manifest())).toString("base64") });
    if (pathname.endsWith(`/commits/${"a".repeat(40)}`)) return Response.json({ sha: "a".repeat(40) });
    if (pathname === "/repos/NewOwner/Afterglow-Renamed/contents/project/collaboration/policy.json") return Response.json({ message: "Not found" }, { status: 404 });
    if (pathname === "/user") return Response.json({ login: "NewOwner" });
    if (pathname === "/repos/NewOwner/Afterglow-Renamed/git/refs" && method === "POST") { const value = JSON.parse(String(init.body)); writes.push(value); return Response.json({ ref: value.ref }, { status: 201 }); }
    return Response.json({ message: `Unexpected ${method} ${pathname}` }, { status: 500 });
  };
  const { directory, module } = await runtimeGateway();
  try {
    let handler;
    module.githubRepositoryRecoveryGateway().configureServer({ middlewares: { use(value) { handler = value; } } });
    const diagnosis = await invoke(handler, "/api/local-github-repository-recovery");
    assert.equal(diagnosis.status, 200);
    assert.equal(diagnosis.body.diagnosis.state, "branch-missing");
    assert.equal(diagnosis.body.diagnosis.canAdoptRepository, true);
    assert.equal(diagnosis.body.diagnosis.canRecreateBranch, true);
    const recreated = await invoke(handler, "/api/local-github-repository-recovery/recreate-branch", "POST", {});
    assert.equal(recreated.status, 200);
    assert.deepEqual(writes, [{ ref: "refs/heads/main", sha: "a".repeat(40) }]);
    assert.equal("force" in writes[0], false);
    assert.equal(recreated.body.payloadsExposed, false);
    assert.equal(recreated.body.requiresReadinessCheck, true);
    assert.equal(globalThis.__CREDS["github-connection.json"].readiness.ready, false);
    assert.equal(globalThis.__CREDS["github-project-sync.json"].repository, "NewOwner/Afterglow-Renamed");
    const forbidden = await invoke(handler, "/api/local-github-repository-recovery", "GET", undefined, "192.0.2.1");
    assert.equal(forbidden.status, 403);
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__CREDS;
    delete globalThis.__OUTBOX;
    await rm(directory, { recursive: true, force: true });
  }
});

test("issue #165 mounts guarded recovery without browser interception or automatic conflict resolution", async () => {
  const [gateway, wrapper, repository, styles, vite, docs] = await Promise.all([source("build/github-repository-recovery-gateway.ts"), source("app/github-recovery-centre.tsx"), source("app/github-repository-recovery.tsx"), source("app/github-recovery-centre.module.css"), source("vite.config.ts"), source("docs/issue-165-github-repository-recovery.md")]);
  for (const phrase of ["Only the Project Lead workspace", "readiness: { ready: false", "requiresReadinessCheck: true", "payloadsExposed: false", "refs/heads/", "same-project recovery choices"]) assert.ok(gateway.includes(phrase), `Gateway missing ${phrase}`);
  assert.doesNotMatch(gateway, /force:\s*true/);
  assert.match(wrapper, /GitHubCommandRecoveryCentre/);
  for (const phrase of ["Guarded repository recovery", "Project Lead: adopt repository", "Verified existing branches", "Project Lead: recreate approved branch", "Conflict review candidates", "will never force-push"]) assert.ok(repository.includes(phrase), `UI missing ${phrase}`);
  assert.doesNotMatch(repository, /window\.fetch\s*=|setInterval\(/);
  for (const className of ["repositoryRecovery", "diagnosis", "recoveryChoice", "branchChoices", "conflicts"]) assert.ok(styles.includes(`.${className}`));
  assert.match(vite, /githubRepositoryRecoveryGateway\(\)/);
  for (const phrase of ["same PlotPickle project identity", "non-forced", "Project Lead", "review candidate", "No automatic conflict resolution"]) assert.ok(docs.includes(phrase));
});

test("issue #165 focused test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.equal(packageJson.scripts["test:github-repository-recovery"], "node --test tests/issue-165-github-repository-recovery.test.mjs");
  assert.match(await source("tests/phase-f-collaboration-release.test.mjs"), /issue-165-github-repository-recovery\.test\.mjs/);
});
