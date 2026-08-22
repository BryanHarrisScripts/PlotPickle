import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateComfyUiWrongPortFault,
  evaluateSageFallbackFault,
  evaluateSageVisibleAnswer,
  verifyComfyUiVisibleOutput,
} from "../scripts/casebook-live-verifiers.mjs";

function sageRoute(overrides = {}) {
  return {
    choice: { text: "ollama" },
    text: {
      selected: "ollama",
      options: {
        ollama: { ready: true, model: "plotpickle-guide:test", ...overrides },
      },
    },
  };
}

function mediaStatus(overrides = {}) {
  return {
    comfyui: {
      reachable: true,
      imageNodesReady: true,
      checkpoint: "sd_xl_base_1.0.safetensors",
      imageVerifiedAt: "2026-08-22T00:00:00.000Z",
      version: "0.33.2",
      ...overrides,
    },
  };
}

function aiStatus(overrides = {}) {
  return {
    image: {
      selected: "comfyui",
      options: {
        "ollama-comfyui": { ready: true, model: "Ollama → SDXL", ...overrides },
      },
    },
  };
}

test("#1236 Sage independent verifier accepts a useful grounded Human-visible Ollama answer", () => {
  const result = evaluateSageVisibleAnswer({
    question: "In one concise sentence, what is the main idea of this premise lesson?",
    answer: "A strong premise states the central story idea and dramatic situation clearly enough to guide later choices.",
    lessonTitle: "Building a Strong Premise",
    relatedLessonLabels: ["Learn more in Building a Strong Premise"],
    routeStatus: sageRoute(),
  });
  assert.equal(result.status, "verified");
  assert.equal(result.source, "sage-response-evaluator");
  assert.equal(result.independent, true);
});

test("#1236 Sage independent verifier rejects the vague real-machine fallback and non-Ollama routes", () => {
  const vague = evaluateSageVisibleAnswer({
    question: "What is the main idea of this lesson?",
    answer: "That local reply didn’t come through cleanly, so I dropped it instead of showing you nonsense. Ask me again and I’ll keep it short and direct.",
    lessonTitle: "Building a Strong Premise",
    relatedLessonLabels: [],
    routeStatus: sageRoute(),
  });
  assert.equal(vague.status, "contradicted");
  assert.match(vague.summary, /fallback/i);

  const wrongRoute = evaluateSageVisibleAnswer({
    question: "Explain premise in one sentence.",
    answer: "A premise is the compact dramatic idea that guides the story.",
    lessonTitle: "Building a Strong Premise",
    relatedLessonLabels: ["Building a Strong Premise"],
    routeStatus: { text: { selected: "openai", options: { ollama: { ready: true } } } },
  });
  assert.equal(wrongRoute.status, "contradicted");
  assert.match(wrongRoute.summary, /not ollama/i);
});

test("#1236 ComfyUI independent verifier requires local asset read-back, visible image readiness and combined-route readiness", async () => {
  const bytes = Buffer.alloc(2_400, 7);
  const result = await verifyComfyUiVisibleOutput({
    baseUrl: "http://127.0.0.1:4173",
    imageSrc: "/generated/test.png",
    mediaStatus: mediaStatus(),
    aiStatus: aiStatus(),
    fetchImpl: async (url) => {
      assert.equal(String(url), "http://127.0.0.1:4173/generated/test.png");
      return new Response(bytes, { status: 200, headers: { "content-type": "image/png" } });
    },
  });
  assert.equal(result.status, "verified");
  assert.equal(result.source, "comfyui-output-observer");
  assert.equal(result.metadata.assetBytes, 2400);
  assert.equal(result.metadata.combinedRouteReady, true);
});

test("#1236 ComfyUI verifier rejects job-only success, external assets, and a route still marked Test needed", async () => {
  const noVisible = await verifyComfyUiVisibleOutput({
    baseUrl: "http://127.0.0.1:4173",
    imageSrc: "",
    mediaStatus: mediaStatus(),
    aiStatus: aiStatus(),
  });
  assert.equal(noVisible.status, "contradicted");
  assert.match(noVisible.summary, /no Human-visible generated image/i);

  const routeBlocked = await verifyComfyUiVisibleOutput({
    baseUrl: "http://127.0.0.1:4173",
    imageSrc: "/generated/test.png",
    mediaStatus: mediaStatus(),
    aiStatus: aiStatus({ ready: false }),
    fetchImpl: async () => new Response(Buffer.alloc(2_000), { status: 200, headers: { "content-type": "image/png" } }),
  });
  assert.equal(routeBlocked.status, "contradicted");
  assert.match(routeBlocked.summary, /not ready\/selectable/i);

  const external = await verifyComfyUiVisibleOutput({
    baseUrl: "http://127.0.0.1:4173",
    imageSrc: "https://example.com/test.png",
    mediaStatus: mediaStatus(),
    aiStatus: aiStatus(),
    fetchImpl: async () => { throw new Error("must not fetch external asset"); },
  });
  assert.equal(external.status, "contradicted");
  assert.match(external.summary, /not local/i);
});

test("#1236 fault evaluators count only detected bad states as FAIL/BLOCKED", () => {
  const wrongPort = evaluateComfyUiWrongPortFault({ comfyui: { reachable: false, error: "ECONNREFUSED" } });
  assert.equal(wrongPort.outcome, "blocked");
  assert.match(wrongPort.observed, /wrong-port diagnostic was detected/i);

  const missedPort = evaluateComfyUiWrongPortFault({ comfyui: { reachable: true } });
  assert.equal(missedPort.outcome, "pass");

  const vague = evaluateSageFallbackFault("That local reply didn’t come through cleanly, so I dropped it. Ask me again and I’ll keep it short and direct.");
  assert.equal(vague.outcome, "fail");

  const useful = evaluateSageFallbackFault("A premise gives the story its central dramatic idea and direction.");
  assert.equal(useful.outcome, "pass");
});
