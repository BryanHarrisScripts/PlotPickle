import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
test("#2835 real HTTP sign-in isolates browser remnants and protected Afterglow working copies", async (t) => {
  const originalWindow = globalThis.window;
  const previousHome = process.env.PLOTPICKLE_HOME;
  const previousState = process.env.PLOTPICKLE_AUTH_STATE_PATH;
  const require2 = createRequire(path.join(process.cwd(), "package.json"));
  const { build } = require2("esbuild");
  const temporary = await mkdtemp(path.resolve("node_modules/.startup-account-audit-"));
  process.env.PLOTPICKLE_HOME = temporary;
  process.env.PLOTPICKLE_AUTH_STATE_PATH = path.join(temporary, "auth/state.json");
  process.env.PLOTPICKLE_ACCESS_MODE = "desktop-loopback";
  const compile = async (contents, file) => {
    const outfile = path.join(temporary, file);
    await build({ stdin: { contents, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", packages: "external", outfile, logLevel: "silent" });
    return import(pathToFileURL(outfile).href);
  };
  const serverModule = await compile('export {localProfileAuthGateway} from "./build/local-profile-auth-gateway.ts"; export {resetProfileExperienceRuntime} from "./core/auth/profile-experience/profile-experience-runtime.ts";', "server.mjs");
  let middleware;
  serverModule.localProfileAuthGateway().configureServer({ middlewares: { use(handler) {
    middleware = handler;
  } } });
  const server = createServer((req, res) => middleware(req, res, () => {
    res.statusCode = 404;
    res.end();
  }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  class Storage {
    map = /* @__PURE__ */ new Map();
    get length() {
      return this.map.size;
    }
    key(i) {
      return [...this.map.keys()][i] ?? null;
    }
    getItem(k) {
      return this.map.get(k) ?? null;
    }
    setItem(k, v) {
      this.map.set(k, String(v));
    }
    removeItem(k) {
      this.map.delete(k);
    }
    clear() {
      this.map.clear();
    }
  }
  const window = new EventTarget();
  window.localStorage = new Storage();
  window.sessionStorage = new Storage();
  window.setTimeout = setTimeout;
  window.clearTimeout = clearTimeout;
  globalThis.window = window;
  const nativeFetch = globalThis.fetch;
  let cookie = "";
  const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input, base);
    const headers = new Headers(init.headers);
    if (cookie) headers.set("Cookie", cookie);
    if (init.method === "POST") headers.set("Origin", base);
    const response = await nativeFetch(url, { ...init, headers });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    requests.push({ path: url.pathname, method: init.method || "GET", action: init.body ? JSON.parse(init.body).action : null, status: response.status });
    return response;
  };
  const client = await compile('export {browserProfileAuthGateway} from "./adapters/experience/browser-profile-auth-gateway.ts"; export * from "./core/storage/project-library-browser.ts"; export {persistActiveProfileProject,flushProfilePrivateWrites} from "./core/storage/profile-private-browser.ts"; export {createAfterglowPackagedCurrentReference} from "./modules/library/reference/afterglow-packaged-current.ts"; export {createEmptyProject} from "./core/project/project.ts"; export {afterglowRestoreChoices} from "./modules/library/afterglow-open-contract.ts";', "client.mjs");
  const observations = [];
  const observe = (name, details) => {
    observations.push({ name, ...details });
    t.diagnostic(JSON.stringify(observations.at(-1)));
  };
  const privateState = async () => {
    const r = await fetch("/api/auth/profile-private");
    assert.equal(r.status, 200);
    return r.json();
  };
  const credential = "isolated startup audit passphrase 2026";
  try {
    const initial = await client.browserProfileAuthGateway.read();
    assert.equal(initial.configured, false);
    assert.equal(initial.authenticated, false);
    observe("fresh-auth-boundary", { status: "PASS" });
    const created = await client.browserProfileAuthGateway.createFirstProfile({ displayName: "Startup Audit Human", credential, bootstrapProof: "" });
    assert.ok(created.profile.profileId);
    const profileId = created.profile.profileId;
    const login = await client.browserProfileAuthGateway.authenticate(profileId, credential);
    assert.equal(login.authenticated, true);
    assert.equal(login.profile.profileId, profileId);
    const fresh = await privateState();
    assert.equal(fresh.projects.length, 0);
    assert.equal(client.hasActiveLibraryProject(), false);
    observe("sign-in-and-empty-library", { status: "PASS", projects: 0, activeBrowserProject: false });
    const packaged = client.createAfterglowPackagedCurrentReference();
    const t2 = performance.now();
    const working = client.createLibraryWorkingCopy({ sourceProject: packaged, sourceKind: "example", sourceId: client.AFTERGLOW_EXAMPLE_DEFAULTS_SOURCE_ID, title: packaged.title, genre: "Science fiction", format: "feature" });
    await client.persistActiveProfileProject();
    await client.flushProfilePrivateWrites();
    let saved = await privateState();
    assert.equal(saved.projects.length, 1, "one example must persist only one story");
    assert.equal(saved.project.id, working.id);
    assert.ok(saved.projects.some((x) => x.project.id === working.id));
    assert.notEqual(working.id, packaged.id);
    observe("open-packaged-afterglow-and-encrypted-save", { status: "PASS", elapsedMs: Math.round(performance.now() - t2), projectCount: saved.projects.length, title: working.title, visualArtifacts: working.build.foundations.visualArtifacts.length, inventory: saved.projects.map((x) => ({ title: x.project.title, revision: x.project.revision, sourceKind: x.summary.sourceKind, sourceId: x.summary.sourceId, createdAt: x.project.createdAt, updatedAt: x.project.updatedAt })) });
    await client.browserProfileAuthGateway.logout();
    assert.equal(client.hasActiveLibraryProject(), false);
    const relogin = await client.browserProfileAuthGateway.authenticate(profileId, credential);
    assert.equal(relogin.authenticated, true);
    saved = await privateState();
    assert.equal(saved.activeProjectId, null, "fresh login cannot reactivate a durable last-project pointer");
    assert.equal(client.hasActiveLibraryProject(), false);
    assert.ok(saved.projects.some((x) => x.project.id === working.id));
    observe("sign-out-and-sign-in-with-saved-afterglow", { status: "PASS", browserProjectRemainsUnselected: true, backendReturnsActiveProject: Boolean(saved.activeProjectId) });
    await client.browserProfileAuthGateway.logout();
    await serverModule.resetProfileExperienceRuntime();
    cookie = "";
    const restarted = await client.browserProfileAuthGateway.authenticate(profileId, credential);
    assert.equal(restarted.authenticated, true);
    const durable = await privateState();
    assert.ok(durable.projects.some((x) => x.project.id === working.id));
    assert.equal(client.hasActiveLibraryProject(), false);
    observe("restart-auth-runtime-and-sign-in", { status: "PASS", savedAfterglowPresent: true, browserProjectRemainsUnselected: true });
    await client.browserProfileAuthGateway.logout();
    const stale = { ...working, title: "STALE BROWSER COPY", revision: 0, updatedAt: "2020-01-01T00:00:00.000Z" };
    window.localStorage.setItem("plotpickle.library.profile.v1.profile_FOREIGN.projects." + working.id, JSON.stringify({ profileId: "profile_FOREIGN", projectId: working.id, project: stale }));
    const foreign = { ...working, id: "foreign-browser-project", title: "FOREIGN BROWSER PROJECT" };
    window.localStorage.setItem("plotpickle.library.profile.v1.profile_OTHER.projects.foreign-browser-project", JSON.stringify({ profileId: "profile_OTHER", projectId: foreign.id, project: foreign }));
    window.sessionStorage.setItem("plotpickle.library.profile.v1." + profileId + ".projects." + working.id, JSON.stringify({ profileId, projectId: working.id, project: { ...stale, updatedAt: "2099-01-01T00:00:00.000Z" } }));
    requests.length = 0;
    await client.browserProfileAuthGateway.authenticate(profileId, credential);
    const migrated = await privateState();
    const overwritten = migrated.projects.find((x) => x.project.id === working.id);
    const foreignImported = migrated.projects.some((x) => x.project.id === foreign.id);
    assert.equal(overwritten.project.title, working.title, "login must retain durable Afterglow");
    assert.equal(foreignImported, false, "foreign-labelled browser records cannot enter the vault");
    assert.equal(requests.filter((x) => x.method === "POST" && x.path === "/api/auth/profile-private").length, 0, "login must make no private-state mutations");
    assert.equal(window.localStorage.length, 2, "legacy local records remain untouched");
    assert.ok([...window.sessionStorage.map.keys()].some((k) => k.includes(".quarantine.")), "session remnants remain available for recovery");
    assert.equal(migrated.activeProjectId, null, "inventory read cannot activate a project");
    observe("automatic-legacy-import-during-login", { status: "PASS", durableAfterglowPreserved: true, legacyRecordsPreserved: true });
    client.switchActiveLibraryProject(working.id);
    client.saveActiveLibraryProject({ ...working, revision: 1, title: "Account A saved Afterglow" });
    await client.flushProfilePrivateWrites();
    const choices = client.afterglowRestoreChoices(client.listAfterglowExampleProjects(), client.loadLibraryProjectSnapshot, []);
    assert.equal(choices.length, 1, "saved changes appear in this profile opening choices");
    assert.equal(choices[0].project.title, "Account A saved Afterglow");
    const foreignPoint = { id: "foreign-point", projectId: foreign.id, project: foreign, createdAt: "2026-10-07T00:00:00.000Z" };
    assert.equal(client.afterglowRestoreChoices(client.listAfterglowExampleProjects(), client.loadLibraryProjectSnapshot, [foreignPoint]).length, 1, "recovery point must match an owned Afterglow project");
    const oldSnapshot = { ...working, title: "Earlier Afterglow" };
    const point = { id: "owned-point", projectId: working.id, project: oldSnapshot, createdAt: "2026-10-06T00:00:00.000Z" };
    const owned = client.afterglowRestoreChoices(client.listAfterglowExampleProjects(), client.loadLibraryProjectSnapshot, [point]);
    assert.equal(owned.length, 2);
    const restored = client.createLibraryWorkingCopy({ sourceProject: owned[1].project, sourceKind: "example", sourceId: client.AFTERGLOW_EXAMPLE_SOURCE_ID, title: oldSnapshot.title, genre: "", format: "Feature" });
    await client.flushProfilePrivateWrites();
    assert.notEqual(restored.id, working.id);
    assert.equal(client.loadLibraryProjectSnapshot(working.id).title, "Account A saved Afterglow", "restoring a point preserves newer work");
    assert.equal(client.createAfterglowPackagedCurrentReference().title, packaged.title, "account work cannot overwrite the repository example");
    const user = client.createLibraryUserProject({ title: "Independent story", genre: "Drama", format: "Feature" });
    await client.flushProfilePrivateWrites();
    const priorSourceId = client.listLibraryProjects().find((x) => x.id === user.id).sourceId;
    client.createLibraryWorkingCopy({ sourceProject: packaged, sourceKind: "example", sourceId: client.AFTERGLOW_EXAMPLE_DEFAULTS_SOURCE_ID, title: packaged.title, genre: "Science fiction", format: "Feature" });
    await client.flushProfilePrivateWrites();
    const prior = client.listLibraryProjects().find((x) => x.id === user.id);
    assert.equal(prior.sourceKind, "user");
    assert.equal(prior.sourceId, priorSourceId);
    assert.equal(prior.genre, "Drama");
    const auth = await (await fetch("/api/auth/profile")).json();
    const secondResponse = await fetch("/api/auth/profile", { method: "POST", headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": auth.csrfToken }, body: JSON.stringify({ action: "create-profile", displayName: "Startup Audit Second Human", password: credential + " second" }) });
    assert.equal(secondResponse.status, 200);
    const second = await secondResponse.json();
    await client.browserProfileAuthGateway.logout();
    await client.browserProfileAuthGateway.authenticate(second.profile.profileId, credential + " second");
    const secondState = await privateState();
    assert.equal(secondState.projects.length, 0);
    assert.equal(client.hasActiveLibraryProject(), false);
    assert.equal(client.afterglowRestoreChoices(client.listAfterglowExampleProjects(), client.loadLibraryProjectSnapshot, []).length, 0, "other profile cannot see first profile restore choices");
    observe("second-account-isolation-and-point-restore", { status: "PASS" });
  } finally {
    globalThis.fetch = nativeFetch;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await serverModule.resetProfileExperienceRuntime();
    await rm(temporary, { recursive: true, force: true });
    globalThis.window = originalWindow;
    if (previousHome === void 0) delete process.env.PLOTPICKLE_HOME;
    else process.env.PLOTPICKLE_HOME = previousHome;
    if (previousState === void 0) delete process.env.PLOTPICKLE_AUTH_STATE_PATH;
    else process.env.PLOTPICKLE_AUTH_STATE_PATH = previousState;
  }
});
