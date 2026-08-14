import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("local text is provider-independent and llama.cpp is preferred", async () => {
  const [catalog, manager, provider, gateway] = await Promise.all([
    read("lib/ai/local-runtime.ts"),
    read("build/local-runtime-manager.ts"),
    read("build/writing-assistant-provider.ts"),
    read("build/writing-assistant-gateway.ts"),
  ]);
  assert.match(catalog, /"llama\.cpp" \| "lm-studio" \| "ollama" \| "openai-compatible"/);
  assert.match(catalog, /runtimePreference: \["llama\.cpp", "lm-studio", "ollama", "openai-compatible"\]/);
  assert.match(manager, /\/models/);
  assert.match(provider, /\/chat\/completions/);
  assert.match(provider, /Every local runtime/);
  assert.match(gateway, /provider: "local"/);
  assert.match(gateway, /localTextExecutionProfile/);
  assert.doesNotMatch(gateway, /curriculumGuideOllamaProfile/);
});

test("GTX 1080 Pascal receives the CUDA 12.6 safe hardware profile", async () => {
  const [profiles, detector, installer] = await Promise.all([
    read("lib/ai/local-runtime.ts"),
    read("build/local-hardware-detection.ts"),
    read("scripts/configure-hardware-aware-local-ai.ps1"),
  ]);
  assert.match(profiles, /id: "nvidia-pascal-8gb-32gb"/);
  assert.match(profiles, /cudaPolicy: "cu126-pascal"/);
  assert.match(profiles, /allowVulkanFallback: true/);
  assert.match(profiles, /cpuGpuSplit: true/);
  assert.match(detector, /GTX\\s\*10\\d\{2\}/i);
  assert.match(detector, /pytorchCuda: pascal \? "12\.6"/);
  assert.match(detector, /prohibitCuda13PyTorch: pascal/);
  assert.match(installer, /download\.pytorch\.org\/whl\/cu126/);
  assert.match(installer, /CUDA 13 auto-install:\s+disabled/);
  assert.match(installer, /prefer CUDA 12\.x/i);
});

test("the GTX 1080 model-role catalog matches the local production profile", async () => {
  const catalog = await read("lib/ai/local-runtime.ts");
  assert.match(catalog, /Qwen3\.5-4B GGUF/);
  assert.match(catalog, /Q6_K or Q8/);
  assert.match(catalog, /Qwen3\.5-9B GGUF/);
  assert.match(catalog, /Q4_K_M/);
  assert.match(catalog, /gpt-oss-20b MXFP4/);
  assert.match(catalog, /Qwen3-Embedding-0\.6B/);
  assert.match(catalog, /Qwen3-Reranker-0\.6B/);
  assert.match(catalog, /SDXL 1\.0/);
  assert.match(catalog, /LTX-Video 2B 0\.9\.8 Distilled/);
});

test("SmolLM2 is health-check only and cannot become a production role", async () => {
  const [catalog, panel] = await Promise.all([
    read("lib/ai/local-runtime.ts"),
    read("app/local-runtime-panel.tsx"),
  ]);
  assert.match(catalog, /id: "smollm2-135m-health"/);
  assert.match(catalog, /production: false/);
  assert.match(catalog, /Never route production story or Creative Room work here/);
  assert.match(panel, /never eligible for Creative Room or production story routing/);
});

test("curriculum RAG uses CPU Qwen embedding and reranking with bounded assembly", async () => {
  const [service, gateway, guide] = await Promise.all([
    read("services/curriculum-rag/server.py"),
    read("build/curriculum-rag-gateway.ts"),
    read("modules/creative-room/curriculum-guide.ts"),
  ]);
  assert.match(service, /Qwen\/Qwen3-Embedding-0\.6B/);
  assert.match(service, /Qwen\/Qwen3-Reranker-0\.6B/);
  assert.match(service, /device="cpu"/);
  assert.match(service, /corpus_digest/);
  assert.match(service, /_cached_embeddings/);
  assert.match(gateway, /MAX_CONTEXT_CHARACTERS = 6_500/);
  assert.match(gateway, /candidateK: 48/);
  assert.match(gateway, /topK: 12/);
  assert.match(guide, /semanticCurriculumRetrieval/);
  assert.match(guide, /bounded lexical retriever/i);
  assert.match(guide, /message\.length > 12_000/);
});

test("context is 16K by default with an explicit 32K override", async () => {
  const [catalog, manager, panel] = await Promise.all([
    read("lib/ai/local-runtime.ts"),
    read("build/local-runtime-manager.ts"),
    read("app/local-runtime-panel.tsx"),
  ]);
  assert.match(catalog, /defaultContextTokens: 16384/);
  assert.match(catalog, /extendedContextTokens: 32768/);
  assert.match(manager, /contextTokens: 16384/);
  assert.match(manager, /item\.contextTokens === 32768 \? 32768 : 16384/);
  assert.match(panel, />16K default</);
  assert.match(panel, />32K extended</);
});

test("the GPU scheduler enforces text-media residency transitions", async () => {
  const scheduler = await read("build/local-gpu-resource-manager.ts");
  assert.match(scheduler, /freeComfyMemory/);
  assert.match(scheduler, /releaseExternalTextRuntime/);
  assert.match(scheduler, /keep_alive: 0/);
  assert.match(scheduler, /lms.*unload.*--all/s);
  assert.match(scheduler, /stopManagedLlama/);
  assert.match(scheduler, /finishLocalMediaTask/);
  assert.match(scheduler, /doTransition\("text", "fast"\)/);
  assert.match(scheduler, /activeTask: "image"|activeTask: task/);
});

test("SDXL is the default 8 GB image route and SD3.5 is only experimental", async () => {
  const [catalog, store, gateway] = await Promise.all([
    read("lib/ai/local-runtime.ts"),
    read("build/media-routing-store.ts"),
    read("build/comfyui-sdxl-local-gateway.ts"),
  ]);
  assert.match(store, /imageRoute: "comfyui"/);
  assert.match(gateway, /SDXL_PATTERN/);
  assert.match(gateway, /find an SDXL checkpoint/);
  assert.match(gateway, /localProfile: "SDXL 1\.0"/);
  assert.match(catalog, /SD3\.5 Medium is an advanced experimental override/);
});

test("LTX-Video 2B is the default lightweight local video path while H3 stays override-compatible", async () => {
  const [catalog, ltx, gateway, composition] = await Promise.all([
    read("lib/ai/local-runtime.ts"),
    read("build/comfyui-ltx-local-provider.ts"),
    read("build/comfyui-ltx-local-gateway.ts"),
    read("build/local-ai-gateway.ts"),
  ]);
  assert.match(catalog, /LTX-Video 2B 0\.9\.8 Distilled/);
  assert.match(ltx, /LTX-Video-2B-0\.9\.8-Distilled/);
  assert.match(ltx, /UNSAFE_NODE_PATTERN/);
  assert.match(gateway, /videoRoute === "none"/);
  assert.match(gateway, /waitForLocalVideo/);
  assert.match(composition, /registerLtxLocalVideoGateway/);
  assert.match(composition, /registerNativeH3Gateway/);
});

test("visual continuity controls remain above provider/model selection", async () => {
  const [contracts, contextPack, common] = await Promise.all([
    read("lib/ai/contracts.ts"),
    read("lib/ai/context-pack.ts"),
    read("build/media-provider-common.ts"),
  ]);
  assert.match(contracts, /IdentityLock/);
  assert.match(common, /referenceImages/);
  assert.match(common, /identityLocks/);
  assert.match(contextPack, /character|identity/i);
  assert.match(contextPack, /wardrobe|look/i);
  assert.match(contextPack, /negative|constraint/i);
});

test("settings detect multiple runtimes and expose advanced overrides", async () => {
  const [installation, runtime, panel] = await Promise.all([
    read("build/local-ai-installation-gateway.ts"),
    read("build/local-runtime-gateway.ts"),
    read("app/local-runtime-panel.tsx"),
  ]);
  assert.match(installation, /llamaCpp/);
  assert.match(installation, /lmStudio/);
  assert.match(installation, /ollama/);
  assert.match(installation, /comfyui/);
  assert.match(installation, /preferredRuntime: "llama\.cpp"/);
  assert.match(runtime, /endpointOverrides/);
  assert.match(runtime, /modelOverrides/);
  assert.match(runtime, /managedLlama/);
  assert.match(panel, /Advanced users can override runtime/);
});

test("cloud providers and legacy Ollama remain available without defining local architecture", async () => {
  const [store, provider, page] = await Promise.all([
    read("build/writing-assistant-store.ts"),
    read("build/writing-assistant-provider.ts"),
    read("app/ai-routing/page.tsx"),
  ]);
  assert.match(store, /"local" \| "ollama" \| "openai" \| "minimax"/);
  assert.match(provider, /profile\.provider === "openai"/);
  assert.match(provider, /profile\.provider === "minimax"/);
  assert.match(provider, /profile\.provider === "ollama"/);
  assert.match(page, /Ollama is optional and no longer defines the local architecture/);
});
