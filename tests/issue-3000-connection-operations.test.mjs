import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createConnectionCommandSession, parseConnectionCommand } from "../app/_components/settings/connection-command.mjs";

const TOKEN = "0123456789abcdef";
function harness() {
  const option = (locality, extra = {}) => ({ configured: true, ready: true, model: "synthetic", verifiedAt: "synthetic", locality, ...extra });
  const state = { profile: "synthetic-a", now: 0, posts: [], opened: [], changed: 0, status: {
    text: { selected: "local", options: { local: option("local"), ollama: option("local"), openai: option("cloud"), gemini: option("cloud"), minimax: option("cloud"), off: option("off", { ready: false, disabled: true }) } },
    image: { selected: "manual", options: { comfyui: option("local", { imageProfile: "sdxl-1.0" }), "ollama-comfyui": option("local"), openai: option("cloud"), manual: option("manual", { ready: false, disabled: true }) } },
    video: { selected: "off", options: { minimax: option("cloud"), "minimax-comfyui": option("cloud"), "ltx-video": option("local"), "comfyui-native": option("local"), openai: option("cloud", { supported: false }), off: option("off", { ready: false, disabled: true }) } }, joins: {},
  } };
  const session = createConnectionCommandSession({
    profile: async () => state.profile, now: () => state.now, token: () => TOKEN,
    changed: () => { state.changed++; },
    openMode: async mode => { state.opened.push(mode); },
    request: async (path, body) => {
      if (!body) return structuredClone(state.status);
      state.posts.push({ path, body });
      if (path.endsWith("/select")) state.status[body.capability].selected = body.route;
      if (path.endsWith("/join")) {
        const route = body.provider;
        state.status.joins[body.capability] = { ...body, route };
        if (state.status[body.capability].options[route].ready) state.status[body.capability].selected = route;
      }
      return { ok: true, id: "synthetic-job", status: "queued" };
    },
  });
  return { state, run: text => session.execute(parseConnectionCommand(`PlotPickle connections ${text}`)) };
}

test("#3000 bounded grammar withholds credential-like and unsupported input", () => {
  for (const value of ["test writing openai key=secret", "join video direct openai SECRET", "confirm 0123456789abcdef charges password", "setup openai secret"]) assert.deepEqual(parseConnectionCommand(`PlotPickle connections ${value}`), { action: "invalid" });
  assert.equal(parseConnectionCommand("PlotPickle connections hybrid"), null);
  assert.equal(parseConnectionCommand("unrelated conversation"), null);
  for (const action of ["test", "select", "join"]) for (const category of ["constructor", "__proto__", "tostring"]) {
    assert.deepEqual(parseConnectionCommand(`PlotPickle connections ${action} ${category} direct ollama`), { action: "invalid" });
    assert.deepEqual(parseConnectionCommand(`PlotPickle connections ${action} ${category} ollama`), { action: "invalid" });
  }
  assert.deepEqual(parseConnectionCommand("/PlotPickle connections select writing ollama"), { action: "select", capability: "text", route: "ollama" });
});

test("#3000 read-only runtime status preserves selected/configured/verified distinctions and exact Hybrid blockers", async () => {
  const h = harness();
  h.state.status.text.options.openai.ready = false;
  h.state.status.text.options.openai.error = "synthetic-secret-provider-payload";
  const before = structuredClone(h.state.status);
  const result = await h.run("status hybrid");
  assert.match(result, /text: selected local/);
  assert.match(result, /openai: configured=true; ready=false/);
  assert.match(result, /video direct\/openai: This route is not capable/);
  assert.match(result, /ComfyUI Cloud.*executable verified workflow adapter is not available/);
  assert.doesNotMatch(result, /synthetic-secret-provider-payload/);
  assert.deepEqual(h.state.status, before);
  assert.equal(h.state.posts.length, 0);
});

test("#3000 exact local Quality test requires preview then consumes confirmation without selecting", async () => {
  const h = harness();
  assert.match(await h.run("test writing local"), /CONNECTION PREVIEW/);
  assert.equal(h.state.posts.length, 0);
  assert.match(await h.run(`confirm ${TOKEN}`), /TEST REQUEST RETURNED/);
  assert.deepEqual(h.state.posts, [{ path: "/api/writing-assistant/test", body: { provider: "local", modelRole: "quality" } }]);
  assert.equal(h.state.status.text.selected, "local");
  assert.match(await h.run(`confirm ${TOKEN}`), /BLOCKED/);
  assert.equal(h.state.posts.length, 1);
});

test("#3000 route selection uses exact owner and verifies current state", async () => {
  const h = harness();
  await h.run("select writing ollama");
  assert.equal(h.state.status.text.selected, "local");
  await h.run(`confirm ${TOKEN}`);
  assert.deepEqual(h.state.posts, [{ path: "/api/ai-routing/select", body: { capability: "text", route: "ollama" } }]);
  assert.equal(h.state.status.text.selected, "ollama");
});

test("#3000 unverified Join saves configuration only; unsupported pair never submits", async () => {
  const h = harness();
  h.state.status.text.options.ollama.ready = false;
  h.state.status.text.options.ollama.error = "synthetic-secret-join-payload";
  const preview = await h.run("join writing direct ollama");
  assert.match(preview, /Will save Join only/);
  assert.doesNotMatch(preview, /synthetic-secret-join-payload/);
  await h.run(`confirm ${TOKEN}`);
  assert.equal(h.state.status.text.selected, "local");
  assert.equal(h.state.status.joins.text.provider, "ollama");
  assert.match(await h.run("join video direct openai"), /not capable/);
  assert.equal(h.state.posts.length, 1);
  assert.match(await h.run("select writing ollama"), /needs setup/);
  assert.equal(h.state.posts.length, 1);
});

test("#3000 expiry, cancellation, changed profile and stale execution identity fail closed", async () => {
  for (const change of [h => { h.state.now = 120001; }, h => { h.state.profile = "synthetic-b"; }, h => { h.state.status.text.options.local.model = "changed"; }, h => { h.state.status.text.selected = "ollama"; }, async h => { await h.run("cancel"); }]) {
    const h = harness(); await h.run("test writing local"); await change(h);
    assert.match(await h.run(`confirm ${TOKEN}`), /BLOCKED/);
    assert.equal(h.state.posts.length, 0);
  }
});

test("#3000 cloud tests require charge and video-sharing acknowledgement; job submission is not completion", async () => {
  const h = harness();
  await h.run("test video minimax");
  assert.match(await h.run(`confirm ${TOKEN} charges`), /acknowledgement is missing/);
  assert.equal(h.state.posts.length, 0);
  await h.run("test video minimax");
  const result = await h.run(`confirm ${TOKEN} charges share`);
  assert.match(result, /submission is not completed verification/);
  assert.deepEqual(h.state.posts, [{ path: "/api/media-routing/test/video", body: { route: "minimax-direct", billingAcknowledged: true, dataSharingAcknowledged: true } }]);
  assert.equal(h.state.status.video.selected, "off");
});

test("#3000 raw request failures cannot disclose secrets or retry a submitted operation", async () => {
  let posts = 0;
  const status = { text: { selected: "local", options: { local: { configured: true, ready: true } } } };
  const session = createConnectionCommandSession({ profile: async () => "synthetic", now: () => 0, token: () => TOKEN, changed() {}, request: async (_path, body) => { if (body) { posts++; throw new Error("secret-api-key"); } return status; } });
  await session.execute({ action: "test", capability: "text", route: "local" });
  const result = await session.execute({ action: "confirm", token: TOKEN });
  assert.match(result, /BLOCKED/); assert.doesNotMatch(result, /secret-api-key/);
  await session.execute({ action: "confirm", token: TOKEN });
  assert.equal(posts, 1);
});

test("#3000 provider Setup navigates through existing Local/Cloud host without accepting secrets", async () => {
  const h = harness();
  assert.deepEqual(parseConnectionCommand("/PlotPickle connections setup openai"), { action: "setup", provider: "openai", mode: "cloud" });
  assert.deepEqual(parseConnectionCommand("PlotPickle connections setup comfyui"), { action: "setup", provider: "comfyui", mode: "local" });
  assert.deepEqual(parseConnectionCommand("PlotPickle connections setup openai key=secret"), { action: "invalid" });
  assert.deepEqual(parseConnectionCommand("PlotPickle connections setup __proto__"), { action: "invalid" });
  const original = JSON.stringify(h.state.status);
  assert.match(await h.run("setup openai"), /existing CLOUD Settings/);
  assert.match(await h.run("setup ollama"), /existing LOCAL Settings/);
  assert.deepEqual(h.state.opened, ["cloud", "local"]);
  assert.deepEqual(h.state.posts, []);
  assert.equal(h.state.changed, 0);
  assert.equal(JSON.stringify(h.state.status), original);
  await h.run("test writing local");
  await h.run("setup gemini");
  assert.match(await h.run(`confirm ${TOKEN}`), /BLOCKED/);
  assert.deepEqual(h.state.posts, []);
  h.state.profile = "";
  assert.match(await h.run("setup minimax"), /BLOCKED/);
  assert.deepEqual(h.state.opened, ["cloud", "local", "cloud"]);
});

test("#3000 selected route reads back identically in a fresh controller as in the GUI-owned status", async () => {
  const h = harness();
  await h.run("select writing openai");
  assert.match(await h.run(`confirm ${TOKEN} charges`), /text: selected openai/);
  assert.equal(h.state.posts.at(-1).path, "/api/ai-routing/select");
  const fresh = createConnectionCommandSession({
    profile: async () => h.state.profile,
    now: () => h.state.now,
    token: () => TOKEN,
    changed: () => {},
    request: async () => structuredClone(h.state.status),
  });
  assert.match(await fresh.execute(parseConnectionCommand("PlotPickle connections status hybrid")), /text: selected openai/);
  assert.equal(h.state.status.text.selected, "openai");
});

test("#3000 CMD status redacts credential-looking model metadata and malformed Join identities", async () => {
  const h = harness();
  h.state.status.text.options.openai.model = "sk-proj-example-secret";
  h.state.status.image.options.comfyui.model = "line1\\nprivate-token";
  h.state.status.joins.text = { engine: "secret-provider-key", provider: "openai", route: "openai" };
  const result = await h.run("status hybrid");
  assert.doesNotMatch(result, /sk-proj-example-secret|line1|private-token|secret-provider-key/u);
  assert.match(result, /withheld; inspect secure Setup/u);
  assert.match(result, /Join NOT CAPABLE/u);
  assert.equal(h.state.posts.length, 0);
});

test("#3000 CMD setup navigation and GUI route operations use shared product owners", async () => {
  const read = name => readFile(new URL("../" + name, import.meta.url), "utf8");
  const [host, dashboard, hybrid, gateway] = await Promise.all([
    read("app/skin-v1/global-dsdd-conversation.tsx"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/hybrid-story-mode-panel.tsx"),
    read("build/ai-routing-gateway.ts"),
  ]);
  assert.match(host, /openMode: \(mode: "local" \| "cloud"\)/u);
  assert.match(host, /new CustomEvent\("plotpickle:open-story-mode", \{ detail: mode \}\)/u);
  assert.match(dashboard, /plotpickle:open-story-mode/u);
  assert.match(hybrid, /fetch\("\/api\/ai-routing\/status"/u);
  assert.match(hybrid, /fetch\("\/api\/ai-routing\/join"/u);
  for (const route of ["status", "select", "join"]) assert.ok(gateway.includes('"' + "/api/ai-routing".slice(0, 15) + '"') || gateway.includes("/api/ai-routing"));
  assert.match(host, /authenticatedComputeFetch as fetch/u);
  assert.match(host, /profilePrivateBrowserReadyFor\(profile\)/u);
});
