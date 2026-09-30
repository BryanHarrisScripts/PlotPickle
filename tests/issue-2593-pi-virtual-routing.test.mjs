import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PI_CLASSIFIER_FORBIDDEN_DECISIONS,
  buildPiDeveloperRouteProjection,
  choosePiDeveloperPhysicalRoute,
  classifierMayDecide,
  normalizePiDeveloperRouteProjection,
  safePiDeveloperRouteEvidence,
} from "../lib/agents/pi-developer-routing.mjs";
import plotpickleVirtualDeveloperModel from "../.pi/extensions/plotpickle-virtual-model.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

function localRoute(id = "local-primary", model = "qwen3.8-27b", purpose = "default") {
  return {
    id,
    provider: "plotpickle-local",
    model,
    locality: "local",
    purpose,
    thinkingLevel: "off",
    ready: true,
  };
}

test("#2593 PlotPickle Agent Compute remains authority for the Pi virtual developer model", () => {
  const projection = buildPiDeveloperRouteProjection({ localRoute: localRoute() });
  assert.equal(projection.authority, "plotpickle-agent-compute");
  assert.deepEqual(projection.logicalModel, { provider: "plotpickle", model: "developer" });
  assert.equal(projection.selectedRouteId, "local-primary");
  assert.equal(projection.privacy.localOnly, true);
  assert.equal(projection.privacy.cloudAllowed, false);
});

test("#2593 cloud credentials never silently enable the OpenAI/ChatGPT route", () => {
  const projection = buildPiDeveloperRouteProjection({
    localRoute: localRoute(),
    cloudRoute: {
      id: "openai-explicit",
      provider: "openai",
      model: "gpt-5.6-sol",
      purpose: "complex",
      thinkingLevel: "high",
      ready: true,
    },
    localOnly: false,
    explicitCloudConsent: false,
    preferCloud: true,
  });
  assert.equal(projection.selectedRouteId, "local-primary");
  assert.equal(projection.privacy.cloudAllowed, false);
  assert.equal(choosePiDeveloperPhysicalRoute({ projection, request: { reason: "user" } }).locality, "local");

  assert.throws(() => normalizePiDeveloperRouteProjection({
    ...projection,
    selectedRouteId: "openai-explicit",
  }), /violates the current local\/cloud consent policy/u);
});

test("#2593 explicit cloud consent can authorize but never auto-login the OpenAI physical route", () => {
  const projection = buildPiDeveloperRouteProjection({
    localRoute: localRoute(),
    cloudRoute: {
      id: "openai-explicit",
      provider: "openai",
      model: "gpt-5.6-sol",
      purpose: "complex",
      thinkingLevel: "high",
      ready: true,
    },
    localOnly: false,
    explicitCloudConsent: true,
    preferCloud: true,
  });
  const route = choosePiDeveloperPhysicalRoute({ projection, request: { reason: "user" } });
  assert.equal(route.provider, "openai");
  assert.equal(route.model, "gpt-5.6-sol");
});

test("#2593 classifier authority is bounded to non-authoritative routing decisions", () => {
  assert.equal(classifierMayDecide("complexity"), true);
  assert.equal(classifierMayDecide("model-family"), true);
  for (const decision of PI_CLASSIFIER_FORBIDDEN_DECISIONS) {
    assert.equal(classifierMayDecide(decision), false, decision);
  }

  const projection = buildPiDeveloperRouteProjection({
    localRoute: localRoute(),
    classifier: {
      enabled: true,
      provider: "llama.cpp",
      model: "local-classifier",
      locality: "local",
      decisionKinds: ["complexity"],
    },
  });
  assert.equal(projection.classifier.authoritative, false);
  assert.throws(() => normalizePiDeveloperRouteProjection({
    ...projection,
    classifier: {
      enabled: true,
      provider: "llama.cpp",
      model: "local-classifier",
      locality: "local",
      decisionKinds: ["merge-authorization"],
    },
  }), /not an allowed non-authoritative routing decision/u);
});

test("#2593 classifier can choose only among already authorized physical routes", () => {
  const projection = buildPiDeveloperRouteProjection({
    localRoute: localRoute("standard", "qwen2.5-coder:7b", "default"),
    classifier: {
      enabled: true,
      provider: "llama.cpp",
      model: "local-classifier",
      locality: "local",
      decisionKinds: ["complexity"],
    },
  });
  const extended = normalizePiDeveloperRouteProjection({
    ...projection,
    authorizedRoutes: [
      ...projection.authorizedRoutes,
      localRoute("complex", "qwen3.8-27b", "complex"),
    ],
  });
  assert.equal(
    choosePiDeveloperPhysicalRoute({ projection: extended, request: { reason: "user" }, classifierChoice: "complex" }).id,
    "complex",
  );
});

test("#2593 virtual model registration dispatches to the physical model selected by PlotPickle policy", async () => {
  let definition;
  plotpickleVirtualDeveloperModel({
    registerVirtualModel(value) { definition = value; },
  });
  assert.equal(definition.provider, "plotpickle");
  assert.equal(definition.id, "developer");

  const previous = process.env.PLOTPICKLE_PI_ROUTE_JSON;
  process.env.PLOTPICKLE_PI_ROUTE_JSON = JSON.stringify(buildPiDeveloperRouteProjection({ localRoute: localRoute() }));
  try {
    const physical = { provider: "plotpickle-local", id: "qwen3.8-27b" };
    const result = await definition.route(
      { reason: "user", thinkingLevel: "medium", messages: [], signal: undefined },
      {
        modelRegistry: {
          find(provider, model) {
            return provider === physical.provider && model === physical.id ? physical : undefined;
          },
          findOfType() { return undefined; },
          classify() { throw new Error("Classifier should not run without a configured classifier."); },
        },
      },
    );
    assert.equal(result.model, physical);
    assert.equal(result.state.authority, "plotpickle-agent-compute");
  } finally {
    if (previous === undefined) delete process.env.PLOTPICKLE_PI_ROUTE_JSON;
    else process.env.PLOTPICKLE_PI_ROUTE_JSON = previous;
  }
});

test("#2593 route evidence separates logical and physical model IDs without prompt payloads", () => {
  const projection = buildPiDeveloperRouteProjection({ localRoute: localRoute() });
  const evidence = safePiDeveloperRouteEvidence({
    projection,
    physicalRoute: localRoute(),
    usage: { inputTokens: 12, outputTokens: 8, estimatedCost: 0 },
  });
  assert.equal(evidence.logicalProviderId, "plotpickle");
  assert.equal(evidence.logicalModelId, "developer");
  assert.equal(evidence.providerId, "plotpickle-local");
  assert.equal(evidence.modelId, "qwen3.8-27b");
  assert.equal(evidence.inputTokens, 12);
  assert.equal("prompt" in evidence, false);
  assert.equal("response" in evidence, false);
});

test("#2593 live configuration wires the virtual route without changing Story Mode", async () => {
  const [policy, stack, worker, routing, vocabulary, compatibility] = await Promise.all([
    read("config/pi-virtual-model-policy.json").then(JSON.parse),
    read("config/developer-agent-stack.json").then(JSON.parse),
    read("scripts/pi-worker-runtime.mjs"),
    read("lib/agents/pi-developer-routing.mjs"),
    read("lib/agents/agent-runtime-vocabulary.mjs"),
    read("config/pi-099-compatibility.json").then(JSON.parse),
  ]);
  assert.equal(policy.scope, "developer-agent-only");
  assert.equal(policy.cloud.loginCommand, "/login openai");
  assert.equal(policy.cloud.loginTriggeredByPlotPickle, false);
  assert.equal(policy.cloud.existingCredentialsEnableRouting, false);
  assert.equal(stack.piRuntime.virtualModel.provider, "plotpickle");
  assert.equal(stack.piRuntime.virtualModel.model, "developer");
  assert.equal(stack.piRuntime.virtualModel.authority, "plotpickle-agent-compute");
  assert.match(worker, /PI_DEVELOPER_ROUTE_ENV/u);
  assert.match(routing, /PLOTPICKLE_PI_ROUTE_JSON/u);
  assert.match(worker, /plotpickle-virtual-model\.mjs/u);
  assert.match(worker, /provider", PI_DEVELOPER_LOGICAL_MODEL\.provider/u);
  assert.match(vocabulary, /logicalProviderId/u);
  assert.match(vocabulary, /logicalModelId/u);
  assert.equal(compatibility.phase4Migration.virtualModel, true);
  assert.equal(policy.storyModeAffected, false);
});
