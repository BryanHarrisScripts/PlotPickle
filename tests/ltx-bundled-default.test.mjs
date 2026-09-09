import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
async function compile(file, dependencies = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(await read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, {
    exports, require: (name) => dependencies[name] ?? require(name),
    Buffer, URL, URLSearchParams, AbortSignal, setTimeout, console, ...globals,
  });
  return exports;
}

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pp-ltx-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const defaults = await compile("build/ai/comfyui-ltx-default.ts");
  let stored = null;
  let writes = 0;
  let version = "0.3.50";
  let online = true;
  let submitted;
  let saved;
  let historyError = false;
  const manifest = defaults.bundledLtxManifest();
  const objectInfo = Object.fromEntries(Object.values(manifest.workflow).map((node) => [node.class_type, { input: { required: {} } }]));
  objectInfo.CheckpointLoaderSimple.input.required.ckpt_name = [[manifest.requiredModelNames[0]]];
  objectInfo.CLIPLoader.input.required.clip_name = [[manifest.requiredModelNames[1]]];
  const provider = await compile("build/ai/comfyui-ltx-local-provider.ts", {
    "./comfyui-ltx-default": defaults,
    "../local-credentials": {
      persistentHome: () => directory,
      readCredentialJson: async () => structuredClone(stored),
      writeCredentialJson: async (_file, value) => { stored = plain(value); writes++; },
    },
    "../media-provider-common": {
      safeAssetStem: (value) => value,
      saveGeneratedAsset: async (bytes, id, extension) => {
        saved = { bytes: [...bytes], id, extension };
        return `/api/generated-assets/${id}${extension}`;
      },
    },
  }, {
    fetch: async (url, init) => {
      assert.ok(url.startsWith("http://127.0.0.1:8188/"), "all inference must remain loopback");
      if (!online) throw new Error("connection refused");
      if (url.endsWith("/system_stats")) return Response.json({ system: { comfyui_version: version } });
      if (url.endsWith("/object_info")) return Response.json(objectInfo);
      if (url.endsWith("/prompt")) {
        submitted = JSON.parse(init.body).prompt;
        return Response.json({ prompt_id: "proof-1" });
      }
      if (url.includes("/history/") && historyError) return Response.json({ "proof-1": { status: { status_str: "error", messages: ["CUDA out of memory"] } } });
      if (url.includes("/history/")) return Response.json({ "proof-1": { outputs: { "15": { images: [{ filename: "proof.mp4", type: "output" }] } }, status: { status_str: "success" } } });
      if (url.includes("/view?")) return new Response(new Uint8Array([1, 2, 3]));
      throw new Error(`Unexpected request ${url}`);
    },
  });
  return { provider, defaults, objectInfo, manifest,
    get stored() { return stored; }, get writes() { return writes; },
    get submitted() { return submitted; }, get saved() { return saved; },
    set historyError(value) { historyError = value; },
    set version(value) { version = value; }, set online(value) { online = value; },
  };
}

test("first-run setup bundles and persists once, preserving a reviewed advanced workflow", async (t) => {
  const f = await fixture(t);
  await Promise.all([f.provider.ensureLtxDefault(), f.provider.ensureLtxDefault()]);
  assert.equal(f.writes, 1);
  assert.ok(f.stored.manifest.workflow);
  const custom = f.defaults.bundledLtxManifest();
  custom.workflow["3"].inputs.text = "A custom prompt: {{PLOTPICKLE_PROMPT}}";
  await f.provider.configureLtxManifest(custom);
  await f.provider.ensureLtxDefault();
  assert.equal(f.stored.manifest.workflow["3"].inputs.text, custom.workflow["3"].inputs.text);
  assert.equal(f.writes, 2);
});

test("readiness reports exact model/node/version blockers and never accepts a similarly named model", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.provider.probeLtxVideo()).ready, true);
  delete f.objectInfo.LTXVConditioning;
  f.objectInfo.CheckpointLoaderSimple.input.required.ckpt_name = [[`wrong-${f.manifest.requiredModelNames[0]}`]];
  f.version = "0.3.49";
  const status = await f.provider.probeLtxVideo();
  assert.equal(status.ready, false);
  assert.ok(status.blockers.includes("MISSING NODE: LTXVConditioning"));
  assert.ok(status.blockers.includes(`MISSING MODEL: ${f.manifest.requiredModelNames[0]}`));
  assert.match(status.error, /COMFYUI VERSION TOO OLD/);
  f.online = false;
  assert.match((await f.provider.probeLtxVideo()).error, /COMFYUI SERVICE NOT READY/);
});

test("proof workflow is bounded text-to-video, uses numeric seed and does not mutate the bundle", async (t) => {
  const f = await fixture(t);
  const store = await f.provider.ensureLtxDefault();
  const workflow = f.provider.hydratedLtxWorkflow(store, { durationSeconds: 300 }, 'A person says "hello".');
  assert.deepEqual(plain(workflow["6"].inputs), { width: 640, height: 352, length: 25, batch_size: 1 });
  assert.equal(typeof workflow["7"].inputs.noise_seed, "number");
  assert.equal(workflow["3"].inputs.text, 'A person says "hello".');
  assert.equal(store.manifest.workflow["3"].inputs.text, "{{PLOTPICKLE_PROMPT}}");
  assert.equal(workflow["2"].inputs.device, "cpu");
  assert.doesNotMatch(JSON.stringify(workflow), /Upscal|ImgToVideo|LoadImage|SOURCE_IMAGE/);
  assert.throws(() => f.provider.hydratedLtxWorkflow(store, { sourceAssetUrl: "/image.png" }, "prompt"), /text-to-video only/);
});

test("local render submission retrieves native ComfyUI video history and verifies only saved output", async (t) => {
  const f = await fixture(t);
  const job = await f.provider.createLtxVideo({ prompt: "A person walks slowly.", assetId: "proof" });
  let result;
  for (let attempt = 0; attempt < 100; attempt++) {
    result = await f.provider.getLtxVideoJob(job.id);
    if (result.status === "succeeded" && f.stored.verifiedAt) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(result.status, "succeeded");
  assert.equal(result.outputAssetUrl, "/api/generated-assets/proof.mp4");
  assert.equal(f.saved.extension, ".mp4");
  assert.ok(f.stored.verifiedAt);
  assert.equal(f.submitted["6"].inputs.length, 25);
  assert.equal(f.provider.firstLtxVideoOutput({ outputs: { a: { images: [{ filename: "poster.png" }] } } }), null);
});

test("LTX test endpoint cannot fall through to a selected cloud route and releases its GPU lease", async () => {
  let handler, renders = 0, releases = 0;
  const gateway = await compile("build/ai/comfyui-ltx-local-gateway.ts", {
    "./comfyui-ltx-local-provider": {
      createLtxVideo: async () => { renders++; return { id: "ltx-test", status: "succeeded", outputAssetUrl: "/proof.mp4" }; },
    },
    "../local-gpu-resource-manager": { holdLocalGpuMediaLease() {}, async releaseLocalGpuMediaLease() { releases++; } },
    "../media-routing-store": { readMediaRoutingStore: async () => ({ videoRoute: "cloud" }) },
  });
  gateway.registerLtxLocalVideoGateway({ middlewares: { use(value) { handler = value; } } });
  async function request(url, origin = "http://localhost:3000") {
    return new Promise((resolve) => {
      const response = { setHeader() {}, end(body) { resolve({ code: this.statusCode, body: JSON.parse(body) }); } };
      handler({ url, method: "POST", headers: { host: "localhost:3000", origin }, socket: { remoteAddress: "127.0.0.1" }, async *[Symbol.asyncIterator]() { yield Buffer.from("{}"); } }, response, () => resolve({ next: true }));
    });
  }
  assert.equal((await request("/api/local-ai/ltx-video/test")).body.status, "succeeded");
  assert.equal(renders, 1);
  assert.equal(releases, 1);
  assert.equal((await request("/api/media-routing/test/video")).next, true);
  assert.equal((await request("/api/local-ai/ltx-video/test", "https://example.org")).code, 403);
  assert.equal(renders, 1);
});

test("selected plug-in publishes the same readiness, proof preset and engine actions without story-layer model coupling", async (t) => {
  const f = await fixture(t);
  const adapters = await compile("build/ai/local-plugin-adapters.ts", {
    "./comfyui-ltx-local-provider": f.provider,
    "./h3/comfyui-h3-native-provider": {},
  });
  const status = await adapters.probeLocalAiPluginAdapter("comfyui-ltx-local");
  assert.equal(status.ready, (await f.provider.probeLtxVideo()).ready);
  assert.equal(status.active, false, "green requires a saved proof render");
  assert.deepEqual(plain(status.details.supportedModes), ["text-to-video"]);
  assert.equal(status.details.defaultPreset.frames, 25);
  assert.equal(status.details.testPath, "/api/local-ai/ltx-video/test");
  assert.equal(status.details.setupPath, "/api/local-ai/ltx-video/setup");
});


test("failed proof clears a previous green verification and publishes the actual failure", async (t) => {
  const f = await fixture(t);
  await f.provider.ensureLtxDefault();
  f.stored.verifiedAt = "2026-01-01T00:00:00Z";
  f.historyError = true;
  const job = await f.provider.createLtxVideo({ prompt: "A person walks slowly." });
  for (let attempt = 0; attempt < 100 && !f.stored.lastError; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  const result = await f.provider.getLtxVideoJob(job.id);
  assert.equal(result.status, "failed");
  assert.equal(result.outputAssetUrl, "");
  assert.equal(f.stored.verifiedAt, "");
  assert.match(f.stored.lastError, /CUDA out of memory/);
});
