import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CHARACTER_DEVELOPMENT_STUDY_TYPES,
  createCharacterDevelopmentPackage,
  linkAcceptedVisualArtifact,
  markCharacterDevelopmentStale,
  recordConsistencyFindings,
  toVisualReadinessEvidence,
} from "../core/visual-production/character-development.mjs";

const baseInput = {
  projectId: "afterglow-v9",
  ppfRevision: "42",
  character: { id: "character:sam", name: "Sam", role: "Protagonist" },
  canonicalEvidenceRefs: ["ppf:character:sam@42", "ppf:prop:camera@42"],
  approvedVisualRefs: ["visual-canon:sam-identity-v2"],
  observedRefs: ["visual-reference:street-photographer"],
  targetStudyTypes: CHARACTER_DEVELOPMENT_STUDY_TYPES,
  providerRoute: {
    provider: "comfyui",
    runtime: "local",
    model: "sdxl-local",
    costClass: "local",
    consentState: "not-required",
    budgetState: "not-required",
  },
  authority: { authorityClass: "authenticated-human", authenticatedHuman: true },
  createdAt: "2026-09-03T18:00:00.000Z",
};

test("#1557 creates one revision-bound candidate package with independently addressable studies", () => {
  const result = createCharacterDevelopmentPackage(baseInput);
  assert.equal(result.status, "ready");
  assert.equal(result.package.projectId, "afterglow-v9");
  assert.equal(result.package.ppfBaseRevision, "42");
  assert.equal(result.package.characterId, "character:sam");
  assert.deepEqual(result.package.studies.map((study) => study.type), CHARACTER_DEVELOPMENT_STUDY_TYPES);
  assert.ok(result.package.studies.every((study) => study.reviewState === "candidate"));
  assert.ok(result.package.studies.every((study) => study.sourceEvidenceRefs.includes("ppf:character:sam@42")));
  assert.equal(result.package.acceptedArtifactId, "");
  assert.equal(Object.hasOwn(result.package, "chainOfThought"), false);
});

test("#1557 keeps observed, accepted and generated evidence distinct", () => {
  const result = createCharacterDevelopmentPackage({
    ...baseInput,
    privatePrompt: "must not survive",
    credentials: { apiKey: "must not survive" },
  });
  const serialized = JSON.stringify(result);
  assert.deepEqual(result.package.approvedVisualRefs, ["visual-canon:sam-identity-v2"]);
  assert.deepEqual(result.package.observedRefs, ["visual-reference:street-photographer"]);
  assert.ok(result.package.studies.every((study) => study.generatedCandidateRefs.length === 0));
  assert.equal(serialized.includes("must not survive"), false);
});

test("#1557 blocks provider fallback that lacks cloud consent or paid budget approval", () => {
  for (const providerRoute of [
    { provider: "cloud-images", runtime: "cloud", model: "image-model", costClass: "free-cloud", consentState: "missing", budgetState: "not-required" },
    { provider: "cloud-images", runtime: "cloud", model: "image-model", costClass: "paid-cloud", consentState: "approved", budgetState: "missing" },
  ]) {
    const result = createCharacterDevelopmentPackage({ ...baseInput, providerRoute });
    assert.equal(result.status, "blocked");
    assert.equal(result.blocker.code, "provider-policy");
  }
});

test("#1557 autonomous invocation cannot impersonate an authenticated Human", () => {
  const result = createCharacterDevelopmentPackage({
    ...baseInput,
    authority: { authorityClass: "authenticated-human", authenticatedHuman: false, autonomousRunId: "run-1" },
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.blocker.code, "authority-policy");
});

test("#1557 makes only dependency-backed studies stale", () => {
  const initial = createCharacterDevelopmentPackage(baseInput).package;
  const customized = {
    ...initial,
    studies: initial.studies.map((study) => ({
      ...study,
      dependencyRefs: study.type === "wardrobe-props"
        ? ["ppf:character:sam@42", "ppf:prop:camera@42"]
        : ["ppf:character:sam@42"],
    })),
  };
  const stale = markCharacterDevelopmentStale(customized, ["ppf:prop:camera@42"], "The canonical camera prop changed.");
  assert.deepEqual(stale.studies.filter((study) => study.stale).map((study) => study.type), ["wardrobe-props"]);
  assert.equal(stale.studies.find((study) => study.type === "expressions").stale, false);
});

test("#1557 records concrete cross-study drift instead of an opaque score", () => {
  const initial = createCharacterDevelopmentPackage(baseInput).package;
  const reviewed = recordConsistencyFindings(initial, [{
    code: "face-drift",
    dimension: "face-head",
    studyIds: [initial.studies[1].id, initial.studies[2].id],
    detail: "The profile study changes the accepted jaw line.",
    severity: "blocking",
  }]);
  assert.equal(reviewed.consistencyFindings[0].code, "face-drift");
  assert.equal(reviewed.consistencyFindings[0].detail, "The profile study changes the accepted jaw line.");
  assert.equal(Object.hasOwn(reviewed.consistencyFindings[0], "score"), false);
});

test("#1557 reaches visual readiness only through an already accepted visual artifact", () => {
  const initial = createCharacterDevelopmentPackage(baseInput).package;
  assert.equal(toVisualReadinessEvidence(initial).approved, false);
  assert.throws(() => linkAcceptedVisualArtifact(initial, "character-study:sam", []), /existing visual artifact acceptance path/i);
  const linked = linkAcceptedVisualArtifact(initial, "character-study:sam", ["character-study:sam"]);
  const evidence = toVisualReadinessEvidence(linked);
  assert.equal(evidence.approved, true);
  assert.equal(evidence.sourceRef, "character-study:sam");
});

test("#1557 is a registered and trust-covered reusable skill with no direct canon or storage authority", async () => {
  const [registryText, trustText, skill, source, workflow] = await Promise.all([
    readFile(new URL("../config/agent-skills.json", import.meta.url), "utf8"),
    readFile(new URL("../config/agent-skill-trust.json", import.meta.url), "utf8"),
    readFile(new URL("../.agents/skills/character-visual-development/SKILL.md", import.meta.url), "utf8"),
    readFile(new URL("../core/visual-production/character-development.mjs", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/visual-readiness.yml", import.meta.url), "utf8"),
  ]);
  const registry = JSON.parse(registryText);
  const trust = JSON.parse(trustText);
  const entry = registry.skills.find((candidate) => candidate.id === "character-visual-development");
  const trustRecord = trust.records.find((candidate) => candidate.uri === entry.uri);
  assert.equal(entry.uri, "skill://plotpickle/character-visual-development");
  assert.equal(entry.primaryWorker, "host");
  assert.equal(trustRecord.evalStatus, "covered");
  assert.equal(trustRecord.lastEvaluatedRevision, "issue-1557");
  assert.match(skill, /PPF remains the story and canon authority/i);
  assert.match(skill, /existing visual artifact acceptance path/i);
  assert.doesNotMatch(source, /applyStoryCommand|localStorage|sessionStorage|indexedDB|sqlite|database/i);
  assert.match(workflow, /issue-1557-character-visual-development\.test\.mjs/);
});
