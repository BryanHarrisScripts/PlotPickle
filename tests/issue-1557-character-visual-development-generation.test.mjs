import assert from "node:assert/strict";
import test from "node:test";

import { createCharacterDevelopmentPackage } from "../core/visual-production/character-development.mjs";
import {
  CHARACTER_DEVELOPMENT_IMAGE_API,
  createCharacterDevelopmentGenerationPlan,
  runCharacterDevelopmentGeneration,
} from "../lib/visual-production/character-development-runner.mjs";

const localProviderRoute = {
  provider: "comfyui",
  runtime: "local",
  model: "juggernautXL_v9.safetensors",
  costClass: "local",
  consentState: "not-required",
  budgetState: "not-required",
};

const localStatus = {
  imageRoute: "comfyui",
  profiles: { openai: { configured: false }, minimax: { configured: false } },
  comfyui: {
    reachable: true,
    imageNodesReady: true,
    checkpoint: "juggernautXL_v9.safetensors",
    selectedCheckpoint: "juggernautXL_v9.safetensors",
  },
};

function packageFor(providerRoute = localProviderRoute, types = ["turnaround", "expressions"]) {
  const result = createCharacterDevelopmentPackage({
    projectId: "afterglow-v9",
    ppfRevision: "42",
    character: { id: "character:ren", name: "Ren", role: "Protagonist" },
    canonicalEvidenceRefs: ["ppf:character:ren@42", "ppf:wardrobe:ren@42"],
    approvedVisualRefs: ["/api/local-ai/assets/ren-approved.webp", "visual-canon:ren-v2"],
    observedRefs: ["/api/local-ai/assets/reference-lighting.jpg", "external-reference:ignored-for-provider"],
    targetStudyTypes: types,
    providerRoute,
    authority: { authorityClass: "delegated-autonomous-operator", autonomousRunId: "run-afterglow" },
    createdAt: "2026-09-03T19:00:00.000Z",
  });
  assert.equal(result.status, "ready");
  return result.package;
}

function specifications(candidatePackage) {
  return candidatePackage.studies.map((study) => ({
    studyId: study.id,
    ppfRevision: "42",
    prompt: `Generate the ${study.type} study from the supplied revision-bound evidence without inventing canon.`,
    specificationFingerprint: `spec:${study.type}:42`,
    coverageLabels: study.type === "turnaround" ? ["front", "profile", "back"] : ["neutral", "grief", "resolve"],
    aspect: "landscape",
    quality: "low",
    identityLocks: {
      neverChange: ["accepted face proportions"],
      apiKey: "must-not-leave-the-host",
    },
    continuityMetadata: { note: "Preserve accepted identity." },
  }));
}

test("#1557 generation plan uses the active Settings image route without selecting or switching providers", () => {
  const candidatePackage = packageFor();
  const result = createCharacterDevelopmentGenerationPlan(candidatePackage, localStatus, {
    studySpecifications: specifications(candidatePackage),
  });
  assert.equal(result.status, "ready");
  assert.equal(result.plan.route, "comfyui");
  assert.equal(result.plan.model, "juggernautXL_v9.safetensors");
  assert.equal(result.plan.paid, false);
  assert.equal(result.plan.requestedCount, 2);
  assert.ok(result.plan.jobs.every((job) => job.body.billingAcknowledged === false));
  assert.ok(result.plan.jobs.every((job) => job.body.requestCount === 1));
  assert.ok(result.plan.jobs.every((job) => job.body.approvedCharacterReferences.includes("/api/local-ai/assets/ren-approved.webp")));
  assert.ok(result.plan.jobs.every((job) => !job.body.approvedCharacterReferences.includes("visual-canon:ren-v2")));
  assert.equal(JSON.stringify(result.plan.jobs).includes("must-not-leave-the-host"), false);
});

test("#1557 blocks route or model drift instead of silently falling back", () => {
  const candidatePackage = packageFor();
  const routeChanged = createCharacterDevelopmentGenerationPlan(candidatePackage, {
    ...localStatus,
    imageRoute: "openai",
    profiles: { openai: { configured: true, imageModel: "gpt-image-2" } },
  }, { studySpecifications: specifications(candidatePackage) });
  assert.equal(routeChanged.status, "blocked");
  assert.equal(routeChanged.blocker.code, "provider-route-changed");

  const modelChanged = createCharacterDevelopmentGenerationPlan(candidatePackage, {
    ...localStatus,
    comfyui: { ...localStatus.comfyui, checkpoint: "other.safetensors", selectedCheckpoint: "other.safetensors" },
  }, { studySpecifications: specifications(candidatePackage) });
  assert.equal(modelChanged.status, "blocked");
  assert.equal(modelChanged.blocker.code, "provider-model-changed");
});

test("#1557 requires exact current paid consent for every cloud study request", () => {
  const providerRoute = {
    provider: "openai",
    runtime: "cloud",
    model: "gpt-image-2",
    costClass: "paid-cloud",
    consentState: "approved",
    budgetState: "approved",
  };
  const candidatePackage = packageFor(providerRoute);
  const mediaStatus = {
    imageRoute: "openai",
    profiles: { openai: { configured: true, provider: "openai", imageModel: "gpt-image-2" } },
    comfyui: {},
  };
  const missing = createCharacterDevelopmentGenerationPlan(candidatePackage, mediaStatus, {
    studySpecifications: specifications(candidatePackage),
  });
  assert.equal(missing.status, "blocked");
  assert.equal(missing.blocker.code, "paid-consent");

  const statement = "I authorize 2 paid image requests for this Character Visual Development package.";
  const ready = createCharacterDevelopmentGenerationPlan(candidatePackage, mediaStatus, {
    studySpecifications: specifications(candidatePackage),
    paidConsent: { acknowledged: true, maximumRequests: 2, statement },
  });
  assert.equal(ready.status, "ready");
  assert.equal(ready.plan.paid, true);
  assert.ok(ready.plan.jobs.every((job) => job.body.billingAcknowledged === true));
});

test("#1557 refuses cloud execution when the package itself lacks consent or budget authority", () => {
  const providerRoute = {
    provider: "minimax",
    runtime: "cloud",
    model: "image-01",
    costClass: "paid-cloud",
    consentState: "approved",
    budgetState: "missing",
  };
  const created = createCharacterDevelopmentPackage({
    projectId: "afterglow-v9",
    ppfRevision: "42",
    character: { id: "character:ren", name: "Ren" },
    canonicalEvidenceRefs: ["ppf:character:ren@42"],
    targetStudyTypes: ["turnaround"],
    providerRoute,
    authority: { authorityClass: "host" },
  });
  assert.equal(created.status, "blocked");
  assert.equal(created.blocker.code, "provider-policy");
});

test("#1557 executor records only returned local candidate assets and keeps them unaccepted", async () => {
  const candidatePackage = packageFor();
  const requests = [];
  let index = 0;
  const fetchImpl = async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    index += 1;
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          route: "comfyui",
          assetUrl: `/api/local-ai/assets/ren-study-${index}.png`,
          providerRequestId: `comfy-prompt-${index}`,
        };
      },
    };
  };
  const result = await runCharacterDevelopmentGeneration(
    "http://127.0.0.1:4173",
    candidatePackage,
    localStatus,
    { studySpecifications: specifications(candidatePackage) },
    fetchImpl,
  );
  assert.equal(result.status, "ready");
  assert.equal(result.generated.length, 2);
  assert.equal(result.failed.length, 0);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => request.url.endsWith(CHARACTER_DEVELOPMENT_IMAGE_API)));
  assert.ok(result.package.studies.every((study) => study.generatedCandidateRefs[0]?.startsWith("/api/local-ai/assets/")));
  assert.ok(result.package.studies.every((study) => study.reviewState === "candidate"));
  assert.equal(result.package.acceptedArtifactId, "");
  assert.equal(JSON.stringify(result).includes("Generate the turnaround study"), false);
});

test("#1557 executor fails a provider-response route mismatch without recording the candidate", async () => {
  const candidatePackage = packageFor(localProviderRoute, ["turnaround"]);
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    async json() {
      return { ok: true, route: "openai", assetUrl: "/api/local-ai/assets/wrong-route.png" };
    },
  });
  const result = await runCharacterDevelopmentGeneration(
    "http://127.0.0.1:4173",
    candidatePackage,
    localStatus,
    { studySpecifications: specifications(candidatePackage) },
    fetchImpl,
  );
  assert.equal(result.status, "failed");
  assert.equal(result.generated.length, 0);
  assert.equal(result.failed.length, 1);
  assert.equal(result.package.studies[0].generatedCandidateRefs.length, 0);
});

test("#1557 only regenerates requested missing or stale studies", () => {
  const candidatePackage = packageFor();
  candidatePackage.studies[0].generatedCandidateRefs = ["/api/local-ai/assets/existing.png"];
  candidatePackage.studies[1].stale = true;
  const result = createCharacterDevelopmentGenerationPlan(candidatePackage, localStatus, {
    studySpecifications: specifications(candidatePackage),
  });
  assert.equal(result.status, "ready");
  assert.deepEqual(result.plan.studyIds, [candidatePackage.studies[1].id]);
});
