import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const targetArg = process.argv.find((value) => value.startsWith("--target="));
const TARGET = (targetArg ? targetArg.slice("--target=".length) : process.env.PLOTPICKLE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const COMFY = "http://127.0.0.1:8188";
const OLLAMA = "http://127.0.0.1:11434";
const LIVE_CLOUD = args.has("--live-cloud");
const LIVE_PAID_H3 = args.has("--live-paid-h3");
const LIVE_NATIVE_H3 = args.has("--live-native-h3");
const STRICT_ALL = args.has("--strict-all");
const REQUIRED_IMAGE_NODES = [
  "CheckpointLoaderSimple",
  "CLIPTextEncode",
  "EmptyLatentImage",
  "KSampler",
  "VAEDecode",
  "SaveImage",
];

const results = [];
let originalRoutes = null;
let originalNativeH3 = null;

function record(name, status, detail = "", data = {}) {
  results.push({ name, status, detail, ...data });
  console.log(`${status.padEnd(5)} ${name}${detail ? ` · ${detail}` : ""}`);
}

const pass = (name, detail = "", data = {}) => record(name, "PASS", detail, data);
const fail = (name, detail = "", data = {}) => record(name, "FAIL", detail, data);
const skip = (name, detail = "", data = {}) => record(name, STRICT_ALL ? "FAIL" : "SKIP", detail, data);

async function jsonRequest(url, options = {}, timeoutMs = 20_000) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 500) }; }
  return { response, body };
}

async function requireJson(url, options = {}, timeoutMs = 20_000) {
  const { response, body } = await jsonRequest(url, options, timeoutMs);
  if (!response.ok) {
    const message = typeof body.message === "string" ? body.message : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body;
}

function postJson(url, body, timeoutMs = 20_000) {
  return requireJson(url, { method: "POST", body: JSON.stringify(body) }, timeoutMs);
}

function setRoutes(imageRoute, videoRoute = "none") {
  return postJson(`${TARGET}/api/media-routing/routes`, { imageRoute, videoRoute });
}

function mediaStatus() {
  return requireJson(`${TARGET}/api/media-routing/status`, {}, 30_000);
}

function nativeStatus() {
  return requireJson(`${TARGET}/api/media-routing/comfyui/h3/native/status`, {}, 30_000);
}

function setNativeH3(active, allowConstrainedVram) {
  return postJson(`${TARGET}/api/media-routing/comfyui/h3/native/activation`, {
    active,
    allowConstrainedVram,
  }, 30_000);
}

function ollamaModelNames(body) {
  if (!Array.isArray(body.models)) return [];
  return body.models
    .map((model) => model && typeof model === "object" ? String(model.name || model.model || "").trim() : "")
    .filter(Boolean);
}

function preferredOllamaModel(names) {
  return names.find((name) => /plotpickle-guide/i.test(name))
    || names.find((name) => /qwen/i.test(name) && !/coder/i.test(name))
    || names.find((name) => !/coder/i.test(name))
    || names[0]
    || "";
}

async function ollamaImagePrompt() {
  const tags = await requireJson(`${OLLAMA}/api/tags`, {}, 10_000);
  const names = ollamaModelNames(tags);
  if (!names.length) throw new Error("Ollama is running but reports no installed model.");
  const model = preferredOllamaModel(names);
  const body = await postJson(`${OLLAMA}/api/generate`, {
    model,
    stream: false,
    prompt: "Write one concise image-generation prompt, under 45 words, for a cinematic storyboard frame of a writer opening a mysterious creative notebook. No commentary, no quotation marks, no text inside the image.",
    options: { temperature: 0.2, num_predict: 72 },
  }, 90_000);
  const prompt = typeof body.response === "string" ? body.response.trim().replace(/^['\"]|['\"]$/g, "") : "";
  if (!prompt) throw new Error(`Ollama model ${model} returned no usable prompt.`);
  return { model, prompt: prompt.slice(0, 1_000), modelCount: names.length };
}

async function verifyOutput(assetUrl) {
  if (typeof assetUrl !== "string" || !assetUrl.trim()) throw new Error("PlotPickle returned no generated asset URL.");
  const url = new URL(assetUrl, `${TARGET}/`);
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) {
    throw new Error(`Generated asset unexpectedly points away from the local PlotPickle server: ${url.hostname}`);
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Generated asset could not be read back (HTTP ${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1_000) throw new Error(`Generated asset is unexpectedly small (${bytes.length} bytes).`);
  return { bytes: bytes.length, contentType: response.headers.get("content-type") || "" };
}

async function pollVideoJob(id, timeoutMs = 360_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const body = await requireJson(`${TARGET}/api/local-ai/video/${encodeURIComponent(id)}`, {}, 30_000);
    if (body.status === "succeeded") return body;
    if (["failed", "cancelled", "expired"].includes(body.status)) {
      throw new Error(body.error || `Video job ended with status ${body.status}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error("Video job did not finish before the verification timeout.");
}

async function restoreState() {
  if (originalRoutes) {
    try {
      await setRoutes(originalRoutes.imageRoute, originalRoutes.videoRoute);
      pass("Restore original media routes", `${originalRoutes.imageRoute} / ${originalRoutes.videoRoute}`);
    } catch (error) {
      fail("Restore original media routes", error instanceof Error ? error.message : String(error));
    }
  }
  if (originalNativeH3) {
    try {
      const restored = await setNativeH3(originalNativeH3.active, originalNativeH3.allowConstrainedVram);
      if (restored.active !== originalNativeH3.active) throw new Error("Native H3 activation state did not restore.");
      pass("Restore native H3 state", restored.active ? "on" : "off");
    } catch (error) {
      fail("Restore native H3 state", error instanceof Error ? error.message : String(error));
    }
  }
}

async function main() {
  console.log("PlotPickle focused ComfyUI verification");
  console.log(`PlotPickle: ${TARGET}`);
  console.log(`ComfyUI:   ${COMFY}`);
  console.log(`Ollama:    ${OLLAMA}`);
  console.log("Paid cloud generation is OFF unless an explicit --live-cloud or --live-paid-h3 flag is supplied.\n");

  try {
    const home = await fetch(TARGET, { signal: AbortSignal.timeout(8_000) });
    if (!home.ok) throw new Error(`PlotPickle returned HTTP ${home.status}.`);
    pass("PlotPickle local app", "reachable");
  } catch (error) {
    fail("PlotPickle local app", error instanceof Error ? error.message : String(error));
    throw error;
  }

  const status = await mediaStatus();
  originalRoutes = { imageRoute: status.imageRoute, videoRoute: status.videoRoute };
  pass("Media-routing API", `${status.imageRoute} / ${status.videoRoute}`);

  try {
    const native = await nativeStatus();
    originalNativeH3 = {
      active: native.active === true,
      allowConstrainedVram: native.allowConstrainedVram === true,
    };
    pass("Native H3 state snapshot", originalNativeH3.active ? "on" : "off");
  } catch (error) {
    fail("Native H3 state snapshot", error instanceof Error ? error.message : String(error));
  }

  try {
    const connections = await requireJson(`${TARGET}/api/local-connections`, {}, 20_000);
    const comfyState = connections.comfyui?.state || "unknown";
    const ollamaState = connections.ollama?.state || "unknown";
    if (!["connected", "configured"].includes(comfyState)) throw new Error(`PlotPickle reports ComfyUI as ${comfyState}.`);
    if (!["connected", "configured"].includes(ollamaState)) throw new Error(`PlotPickle reports Ollama as ${ollamaState}.`);
    pass("PlotPickle local-service inventory", `ComfyUI=${comfyState}; Ollama=${ollamaState}`);
  } catch (error) {
    fail("PlotPickle local-service inventory", error instanceof Error ? error.message : String(error));
  }

  try {
    const [system, loader, ...nodes] = await Promise.all([
      requireJson(`${COMFY}/system_stats`, {}, 10_000),
      requireJson(`${COMFY}/object_info/CheckpointLoaderSimple`, {}, 10_000),
      ...REQUIRED_IMAGE_NODES.map((name) => requireJson(`${COMFY}/object_info/${encodeURIComponent(name)}`, {}, 10_000)),
    ]);
    const checkpointInput = loader.CheckpointLoaderSimple?.input?.required?.ckpt_name;
    const checkpoints = Array.isArray(checkpointInput) && Array.isArray(checkpointInput[0])
      ? checkpointInput[0].filter((value) => typeof value === "string" && value.trim())
      : [];
    const missingNodes = REQUIRED_IMAGE_NODES.filter((name, index) => !nodes[index]?.[name]);
    if (missingNodes.length) throw new Error(`Missing required ComfyUI nodes: ${missingNodes.join(", ")}`);
    if (!checkpoints.length) throw new Error("ComfyUI is running but no image checkpoint is available.");
    const version = system.system?.comfyui_version || "unknown";
    pass("ComfyUI engine + image workflow prerequisites", `v${version}; ${checkpoints.length} checkpoint(s)`, { checkpoints, version });
  } catch (error) {
    fail("ComfyUI engine + image workflow prerequisites", error instanceof Error ? error.message : String(error));
  }

  try {
    const off = await setRoutes("manual", "none");
    if (off.imageRoute !== "manual" || off.videoRoute !== "none") throw new Error("Image/hybrid off state did not persist.");
    if (originalNativeH3) {
      const nativeOff = await setNativeH3(false, originalNativeH3.allowConstrainedVram);
      if (nativeOff.active !== false) throw new Error("Native H3 did not turn off.");
    }
    pass("ComfyUI OFF routing", "Manual Import + video Off + native H3 Off; ComfyUI Desktop remains running");
  } catch (error) {
    fail("ComfyUI OFF routing", error instanceof Error ? error.message : String(error));
  }

  try {
    const connection = await postJson(`${TARGET}/api/media-routing/comfyui/connection`, { baseUrl: COMFY }, 30_000);
    if (connection.comfyui?.baseUrl !== COMFY) throw new Error("Local ComfyUI address did not persist.");
    const local = await setRoutes("comfyui", "none");
    if (local.imageRoute !== "comfyui" || local.videoRoute !== "none") throw new Error("Local ComfyUI route did not persist.");
    if (!local.comfyui?.reachable) throw new Error(local.comfyui?.error || "PlotPickle could not reach local ComfyUI.");
    if (!local.comfyui?.imageNodesReady) throw new Error(`Missing image nodes: ${(local.comfyui?.missingImageNodes || []).join(", ")}`);
    if (!Array.isArray(local.comfyui?.checkpoints) || !local.comfyui.checkpoints.length) throw new Error("PlotPickle sees no ComfyUI checkpoint.");
    pass("ComfyUI ON local routing", `${local.comfyui.checkpoints.length} checkpoint(s) ready at ${connection.comfyui.baseUrl}`);
  } catch (error) {
    fail("ComfyUI ON local routing", error instanceof Error ? error.message : String(error));
  }

  try {
    const remoteAttempt = await jsonRequest(`${TARGET}/api/media-routing/comfyui/connection`, {
      method: "POST",
      body: JSON.stringify({ baseUrl: "https://example.invalid:8188" }),
    });
    if (remoteAttempt.response.ok) throw new Error("A remote ComfyUI URL was accepted even though PlotPickle's ComfyUI route is local-only.");
    pass("Remote ComfyUI guard", "remote ComfyUI URLs are rejected; cloud media remains a separate provider route");
  } catch (error) {
    fail("Remote ComfyUI guard", error instanceof Error ? error.message : String(error));
  }

  let localPrompt = null;
  try {
    localPrompt = await ollamaImagePrompt();
    pass("Ollama live generation", `${localPrompt.model}; generated local image prompt`, { model: localPrompt.model });
  } catch (error) {
    fail("Ollama live generation", error instanceof Error ? error.message : String(error));
  }

  if (localPrompt) {
    try {
      const generated = await postJson(`${TARGET}/api/media-routing/test/image`, {
        route: "comfyui",
        prompt: localPrompt.prompt,
      }, 300_000);
      const output = await verifyOutput(generated.assetUrl);
      pass("Ollama → PlotPickle → local ComfyUI image", `${output.bytes} bytes; ${output.contentType || "image asset"}`, {
        ollamaModel: localPrompt.model,
        providerRequestId: generated.providerRequestId || "",
        assetUrl: generated.assetUrl,
      });
    } catch (error) {
      fail("Ollama → PlotPickle → local ComfyUI image", error instanceof Error ? error.message : String(error));
    }
  } else {
    fail("Ollama → PlotPickle → local ComfyUI image", "Skipped because the required Ollama prompt-generation step failed.");
  }

  try {
    const current = await mediaStatus();
    const cloudProvider = current.profiles?.openai?.configured ? "openai" : current.profiles?.minimax?.configured ? "minimax" : "";
    if (!cloudProvider) {
      const blocked = await jsonRequest(`${TARGET}/api/media-routing/routes`, {
        method: "POST",
        body: JSON.stringify({ imageRoute: "openai", videoRoute: "none" }),
      });
      if (blocked.response.ok) throw new Error("Cloud route was enabled without a configured provider.");
      skip("Cloud image configuration", "no cloud image provider is configured; unconfigured cloud routing is correctly blocked");
    } else {
      const routed = await setRoutes(cloudProvider, "none");
      if (routed.imageRoute !== cloudProvider) throw new Error(`${cloudProvider} route did not persist.`);
      pass("Cloud image configuration", `${cloudProvider} route selected and persisted without spending credits`);
      if (LIVE_CLOUD) {
        const generated = await postJson(`${TARGET}/api/media-routing/test/image`, {
          route: cloudProvider,
          billingAcknowledged: true,
        }, 300_000);
        const output = await verifyOutput(generated.assetUrl);
        pass("Cloud image live generation", `${cloudProvider}; ${output.bytes} bytes`, { assetUrl: generated.assetUrl });
      } else {
        skip("Cloud image live generation", "not run because it may incur provider charges; use --live-cloud explicitly");
      }
    }
  } catch (error) {
    fail("Cloud image configuration", error instanceof Error ? error.message : String(error));
  }

  try {
    const current = await mediaStatus();
    const hybrid = current.hybridGate;
    if (hybrid?.ready) {
      const routed = await setRoutes("comfyui", "minimax-comfyui");
      if (routed.videoRoute !== "minimax-comfyui") throw new Error("Hybrid H3-through-ComfyUI route did not persist.");
      pass("MiniMax H3 through ComfyUI configuration", "all hybrid prerequisites verified and route enabled");
      if (LIVE_PAID_H3) {
        const created = await postJson(`${TARGET}/api/media-routing/test/video`, {
          route: "minimax-comfyui",
          billingAcknowledged: true,
          dataSharingAcknowledged: true,
        }, 60_000);
        if (!created.id) throw new Error("Paid H3 test returned no job ID.");
        const job = await pollVideoJob(created.id);
        const output = await verifyOutput(job.outputAssetUrl || job.assetUrl);
        pass("MiniMax H3 through ComfyUI live generation", `${output.bytes} bytes`, { id: created.id });
      } else {
        skip("MiniMax H3 through ComfyUI live generation", "not run because it is paid; use --live-paid-h3 explicitly");
      }
    } else {
      const missing = Array.isArray(hybrid?.requirements)
        ? hybrid.requirements.filter((item) => !item.ready).map((item) => item.label).join("; ")
        : "hybrid prerequisites are incomplete";
      skip("MiniMax H3 through ComfyUI configuration", missing);
    }
  } catch (error) {
    fail("MiniMax H3 through ComfyUI configuration", error instanceof Error ? error.message : String(error));
  }

  try {
    const native = await nativeStatus();
    if (!originalNativeH3) {
      originalNativeH3 = {
        active: native.active === true,
        allowConstrainedVram: native.allowConstrainedVram === true,
      };
    }
    if (!native.ready) {
      skip("Native H3 ComfyUI readiness", native.error || "native H3 model/workflow prerequisites are not installed");
    } else {
      const nativeOff = await setNativeH3(false, native.allowConstrainedVram === true);
      if (nativeOff.active !== false) throw new Error("Native H3 did not turn off.");
      const nativeOn = await setNativeH3(true, native.allowConstrainedVram === true);
      if (nativeOn.active !== true) throw new Error("Native H3 did not turn on.");
      pass("Native H3 ComfyUI ON/OFF", "activation toggled successfully");
      if (LIVE_NATIVE_H3) {
        const created = await postJson(`${TARGET}/api/media-routing/comfyui/h3/native/test`, {
          performanceAcknowledged: true,
        }, 60_000);
        if (!created.id) throw new Error("Native H3 test returned no job ID.");
        const job = await pollVideoJob(created.id, 600_000);
        const output = await verifyOutput(job.outputAssetUrl || job.assetUrl);
        pass("Native H3 ComfyUI live generation", `${output.bytes} bytes`, { id: created.id });
      } else {
        skip("Native H3 ComfyUI live generation", "readiness and ON/OFF were verified; use --live-native-h3 for an actual video render");
      }
    }
  } catch (error) {
    fail("Native H3 ComfyUI readiness", error instanceof Error ? error.message : String(error));
  }
}

let fatal = null;
try {
  await main();
} catch (error) {
  fatal = error instanceof Error ? error.message : String(error);
} finally {
  await restoreState();
}

const failed = results.filter((item) => item.status === "FAIL");
const skipped = results.filter((item) => item.status === "SKIP");
const passed = results.filter((item) => item.status === "PASS");
const report = {
  checkedAt: new Date().toISOString(),
  target: TARGET,
  comfyui: COMFY,
  ollama: OLLAMA,
  flags: {
    liveCloud: LIVE_CLOUD,
    livePaidH3: LIVE_PAID_H3,
    liveNativeH3: LIVE_NATIVE_H3,
    strictAll: STRICT_ALL,
  },
  summary: { passed: passed.length, failed: failed.length, skipped: skipped.length },
  fatal,
  results,
};

try {
  const root = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "PlotPickle", "comfyui-verification")
    : path.join(process.cwd(), "logs", "comfyui-verification");
  await mkdir(root, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(root, `comfyui-verification-${stamp}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`\nReport: ${reportPath}`);
} catch (error) {
  console.warn(`Could not save ComfyUI verification report: ${error instanceof Error ? error.message : String(error)}`);
}

console.log(`\nComfyUI verification complete: ${passed.length} PASS, ${failed.length} FAIL, ${skipped.length} SKIP.`);
if (fatal) console.error(`Fatal: ${fatal}`);
process.exitCode = failed.length || fatal ? 1 : 0;
