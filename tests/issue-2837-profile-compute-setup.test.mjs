import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "node:http";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";
import { computeReadiness, cloudMediaReadiness, writingReadiness, invalidateImageVerification } from "../core/contracts/compute/compute-readiness.mjs";

test("#2837 account-owned compute setup survives restart, isolates keys and serializes parallel saves", async () => {
  const root = await mkdtemp(path.join(path.resolve("node_modules"), ".compute-setup-2837-"));
  const previousHome = process.env.PLOTPICKLE_HOME;
  const previousAuth = process.env.PLOTPICKLE_AUTH_STATE_PATH;
  const realFetch = globalThis.fetch;
  process.env.PLOTPICKLE_HOME = path.join(root, "private");
  process.env.PLOTPICKLE_AUTH_STATE_PATH = path.join(root, "private", "auth", "state.json");
  let worker, server;
  let paidRequests = 0;
  try {
    const entry = path.join(root, "entry.ts");
    await writeFile(entry, [
      'export { getProfileExperienceRuntime, resetProfileExperienceRuntime } from "./core/auth/profile-experience/profile-experience-runtime";',
      'export { profileRequestScope, profileScopedBuzzRequestContext } from "./build/auth/profile-request-context";',
      'export { readCredentialJson, writeCredentialJson } from "./build/local-credentials";',
      'export { readMediaRoutingStore, writeMediaRoutingStore, publicMediaProfile } from "./build/media-routing-store";',
      'export { readSynchronizedAssistantStore, writeAssistantStore, publicProfile } from "./build/writing-assistant-store";',
      'export { readAgentComputeStore, writeAgentComputeStore, resolveAgentComputeProvider } from "./build/agent-compute-store";',
      'export { POST } from "./app/api/cloud-story-mode/provider/route";',
      'export { registerMediaRoutingGateway } from "./build/media-routing-gateway";',
    ].map((line) => line.replace(/from "\.\//, `from "${process.cwd().replaceAll("\\", "/")}/`)).join("\n"));
    const outfile = path.join(root, "worker.mjs");
    await build({ entryPoints: [entry], outfile, bundle: true, platform: "node", format: "esm", packages: "external", logLevel: "silent" });
    worker = await import(pathToFileURL(outfile).href);
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.url || String(input));
      if (url.hostname === "synthetic.invalid") { paidRequests++; return Response.json({ error: { message: "Synthetic rejected image test" } }, { status: 500 }); }
      return realFetch(input, init);
    };
    // An OS-account remnant must never become a newly signed-in profile's key.
    await mkdir(path.join(process.env.PLOTPICKLE_HOME, "secrets"), { recursive: true });
    await writeFile(path.join(process.env.PLOTPICKLE_HOME, "secrets", "ai-connection.json"), JSON.stringify({ provider: "openai", apiKey: "synthetic-foreign-OS-key" }));
    assert.equal(await worker.readCredentialJson("ai-connection.json"), null);
    await assert.rejects(worker.writeCredentialJson("ai-routing.json", {}), /Unlock/);
    let runtime = await worker.getProfileExperienceRuntime();
    const password = "Synthetic compute profile passphrase 2837";
    let owner = await runtime.auth.createFirstProfile({ displayName: "Synthetic compute owner", password });
    const ownerId = owner.profile.profileId;
    let context = { authContext: owner.authContext, profileId: ownerId, privateStorage: runtime.privateStorage };
    const scoped = (fn) => worker.profileRequestScope.run(context, fn);
    assert.equal(await scoped(() => worker.readCredentialJson("ai-connection.json")), null);
    const middlewares = [];
    const vite = { middlewares: { use: (fn) => middlewares.push(fn) } };
    worker.profileScopedBuzzRequestContext().configureServer(vite);
    worker.registerMediaRoutingGateway(vite);
    server = createServer((request, response) => {
      let index = 0;
      const next = () => { if (index < middlewares.length) middlewares[index++](request, response, next); else { response.statusCode = 404; response.end(); } };
      next();
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const sessionHeaders = (auth) => {
      const session = runtime.establishSession(auth, origin);
      return { Cookie: session.setCookie.split(";", 1)[0], Origin: origin, "X-PlotPickle-CSRF": session.csrfToken, "Content-Type": "application/json" };
    };
    let headers = sessionHeaders(owner.authContext);
    const anonymous = await realFetch(`${origin}/api/media-routing/status`);
    assert.equal(anonymous.status, 401, "Anonymous compute reads must not see saved authority.");
    const missingCsrf = { ...headers };
    delete missingCsrf["X-PlotPickle-CSRF"];
    const denied = await realFetch(`${origin}/api/media-routing/test/image`, { method: "POST", headers: missingCsrf, body: JSON.stringify({ route: "openai", billingAcknowledged: true }) });
    assert.equal(denied.status, 401, "Compute mutations require the active session CSRF proof.");
    assert.equal(paidRequests, 0);
    const authority = { provider: "openai", baseUrl: "https://synthetic.invalid/v1", textModel: "synthetic-writing", imageModel: "synthetic-image", videoModel: "synthetic-video", apiKey: "synthetic-profile-owned-key-2837" };
    const saved = await worker.POST(new Request(`${origin}/api/cloud-story-mode/provider`, { method: "POST", headers, body: JSON.stringify(authority) }));
    assert.equal(saved.status, 200, await saved.clone().text());
    assert.equal(paidRequests, 0, "Saving authority must never run a paid test.");
    let media = await scoped(() => worker.readMediaRoutingStore());
    let { store: writing } = await scoped(() => worker.readSynchronizedAssistantStore());
    assert.equal(worker.publicMediaProfile(media.profiles.openai).imageReady, false);
    media.imageRoute = "openai";
    media.profiles.openai.imageVerifiedAt = "2026-10-07T20:00:00.000Z";
    media.profiles.openai.videoVerifiedAt = "2026-10-07T20:00:00.000Z";
    writing.activeProvider = "openai";
    writing.profiles.openai.assistantVerifiedAt = "2026-10-07T20:00:00.000Z";
    await scoped(() => Promise.all([
      worker.writeMediaRoutingStore(media), worker.writeAssistantStore(writing),
      worker.writeAgentComputeStore({ version: 1, defaultProvider: "active", overrides: { "graphic-novel": "openai" } }),
      worker.writeCredentialJson("ai-routing.json", { version: 1, text: "openai", image: "openai", video: "off" }),
    ]));
    const record = await runtime.privateStorage.readCredential(owner.authContext, "compute-setup.json");
    for (const name of ["media-routing.json", "writing-assistant-profiles.json", "plotpickle-agent-compute.json", "ai-routing.json"]) assert.ok(record.settings[name], `parallel save lost ${name}`);
    assert.equal(worker.publicMediaProfile(media.profiles.openai).imageReady, true);
    // The real API failure must clear the prior image stamp while retaining video proof.
    const failed = await realFetch(`${origin}/api/media-routing/test/image`, { method: "POST", headers, body: JSON.stringify({ route: "openai", billingAcknowledged: true }) });
    assert.equal(failed.status, 400);
    assert.ok(paidRequests > 0, "The synthetic image provider was called.");
    media = await scoped(() => worker.readMediaRoutingStore());
    assert.equal(media.profiles.openai.imageVerifiedAt, "");
    assert.equal(worker.publicMediaProfile(media.profiles.openai).imageReady, false);
    assert.equal(worker.publicMediaProfile(media.profiles.openai).videoReady, true);
    const beforeRestart = paidRequests;
    const other = await runtime.auth.createProfile({ displayName: "Synthetic second compute owner", password }, owner.authContext);
    const otherContext = { authContext: other.authContext, profileId: other.profile.profileId, privateStorage: runtime.privateStorage };
    const empty = await worker.profileRequestScope.run(otherContext, () => worker.readMediaRoutingStore());
    assert.equal(empty.profiles.openai, undefined, "Another account must not inherit cloud authority.");
    const otherWriting = await worker.profileRequestScope.run(otherContext, () => worker.readSynchronizedAssistantStore());
    assert.equal(otherWriting.store.activeProvider, "disabled");
    await worker.resetProfileExperienceRuntime();
    runtime = await worker.getProfileExperienceRuntime();
    owner = await runtime.auth.authenticate({ profileId: ownerId, password });
    context = { authContext: owner.authContext, profileId: ownerId, privateStorage: runtime.privateStorage };
    media = await scoped(() => worker.readMediaRoutingStore());
    ({ store: writing } = await scoped(() => worker.readSynchronizedAssistantStore()));
    assert.equal(media.profiles.openai.apiKey, authority.apiKey);
    assert.equal(media.imageRoute, "openai");
    assert.equal(media.profiles.openai.imageVerifiedAt, "");
    assert.equal(worker.publicProfile(writing.profiles.openai, writing.activeProvider).ready, true);
    const agents = await scoped(() => worker.readAgentComputeStore());
    assert.deepEqual(worker.resolveAgentComputeProvider(agents, "graphic-novel", writing.activeProvider), { provider: "openai", source: "override" });
    assert.equal(paidRequests, beforeRestart, "Restart and profile hydration repeat no paid request.");
    async function assertEncrypted(directory) {
      for (const item of await readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, item.name);
        if (item.isDirectory()) await assertEncrypted(file);
        else assert.ok(!(await readFile(file, "utf8")).includes(authority.apiKey), "Saved API key must not appear in plaintext.");
      }
    }
    await assertEncrypted(path.join(process.env.PLOTPICKLE_HOME, "profiles"));
    assert.ok(!JSON.stringify(worker.publicMediaProfile(media.profiles.openai)).includes(authority.apiKey));
    runtime.auth.lock(owner.authContext);
    await assert.rejects(scoped(() => worker.readMediaRoutingStore()));
    await assert.rejects(scoped(() => worker.writeCredentialJson("ai-routing.json", {})));
  } finally {
    globalThis.fetch = realFetch;
    await worker?.resetProfileExperienceRuntime();
    server?.closeAllConnections();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (previousHome === undefined) delete process.env.PLOTPICKLE_HOME; else process.env.PLOTPICKLE_HOME = previousHome;
    if (previousAuth === undefined) delete process.env.PLOTPICKLE_AUTH_STATE_PATH; else process.env.PLOTPICKLE_AUTH_STATE_PATH = previousAuth;
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("#2837 readiness distinguishes configured, tested, unavailable and invalidated capabilities", async () => {
  assert.equal(computeReadiness({ configured: true }).ready, false);
  assert.equal(computeReadiness({ configured: true, verifiedAt: "synthetic-success", available: false }).ready, false);
  const profile = { provider: "openai", apiKey: "synthetic-key", textModel: "text", imageModel: "image", videoModel: "video", assistantVerifiedAt: "synthetic-success", imageVerifiedAt: "synthetic-success", videoVerifiedAt: "synthetic-success" };
  assert.equal(writingReadiness(profile).ready, true);
  const store = { profiles: { openai: profile }, comfyui: { imageVerifiedAt: "synthetic-success", qwenImage21: { lastVerifiedAt: "synthetic-success" }, imageProfile: "qwen-image-2.1-experimental" } };
  invalidateImageVerification(store, "openai", "Synthetic image failure");
  assert.equal(cloudMediaReadiness(profile, "image").ready, false);
  assert.equal(cloudMediaReadiness(profile, "video").ready, true);
  invalidateImageVerification(store, "comfyui", "Synthetic local failure");
  assert.equal(store.comfyui.imageVerifiedAt, "");
  assert.equal(store.comfyui.qwenImage21.lastVerifiedAt, "");
  const overview = await readFile(new URL("../app/settings-readiness-overview.tsx", import.meta.url), "utf8");
  assert.match(overview, /routing\?\.image\?\.options\?\.\[imageRoute\]\?\.ready/u);
  assert.match(overview, /routing\?\.video\?\.options\?\.\[videoRoute\]\?\.ready/u);
  assert.doesNotMatch(overview, /imageReady[^;]*profiles[^;]*configured/u);
});

test("#2837 Hybrid refreshes saved capability status after Cloud tests and removes listeners on exit", async () => {
  for (const surface of ["hybrid-story-mode-panel", "story-mode-host"]) {
  const source = await readFile(new URL(`../app/skin-v1/${surface}.tsx`, import.meta.url), "utf8");
  const effect = source.match(/useEffect\(\(\) => \{([\s\S]*?)\}, \[refresh\]\);/u)?.[1];
  assert.ok(effect, "Hybrid must own its setup-change subscription.");
  const listeners = new Map();
  let reads = 0;
  const cleanup = vm.runInNewContext(`(() => {${effect}})()`, {
    refresh: () => { reads++; },
    window: {
      addEventListener: (name, handler) => listeners.set(name, handler),
      removeEventListener: (name, handler) => { assert.equal(listeners.get(name), handler); listeners.delete(name); },
    },
  });
  assert.equal(reads, 1);
  listeners.get("plotpickle:setup-status-refresh")();
  listeners.get("plotpickle:connection-status-refresh")();
  assert.equal(reads, 3, "Cloud verification and connection changes must refresh Hybrid without remounting.");
  cleanup();
  assert.equal(listeners.size, 0);
  }
});

test("#2837 unavailable managed startup reports a setup state without a server crash", async () => {
  const source = await readFile(new URL("../build/ai/comfyui-onboarding-gateway.ts", import.meta.url), "utf8");
  const body = source.match(/async function startWithManagedLocalRuntime\(\) \{([\s\S]*?)\n\}\n\nasync function startComfyUi/u)?.[1];
  assert.ok(body);
  const result = await vm.runInNewContext(`(async () => {${body}})()`, { process: { platform: "linux" } });
  assert.equal(result.ready, false);
  assert.equal(result.state, "unsupported-platform");
  assert.match(result.message, /Start ComfyUI locally/);
});
