import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { ensureVerificationTools } from "../../run-webmcp-startup-uat.mjs";

// Real Settings components against bounded synthetic status. Handler/vault proof
// is separately owned by issue-2841-capability-harness.test.mjs.
const artifactRoot = path.resolve(".artifacts/2841-capability-settings");
await mkdir(artifactRoot, { recursive: true });
const output = await build({ stdin: { contents: 'import React from "react";import {createRoot} from "react-dom/client";import Settings from "./app/skin-v1/story-mode-host.tsx";import Agents from "./app/skin-v1/plotpickle-agents-host.tsx";createRoot(document.getElementById("root")).render(location.pathname === "/agents" ? <Agents/> : <Settings/>);', loader: "tsx", resolveDir: process.cwd() }, bundle: true, platform: "browser", format: "esm", jsx: "automatic", outfile: "fixture.js", write: false, logLevel: "silent" });
const javascript = output.outputFiles.find((file) => file.path.endsWith(".js")).text;
const css = (await readFile("app/skin-v1-definition.css", "utf8")) + (output.outputFiles.find((file) => file.path.endsWith(".css"))?.text || "");
const option = (locality, model, extra = {}) => ({ locality, model, configured: true, ready: true, verifiedAt: "2026-10-08T00:00:00.000Z", error: "", ...extra });
const routing = {
  ok: true,
  text: { selected: "ollama", options: { local: option("local", "synthetic-quality", { ready: false, verifiedAt: "", runtime: "ollama", baseUrl: "http://127.0.0.1:11434/v1", error: "" }), ollama: option("local", "synthetic-writing"), minimax: option("cloud", "synthetic-minimax"), openai: option("cloud", "synthetic-openai"), gemini: option("cloud", "synthetic-gemini") } },
  image: { selected: "comfyui", options: { comfyui: option("local", "sd_xl_base_1.0.safetensors"), openai: option("cloud", "synthetic-image"), minimax: option("cloud", "synthetic-image") } },
  video: { selected: "minimax", options: { "minimax-comfyui": option("local", "MiniMax-H3", { label: "ComfyUI", provider: "minimax", inferenceLocation: "cloud", cost: "Cloud generation through your MiniMax API account" }), minimax: option("cloud", "MiniMax-H3"), "comfyui-native": option("local", "MiniMax-H3", { label: "ComfyUI — Native local inference", ready: false }), "comfy-cloud": option("cloud", "", { label: "ComfyUI Cloud", ready: false, supported: false, error: "Generation workflow required." }), openai: option("cloud", "", { ready: false, supported: false, error: "OpenAI Videos API was removed." }) } },
};
const writes = [];
let server, browser;
try {
  server = createServer(async (request, response) => {
    const pathname = request.url.split("?", 1)[0];
    response.setHeader("Cache-Control", "no-store");
    if (pathname === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(javascript); return; }
    if (pathname === "/fixture.css") { response.setHeader("Content-Type", "text/css"); response.end(css); return; }
    if (pathname.startsWith("/api/")) {
      response.setHeader("Content-Type", "application/json");
      if (request.method === "POST") {
        let source = ""; for await (const chunk of request) source += chunk;
        const body = JSON.parse(source); writes.push({ pathname, body });
        if (pathname === "/api/ai-routing/select") { assert.ok(routing[body.capability].options[body.route].ready); routing[body.capability].selected = body.route; }
      }
      const bodies = {
        "/api/auth/profile": { authenticated: true, csrfToken: "synthetic-settings-csrf", profile: { profileId: "synthetic-settings-owner", displayName: "Synthetic owner" } },
        "/api/ai-routing/status": routing, "/api/ai-routing/select": routing,
        "/api/writing-assistant/agent-compute": { ok: true, defaultProvider: "active", activeProvider: "ollama", overrides: {}, providers: [{ id: "ollama", label: "Ollama", model: "synthetic-writing", ready: true }], agents: [{ agentId: "synthetic-agent", roleId: "graphic-novel", displayName: "Synthetic text Agent", title: "Story writer", responsibility: "Write synthetic story captions", system: "PlotPickle", configurable: true }] },
        "/api/story-mode/policy": { ok: true, mode: "hybrid" },
        "/api/media-routing/status": { ok: true, comfyui: { reachable: true, imageNodesReady: true, imageVerifiedAt: "synthetic", checkpoints: ["sd_xl_base_1.0.safetensors"] } },
        "/api/local-ai/plugins/video": { recommendation: { selected: null, candidates: [], ready: false, active: false } },
        "/api/cloud-story-mode/comfy-cloud": { ok: true, configured: true, tested: true, defaultLane: "cinematic" },
        "/api/ai-routing/diagnostics": { ok: true, events: [{ id: "synthetic-event", at: "2026-10-08T00:00:00.000Z", capability: "video", route: "minimax-comfyui", runtime: "local", provider: "minimax", stage: "saved", code: "video-downloaded-and-saved", jobId: "synthetic-job" }] },
      };
      response.end(JSON.stringify(bodies[pathname] || { ok: true })); return;
    }
    response.setHeader("Content-Type", "text/html");
    response.end('<!doctype html><html data-plotpickle-skin="skin-v1"><head><link rel="stylesheet" href="/fixture.css"/><style>body{margin:24px;background:#101510;color:#ddd;font-family:monospace}button,input,textarea{font:inherit}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let chromium;
  if (process.env.PLOTPICKLE_PRODUCT_PLAYWRIGHT_MODULE) ({ chromium } = await import(pathToFileURL(path.resolve(process.env.PLOTPICKLE_PRODUCT_PLAYWRIGHT_MODULE)).href));
  else { const tools = path.join(artifactRoot, "tools"); await ensureVerificationTools(tools); ({ chromium } = createRequire(path.join(tools, "package.json"))("@playwright/test")); }
  browser = await chromium.launch({ headless: true, ...(process.env.PLOTPICKLE_PRODUCT_BROWSER_EXECUTABLE ? { executablePath: process.env.PLOTPICKLE_PRODUCT_BROWSER_EXECUTABLE } : {}), args: ["--disable-background-networking", "--disable-gpu"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.route("**/*", (route) => new URL(route.request().url()).origin === baseUrl ? route.continue() : route.abort());
  const page = await context.newPage(); const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseUrl);
  await page.locator('[data-story-mode-policy="local"]').click();
  await page.locator('[data-skin-menu-row="writing"]').click();
  const writing = page.locator('[data-story-mode-capability="writing"]');
  assert.equal(await writing.locator("button").count(), 2, "Local Writing shows its exact Quality runtime separately from the optional Ollama profile");
  assert.equal(await writing.locator('[data-story-mode-connection="local"][data-connection-state="needs-test"]').count(), 1,
    "discovered Quality model is not falsely READY without a successful response test");
  assert.equal(await writing.locator('[data-story-mode-connection="ollama"][data-connection-state="ready"]').count(), 1,
    "a separately tested Ollama resource retains its own verified status");
  assert.equal(await page.getByRole("button", { name: "Test Writing" }).count(), 1,
    "Human can request a real exact-model response test from Local Writing");
  assert.equal(await writing.getByRole("img", { name: "Ollama Ready" }).count(), 1);
  assert.equal(await writing.getByText("Use for Writing", { exact: true }).count(), 0);
  assert.equal(writes.length, 0, "Opening Local/Writing must never activate a route or execution policy.");
  await page.screenshot({ fullPage: true, path: path.join(artifactRoot, "local-writing.png") });
  await page.getByRole("button", { name: "Back to Story Mode", exact: true }).click();
  await page.locator('[data-story-mode-policy="cloud"]').click();
  await page.locator('[data-skin-menu-row="writing"]').click();
  assert.equal(await page.locator('[data-story-mode-capability="writing"] button').count(), 3);
  assert.equal(writes.length, 0);
  await page.screenshot({ fullPage: true, path: path.join(artifactRoot, "cloud-writing.png") });
  await page.getByRole("button", { name: "Back to Story Mode", exact: true }).click();
  await page.locator('[data-story-mode-policy="hybrid"]').click();
  const hybrid = page.locator('[data-hybrid-story-mode="capability-matrix"]');
  await hybrid.locator('[data-route="minimax-comfyui"]').waitFor();
  assert.equal(await hybrid.locator('input[type="checkbox"]').count(), 0);
  assert.equal(await hybrid.locator('[data-story-mode-job-routing]').count(), 0);
  await hybrid.locator('[data-hybrid-capability="video"] [data-route="minimax-comfyui"]').click();
  await hybrid.locator('[data-hybrid-capability="video"] [data-route="minimax-comfyui"][data-selected="true"]').waitFor();
  assert.equal(writes.length, 1); assert.equal(writes[0].pathname, "/api/ai-routing/select");
  await page.getByText("Connectivity diagnostics", { exact: true }).click();
  await page.getByRole("log").getByText(/video downloaded and saved/).waitFor();
  await page.screenshot({ fullPage: true, path: path.join(artifactRoot, "hybrid-video-diagnostics.png") });
  await page.reload(); await page.locator('[data-story-mode-policy="hybrid"]').click();
  await page.locator('[data-hybrid-capability="video"] [data-route="minimax-comfyui"][data-selected="true"]').waitFor();
  assert.equal(writes.length, 1, "Reload/status inspection must leave route selection intact.");
  await page.goto(baseUrl + "/agents");
  await page.getByText("Hybrid Writing selection", { exact: true }).waitFor();
  assert.equal(await page.locator("select").count(), 0);
  assert.equal(writes.length, 1, "Agent roster must not change the Hybrid route.");
  await page.screenshot({ fullPage: true, path: path.join(artifactRoot, "agents-writing-route.png") });
  assert.deepEqual(errors, []);
  const report = { status: "PASS", sourceHead: process.env.PLOTPICKLE_PROOF_SOURCE_HEAD || "local-working-tree", scope: "Actual Local/Cloud/Hybrid Settings components with bounded synthetic connection status", observations: ["Local and Cloud setup navigation performs no selection/policy write", "one setup action per provider", "accessible checked Ready marker", "Hybrid has no duplicate consent or job preferences", "Hybrid selects explicit local ComfyUI MiniMax video route", "diagnostic history relays saved outcome", "reload retains the selected route", "Agent roster displays Hybrid Writing without duplicate selectors"], screenshots: ["local-writing.png", "cloud-writing.png", "hybrid-video-diagnostics.png", "agents-writing-route.png"], handlerProof: "tests/issue-2841-capability-harness.test.mjs", providerInference: false, humanWindowsAcceptance: "PENDING" };
  await writeFile(path.join(artifactRoot, "proof.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("#2841 rendered capability Settings proof PASS");
} finally { await browser?.close(); server?.closeAllConnections(); if (server) await new Promise((resolve) => server.close(resolve)); }
