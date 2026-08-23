import assert from "node:assert/strict";
import test from "node:test";
import { normalizeModelDescriptor } from "../lib/runtime/ai/local-model/local-model-capabilities.mjs";
import {
  buildLocalModelCatalog,
  chooseModelForPreference,
  modelThroughput,
  recommendLocalModelPreferences,
} from "../lib/runtime/ai/local-model/local-model-recommendations.mjs";

const GB = 1024 ** 3;
const hardware = {
  ramGb: 32,
  vramGb: 8,
  cpuThreads: 16,
  gpuGeneration: "pascal",
  cpuGpuSplit: true,
};

const fast4b = normalizeModelDescriptor({
  id: "qwen3.5:4b",
  parameterSize: "4B",
  quantization: "Q6_K",
  sizeBytes: 3.6 * GB,
  contextLength: 131072,
  nativeCapabilities: ["completion", "tools", "thinking"],
});
const quality9b = normalizeModelDescriptor({
  id: "qwen3.5:9b",
  parameterSize: "9B",
  quantization: "Q4_K_M",
  sizeBytes: 5.8 * GB,
  contextLength: 131072,
  nativeCapabilities: ["completion", "tools", "thinking"],
});
const coder7b = normalizeModelDescriptor({
  id: "qwen2.5-coder:7b",
  parameterSize: "7B",
  quantization: "Q4_K_M",
  sizeBytes: 4.7 * GB,
  contextLength: 65536,
  nativeCapabilities: ["completion", "tools"],
});
const large27b = normalizeModelDescriptor({
  id: "future-agent:27b",
  parameterSize: "27B",
  quantization: "Q4_K_M",
  sizeBytes: 15.5 * GB,
  contextLength: 262144,
  nativeCapabilities: ["completion", "vision", "tools", "thinking"],
});
const unsafe70b = normalizeModelDescriptor({
  id: "future-agent:70b",
  parameterSize: "70B",
  quantization: "Q6_K",
  sizeBytes: 52 * GB,
  contextLength: 131072,
  nativeCapabilities: ["completion", "vision", "tools", "thinking"],
});

const models = [fast4b, quality9b, coder7b, large27b, unsafe70b];

test("catalog reports safe memory fit before a model is recommended", () => {
  const catalog = buildLocalModelCatalog(models, hardware);
  assert.equal(catalog.find((item) => item.id === fast4b.id)?.fit.id, "gpu");
  assert.equal(catalog.find((item) => item.id === large27b.id)?.fit.id, "split");
  assert.equal(catalog.find((item) => item.id === unsafe70b.id)?.fit.id, "too-large");
  assert.notEqual(catalog.find((item) => item.id === unsafe70b.id)?.fit.label, "fits GPU");
});

test("throughput is estimated without forcing a benchmark and measured evidence wins when present", () => {
  const estimated = modelThroughput(fast4b, hardware);
  assert.equal(estimated.source, "estimated");
  assert.ok(estimated.low > 0 && estimated.high > estimated.low);

  const benchmarks = {
    models: {
      "qwen3.5:4b": {
        tokensPerSecond: 41.2,
        measuredAt: "2026-08-18T12:00:00Z",
        runtime: "llama.cpp",
      },
    },
  };
  const measured = modelThroughput(fast4b, hardware, benchmarks);
  assert.equal(measured.source, "measured");
  assert.equal(measured.mid, 41.2);
  assert.equal(measured.low, 41.2);
  assert.equal(measured.high, 41.2);
});

test("simple preferences preserve role capability requirements while changing ranking priorities", () => {
  const fastest = chooseModelForPreference("fast", models, hardware, "fastest");
  const repair = chooseModelForPreference("repair", models, hardware, "balanced");
  const vision = chooseModelForPreference("vision", models, hardware, "best-quality");
  const lowest = chooseModelForPreference("quality", models, hardware, "lowest-memory");

  assert.equal(fastest?.model.id, fast4b.id);
  assert.equal(repair?.model.id, coder7b.id);
  assert.equal(vision?.model.id, large27b.id);
  assert.equal(lowest?.model.id, fast4b.id);
  assert.notEqual(vision?.model.id, unsafe70b.id);
});

test("recommendation profiles expose Fastest, Balanced, Best Quality and Lowest Memory without a new runtime", () => {
  const profiles = recommendLocalModelPreferences(models, hardware);
  assert.deepEqual(profiles.map((profile) => profile.id), ["fastest", "balanced", "best-quality", "lowest-memory"]);
  for (const profile of profiles) {
    assert.ok(profile.primaryModel);
    assert.ok(profile.throughput.source === "estimated" || profile.throughput.source === "measured");
    assert.ok(Object.hasOwn(profile.roles, "repair"));
    assert.ok(Object.hasOwn(profile.roles, "vision"));
  }
});

test("speculative decoding stays off until measured speed gain and memory headroom both prove it worthwhile", () => {
  const noEvidence = buildLocalModelCatalog([fast4b], hardware)[0];
  assert.equal(noEvidence.acceleration.recommended, false);
  assert.match(noEvidence.acceleration.reason, /benchmark proves/i);

  const weakEvidence = buildLocalModelCatalog([fast4b], hardware, {
    models: { "qwen3.5:4b": { tokensPerSecond: 40, speculativeTokensPerSecond: 41 } },
  })[0];
  assert.equal(weakEvidence.acceleration.recommended, false);

  const proven = buildLocalModelCatalog([fast4b], hardware, {
    models: { "qwen3.5:4b": { tokensPerSecond: 40, speculativeTokensPerSecond: 46 } },
  })[0];
  assert.equal(proven.acceleration.recommended, true);
  assert.ok(proven.acceleration.gainPercent >= 5);
  assert.ok(proven.acceleration.headroomGb >= 1.5);
});
