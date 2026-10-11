import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "node:http";
import test from "node:test";
import { build } from "esbuild";
import vm from "node:vm";

test("#2911 real local gateway unlock, diagnostics, provider save and process-runtime restart", async t => {
  const root = await mkdtemp(path.resolve("node_modules/.profile-session-2911-"));
  const previous = { home: process.env.PLOTPICKLE_HOME, auth: process.env.PLOTPICKLE_AUTH_STATE_PATH };
  process.env.PLOTPICKLE_HOME = path.join(root, "private");
  process.env.PLOTPICKLE_AUTH_STATE_PATH = path.join(root, "private/auth/state.json");
  let worker, server;
  try {
    const outfile = path.join(root, "worker.mjs");
    await build({ stdin: { contents: [
      'export { localProfileAuthGateway } from "./build/local-profile-auth-gateway.ts";',
      'export { getProfileExperienceRuntime, resetProfileExperienceRuntime } from "./core/auth/profile-experience/profile-experience-runtime.ts";',
      'export { withAuthenticatedProfileRequest } from "./build/auth/profile-request-context.ts";',
      'export { readMediaRoutingStore } from "./build/media-routing-store.ts";',
      'export { readSynchronizedAssistantStore } from "./build/writing-assistant-store.ts";',
    ].join("\n"), resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", packages: "external", outfile, logLevel: "silent" });
    worker = await import(pathToFileURL(outfile).href);
    let middleware;
    worker.localProfileAuthGateway().configureServer({ middlewares: { use(handler) { middleware = handler; } } });
    server = createServer((request, response) => middleware(request, response, () => { response.statusCode = 404; response.end(); }));
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    let cookie = "", token = "";
    const request = (url, body, extra = {}) => fetch(origin + url, {
      method: body ? "POST" : "GET", headers: { Origin: origin, Cookie: cookie,
        "Content-Type": "application/json", "X-PlotPickle-CSRF": token, ...extra },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const runtime = await worker.getProfileExperienceRuntime();
    const password = "Synthetic profile unlock passphrase 2911";
    const created = await runtime.auth.createFirstProfile({ displayName: "Synthetic unlock", password });
    const profileId = created.profile.profileId;
    runtime.auth.lock(created.authContext);
    let status = await (await request("/api/auth/profile")).json();
    assert.equal(status.sessionState, "missing-or-expired");
    assert.equal(status.profileDiagnostics[0].vaultState, "locked");
    assert.equal(status.profileDiagnostics[0].lastLockReason, "lock");
    const wrong = await request("/api/auth/profile", { action: "login", locator: profileId, password: "incorrect synthetic phrase" });
    assert.equal(wrong.ok, false);
    assert.equal((await (await request("/api/auth/profile")).json()).authenticated, false);
    const login = async () => {
      const response = await request("/api/auth/profile", { action: "login", locator: profileId, password });
      assert.equal(response.status, 200);
      cookie = response.headers.get("set-cookie").split(";", 1)[0];
      status = await (await request("/api/auth/profile")).json();
      assert.equal(status.authenticated, true);
      assert.equal(status.profileDiagnostics[0].vaultState, "unlocked");
      assert.equal(status.sessionState, "valid");
      assert.ok(status.sessionIdleExpiresAt);
      token = status.csrfToken;
    };
    await login();
    const input = { provider: "minimax", apiKey: "synthetic-private-key-2911", baseUrl: "https://api.minimax.io", textModel: "MiniMax-M2", imageModel: "image-01", videoModel: "MiniMax-Hailuo-2.3" };
    assert.equal((await request("/api/cloud-story-mode/provider", input, { "X-PlotPickle-CSRF": "wrong" })).status, 403);
    assert.equal((await request("/api/cloud-story-mode/provider", input, { Origin: "http://foreign.example" })).status, 403);
    const saved = await request("/api/cloud-story-mode/provider", input);
    assert.equal(saved.status, 200, await saved.text());
    // A separate runtime recreates the vault from disk; old cookie must fail closed.
    await worker.resetProfileExperienceRuntime();
    status = await (await request("/api/auth/profile")).json();
    assert.equal(status.authenticated, false);
    assert.equal(status.profileDiagnostics[0].vaultState, "locked");
    assert.equal(status.profileDiagnostics[0].lastLockReason, null, "unknown after restart is truthful");
    assert.equal((await request("/api/cloud-story-mode/provider", input)).status, 403);
    await login();
    const proofRequest = new Request(origin + "/api/auth/profile", { headers: { Cookie: cookie, Origin: origin } });
    const media = await worker.withAuthenticatedProfileRequest(proofRequest, () => worker.readMediaRoutingStore());
    const writing = await worker.withAuthenticatedProfileRequest(proofRequest, () => worker.readSynchronizedAssistantStore());
    assert.equal(media.profiles.minimax.apiKey, input.apiKey);
    assert.equal(writing.store.profiles.minimax.apiKey, input.apiKey);
    assert.equal(JSON.stringify(status).includes(input.apiKey), false);
    assert.equal(JSON.stringify(status).includes(password), false);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await worker?.resetProfileExperienceRuntime();
    for (const [key, value] of [["PLOTPICKLE_HOME", previous.home], ["PLOTPICKLE_AUTH_STATE_PATH", previous.auth]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});

test("#2911 Settings and cloud setup share an inline verified unlock without replacing story inputs", async () => {
  const read = file => readFile(file, "utf8");
  const [panel, settings, cloud, browser] = await Promise.all([
    read("app/_components/settings/profile-session-panel.tsx"), read("app/skin-v1/settings-workspace-panel.tsx"),
    read("app/skin-v1/cloud-provider-setup-panel.tsx"), read("core/auth/profile-request-browser.ts"),
  ]);
  assert.match(settings, /<ProfileSessionPanel/u);
  assert.match(cloud, /<ProfileSessionPanel onVerified=\{refresh\}/u);
  assert.match(browser, /"\/api\/cloud-story-mode"/u);
  assert.match(panel, /next\.profile\.profileId !== profileId/u);
  assert.match(panel, /vaultState !== "unlocked"/u);
  assert.match(panel, /finally \{ setPassword\(""\)/u);
  assert.doesNotMatch(panel, /localStorage\.setItem|sessionStorage\.setItem|hydrateProfilePrivateBrowser/u);
});

test("#2911 cloud authority obtains fresh CSRF and never submits with rejected session refresh", async () => {
  const source = await readFile("core/auth/profile-request-browser.ts", "utf8");
  const compiled = await build({ stdin: { contents: source, loader: "ts" }, format: "cjs", write: false, logLevel: "silent" });
  const calls = [];
  let authenticated = true;
  const context = { exports: {}, module: { exports: {} }, Headers, Request, URL,
    window: { location: { href: "http://127.0.0.1:4173/", origin: "http://127.0.0.1:4173" } },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return url === "/api/auth/profile"
        ? Response.json({ authenticated, csrfToken: authenticated ? "fresh-proof" : null })
        : Response.json({ ok: true });
    },
  };
  context.globalThis = context;
  vm.runInNewContext(compiled.outputFiles[0].text, context);
  await context.module.exports.authenticatedComputeFetch("/api/cloud-story-mode/provider", {
    method: "POST", headers: { "X-PlotPickle-CSRF": "stale-proof" }, body: "{}",
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.headers.get("X-PlotPickle-CSRF"), "fresh-proof");
  authenticated = false;
  calls.length = 0;
  await assert.rejects(context.module.exports.authenticatedComputeFetch("/api/cloud-story-mode/provider", { method: "POST", body: "{}" }), /Unlock/);
  assert.equal(calls.length, 1, "no provider write after session rejection");
});
