import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import test from "node:test";
import { build } from "esbuild";
import { createVerificationSyntheticProfile, authenticateVerificationSyntheticProfile } from "../scripts/full-verification-auth.mjs";

class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}
const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

// Actual node gateway, session, encrypted store, browser library and component
// handlers; only browser storage/event primitives and provider inference are absent.
test("#2821 local narration and Save/Lock share current session and durable project authority", async (t) => {
  const temporary = await mkdtemp(path.resolve("node_modules/.2821-continuity-"));
  const priorHome = process.env.PLOTPICKLE_HOME;
  const priorState = process.env.PLOTPICKLE_AUTH_STATE_PATH;
  const priorWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  process.env.PLOTPICKLE_HOME = temporary;
  process.env.PLOTPICKLE_AUTH_STATE_PATH = path.join(temporary, "auth/state.json");
  let server, runtime, browser;
  try {
    const serverOutput = path.join(temporary, "server.mjs");
    await build({ stdin: { contents: 'export { localProfileAuthGateway } from "./build/local-profile-auth-gateway.ts"; export { resetProfileExperienceRuntime } from "./core/auth/profile-experience/profile-experience-runtime.ts";', resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", packages: "external", outfile: serverOutput, logLevel: "silent" });
    runtime = await import(pathToFileURL(serverOutput).href);
    let middleware;
    runtime.localProfileAuthGateway().configureServer({ middlewares: { use(handler) { middleware = handler; } } });
    server = createServer((request, response) => middleware(request, response, () => { response.statusCode = 404; response.end(); }));
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const profile = await createVerificationSyntheticProfile({ baseUrl, home: temporary });
    const session = await authenticateVerificationSyntheticProfile({ baseUrl, ...profile });
    const headers = { Cookie: session.environment.PLOTPICKLE_VERIFICATION_AUTH_COOKIE, Origin: baseUrl };
    const token = session.environment.PLOTPICKLE_VERIFICATION_AUTH_CSRF;
    const profileStatus = await (await originalFetch(`${baseUrl}/api/auth/profile`, { headers })).json();
    assert.equal(profileStatus.authenticated, true);
    await t.test("narration reaches request validation with login proof, rejects missing proof and genuine sign-out", async () => {
      const request = (extraHeaders = {}) => originalFetch(`${baseUrl}/api/previs/narration`, { method: "POST", headers: { ...headers, "Content-Type": "application/json", ...extraHeaders }, body: "{}" });
      const authorized = await request({ "X-PlotPickle-CSRF": token });
      assert.equal(authorized.status, 400, "a valid login must reach narration payload validation without provider inference");
      assert.match((await authorized.json()).message, /mapped script/u);
      const missing = await request();
      assert.equal(missing.status, 403);
      assert.equal((await missing.json()).code, "CSRF_REJECTED");
      const signedOut = await request({ Cookie: "", "X-PlotPickle-CSRF": token });
      assert.equal(signedOut.status, 403);
      assert.equal((await signedOut.json()).code, "SESSION_REJECTED");
      assert.equal((await request({ "X-PlotPickle-CSRF": token, Origin: "http://foreign.example" })).status, 403);
    });

    const browserOutput = path.join(temporary, "browser.mjs");
    await build({ stdin: { contents: 'export * from "./core/storage/profile-private-browser.ts"; export * from "./core/storage/foundation-project-browser.ts"; export * from "./core/storage/project-library/revision-safe-browser.ts"; export { switchActiveLibraryProject, unloadActiveLibraryProject, resumeSessionActiveProject } from "./core/storage/project-library-browser.ts"; export { browserProfileAuthGateway } from "./adapters/experience/browser-profile-auth-gateway.ts"; export { createEmptyProject } from "./core/project/project.ts"; export { applyStoryCommand } from "./core/project/apply-command.ts";', resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", packages: "external", outfile: browserOutput, logLevel: "silent" });
    browser = await import(pathToFileURL(browserOutput).href);
    const window = new EventTarget();
    window.localStorage = new MemoryStorage();
    window.sessionStorage = new MemoryStorage();
    globalThis.window = window;
    let failWrites = false, deferRead = null;
    globalThis.fetch = async (url, options = {}) => {
      if (url === "/api/auth/profile-private" && options.method === "POST" && failWrites) return Response.json({ message: "Injected encrypted write failure" }, { status: 503 });
      const response = await originalFetch(new URL(url, baseUrl), { ...options, headers: { ...headers, ...options.headers } });
      if (url === "/api/auth/profile-private" && !options.method && deferRead) await deferRead;
      return response;
    };
    await browser.hydrateProfilePrivateBrowser(profileStatus.profile.profileId, token);
    const base = browser.createEmptyProject({ id: "story-2821", now: "2026-10-07T12:00:00.000Z", title: "Save authority fixture" });
    const artifact = { id: "frame-1", assetUrl: "/api/local-ai/assets/2821-fixture.webp", prompt: "Fixture", createdAt: base.updatedAt, provider: "fixture", model: "fixture", frameNumber: 1, narrativeIntention: "Fixture", sourceDecisionKeys: ["storyboard-anchor:block:block-01:mini-1"], workflow: "storyboard-frame-webp-v2", reviewState: "draft", parentArtifactId: null };
    const initial = browser.applyStoryCommand(base, { type: "foundations.visual.store", artifact, occurredAt: base.updatedAt });
    browser.saveFoundationProject(initial);
    await browser.flushProfilePrivateWrites();
    const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
    const handlers = stripTypeScriptTypes(source.slice(source.search(/  (?:async )?function saveFrameVersion\(/u), source.indexOf("  const normalizedSourceEvidence")));
    const notices = [];
    const context = vm.createContext({
      ...browser, Error, project: initial, qaOnlyAccess: false, storyboardAccessible: false,
      frameBusy: false, frameMutation: { current: false },
      selectedNumber: 1, selectedMiniBlockNumber: 1,
      STORYBOARD_LOCAL_SAVE_MARKER: "storyboard-local-save:v1",
      storyboardArtifactSavedLocally: (item) => (item.sourceDecisionKeys ?? []).includes("storyboard-local-save:v1"),
      setFrameSaving() {}, setFrameNotice(value) { notices.push(value); },
      setSelectedImageByPosition() {}, setPendingDeleteArtifactId() {}, onProjectChange() {},
    });
    vm.runInContext(handlers, context);
    const callSave = () => context.saveFrameVersion(artifact);
    const callLock = (decision) => context.reviewFrame(artifact, decision);
    const currentArtifact = () => browser.loadFoundationProject().build.foundations.visualArtifacts.find((item) => item.id === artifact.id);
    await t.test("enabled Save responds without generation readiness and stale Lock/Unlock preserves saved image", async () => {
      await callSave();
      assert.match(notices.at(-1), /saved locally/u);
      assert.ok(currentArtifact().sourceDecisionKeys.includes("storyboard-local-save:v1"));
      await callLock("accept");
      assert.equal(currentArtifact().reviewState, "accepted");
      await callLock("unaccept");
      assert.equal(currentArtifact().reviewState, "draft");
      assert.ok(currentArtifact().sourceDecisionKeys.includes("storyboard-local-save:v1"));
      const revision = browser.loadFoundationProject().revision;
      await callSave();
      assert.equal(browser.loadFoundationProject().revision, revision, "retrying saved image must not create another artifact or revision");
      await callLock("accept");
      assert.equal(browser.loadFoundationProject().build.foundations.visualArtifacts.length, 1);
      assert.equal(browser.loadFoundationProject().build.foundations.acceptedVisualArtifactIds.length, 1);
    });
    await t.test("failed encrypted write remains visible and retry persists through unload and rehydrate", async () => {
      failWrites = true;
      await callSave();
      assert.match(notices.at(-1), /Save failed: Injected encrypted write failure/u);
      assert.equal(browser.getProfilePrivateSaveState().state, "blocked");
      await assert.rejects(browser.browserProfileAuthGateway.logout(), /Injected encrypted write failure/u);
      assert.equal((await (await globalThis.fetch("/api/auth/profile")).json()).authenticated, true, "failed persistence must prevent logout and cache clearing");
      assert.ok(currentArtifact().sourceDecisionKeys.includes("storyboard-local-save:v1"));
      failWrites = false;
      await callSave();
      assert.equal(browser.getProfilePrivateSaveState().state, "saved");
      const saved = browser.loadFoundationProject();
      browser.unloadActiveLibraryProject();
      await browser.flushProfilePrivateWrites();
      browser.releaseProfilePrivateBrowserAuthority();
      await browser.hydrateProfilePrivateBrowser(profileStatus.profile.profileId, token);
      browser.switchActiveLibraryProject(saved.id);
      await browser.flushProfilePrivateWrites();
      assert.equal(browser.loadFoundationProject().revision, saved.revision);
      assert.equal(currentArtifact().reviewState, "accepted");
      assert.ok(currentArtifact().sourceDecisionKeys.includes("storyboard-local-save:v1"));
      assert.equal((await (await globalThis.fetch("/api/auth/profile")).json()).authenticated, true);
    });
    await t.test("same authority hydration cannot replace a newer project; stale hydration cannot resurrect released authority", async () => {
      const current = browser.loadFoundationProject();
      browser.saveFoundationProject({ ...current, revision: current.revision + 1, title: "Newer unsynchronized decision" });
      await browser.hydrateProfilePrivateBrowser(profileStatus.profile.profileId, token);
      assert.equal(browser.loadFoundationProject().title, "Newer unsynchronized decision");
      await browser.flushProfilePrivateWrites();
      browser.releaseProfilePrivateBrowserAuthority();
      let releaseRead;
      deferRead = new Promise((resolve) => { releaseRead = resolve; });
      const stale = browser.hydrateProfilePrivateBrowser(profileStatus.profile.profileId, token);
      await new Promise((resolve) => setImmediate(resolve));
      browser.releaseProfilePrivateBrowserAuthority();
      releaseRead();
      await assert.rejects(stale, /profile changed/u);
      assert.equal(browser.profilePrivateBrowserAuthorityMatches(profileStatus.profile.profileId, token), false);
    });
  } finally {
    browser?.releaseProfilePrivateBrowserAuthority();
    globalThis.fetch = originalFetch;
    if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow;
    if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
    await runtime?.resetProfileExperienceRuntime();
    if (priorHome === undefined) delete process.env.PLOTPICKLE_HOME; else process.env.PLOTPICKLE_HOME = priorHome;
    if (priorState === undefined) delete process.env.PLOTPICKLE_AUTH_STATE_PATH; else process.env.PLOTPICKLE_AUTH_STATE_PATH = priorState;
    await rm(temporary, { recursive: true, force: true });
  }
});

test("#2821 status reports transient failures without claiming logout", async () => {
  const source = await read("app/api/auth/profile/route.ts");
  const route = stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\r?\n/gm, "")).replace(/^export /gm, "");
  let readiness = true, failure = null;
  class AuthError extends Error { constructor(code) { super(code); this.code = code; } }
  const context = vm.createContext({ Response, URL,
    PlotPickleServerSessionError: AuthError, PlotPickleAuthError: AuthError,
    toPublicServerSessionError: (error) => ({ code: error.code, message: error.message }),
    toPublicAuthError: (error) => ({ code: error.code, message: error.message }),
    getAutonomousGuestAuthority: () => ({ active: false }), requestBoundary: (request) => request,
    getProfileExperienceRuntime: async () => ({ accessMode: "desktop-loopback",
      boundaryFor: () => ({ readiness: () => ({ ready: readiness, reasons: [] }), authorizeRequest: async () => { if (failure) throw failure; return { authContext: { profileId: "fixture" } }; }, listSessions: async () => [] }),
      auth: { getAuthStatus: () => ({ configured: true, profile: { displayName: "Fixture" } }), listProfileSummaries: () => [], createBrowserSession: () => ({ csrfToken: "fixture-proof" }) },
    }),
  });
  vm.runInContext(route, context);
  const call = () => context.GET({ url: "http://127.0.0.1:3000/api/auth/profile" });
  assert.equal((await (await call()).json()).authenticated, true);
  failure = new Error("Transient failure");
  let response = await call();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).authenticated, undefined);
  failure = new AuthError("SESSION_REJECTED");
  response = await call();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).authenticated, false);
  failure = null; readiness = false;
  response = await call();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "SERVER_NOT_READY");
});
