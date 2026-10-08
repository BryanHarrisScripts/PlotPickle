import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";
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

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

// Real packaged Afterglow, browser owners, HTTP session/CSRF boundary and
// encrypted vault. Only DOM storage primitives and injected write delays fail.
test("#2839 actual approval handler persists text through encrypted unload and reopen", async (t) => {
  const temporary = await mkdtemp(path.resolve("node_modules/.2839-text-approval-"));
  const previousHome = process.env.PLOTPICKLE_HOME;
  const previousState = process.env.PLOTPICKLE_AUTH_STATE_PATH;
  const previousWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  process.env.PLOTPICKLE_HOME = temporary;
  process.env.PLOTPICKLE_AUTH_STATE_PATH = path.join(temporary, "auth/state.json");
  let server, runtime, browser, hold;
  try {
    const serverFile = path.join(temporary, "server.mjs");
    await build({ stdin: { contents: 'export {localProfileAuthGateway} from "./build/local-profile-auth-gateway.ts"; export {resetProfileExperienceRuntime} from "./core/auth/profile-experience/profile-experience-runtime.ts";', resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", packages: "external", outfile: serverFile, logLevel: "silent" });
    runtime = await import(pathToFileURL(serverFile).href);
    let middleware;
    runtime.localProfileAuthGateway().configureServer({ middlewares: { use(handler) { middleware = handler; } } });
    server = createServer((request, response) => middleware(request, response, () => { response.statusCode = 404; response.end(); }));
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const profile = await createVerificationSyntheticProfile({ baseUrl, home: temporary });
    const session = await authenticateVerificationSyntheticProfile({ baseUrl, ...profile });
    const headers = { Cookie: session.environment.PLOTPICKLE_VERIFICATION_AUTH_COOKIE, Origin: baseUrl };
    const token = session.environment.PLOTPICKLE_VERIFICATION_AUTH_CSRF;
    const status = await (await originalFetch(`${baseUrl}/api/auth/profile`, { headers })).json();
    const browserFile = path.join(temporary, "browser.mjs");
    await build({ stdin: { contents: 'export * from "./core/storage/profile-private-browser.ts"; export * from "./core/storage/project-library-browser.ts"; export * from "./core/storage/project-library/revision-safe-browser.ts"; export {createEmptyProject} from "./core/project/project.ts"; export {applyStoryCommand} from "./core/project/apply-command.ts";', resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", packages: "external", outfile: browserFile, logLevel: "silent" });
    browser = await import(pathToFileURL(browserFile).href);
    const window = new EventTarget();
    window.localStorage = new MemoryStorage();
    window.sessionStorage = new MemoryStorage();
    globalThis.window = window;
    const requests = [];
    let failAction = "";
    globalThis.fetch = async (url, options = {}) => {
      if (url === "/api/auth/profile-private" && options.method === "POST") {
        const body = JSON.parse(options.body);
        requests.push({ action: body.action, id: body.project?.id, revision: body.project?.revision, title: body.project?.title });
        if (hold?.action === body.action) {
          const waiting = hold;
          hold = null;
          waiting.entered.resolve();
          await waiting.release.promise;
        }
        if (failAction === body.action) return Response.json({ message: "Injected durable write failure" }, { status: 503 });
      }
      return originalFetch(new URL(url, baseUrl), { ...options, headers: { ...headers, ...options.headers } });
    };
    await browser.hydrateProfilePrivateBrowser(status.profile.profileId, token);
    const packaged = JSON.parse(await readFile("data/afterglow-packaged-current/snapshot.json", "utf8")).project;
    browser.saveActiveLibraryProject(packaged);
    await browser.flushProfilePrivateWrites();
    const current = () => browser.loadActiveLibraryProject();
    const artifact = current().build.foundations.visualArtifacts.find((entry) => entry.assetUrl.startsWith("/assets/library/examples/") && entry.workflow === "storyboard-frame-webp-v2");
    assert.ok(artifact, "the regression must use a real committed packaged Storyboard artifact");
    const source = await readFile("app/_components/preproduction/storyboard-locked-shot-handoff.tsx", "utf8");
    const handler = stripTypeScriptTypes(source.slice(source.indexOf("  async function saveApproval("), source.indexOf("  async function generateNarration(")));
    const anchorRef = artifact.sourceDecisionKeys.find(key => key.startsWith("storyboard-anchor:"));
    const panel = { position: artifact.frameNumber ?? 1 };
    let notices = {}, published = 0;
    const latestProject = { current: current() };
    const context = vm.createContext({
      Error, Date, anchorRef, project: current(), latestProject,
      lockedArtifacts: [{ position: panel.position, artifact }],
      graphicNovelTextSourceSnapshot: () => ({}),
      graphicNovelTextSourceKey: () => "source-current",
      evidence: { passages: [] }, storyContext: {},
      loadFoundationProject: current,
      saveFoundationProjectDurably: browser.saveFoundationProjectDurably,
      onProjectChange(saved) { published++; latestProject.current = saved; },
      setDrafts() {}, setNotices(fn) { notices = fn(notices); },
    });
    vm.runInContext(handler, context);
    const before = current();
    const bubbles = [{ speaker: "REN", text: "We should go." }];
    await context.saveApproval(panel, "source-current", "Ren pauses at the door.", bubbles, false);
    assert.equal(published, 1);
    assert.match(notices[panel.position], /saved and locked for Storyboard and Previs/);
    assert.deepEqual(current().build, before.build, "text approval must preserve image/lock authority");
    const id = current().id;
    browser.unloadActiveLibraryProject();
    await browser.flushProfilePrivateWrites();
    browser.releaseProfilePrivateBrowserAuthority();
    window.localStorage.clear(); window.sessionStorage.clear();
    await browser.hydrateProfilePrivateBrowser(status.profile.profileId, token);
    browser.switchActiveLibraryProject(id);
    await browser.flushProfilePrivateWrites();
    const approval = current().production.graphicNovelTextApprovals.find(item => item.anchorRef === anchorRef && item.position === panel.position);
    assert.equal(approval.sourceKey, "source-current");
    assert.equal(approval.narration, "Ren pauses at the door.");
    assert.deepEqual(approval.bubbles, bubbles);
    assert.equal(approval.noText, false);
    latestProject.current = current();
    failAction = "save-project";
    await context.saveApproval(panel, "source-current", "", [], true);
    assert.equal(published, 1, "failed approval must not publish successful state");
    assert.match(notices[panel.position], /Save & Lock failed.*Injected durable write failure/);
    failAction = "";
    latestProject.current = current();
    await context.saveApproval(panel, "source-current", "", [], true);
    assert.equal(published, 2);
    assert.match(notices[panel.position], /No Bubble saved and locked/);
    browser.unloadActiveLibraryProject();
    await browser.flushProfilePrivateWrites();
    browser.releaseProfilePrivateBrowserAuthority();
    await browser.hydrateProfilePrivateBrowser(status.profile.profileId, token);
    browser.switchActiveLibraryProject(id);
    assert.equal(current().production.graphicNovelTextApprovals.find(item => item.anchorRef === anchorRef && item.position === panel.position).noText, true);

  } finally {
    hold?.release.resolve();
    browser?.releaseProfilePrivateBrowserAuthority();
    globalThis.fetch = originalFetch;
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
    await runtime?.resetProfileExperienceRuntime();
    if (previousHome === undefined) delete process.env.PLOTPICKLE_HOME; else process.env.PLOTPICKLE_HOME = previousHome;
    if (previousState === undefined) delete process.env.PLOTPICKLE_AUTH_STATE_PATH; else process.env.PLOTPICKLE_AUTH_STATE_PATH = previousState;
    await rm(temporary, { recursive: true, force: true });
  }
});
