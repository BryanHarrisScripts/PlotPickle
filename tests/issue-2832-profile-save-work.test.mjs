import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
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

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

// Real packaged Afterglow, browser owners, HTTP session/CSRF boundary and
// encrypted vault. Only DOM storage primitives and injected write delays fail.
test("#2832 single-project Save shares acknowledgement and retains encrypted reopen authority", async (t) => {
  const temporary = await mkdtemp(path.resolve("node_modules/.2832-save-work-"));
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
    for (let index = 0; index < 4; index += 1) {
      browser.saveActiveLibraryProject(browser.createEmptyProject({ id: `other-${index}`, title: `Other ${index}`, now: "2026-10-07T12:00:00.000Z" }));
      await browser.flushProfilePrivateWrites();
      if (index < 2) {
        browser.archiveLibraryProject(`other-${index}`);
        await browser.flushProfilePrivateWrites();
      }
    }
    const packaged = JSON.parse(await readFile("data/afterglow-packaged-current/snapshot.json", "utf8")).project;
    browser.saveActiveLibraryProject(packaged);
    await browser.flushProfilePrivateWrites();
    const current = () => browser.loadActiveLibraryProject();
    const artifact = current().build.foundations.visualArtifacts.find((entry) => entry.assetUrl.startsWith("/assets/library/examples/") && entry.workflow === "storyboard-frame-webp-v2");
    assert.ok(artifact, "the regression must use a real committed packaged Storyboard artifact");
    const saves = () => requests.filter((entry) => entry.action === "save-project");
    const mutate = (command) => browser.applyStoryCommand(current(), command);
    const durable = (next) => browser.saveFoundationProjectDurably(next, current().revision);
    const resetRequests = () => { requests.length = 0; };

    await t.test("one Save writes Afterglow once and never rewrites four unchanged active/archived stories", async () => {
      resetRequests();
      const savedArtifact = { ...artifact, sourceDecisionKeys: [...new Set([...artifact.sourceDecisionKeys, "storyboard-local-save:v1"])] };
      await durable(mutate({ type: "foundations.visual.store", artifact: savedArtifact, occurredAt: new Date().toISOString() }));
      assert.deepEqual(saves().map((entry) => entry.id), [packaged.id]);
      assert.equal(requests.filter((entry) => entry.action === "sync-library-index").length, 1);
    });

    await t.test("delayed automatic and explicit Save share the pending promise and wait for durability", async () => {
      resetRequests();
      const gate = { action: "save-project", entered: deferred(), release: deferred() };
      hold = gate;
      const next = mutate({ type: "foundations.visual.accept", artifactId: artifact.id, occurredAt: new Date().toISOString() });
      let finished = false;
      const save = durable(next).then(() => { finished = true; });
      await gate.entered.promise;
      const first = browser.persistActiveProfileProject();
      const second = browser.persistActiveProfileProject("", packaged.id);
      assert.equal(first, second);
      assert.equal(finished, false, "the Save acknowledgement must wait for the encrypted write");
      assert.equal(browser.getProfilePrivateSaveState().state, "saving");
      gate.release.resolve();
      await Promise.all([save, first, second]);
      assert.equal(saves().length, 1);
      assert.equal(browser.getProfilePrivateSaveState().state, "saved");
    });

    await t.test("same-revision content changes remain durable and newer queued decisions retain order", async () => {
      resetRequests();
      const before = current();
      const gate = { action: "save-project", entered: deferred(), release: deferred() };
      hold = gate;
      browser.saveActiveLibraryProject({ ...before, title: "Same revision first decision" });
      await gate.entered.promise;
      browser.saveActiveLibraryProject({ ...current(), title: "Same revision final decision" });
      gate.release.resolve();
      await browser.flushProfilePrivateWrites();
      assert.deepEqual(saves().map((entry) => entry.title), ["Same revision first decision", "Same revision final decision"]);
      assert.ok(saves().every((entry) => entry.revision === before.revision));
      assert.ok(saves().every((entry) => entry.id === packaged.id));
    });

    await t.test("failed project or index writes remain blocked and explicit retry confirms only this story", async () => {
      for (const action of ["save-project", "sync-library-index"]) {
        resetRequests();
        failAction = action;
        await assert.rejects(durable(current()), /Injected durable write failure/u);
        assert.equal(browser.getProfilePrivateSaveState().state, "blocked");
        await assert.rejects(browser.flushProfilePrivateWrites(), /Injected durable write failure/u);
        failAction = "";
        resetRequests();
        await durable(current());
        assert.equal(browser.getProfilePrivateSaveState().state, "saved");
        assert.deepEqual(saves().map((entry) => entry.id), [packaged.id]);
      }
    });

    await t.test("late explicit confirmation cannot join an operation that already skipped its project", async () => {
      resetRequests();
      const gate = { action: "sync-library-index", entered: deferred(), release: deferred() };
      hold = gate;
      const automatic = browser.persistActiveProfileProject();
      await gate.entered.promise;
      const explicit = browser.persistActiveProfileProject("", packaged.id);
      assert.notEqual(explicit, automatic);
      gate.release.resolve();
      await Promise.all([automatic, explicit]);
      assert.deepEqual(saves().map((entry) => entry.id), [packaged.id]);
    });

    await t.test("unload and rehydrate retain exact Afterglow Save/Lock and seed unchanged inventory acknowledgements", async () => {
      const saved = current();
      browser.unloadActiveLibraryProject();
      await browser.flushProfilePrivateWrites();
      browser.releaseProfilePrivateBrowserAuthority();
      await browser.hydrateProfilePrivateBrowser(status.profile.profileId, token);
      resetRequests();
      browser.switchActiveLibraryProject(saved.id);
      await browser.flushProfilePrivateWrites();
      assert.equal(saves().length, 0, "restored unchanged snapshots must not be rewritten merely to select the story");
      assert.equal(current().title, "Same revision final decision");
      const restored = current().build.foundations.visualArtifacts.find((entry) => entry.id === artifact.id);
      assert.equal(restored.assetUrl, artifact.assetUrl);
      assert.equal(restored.reviewState, "accepted");
      assert.ok(restored.sourceDecisionKeys.includes("storyboard-local-save:v1"));
      assert.equal(browser.listArchivedLibraryProjects().length, 2);
    });

    await t.test("authority release during a write prevents obsolete index or acknowledgement updates", async () => {
      resetRequests();
      const gate = { action: "save-project", entered: deferred(), release: deferred() };
      hold = gate;
      const save = durable(current());
      const rejected = assert.rejects(save, /profile changed/u);
      await gate.entered.promise;
      browser.releaseProfilePrivateBrowserAuthority();
      gate.release.resolve();
      await rejected;
      assert.equal(requests.filter((entry) => entry.action === "sync-library-index").length, 0);
      assert.equal(browser.profilePrivateBrowserAuthorityMatches(status.profile.profileId, token), false);
      await assert.rejects(browser.persistActiveProfileProject(), /profile is locked/u);
    });
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
