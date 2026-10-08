import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import { selectedImageExecution, routeExecution } from "../core/contracts/compute/capability-routes.mjs";

test("#2841 harness follows only the selected route, never locality preferences or unavailable fallbacks", () => {
  const candidates = [{ routeId: "comfyui", locality: "local", ready: true, selected: false }, { routeId: "openai", locality: "cloud", ready: true, selected: true }];
  assert.equal(selectedImageExecution("hybrid", candidates).routeId, "openai");
  assert.throws(() => selectedImageExecution("local", candidates), /Switch Story Mode/);
  candidates[1].ready = false;
  assert.throws(() => selectedImageExecution("hybrid", candidates), /not ready/);
  assert.deepEqual(routeExecution("video", "minimax-comfyui"), { disabled: false, provider: "minimax", runtimeLocation: "local", inferenceLocation: "cloud", paid: true, dataSharing: true });
});

test("#2841 actual authenticated setup, test, select, dispatch and encrypted restart share one authority", async () => {
  const root = await mkdtemp(path.join(path.resolve("node_modules"), ".harness-2841-"));
  const previousHome = process.env.PLOTPICKLE_HOME;
  const previousAuth = process.env.PLOTPICKLE_AUTH_STATE_PATH;
  const realFetch = globalThis.fetch;
  process.env.PLOTPICKLE_HOME = path.join(root, "private");
  process.env.PLOTPICKLE_AUTH_STATE_PATH = path.join(root, "private", "auth", "state.json");
  let worker, server, context, runtime;
  let requests = 0;
  let reachable = true;
  let submitted;
  const workflow = { "1": { class_type: "MiniMaxH3KeyNode", inputs: { token: "{{PLOTPICKLE_MINIMAX_KEY}}", base_url: "https://synthetic.invalid" } }, "2": { class_type: "MiniMaxH3FirstLastFrameURLNode", inputs: { key: ["1", 0], prompt: "{{PLOTPICKLE_PROMPT}}", first_frame_url: "{{PLOTPICKLE_SOURCE_IMAGE}}", duration: 5 } }, "3": { class_type: "SaveVideo", inputs: { video: ["2", 0] } } };
  const nodeNames = ["CheckpointLoaderSimple", "CLIPTextEncode", "EmptyLatentImage", "KSampler", "VAEDecode", "SaveImage", ...Object.values(workflow).map((node) => node.class_type)];
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64");
  try {
    const entry = path.join(root, "entry.ts");
    await writeFile(entry, [
      'export { getProfileExperienceRuntime, resetProfileExperienceRuntime } from "./core/auth/profile-experience/profile-experience-runtime";',
      'export { profileRequestScope, profileScopedBuzzRequestContext } from "./build/auth/profile-request-context";',
      'export { readCredentialJson, writeCredentialJson, writeComputeSelection } from "./build/local-credentials";',
      'export { readMediaRoutingStore, writeMediaRoutingStore } from "./build/media-routing-store";',
      'export { readSynchronizedAssistantStore, writeAssistantStore } from "./build/writing-assistant-store";',
      'export { registerAiRoutingGateway, readRoutingChoice } from "./build/ai-routing-gateway";',
      'export { registerAgentComputeGateway } from "./build/agent-compute-gateway";',
      'export { registerMediaRoutingGateway } from "./build/media-routing-gateway";',
      'export { relayCapabilityDiagnostic } from "./build/ai/capabilities/capability-diagnostics";',
      'export { saveGeneratedAsset } from "./build/media-provider-common";',
      'export { POST } from "./app/api/cloud-story-mode/provider/route";',
    ].map((line) => line.replace(/from "\.\//, `from "${process.cwd().replaceAll("\\", "/")}/`)).join("\n"));
    const outfile = path.join(root, "worker.mjs");
    await build({ entryPoints: [entry], outfile, bundle: true, platform: "node", format: "esm", packages: "external", logLevel: "silent" });
    worker = await import(pathToFileURL(outfile).href);
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.url || String(input));
      if (url.port === "8188") {
        if (!reachable) throw new Error("Synthetic ComfyUI unavailable");
        if (url.pathname === "/system_stats") return Response.json({ system: { comfyui_version: "synthetic" }, devices: [{ name: "Synthetic GPU", type: "cuda", vram_total: 32 * 1024 ** 3, vram_free: 32 * 1024 ** 3 }] });
        if (url.pathname.startsWith("/object_info")) {
          const names = url.pathname === "/object_info" ? nodeNames : [decodeURIComponent(url.pathname.split("/").at(-1))];
          return Response.json(Object.fromEntries(names.filter((name) => nodeNames.includes(name)).map((name) => [name, { input: { required: name === "CheckpointLoaderSimple" ? { ckpt_name: [["sd_xl_base_1.0.safetensors"]] } : {} } }])));
        }
        if (url.pathname === "/prompt") { submitted = JSON.parse(init.body).prompt; requests++; return Response.json({ prompt_id: submitted["3"]?.class_type === "SaveVideo" ? "synthetic-video" : "synthetic-image" }); }
        if (url.pathname.startsWith("/history/")) { const id = url.pathname.split("/").at(-1); return Response.json({ [id]: { outputs: { "3": id === "synthetic-video" ? { videos: [{ filename: "synthetic.mp4", type: "output" }] } : { images: [{ filename: "synthetic.png", type: "output" }] } }, status: { status_str: "success" } } }); }
        if (url.pathname === "/view") return new Response(url.searchParams.get("filename").endsWith(".mp4") ? Buffer.from("synthetic-video-bytes-for-handler-proof") : png);
      }
      if (url.hostname === "synthetic.invalid") { requests++; return Response.json({ task_id: "synthetic-direct" }); }
      if (url.port === "11434") {
        if (url.pathname.endsWith("/tags")) return Response.json({ models: [{ name: "synthetic-writing" }] });
        if (url.pathname.endsWith("/version")) return Response.json({ version: "synthetic" });
      }
      return realFetch(input, init);
    };
    runtime = await worker.getProfileExperienceRuntime();
    const password = "Synthetic harness passphrase 2841";
    let owner = await runtime.auth.createFirstProfile({ displayName: "Synthetic harness owner", password });
    const ownerId = owner.profile.profileId;
    context = { authContext: owner.authContext, profileId: ownerId, privateStorage: runtime.privateStorage };
    const scoped = (fn) => worker.profileRequestScope.run(context, fn);
    const middlewares = [];
    const vite = { middlewares: { use: (fn) => middlewares.push(fn) } };
    worker.profileScopedBuzzRequestContext().configureServer(vite);
    worker.registerAiRoutingGateway(vite); worker.registerAgentComputeGateway(vite); worker.registerMediaRoutingGateway(vite);
    server = createServer((request, response) => { let index = 0; const next = () => { if (index < middlewares.length) middlewares[index++](request, response, next); else { response.statusCode = 404; response.end(); } }; next(); });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const session = runtime.establishSession(owner.authContext, origin);
    const headers = { Cookie: session.setCookie.split(";", 1)[0], Origin: origin, "X-PlotPickle-CSRF": session.csrfToken, "Content-Type": "application/json" };
    async function api(endpoint, body, expected = 200) { const response = await realFetch(origin + endpoint, { headers, ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }) }); const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result; }
    await scoped(() => worker.writeCredentialJson("plotpickle-agent-compute.json", { version: 1, defaultProvider: "openai", overrides: { "graphic-novel": "gemini" }, updatedAt: "synthetic-legacy-assignment" }));
    await scoped(() => worker.writeCredentialJson("ai-routing.json", { version: 2, text: "off", image: "comfyui", video: "off", updatedAt: "synthetic" }));
    const agentStatus = await api("/api/writing-assistant/agent-compute");
    assert.equal(agentStatus.activeProvider, "disabled"); assert.deepEqual(agentStatus.overrides, {}, "Agent roster follows Hybrid instead of legacy assignments.");
    await api("/api/writing-assistant/agent-compute", { scope: "default", provider: "openai" }, 400);
    const authority = { provider: "minimax", baseUrl: "https://synthetic.invalid", apiKey: "synthetic-private-minimax-key", textModel: "synthetic-text", imageModel: "synthetic-image", videoModel: "MiniMax-H3" };
    const saved = await worker.POST(new Request(origin + "/api/cloud-story-mode/provider", { method: "POST", headers, body: JSON.stringify(authority) }));
    assert.equal(saved.status, 200); assert.equal(requests, 0);
    let media = await scoped(() => worker.readMediaRoutingStore());
    media.profiles.minimax.videoVerifiedAt = "synthetic-direct-proof";
    await scoped(() => worker.writeMediaRoutingStore(media));
    await scoped(() => worker.writeCredentialJson("ai-routing.json", { version: 2, text: "off", image: "comfyui", video: "minimax", updatedAt: "synthetic-selection" }));
    await api("/api/media-routing/comfyui/h3-workflow", { workflow });
    assert.equal((await scoped(() => worker.readRoutingChoice())).video, "minimax", "Import must not activate ComfyUI.");
    await api("/api/media-routing/test/video", { route: "minimax-comfyui", billingAcknowledged: true, dataSharingAcknowledged: true }, 400);
    assert.equal(requests, 0, "Action flags cannot manufacture saved setup acknowledgment.");
    await api("/api/ai-routing/consent", { provider: "minimax", billing: true, dataSharing: true });
    const source = await scoped(() => worker.saveGeneratedAsset(png, "synthetic-locked-shot", ".png"));
    const started = await api("/api/media-routing/test/video", { route: "minimax-comfyui", sourceAssetUrl: source, billingAcknowledged: true, dataSharingAcknowledged: true });
    assert.match(submitted["2"].inputs.first_frame_url, /^data:image\/png;base64,/);
    assert.equal(submitted["1"].inputs.token, authority.apiKey);
    const finished = await api(`/api/local-ai/video/${started.id}`);
    assert.equal(finished.status, "succeeded"); assert.match(finished.outputAssetUrl, /\.mp4$/);
    assert.equal((await scoped(() => worker.readRoutingChoice())).video, "minimax", "Test completion must not change selection.");
    media = await scoped(() => worker.readMediaRoutingStore());
    assert.equal(media.videoRoute, "none", "Test must not change the execution projection.");
    let status = await api("/api/ai-routing/status");
    assert.equal(status.video.options["minimax-comfyui"].ready, true);
    assert.equal(status.video.options.off.ready, false);
    assert.equal(status.video.options.openai.ready, false);
    assert.equal(status.video.options["comfy-cloud"].ready, false);
    const selected = await api("/api/ai-routing/select", { capability: "video", route: "minimax-comfyui" });
    assert.equal(selected.video.selected, "minimax-comfyui");
    assert.equal((await scoped(() => worker.readMediaRoutingStore())).videoRoute, "minimax-comfyui");
    await api("/api/ai-routing/select", { capability: "video", route: "openai", paidAcknowledged: true, dataSharingAcknowledged: true }, 400);
    await api("/api/ai-routing/status"); await api("/api/ai-routing/status");
    assert.equal((await scoped(() => worker.readRoutingChoice())).video, "minimax-comfyui", "Status reads must not collapse the route to direct MiniMax.");
    const beforeBlock = requests;
    reachable = false;
    status = await api("/api/ai-routing/status");
    assert.equal(status.video.selected, "minimax-comfyui"); assert.equal(status.video.options["minimax-comfyui"].ready, false);
    await api("/api/local-ai/generate/video", { prompt: "Synthetic private shot prompt", sourceAssetUrl: source, billingAcknowledged: true, dataSharingAcknowledged: true }, 400);
    assert.equal(requests, beforeBlock, "Unavailable selected route sends no paid request and uses no direct fallback.");
    reachable = true;
    await api("/api/local-ai/generate/video", { prompt: "Synthetic private shot prompt", sourceAssetUrl: source, billingAcknowledged: true, dataSharingAcknowledged: true });
    assert.equal(requests, beforeBlock + 1);
    await scoped(() => worker.writeCredentialJson("story-mode-job-routing.json", { version: 1, jobs: { "image-fast-draft": "cloud-first", "image-precision-edit": "cloud-first" }, updatedAt: "synthetic" }));
    media = await scoped(() => worker.readMediaRoutingStore()); media.comfyui.imageVerifiedAt = "synthetic-image-proof";
    await scoped(() => worker.writeMediaRoutingStore(media));
    const image = await api("/api/local-ai/generate/image", { prompt: "Synthetic image", requestCount: 1, quality: "low" });
    assert.equal(image.route, "comfyui"); assert.equal(image.jobRouting.preference, "selected");
    const beforeDiagnostics = requests;
    const diagnostics = await api("/api/ai-routing/diagnostics");
    assert.ok(diagnostics.events.some((event) => event.stage === "submitted"));
    assert.ok(diagnostics.events.some((event) => event.stage === "saved"));
    assert.equal(requests, beforeDiagnostics);
    assert.ok(!JSON.stringify(diagnostics).includes(authority.apiKey)); assert.ok(!JSON.stringify(diagnostics).includes("Synthetic private shot prompt"));
    const other = await runtime.auth.createProfile({ displayName: "Synthetic isolated owner", password }, owner.authContext);
    const otherContext = { authContext: other.authContext, profileId: other.profile.profileId, privateStorage: runtime.privateStorage };
    assert.equal(await worker.profileRequestScope.run(otherContext, () => worker.readCredentialJson("media-comfy-video-jobs.json")), null);
    assert.equal(await worker.profileRequestScope.run(otherContext, () => worker.readCredentialJson("capability-diagnostics.json")), null);
    await worker.resetProfileExperienceRuntime(); runtime = await worker.getProfileExperienceRuntime();
    owner = await runtime.auth.authenticate({ profileId: ownerId, password });
    context = { authContext: owner.authContext, profileId: ownerId, privateStorage: runtime.privateStorage };
    assert.equal((await scoped(() => worker.readRoutingChoice())).video, "minimax-comfyui");
    media = await scoped(() => worker.readMediaRoutingStore()); assert.ok(media.comfyui.h3Workflow.verifiedAt);
    assert.equal((await scoped(() => worker.readCredentialJson("provider-consent.json"))).minimax.billing, true);
    assert.ok((await scoped(() => worker.readCredentialJson("media-comfy-video-jobs.json"))).length);
    const record = await runtime.privateStorage.readCredential(owner.authContext, "compute-setup.json");
    assert.equal(record.settings["ai-routing.json"].video, record.settings["media-routing.json"].videoRoute);
    const renewed = runtime.establishSession(owner.authContext, origin);
    headers.Cookie = renewed.setCookie.split(";", 1)[0]; headers["X-PlotPickle-CSRF"] = renewed.csrfToken;
    const savedChoice = record.settings["ai-routing.json"];
    await assert.rejects(scoped(() => worker.writeComputeSelection({ "ai-routing.json": { ...savedChoice, video: "off" } }, { "ai-routing.json": { ...savedChoice, video: "minimax" } })), /Compute setup changed/);
    assert.equal((await scoped(() => worker.readRoutingChoice())).video, "minimax-comfyui", "Stale selection writes must be rejected atomically.");
    await api("/api/media-routing/comfyui/h3-workflow", { workflow });
    assert.equal((await scoped(() => worker.readMediaRoutingStore())).videoRoute, "minimax-comfyui", "Workflow replacement retains the selected execution projection.");
    status = await api("/api/ai-routing/status");
    assert.equal(status.video.selected, "minimax-comfyui"); assert.equal(status.video.options["minimax-comfyui"].ready, false);
    const beforeRetest = requests;
    await api("/api/local-ai/generate/video", { prompt: "Synthetic blocked replacement" }, 400);
    assert.equal(requests, beforeRetest, "A replacement workflow requires new proof before dispatch.");
  } finally {
    globalThis.fetch = realFetch; await worker?.resetProfileExperienceRuntime();
    server?.closeAllConnections(); if (server) await new Promise((resolve) => server.close(resolve));
    if (previousHome === undefined) delete process.env.PLOTPICKLE_HOME; else process.env.PLOTPICKLE_HOME = previousHome;
    if (previousAuth === undefined) delete process.env.PLOTPICKLE_AUTH_STATE_PATH; else process.env.PLOTPICKLE_AUTH_STATE_PATH = previousAuth;
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("#2841 setup controls render one Setup action and a checked readiness marker", async () => {
  const root = await mkdtemp(path.join(path.resolve("node_modules"), ".setup-render-2841-"));
  try {
    const entry = path.join(root, "render.tsx");
    await writeFile(entry, `import React from "react"; import { renderToStaticMarkup } from "react-dom/server"; import Connections from "${process.cwd().replaceAll("\\", "/")}/app/skin-v1/story-mode-capability-connections"; export const html = renderToStaticMarkup(<Connections mode="local" capability="writing" connections={[{ id:"ollama", label:"Ollama", role:"Writing", detail:"Synthetic configured resource", state:"ready", setupLabel:"Setup", onSetup:()=>{} }]} />);`);
    const output = path.join(root, "render.mjs");
    await build({ entryPoints: [entry], outfile: output, bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic", logLevel: "silent" });
    const { html } = await import(pathToFileURL(output).href);
    assert.equal((html.match(/<button/g) || []).length, 1);
    assert.match(html, /Ollama Ready/); assert.match(html, /<circle/); assert.match(html, /<path/); assert.doesNotMatch(html, /Use for Writing/);
    const hybrid = await readFile(new URL("../app/skin-v1/hybrid-story-mode-panel.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(hybrid, /job-routing|paidAcknowledged|videoSharingAcknowledged/);
    const host = await readFile(new URL("../app/skin-v1/story-mode-host.tsx", import.meta.url), "utf8");
    const activate = host.slice(host.indexOf("async function activate"), host.indexOf("function handleKeyDown"));
    assert.doesNotMatch(activate, /method: "POST"/); assert.match(activate, /setView\(nextMode\)/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
