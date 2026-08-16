import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  chooseModelForRole,
  normalizeModelDescriptor,
  recommendModelsForRoles,
  scoreModelForRole,
} from "../lib/ai/local-model-capabilities.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function model(input) {
  return normalizeModelDescriptor({ runtime: "test", ...input });
}

const fast4b = model({
  id: "qwen3.5:4b",
  parameterSize: "4B",
  quantization: "Q6_K",
  sizeBytes: 3.6 * 1024 ** 3,
  contextLength: 131072,
  nativeCapabilities: ["completion", "tools", "thinking"],
});

const quality9b = model({
  id: "qwen3.5:9b",
  parameterSize: "9B",
  quantization: "Q4_K_M",
  sizeBytes: 5.8 * 1024 ** 3,
  contextLength: 131072,
  nativeCapabilities: ["completion", "tools", "thinking"],
});

const coder7b = model({
  id: "qwen2.5-coder:7b",
  parameterSize: "7B",
  quantization: "Q4_K_M",
  sizeBytes: 4.7 * 1024 ** 3,
  contextLength: 65536,
  nativeCapabilities: ["completion", "tools"],
});

const future27b = model({
  id: "future-agent-model:27b",
  family: "future-agent-model",
  parameterSize: "27B",
  quantization: "Q4_K_M",
  sizeBytes: 15.5 * 1024 ** 3,
  contextLength: 262144,
  nativeCapabilities: ["completion", "vision", "tools", "thinking"],
});

test("native capability metadata can place an unfamiliar future model without a model-name patch", () => {
  assert.equal(future27b.capabilities.vision, true);
  assert.equal(future27b.capabilities.tools, true);
  assert.equal(future27b.capabilities.thinking, true);
  assert.equal(future27b.capabilities.longContext, true);
  assert.equal(future27b.capabilities.agentic, true);

  const workstation = { ramGb: 64, vramGb: 24, cpuGpuSplit: true };
  assert.equal(chooseModelForRole("vision", [fast4b, coder7b, future27b], workstation)?.model.id, future27b.id);
  assert.equal(chooseModelForRole("quality", [quality9b, future27b], workstation)?.model.id, future27b.id);
  assert.equal(chooseModelForRole("repair", [coder7b, future27b], workstation)?.model.id, future27b.id);
});

test("hardware fit keeps a large capable model on demand instead of displacing a practical local default", () => {
  const pascal = { ramGb: 32, vramGb: 8, cpuGpuSplit: true };
  const slots = recommendModelsForRoles([fast4b, quality9b, coder7b, future27b], pascal);
  assert.equal(slots.fast?.model.id, fast4b.id);
  assert.equal(slots.quality?.model.id, quality9b.id);
  assert.equal(slots.repair?.model.id, coder7b.id);
  assert.equal(slots.vision?.model.id, future27b.id);
  assert.ok(slots.vision?.reasons.some((reason) => /on-demand|split/i.test(reason)));
});

test("vision requires detected vision support and repair requires coding or tool use", () => {
  const hardware = { ramGb: 32, vramGb: 8, cpuGpuSplit: true };
  assert.equal(scoreModelForRole("vision", quality9b, hardware).eligible, false);
  const plain = model({ id: "plain-instruct:7b", parameterSize: "7B", sizeBytes: 4.5 * 1024 ** 3, nativeCapabilities: ["completion"] });
  assert.equal(scoreModelForRole("repair", plain, hardware).eligible, false);
  assert.equal(scoreModelForRole("repair", coder7b, hardware).eligible, true);
});

test("Qwen 3 family inference remains a fallback when a generic compatible server reports only a model id", () => {
  const inferred = normalizeModelDescriptor({ id: "qwen3.8:27b" });
  assert.equal(inferred.parameterB, 27);
  assert.equal(inferred.capabilities.tools, true);
  assert.equal(inferred.capabilities.thinking, true);
  assert.equal(inferred.capabilities.vision, false, "vision should not be invented when the generic server does not report it");
});

test("runtime manager probes native metadata and exposes five automatic slots", async () => {
  const [manager, panel, policy] = await Promise.all([
    read("build/local-runtime-manager.ts"),
    read("app/local-runtime-panel.tsx"),
    read("scripts/developer-repair-model-policy.mjs"),
  ]);
  assert.match(manager, /probeRuntimeModelCapabilities/);
  assert.match(manager, /LOCAL_CAPABILITY_ROLES/);
  assert.match(manager, /modelInventory/);
  assert.match(manager, /role !== "repair"/);
  assert.match(panel, /Automatic model slots/);
  assert.match(panel, /Vision \/ Visual QA/);
  assert.match(panel, /Pi \/ Repair/);
  assert.match(panel, /Detected model capabilities/);
  assert.match(policy, /capabilityApprovedCodingModel/);
  assert.match(policy, /chooseModelForRole\(\s*"repair"/);
  assert.match(policy, /repairCapabilityCacheApproves/);
});

test("Pi readiness uses the same native capability and hardware-fit router as Settings", async () => {
  const [ensure, hardware, cache] = await Promise.all([
    read("scripts/ensure-local-repair-model.mjs"),
    read("scripts/local-repair-hardware.mjs"),
    read("scripts/local-repair-capability-cache.mjs"),
  ]);
  assert.match(ensure, /probeRuntimeModelCapabilities/);
  assert.match(ensure, /detectRepairHardware/);
  assert.match(ensure, /scoreModelForRole\("repair"/);
  assert.match(ensure, /writeRepairCapabilityCache/);
  assert.match(ensure, /ollamaInstalledModels/);
  assert.match(ensure, /downloadedLmStudioModels/);
  assert.match(ensure, /warmOllama/);
  assert.match(ensure, /pullOllama/);
  assert.match(hardware, /nvidia-smi/);
  assert.match(cache, /repair-model-capabilities\.json/);
  assert.match(cache, /repairEligible/);
});
