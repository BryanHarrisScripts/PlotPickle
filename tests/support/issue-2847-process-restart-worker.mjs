import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import { build } from "esbuild";

// This deliberately operates only on the isolated home injected by the parent.
// The script is executed TWICE by a parent test, in two different OS processes.
// Both instances use real PlotPickle auth, library and encrypted-vault owners.
const phase = process.argv[2];
assert.ok(phase === "save-and-lock" || phase === "recover");
const home = process.env.PLOTPICKLE_HOME;
assert.ok(home && path.basename(home).startsWith(".pp-save-001-restart-"),
  "PP-SAVE-001 worker requires its dedicated disposable test home");
assert.equal(process.env.PLOTPICKLE_ACCESS_MODE, "desktop-loopback");
const root = process.cwd();
const compileRoot = path.join(home, "compiler");
await mkdir(compileRoot, { recursive: true });
async function compile(contents, name) {
  const out = path.join(compileRoot, name + ".mjs");
  await build({ stdin: { contents, resolveDir: root, loader: "ts" },
    bundle: true, platform: "node", format: "esm", packages: "external",
    outfile: out, logLevel: "silent" });
  return import(pathToFileURL(out).href);
}
const runtime = await compile(
  'export {localProfileAuthGateway} from "./build/local-profile-auth-gateway.ts";export {resetProfileExperienceRuntime} from "./core/auth/profile-experience/profile-experience-runtime.ts";',
  "gateway");
const client = await compile(
  'export {browserProfileAuthGateway} from "./adapters/experience/browser-profile-auth-gateway.ts";' +
  'export {hydrateProfilePrivateBrowser,flushProfilePrivateWrites,getProfilePrivateSaveState} from "./core/storage/profile-private-browser.ts";' +
  'export {loadFoundationProject,saveFoundationProject} from "./core/storage/foundation-project-browser.ts";' +
  'export {switchActiveLibraryProject} from "./core/storage/project-library-browser.ts";' +
  'export {saveFoundationProjectDurably} from "./core/storage/project-library/revision-safe-browser.ts";' +
  'export {applyStoryCommand} from "./core/project/apply-command.ts";' +
  'export {isSavedLockedStoryboardImage} from "./core/contracts/build-progress.ts";',
  "client");
class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}
const priorWindow = globalThis.window;
const priorFetch = globalThis.fetch;
const windowFixture = new EventTarget();
windowFixture.localStorage = new MemoryStorage();
windowFixture.sessionStorage = new MemoryStorage();
windowFixture.setTimeout = setTimeout;
windowFixture.clearTimeout = clearTimeout;
globalThis.window = windowFixture;
let middleware;
runtime.localProfileAuthGateway().configureServer({ middlewares: { use(handler) {
  middleware = handler;
} } });
const server = createServer((request, response) => middleware(request, response, () => {
  response.statusCode = 404;
  response.end();
}));
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = "http://127.0.0.1:" + server.address().port;
let cookie = "";
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input, baseUrl);
  const headers = new Headers(options.headers);
  if (cookie) headers.set("Cookie", cookie);
  if (options.method === "POST") headers.set("Origin", baseUrl);
  const result = await priorFetch(url, { ...options, headers });
  const setCookie = result.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return result;
};
const syntheticCredential = "pp-save-001-isolated-process-restart-fixture-only";
async function vaultProject(projectId) {
  const response = await fetch("/api/auth/profile-private");
  assert.equal(response.status, 200, "read back from the actual encrypted profile API");
  const data = await response.json();
  const record = (data.projects ?? []).find((item) => item.project?.id === projectId);
  assert.ok(record, "the encrypted vault must hold the exact named story");
  return record.project;
}
function artwork(project, id) {
  const artifact = project.build.foundations.visualArtifacts.find((a) => a.id === id);
  assert.ok(artifact, "selected Storyboard artifact identity must still exist");
  return artifact;
}
async function sha256(assetUrl) {
  assert.match(assetUrl, /^\/assets\/library\/examples\/[a-zA-Z0-9_./-]+\.webp$/u);
  assert.ok(!assetUrl.includes(".."), "reject traversal from a persisted media URL");
  return createHash("sha256").update(await readFile(path.join(root, "public", assetUrl))).digest("hex");
}
try {
  if (phase === "save-and-lock") {
    const created = await client.browserProfileAuthGateway.createFirstProfile({
      displayName: "PP-SAVE-001 isolated test profile", credential: syntheticCredential, bootstrapProof: "",
    });
    assert.ok(created.profile.profileId);
    const loggedIn = await client.browserProfileAuthGateway.authenticate(created.profile.profileId, syntheticCredential);
    assert.equal(loggedIn.authenticated, true);
    const status = await (await fetch("/api/auth/profile")).json();
    assert.equal(status.authenticated, true);
    await client.hydrateProfilePrivateBrowser(status.profile.profileId, status.csrfToken);
    const packaged = JSON.parse(await readFile("data/afterglow-packaged-current/snapshot.json", "utf8")).project;
    const selected = packaged.build.foundations.visualArtifacts.find((item) =>
      item.frameNumber === 1 && item.workflow === "storyboard-frame-webp-v2"
      && item.assetUrl.startsWith("/assets/library/examples/")
      && (item.sourceDecisionKeys ?? []).includes("storyboard-anchor:block:block-01:mini-1"));
    assert.ok(selected, "committed packaged Afterglow Shot 1 must exist");
    const project = {
      ...packaged,
      id: "pp-save-001-restart-fixture",
      build: { ...packaged.build, foundations: {
        ...packaged.build.foundations, visualArtifacts: [], acceptedVisualArtifactIds: [],
      } },
    };
    const draft = {
      ...selected, reviewState: "draft",
      sourceDecisionKeys: (selected.sourceDecisionKeys ?? []).filter((key) => key !== "storyboard-local-save:v1"),
    };
    const initial = client.applyStoryCommand(project, {
      type: "foundations.visual.store", artifact: draft, occurredAt: project.updatedAt,
    });
    client.saveFoundationProject(initial);
    await client.flushProfilePrivateWrites();
    const source = await readFile("app/_components/storyboard/storyboard-readiness-workspace.tsx", "utf8");
    const handlers = stripTypeScriptTypes(source.slice(
      source.search(/  (?:async )?function saveFrameVersion\(/u),
      source.indexOf("  const normalizedSourceEvidence")));
    const notices = [];
    const context = vm.createContext({
      ...client, Error, project: initial, qaOnlyAccess: false, frameBusy: false,
      frameMutation: { current: false }, selectedNumber: 1, selectedMiniBlockNumber: 1,
      STORYBOARD_LOCAL_SAVE_MARKER: "storyboard-local-save:v1",
      isSupportedVisualAssetUrl: (value) => typeof value === "string"
        && (value.startsWith("/api/local-ai/assets/") || value.startsWith("/assets/library/examples/")),
      storyboardArtifactSavedLocally: (a) => (a.sourceDecisionKeys ?? []).includes("storyboard-local-save:v1"),
      setFrameSaving() {}, setFrameNotice(message) { notices.push(message); },
      setFrameNoticePosition() {}, setSelectedImageByPosition() {},
      setPendingDeleteArtifactId() {}, onProjectChange() {},
    });
    vm.runInContext(handlers, context);
    await context.saveFrameVersion(draft);
    assert.match(notices.at(-1), /saved locally with this story/u);
    assert.equal(client.getProfilePrivateSaveState().state, "saved");
    await context.reviewFrame(draft, "accept");
    assert.match(notices.at(-1), /kept and locked/u);
    const saved = client.loadFoundationProject();
    const persisted = await vaultProject(saved.id);
    const savedArtifact = artwork(persisted, draft.id);
    assert.equal(savedArtifact.reviewState, "accepted");
    assert.ok((savedArtifact.sourceDecisionKeys ?? []).includes("storyboard-local-save:v1"));
    assert.ok(persisted.build.foundations.acceptedVisualArtifactIds.includes(savedArtifact.id));
    assert.equal(client.isSavedLockedStoryboardImage(savedArtifact,
      new Set(persisted.build.foundations.acceptedVisualArtifactIds)), true);
    const digest = await sha256(savedArtifact.assetUrl);
    const expected = {
      profileId: created.profile.profileId, projectId: persisted.id,
      artifactId: savedArtifact.id, assetUrl: savedArtifact.assetUrl,
      revision: persisted.revision, digest, originalPid: process.pid,
    };
    await writeFile(path.join(home, "expected.json"), JSON.stringify(expected, null, 2) + "\n");
    process.stdout.write(JSON.stringify({
      phase, pid: process.pid, projectId: persisted.id,
      artifactId: savedArtifact.id, revision: persisted.revision, digest,
    }) + "\n");
  } else {
    const expected = JSON.parse(await readFile(path.join(home, "expected.json"), "utf8"));
    assert.notEqual(process.pid, expected.originalPid);
    const login = await client.browserProfileAuthGateway.authenticate(expected.profileId, syntheticCredential);
    assert.equal(login.authenticated, true, "new process must independently reauthenticate");
    const status = await (await fetch("/api/auth/profile")).json();
    assert.equal(status.authenticated, true);
    await client.hydrateProfilePrivateBrowser(status.profile.profileId, status.csrfToken);
    const persisted = await vaultProject(expected.projectId);
    client.switchActiveLibraryProject(expected.projectId);
    const reloaded = client.loadFoundationProject();
    const a = artwork(reloaded, expected.artifactId);
    const vaultA = artwork(persisted, expected.artifactId);
    assert.equal(reloaded.revision, expected.revision);
    assert.equal(persisted.revision, expected.revision);
    assert.equal(a.assetUrl, expected.assetUrl);
    assert.deepEqual(a, vaultA, "reopened selected artifact must match encrypted vault readback");
    assert.equal(a.reviewState, "accepted");
    assert.ok((a.sourceDecisionKeys ?? []).includes("storyboard-local-save:v1"));
    assert.ok(reloaded.build.foundations.acceptedVisualArtifactIds.includes(expected.artifactId));
    const digest = await sha256(a.assetUrl);
    assert.equal(digest, expected.digest, "same packaged image bytes must survive process restart");
    const previsEligible = client.isSavedLockedStoryboardImage(a,
      new Set(reloaded.build.foundations.acceptedVisualArtifactIds));
    assert.equal(previsEligible, true, "Previs same-artifact predicate requires both Save and Lock");
    const observed = {
      originalPid: expected.originalPid, newPid: process.pid,
      projectId: reloaded.id, artifactId: a.id, revision: reloaded.revision,
      assetUrl: a.assetUrl, digest, saved: true, locked: true, previsEligible,
    };
    await writeFile(path.join(home, "observed.json"), JSON.stringify(observed, null, 2) + "\n");
    process.stdout.write(JSON.stringify({ phase, pid: process.pid, ...observed }) + "\n");
  }
} finally {
  globalThis.fetch = priorFetch;
  if (priorWindow === undefined) delete globalThis.window;
  else globalThis.window = priorWindow;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await runtime.resetProfileExperienceRuntime();
}
