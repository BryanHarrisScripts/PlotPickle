import assert from "node:assert/strict";
import test from "node:test";

import { CHARACTER_DEVELOPMENT_STUDY_TYPES, createCharacterDevelopmentPackage } from "../core/visual-production/character-development.mjs";
import { createCharacterDevelopmentStudySpecifications } from "../core/visual-production/character-development-specifications.mjs";
import { createCharacterDevelopmentGenerationPlan } from "../lib/visual-production/character-development-runner.mjs";

const providerRoute = {
  provider: "comfyui",
  runtime: "local",
  model: "juggernautXL_v9.safetensors",
  costClass: "local",
  consentState: "not-required",
  budgetState: "not-required",
};

const mediaStatus = {
  imageRoute: "comfyui",
  profiles: { openai: { configured: false }, minimax: { configured: false } },
  comfyui: {
    reachable: true,
    imageNodesReady: true,
    checkpoint: "juggernautXL_v9.safetensors",
    selectedCheckpoint: "juggernautXL_v9.safetensors",
  },
};

function characterPackage() {
  const result = createCharacterDevelopmentPackage({
    projectId: "afterglow-v9",
    ppfRevision: "42",
    character: { id: "character:ren", name: "Ren", role: "Protagonist" },
    characterEvidence: {
      physical: ["Lean adult with a narrow angular face and close-cropped dark hair."],
      performance: ["Protects control when grief makes connection feel dangerous."],
      wardrobe: ["Charcoal field coat over practical dark layers."],
      props: ["Carries the brass camera established in Block 17."],
      powersEffects: [],
      relationships: ["Withdrawal becomes costly when Isobel demands honesty."],
      locationsWorld: ["Block 17 takes place in a wet industrial exterior with hard practical light."],
      visualDo: ["Preserve the accepted angular face, adult age read and lean proportions."],
      visualAvoid: ["Do not add supernatural effects or unsupported costume changes."],
    },
    canonicalEvidenceRefs: ["ppf:character:ren@42", "ppf:prop:camera@42", "ppf:block:17@42"],
    approvedVisualRefs: ["/api/local-ai/assets/ren-approved.webp"],
    observedRefs: ["/api/local-ai/assets/reference-lighting.jpg"],
    targetStudyTypes: CHARACTER_DEVELOPMENT_STUDY_TYPES,
    providerRoute,
    authority: { authorityClass: "delegated-autonomous-operator", autonomousRunId: "afterglow-reference-v1" },
    createdAt: "2026-09-03T19:00:00.000Z",
  });
  assert.equal(result.status, "ready");
  return result.package;
}

test("#1557 derives revision-bound study specifications directly from bounded canonical character evidence", () => {
  const candidatePackage = characterPackage();
  const result = createCharacterDevelopmentStudySpecifications(candidatePackage);
  assert.equal(result.status, "ready");
  assert.equal(result.specifications.length, CHARACTER_DEVELOPMENT_STUDY_TYPES.length - 1);
  assert.equal(result.notApplicable.length, 1);
  assert.equal(result.notApplicable[0].studyId, candidatePackage.studies.find((study) => study.type === "powers-effects").id);
  assert.equal(result.notApplicable[0].ppfRevision, "42");
  assert.match(result.notApplicable[0].reason, /No canonical power/i);
  assert.deepEqual(result.notApplicable[0].evidenceRefs, candidatePackage.canonicalEvidenceRefs);

  const turnaround = result.specifications.find((item) => item.studyId === candidatePackage.studies.find((study) => study.type === "turnaround").id);
  assert.equal(turnaround.ppfRevision, "42");
  assert.match(turnaround.prompt, /Canonical physical evidence: Lean adult/i);
  assert.match(turnaround.prompt, /Charcoal field coat/i);
  assert.match(turnaround.prompt, /Do not invent story facts/i);
  assert.deepEqual(turnaround.coverageLabels, ["front", "three-quarter", "profile", "back", "proportion"]);
  assert.ok(turnaround.identityLocks.neverChange.some((value) => /accepted angular face/i.test(value)));
});

test("#1557 generation planning can use derived evidence specifications without hand-written prompts", () => {
  const candidatePackage = characterPackage();
  const result = createCharacterDevelopmentGenerationPlan(candidatePackage, mediaStatus);
  assert.equal(result.status, "ready");
  assert.equal(result.plan.route, "comfyui");
  assert.equal(result.plan.model, "juggernautXL_v9.safetensors");
  assert.equal(result.plan.paid, false);
  assert.equal(result.plan.requestedCount, CHARACTER_DEVELOPMENT_STUDY_TYPES.length - 1);
  assert.equal(result.plan.notApplicable.length, 1);
  assert.equal(result.plan.jobs.length, CHARACTER_DEVELOPMENT_STUDY_TYPES.length - 1);
  assert.ok(result.plan.jobs.every((job) => job.body.requestCount === 1));
  assert.ok(result.plan.jobs.every((job) => job.body.billingAcknowledged === false));
  assert.ok(result.plan.jobs.every((job) => job.body.prompt.includes("Use only the supplied canonical evidence")));
  assert.ok(result.plan.jobs.some((job) => job.body.prompt.includes("Protects control when grief makes connection feel dangerous")));
  assert.ok(result.plan.jobs.some((job) => JSON.stringify(job.body.continuityMetadata).includes("Carries the brass camera")));
  assert.ok(result.plan.jobs.every((job) => !job.body.prompt.includes("supernatural effects") || job.studyType !== "powers-effects"));
});

test("#1557 refuses to derive studies when only opaque evidence refs exist and no bounded character evidence was supplied", () => {
  const candidatePackage = createCharacterDevelopmentPackage({
    projectId: "afterglow-v9",
    ppfRevision: "42",
    character: { id: "character:ren", name: "Ren" },
    canonicalEvidenceRefs: ["ppf:character:ren@42"],
    targetStudyTypes: ["turnaround"],
    providerRoute,
    authority: { authorityClass: "host" },
  }).package;
  const result = createCharacterDevelopmentStudySpecifications(candidatePackage);
  assert.equal(result.status, "blocked");
  assert.equal(result.blocker.code, "canonical-evidence");
});
