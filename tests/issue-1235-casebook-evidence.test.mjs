import assert from "node:assert/strict";
import test from "node:test";
import { loadCasebook } from "../scripts/casebook-contract.mjs";
import {
  CASEBOOK_EVIDENCE_SCHEMA_VERSION,
  CASEBOOK_INTERACTION_KINDS,
  appendCaseEvidenceArtifact,
  appendCaseEvidenceStep,
  completeCaseEvidenceManifest,
  createCaseEvidenceManifest,
  createCasebookBrowserEvidenceRecorder,
  createCasebookHumanInteractionAdapter,
  evaluateCaseEvidenceManifest,
  redactCaseEvidence,
  validateCaseEvidenceManifest,
} from "../scripts/casebook-evidence.mjs";

function caseById(casebook, id) {
  const found = casebook.cases.find((item) => item.id === id);
  assert.ok(found, `Expected Case ${id}`);
  return found;
}

function completePassingManifest(caseDefinition) {
  const manifest = createCaseEvidenceManifest(caseDefinition, { runId: `phase2:${caseDefinition.id}`, startedAt: "2026-08-21T23:00:00.000Z" });
  for (const step of caseDefinition.humanJourney) {
    appendCaseEvidenceStep(manifest, caseDefinition, {
      stepId: step.id,
      interaction: step.id.includes("enter") || step.id.includes("ask") ? "type" : "pointer",
      expected: step.action,
      observed: `Observed expected Human outcome for ${step.id}.`,
      workerClaim: "pass",
      outcome: "pass",
      critical: true,
      beforeScreenshot: `${step.id}-before.png`,
      afterScreenshot: `${step.id}-after.png`,
    });
  }
  caseDefinition.requiredEvidence.forEach((item, index) => appendCaseEvidenceArtifact(manifest, {
    id: item.id,
    kind: item.kind,
    status: "verified",
    source: index === 0 ? caseDefinition.independentVerification.source : "casebook-observer",
    independent: index === 0,
    ref: `evidence/${item.id}`,
    summary: item.description,
  }));
  completeCaseEvidenceManifest(manifest, { completedAt: "2026-08-21T23:01:00.000Z" });
  return manifest;
}

test("#1235 every P0 Business Case emits the same evidence manifest contract", async () => {
  const casebook = await loadCasebook();
  assert.equal(casebook.cases.length, 5);
  for (const caseDefinition of casebook.cases) {
    const manifest = createCaseEvidenceManifest(caseDefinition, { runId: `evidence:${caseDefinition.id}` });
    assert.equal(manifest.schemaVersion, CASEBOOK_EVIDENCE_SCHEMA_VERSION);
    assert.equal(manifest.caseId, caseDefinition.id);
    assert.ok(Array.isArray(manifest.timeline));
    assert.ok(Array.isArray(manifest.artifacts));
    assert.ok(Array.isArray(manifest.faultResults));
  }
});

test("#1235 critical transitions require before/after visual proof", async () => {
  const casebook = await loadCasebook();
  const target = caseById(casebook, "buzz-connect-existing-identity");
  const manifest = createCaseEvidenceManifest(target, { runId: "missing-after" });
  appendCaseEvidenceStep(manifest, target, {
    stepId: target.humanJourney[0].id,
    interaction: "pointer",
    expected: "Profile opens",
    observed: "Profile opened",
    workerClaim: "pass",
    outcome: "pass",
    critical: true,
    beforeScreenshot: "before.png",
  });
  const validation = validateCaseEvidenceManifest(target, manifest);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(" "), /requires before and after screenshots/i);
});

test("#1235 a complete evidence timeline can drive a Case PASS", async () => {
  const casebook = await loadCasebook();
  const target = caseById(casebook, "buzz-connect-existing-identity");
  const manifest = completePassingManifest(target);
  const validation = validateCaseEvidenceManifest(target, manifest);
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  const result = evaluateCaseEvidenceManifest(target, manifest);
  assert.equal(result.status, "pass");
  assert.equal(result.independentVerified, true);
  assert.equal(result.timelineSteps, target.humanJourney.length);
  assert.equal(result.contradictoryWorkerClaims, 0);
});

test("#1235 observer contradiction overrides a worker's PASS claim", async () => {
  const casebook = await loadCasebook();
  const target = caseById(casebook, "sage-local-text-usable-response");
  const manifest = completePassingManifest(target);
  const response = manifest.timeline.find((entry) => entry.stepId === "render-answer");
  response.workerClaim = "pass";
  response.outcome = "fail";
  response.observed = "The UI displayed the vague local-reply fallback instead of a usable lesson answer.";
  const result = evaluateCaseEvidenceManifest(target, manifest);
  assert.equal(result.status, "fail");
  assert.equal(result.contradictoryWorkerClaims, 1);
});

test("#1235 evidence redaction removes credentials, local usernames and hidden reasoning", () => {
  const safe = redactCaseEvidence({
    note: "private_key=nsec1abcdefghijklmnop and api_key=sk-supersecretvalue at C:\\Users\\bryan\\PlotPickle",
    nested: { token: "abc123", reasoning: "do not retain", chainOfThought: "hidden" },
  });
  const text = JSON.stringify(safe);
  assert.doesNotMatch(text, /nsec1abcdefghijklmnop|sk-supersecretvalue|C:\\\\Users\\\\bryan|do not retain|hidden/);
  assert.match(text, /REDACTED/);
  assert.match(text, /local-user/);
  assert.equal(safe.nested.token, "[REDACTED]");
  assert.equal("reasoning" in safe.nested, false);
  assert.equal("chainOfThought" in safe.nested, false);
});

test("#1235 interaction vocabulary covers mouse, keyboard, scrolling, typing and focus", () => {
  for (const kind of ["pointer", "keyboard", "scroll", "type", "focus", "navigate", "select"]) {
    assert.ok(CASEBOOK_INTERACTION_KINDS.includes(kind), `Missing interaction kind ${kind}`);
  }
});

test("#1235 Human interaction adapter reuses the existing Creative Browser and MCP tools", async () => {
  const calls = [];
  const creativeBrowser = {
    async clickVisible(label) { calls.push(["pointer", label]); return true; },
    async fillByLabel(label, value) { calls.push(["type", label, value]); return { ok: true }; },
    async navigate(url) { calls.push(["navigate", url]); return { ok: true }; },
    async screenshot(name) { calls.push(["screenshot", name]); return { ok: true }; },
  };
  const tools = [
    { name: "browser_evaluate", inputSchema: { properties: { function: { type: "string" } }, required: ["function"] } },
    { name: "browser_press_key", inputSchema: { properties: { key: { type: "string" } }, required: ["key"] } },
  ];
  const client = {
    async call(name, args) {
      calls.push([name, args]);
      return { content: [{ type: "text", text: '{"ok":true}' }] };
    },
  };
  const adapter = createCasebookHumanInteractionAdapter({ client, tools, creativeBrowser });
  await adapter.pointerClick("Connect Existing Identity");
  await adapter.typeByLabel("Display name", "Avery");
  assert.equal((await adapter.pressKey("Tab")).ok, true);
  assert.equal((await adapter.scrollBy(600)).ok, true);
  assert.equal((await adapter.focusByLabel("Connect identity")).ok, true);
  assert.ok(calls.some(([name, value]) => name === "pointer" && value === "Connect Existing Identity"));
  assert.ok(calls.some(([name]) => name === "browser_press_key"));
  assert.ok(calls.filter(([name]) => name === "browser_evaluate").length >= 2);
});

test("#1235 browser evidence recorder produces a replayable expected-vs-observed action record", async () => {
  const casebook = await loadCasebook();
  const target = caseById(casebook, "buzz-connect-existing-identity");
  const screenshots = [];
  const fakeBrowser = {
    async screenshot(name) { screenshots.push(name); },
    async pointerClick(label) { return label; },
  };
  const recorder = createCasebookBrowserEvidenceRecorder({ caseDefinition: target, browser: fakeBrowser, runId: "replayable-buzz-step" });
  const entry = await recorder.recordStep({
    stepId: "open-profile-buzz",
    interaction: "pointer",
    target: "BUZZ Identity",
    expected: "BUZZ Identity controls become visible in the authenticated profile.",
    act: (browser) => browser.pointerClick("BUZZ Identity"),
    observe: () => ({ outcome: "pass", observed: "BUZZ Identity controls are visible." }),
  });
  assert.equal(entry.sequence, 1);
  assert.equal(entry.interaction, "pointer");
  assert.equal(entry.outcome, "pass");
  assert.match(entry.expected, /controls become visible/i);
  assert.match(entry.observed, /controls are visible/i);
  assert.match(entry.beforeScreenshot, /before\.png$/);
  assert.match(entry.afterScreenshot, /after\.png$/);
  assert.deepEqual(screenshots, ["01-open-profile-buzz-before", "01-open-profile-buzz-after"]);
  assert.equal(validateCaseEvidenceManifest(target, recorder.manifest).valid, true);
});

test("#1235 BLOCKED and UNCERTAIN evidence remain non-green", async () => {
  const casebook = await loadCasebook();
  const target = caseById(casebook, "comfyui-local-image-visible");
  const manifest = completePassingManifest(target);
  manifest.timeline.find((entry) => entry.stepId === "start-or-connect").outcome = "blocked";
  completeCaseEvidenceManifest(manifest, { blockers: ["ComfyUI Desktop is not installed on this test machine."] });
  const result = evaluateCaseEvidenceManifest(target, manifest);
  assert.equal(result.status, "blocked");
  assert.notEqual(result.status, "pass");
});
