import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #258 keeps collaboration modes separate from the three creative-compute paths", async () => {
  const [setup, collaboration] = await Promise.all([
    source("app/setup-connections-dashboard.tsx"),
    source("lib/collaboration-mode.ts"),
  ]);

  for (const phrase of [
    "Choose one of three creative-compute paths",
    "1 · Local AI",
    "2 · Cloud AI",
    "3 · No AI",
    "Local writing & planning · Ollama",
    "Local image generation · ComfyUI",
    "Cloud writing & images · OpenAI",
    "Cloud text, images & H3 video · MiniMax",
    "Manual image import",
    "Ready without AI",
  ]) assert.ok(setup.includes(phrase), `Missing creative-compute contract: ${phrase}`);

  for (const mode of [
    "Local Story Mode",
    "Writers' Room Mode",
    "Repository Collaboration Mode",
  ]) assert.ok(collaboration.includes(mode), `Collaboration mode changed or disappeared: ${mode}`);

  assert.match(setup, /Collaboration and scheduling services/);
  assert.match(setup, /PlotPickle remains fully usable when every optional AI choice is declined/);
});

test("issue #258 probes only the documented loopback Ollama and ComfyUI endpoints", async () => {
  const gateway = await source("build/local-connections-gateway.ts");
  for (const contract of [
    'http://127.0.0.1:11434/api/tags',
    'http://127.0.0.1:8188/system_stats',
    'http://127.0.0.1:8188/object_info/CheckpointLoaderSimple',
    "LOCAL_SERVICE_TIMEOUT_MS",
    "probeOllama",
    "probeComfyUI",
    "comfyCheckpointNames",
    'url.hostname !== "127.0.0.1"',
    'state: models.length ? "connected" : "configured"',
    'state: checkpoints.length ? "connected" : "configured"',
    'state: previous ? "error" : "disconnected"',
  ]) assert.ok(gateway.includes(contract), `Missing local health contract: ${contract}`);

  assert.doesNotMatch(gateway, /0\.0\.0\.0:11434|0\.0\.0\.0:8188/);
  assert.doesNotMatch(gateway, /cloud fallback/i);
});

test("issue #258 offers two independent visible Windows installation choices", async () => {
  const [launcher, installer] = await Promise.all([
    source("Start-PlotPickle.bat"),
    source("scripts/install-local-ai-tool.ps1"),
  ]);

  for (const contract of [
    'call :ensure_local_ai_tool Ollama "local writing and planning"',
    'call :ensure_local_ai_tool ComfyUI "local image generation"',
    'choice /C YN /N /M "Install %LOCAL_AI_TOOL% now? [Y/N]: "',
    "Models, checkpoints, custom nodes, and workflows are separate",
    "PlotPickle remains fully usable with No AI and manual image import",
    "PlotPickle will continue normally",
  ]) assert.ok(launcher.includes(contract), `Missing launcher contract: ${contract}`);

  for (const contract of [
    'ValidateSet("Ollama", "ComfyUI")',
    'PackageId = "Ollama.Ollama"',
    'PackageId = "Comfy.ComfyUI-Desktop"',
    'DownloadUrl = "https://ollama.com/download/windows"',
    'DownloadUrl = "https://comfy.org/download"',
    "--interactive",
    "--accept-source-agreements",
    "--accept-package-agreements",
    "Models, checkpoints and workflows remain separate",
    '"http://127.0.0.1:11434/api/pull"',
    'model = $StarterModel; stream = $false',
  ]) assert.ok(installer.includes(contract), `Missing installer contract: ${contract}`);

  assert.doesNotMatch(installer, /--silent|--quiet|Invoke-Expression|iex\b/i);
  assert.doesNotMatch(installer, /ollama\s+run|pip\s+install|git\s+clone/i);
  assert.doesNotMatch(installer, /param\([\s\S]*\$Model\b|requestedModel|body\.model/i);
});

test("issue #258 status copy distinguishes running software from model readiness", async () => {
  const setup = await source("app/setup-connections-dashboard.tsx");
  for (const phrase of [
    "language models are selected and downloaded separately",
    "checkpoints and reviewed workflows are configured separately",
    'providerConnection("openai", "OpenAI")',
    'providerConnection("minimax", "MiniMax")',
    "No account, API key, local model or checkpoint is required",
    "/api/local-connections",
  ]) assert.ok(setup.includes(phrase), `Missing readiness explanation: ${phrase}`);

  assert.match(setup, /refreshLocalServices/);
  assert.match(setup, /Promise\.all\(\[refreshBuzz\(\), refreshLocalServices\(\)\]\)/);
});

test("phase 3 stores independent media routes and provider profiles in encrypted local credentials", async () => {
  const store = await source("build/media-routing-store.ts");
  for (const contract of [
    "media-routing.json",
    "ai-connection.json",
    'type ImageRoute = "comfyui" | "openai" | "minimax" | "manual"',
    'type VideoRoute = "minimax-direct" | "minimax-comfyui" | "none"',
    "readCredentialJson",
    "writeCredentialJson",
    "imageVerifiedAt",
    "videoVerifiedAt",
    "verifiedHash",
    "workflowHash",
  ]) assert.ok(store.includes(contract), `Missing media routing store contract: ${contract}`);
  assert.doesNotMatch(store, /localStorage|sessionStorage/);
  assert.match(store, /if \(next\.imageRoute === "manual"\) next\.imageRoute = imported\.provider/);
  assert.match(store, /next\.videoRoute = "none"/);
});

test("phase 3 routes existing image and video endpoints without changing text routing", async () => {
  const [gateway, localGateway] = await Promise.all([
    source("build/media-routing-gateway.ts"),
    source("build/local-ai-gateway.ts"),
  ]);
  for (const contract of [
    "/api/local-ai/generate/image",
    "/api/local-ai/generate/video",
    "/api/local-ai/video/",
    "generateCloudImage",
    "generateComfyImage",
    "createCloudVideo",
    "createComfyVideo",
  ]) assert.ok(gateway.includes(contract), `Missing media router contract: ${contract}`);
  assert.match(gateway, /const API = "\/api\/media-routing"/);
  assert.match(gateway, /const STATUS_PATH = `\$\{API\}\/status`/);
  assert.match(gateway, /const ROUTES_PATH = `\$\{API\}\/routes`/);
  assert.match(gateway, /const TEST_IMAGE_PATH = `\$\{API\}\/test\/image`/);
  assert.match(gateway, /const TEST_VIDEO_PATH = `\$\{API\}\/test\/video`/);
  assert.doesNotMatch(gateway, /generate\/text/);
  assert.match(localGateway, /registerSingleImageBoundary\(server\)[\s\S]*registerMediaRoutingGateway\(server\)[\s\S]*registerWritingAssistantGateway\(server\)/);
  assert.match(localGateway, /\/api\/media-routing\/test\/image/);
});

test("phase 3 preserves direct OpenAI image and MiniMax image-01 and H3 execution contracts", async () => {
  const [provider, common] = await Promise.all([
    source("build/cloud-media-provider.ts"),
    source("build/media-provider-common.ts"),
  ]);
  for (const contract of [
    "/images/generations",
    "/images/edits",
    "output_format",
    "image[]",
    "/v1/image_generation",
    'response_format: "base64"',
    "subject_reference",
    "/v2/video_generation",
    "/v2/query/video_generation/",
    'resolution: "2K"',
    "billingAcknowledged",
    "dataSharingAcknowledged",
    "saveGeneratedAsset",
    "media-cloud-video-jobs.json",
  ]) assert.ok(provider.includes(contract), `Missing direct media contract: ${contract}`);
  assert.match(provider, /requestCount !== 1/);
  assert.match(common, /PlotPickle does not supply credits/);
});

test("phase 3 runs a reviewed ComfyUI image workflow and captures returned assets", async () => {
  const comfy = await source("build/comfyui-media-provider.ts");
  for (const contract of [
    "http://127.0.0.1:8188",
    "CheckpointLoaderSimple",
    "CLIPTextEncode",
    "EmptyLatentImage",
    "KSampler",
    "VAEDecode",
    "SaveImage",
    "/object_info/",
    "/prompt",
    "/history/",
    "/view?",
    "imageNodesReady",
    "missingImageNodes",
    "saveGeneratedAsset",
  ]) assert.ok(comfy.includes(contract), `Missing ComfyUI image contract: ${contract}`);
  assert.match(comfy, /url\.hostname !== "127\.0\.0\.1"/);
  assert.match(comfy, /url\.port !== "8188"/);
  assert.doesNotMatch(comfy, /0\.0\.0\.0|localhost:8188/);
});

test("phase 3 locks the ComfyUI H3 route behind verified nodes key and returned paid test asset", async () => {
  const [comfy, gateway] = await Promise.all([
    source("build/comfyui-media-provider.ts"),
    source("build/media-routing-gateway.ts"),
  ]);
  for (const contract of [
    "{{PLOTPICKLE_PROMPT}}",
    "{{PLOTPICKLE_MINIMAX_KEY}}",
    "Remove embedded credentials",
    "workflowNodeClasses",
    "media-comfy-video-jobs.json",
    "The reviewed H3 workflow must return an MP4 or WebM output",
  ]) assert.ok(comfy.includes(contract), `Missing ComfyUI H3 workflow contract: ${contract}`);
  for (const phrase of [
    "ComfyUI responds on 127.0.0.1:8188",
    "Reviewed MiniMax-H3 API workflow is configured",
    "Every workflow node exists in ComfyUI",
    "A user-owned MiniMax key and H3 model are configured",
    "A paid test job completed and returned a local asset",
    "Complete every ComfyUI H3 prerequisite",
  ]) assert.ok(gateway.includes(phrase), `Missing hybrid gate contract: ${phrase}`);
  assert.match(gateway, /workflow\.verifiedHash === workflow\.hash/);
  assert.match(gateway, /store\.videoRoute = "minimax-comfyui"/);
});

test("phase 3 first-run panel exposes independent controls real tests and truthful cost consent", async () => {
  const [panel, host, css] = await Promise.all([
    source("app/media-routing-panel.tsx"),
    source("app/settings-panel.tsx"),
    source("app/media-routing-panel.module.css"),
  ]);
  for (const phrase of [
    "Images &amp; Video",
    "ComfyUI",
    "OpenAI Images",
    "MiniMax image-01",
    "Manual Import",
    "MiniMax H3 Direct",
    "MiniMax H3 through ComfyUI",
    "Test image",
    "Paid H3 test",
    "Cloud image test approval",
    "Paid H3 test approval",
    "Hybrid prerequisite gate",
    "PlotPickle never falls back to a paid provider automatically",
    "/api/media-routing",
    "/api/local-ai/video/",
  ]) assert.ok(panel.includes(phrase), `Missing first-run media control: ${phrase}`);
  assert.match(host, /MediaRoutingPanel/);
  assert.match(css, /requirements/);
  assert.match(css, /preview/);
  assert.doesNotMatch(panel, /Authorization|Bearer |sk-[A-Za-z0-9]|apiKey/);
});

test("issue #300 adds a native H3 provider without cloud credentials or silent installation", async () => {
  const [provider, gateway, localGateway] = await Promise.all([
    source("build/comfyui-h3-native-provider.ts"),
    source("build/comfyui-h3-native-gateway.ts"),
    source("build/local-ai-gateway.ts"),
  ]);
  for (const contract of [
    "minimax-h3-native",
    "text-to-video",
    "image-to-video",
    "first-last-frame",
    "reference-to-video",
    "in-place-edit",
    "minimumComfyUIVersion",
    "requiredModels",
    "/system_stats",
    "/object_info/",
    "/upload/image",
    "/upload/file",
    "/prompt",
    "/history/",
    "/view?",
    "The official native H3 workflow must return an MP4 or WebM output",
    "8 GB VRAM is experimental and may be impractical",
    "PlotPickle does not promise 2K, 15 seconds or usable speed",
  ]) assert.ok(provider.includes(contract), `Missing native H3 provider contract: ${contract}`);
  for (const contract of [
    "/api/media-routing/comfyui/h3/native",
    "/api/local-ai/generate/video",
    "/api/local-ai/video/",
    "installsWeights: false",
    "installsCustomNodes: false",
    "executesDownloadedCode: false",
    "registerNativeH3Gateway",
  ]) assert.ok(`${gateway}\n${localGateway}`.includes(contract), `Missing native H3 gateway contract: ${contract}`);
  assert.match(localGateway, /registerNativeH3Gateway\(server\)[\s\S]*registerMediaRoutingGateway\(server\)/);
  assert.doesNotMatch(provider, /process\.env\.PLOTPICKLE_MINIMAX_KEY|Authorization:\s*["'`]|Bearer\s+\$\{/);
  assert.match(provider, /Native H3 workflows must not contain a cloud API key or authorization field/);
  assert.doesNotMatch(gateway, /child_process|spawn\(|exec\(|git clone|pip install/i);
});

test("issue #300 exposes truthful native H3 status diagnostics and official setup guidance", async () => {
  const [panel, css, host, docs, schema] = await Promise.all([
    source("app/h3-native-panel.tsx"),
    source("app/h3-native-panel.module.css"),
    source("app/settings-panel.tsx"),
    source("docs/MINIMAX_H3_NATIVE_COMFYUI.md"),
    source("config/minimax-h3-native.manifest.schema.json"),
  ]);
  for (const phrase of [
    "MiniMax H3 · Native ComfyUI",
    "No MiniMax cloud key",
    "Official-source H3 manifest imported",
    "Every user-owned model file is detected",
    "8 GB compatibility acknowledgement",
    "PlotPickle does not promise 2K or 15 seconds locally",
    "Use native H3 for video",
    "Run local H3 test",
    "Waiting for official manifest",
    "ComfyUI/models/",
  ]) assert.ok(panel.includes(phrase), `Missing native H3 UI contract: ${phrase}`);
  assert.match(host, /H3NativePanel/);
  assert.match(css, /min-height: 2\.75rem/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(docs, /does not bundle or redistribute H3 weights/);
  assert.match(docs, /Cloud MiniMax remains available as a separate BYOK route/);
  const parsed = JSON.parse(schema);
  assert.equal(parsed.properties.model.const, "MiniMax-H3");
  assert.equal(parsed.properties.workflowFamily.enum.length, 5);
  assert.doesNotMatch(panel, /Authorization|Bearer |sk-[A-Za-z0-9]|apiKey/);
});

test("issue #300 validates official provenance workflow placeholders model directories and version gates", async () => {
  const provider = await source("build/comfyui-h3-native-provider.ts");
  for (const contract of [
    "https://github.com/MiniMax-AI/",
    "https://huggingface.co/MiniMaxAI/",
    "https://github.com/Comfy-Org/ComfyUI/",
    "https://docs.comfy.org/",
    "{{PLOTPICKLE_PROMPT}}",
    "{{PLOTPICKLE_SOURCE_IMAGE}}",
    "{{PLOTPICKLE_FIRST_FRAME}}",
    "{{PLOTPICKLE_LAST_FRAME}}",
    "{{PLOTPICKLE_REFERENCE_ASSET}}",
    "{{PLOTPICKLE_SOURCE_VIDEO}}",
    "SAFE_MODEL_DIRECTORIES",
    "UNSAFE_NODE_PATTERN",
    "versionAtLeast",
    "compatibleVersion",
    "modelsReady",
    "allowConstrainedVram",
  ]) assert.ok(provider.includes(contract), `Missing native H3 validation contract: ${contract}`);
  assert.match(provider, /Native H3 workflows must not contain a cloud API key or authorization field/);
  assert.match(provider, /network, installer or code-execution node/);
});

test("issue #258 focused regression has a dedicated script", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.equal(
    packageJson.scripts["test:creative-compute-paths"],
    "node --test tests/issue-258-creative-compute-paths.test.mjs",
  );
});
