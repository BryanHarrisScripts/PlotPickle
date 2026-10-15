import assert from "node:assert/strict";
import test from "node:test";
import { createConnectionCommandSession, parseConnectionCommand } from "../app/_components/settings/connection-command.mjs";

const TOKEN = "0123456789abcdef";
function harness() {
  const option = (locality, extra = {}) => ({ configured: true, ready: true, model: "synthetic", verifiedAt: "synthetic", locality, ...extra });
  const state = { profile: "synthetic-a", now: 0, posts: [], changed: 0, status: {
    text: { selected: "local", options: { local: option("local"), ollama: option("local"), openai: option("cloud"), gemini: option("cloud"), minimax: option("cloud"), off: option("off", { ready: false, disabled: true }) } },
    image: { selected: "manual", options: { comfyui: option("local", { imageProfile: "sdxl-1.0" }), "ollama-comfyui": option("local"), openai: option("cloud"), manual: option("manual", { ready: false, disabled: true }) } },
    video: { selected: "off", options: { minimax: option("cloud"), "minimax-comfyui": option("cloud"), "ltx-video": option("local"), "comfyui-native": option("local"), openai: option("cloud", { supported: false }), off: option("off", { ready: false, disabled: true }) } }, joins: {},
  } };
  const session = createConnectionCommandSession({
    profile: async () => state.profile, now: () => state.now, token: () => TOKEN,
    changed: () => { state.changed++; },
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
  assert.deepEqual(parseConnectionCommand("/PlotPickle connections select writing ollama"), { action: "select", capability: "text", route: "ollama" });
});

test("#3000 read-only runtime status preserves selected/configured/verified distinctions and exact Hybrid blockers", async () => {
  const h = harness();
  h.state.status.text.options.openai.ready = false;
  const before = structuredClone(h.state.status);
  const result = await h.run("status hybrid");
  assert.match(result, /text: selected local/);
  assert.match(result, /openai: configured=true; ready=false/);
  assert.match(result, /video direct\/openai: This route is not capable/);
  assert.match(result, /ComfyUI Cloud.*executable verified workflow adapter is not available/);
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
  assert.match(await h.run("join writing direct ollama"), /Will save Join only/);
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
