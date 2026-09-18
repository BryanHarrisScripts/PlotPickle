import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2173 composes approved pre-production state into the existing #2064 Director Specification boundary", async () => {
  const source = await read("lib/preproduction/production-convergence.ts");

  for (const contract of [
    "assemblePreproductionProductionIntent",
    "inspectPreproductionSceneDirectorSpecReadiness",
    "compileDirectorSpecification",
    "productionIntent",
    "readiness",
    "specification",
    'state: "ready"',
    'state: "not-ready"',
    "blockingReasons",
  ]) assert.ok(source.includes(contract), `Missing #2173 convergence contract: ${contract}`);

  assert.match(source, /semantics\.story\.projectId !== project\.id/u);
  assert.match(source, /semantics\.story\.canonicalRevision !== project\.revision/u);
  assert.match(source, /reviewState === "approved"/u);
  assert.match(source, /readyForDirectorSpec/u);
  assert.match(source, /readiness\.missingRequired/u);
});

test("#2173 keeps missing upstream production intent truthful instead of manufacturing completion", async () => {
  const source = await read("lib/preproduction/production-convergence.ts");

  assert.match(source, /approved Previs Production Shot/u);
  assert.match(source, /approved Storyboard Shot/u);
  assert.match(source, /specification: null/u);
  assert.match(source, /blockingReasons/u);
  assert.doesNotMatch(source, /defaultScene|defaultShot|fakeScene|fabricated|manufacture.*Shot|createEmpty.*Production/u);
});

test("#2173 derives provider capability questions from the neutral specification without selecting a provider", async () => {
  const source = await read("lib/preproduction/production-convergence.ts");

  for (const required of [
    '"scene.intent", strength: "required"',
    '"sequence.duration", strength: "required"',
    '"shot.order", strength: "required"',
    '"shot.duration", strength: "required"',
  ]) assert.ok(source.includes(required), `Missing required production capability: ${required}`);

  for (const preferred of [
    '"camera.framing"',
    '"camera.lens"',
    '"camera.movement"',
    '"blocking"',
    '"lighting"',
    '"references"',
    '"continuity"',
    '"information-boundary"',
    '"audio"',
    '"transitions"',
  ]) assert.ok(source.includes(preferred), `Missing preferred production capability: ${preferred}`);

  assert.match(source, /ConcreteProviderInstructionIntegration/u);
  assert.match(source, /already selected by Story Mode \/ capability routing/i);
  assert.doesNotMatch(source, /providerInstructionIntegrationForSelectedTarget|selectProvider|selectRoute|readRoutingChoice|story-mode-policy|media-routing/u);
});

test("#2173 compiles only disposable provider output through the existing #2064 compiler", async () => {
  const source = await read("lib/preproduction/production-convergence.ts");
  const compiler = await read("lib/preproduction/provider-instruction-compiler.ts");
  const execution = await read("lib/preproduction/provider-instruction-execution.ts");

  assert.match(source, /assessProviderCapabilities/u);
  assert.match(source, /compileProviderInstructions/u);
  assert.match(source, /input\.integration\.capabilityContract/u);
  assert.match(source, /input\.integration\.instructionAdapter/u);
  assert.match(compiler, /readonly disposable: true/u);
  assert.match(execution, /canonical: false/u);
  assert.match(execution, /sourceRefs/u);
  assert.doesNotMatch(source, /\bfetch\s*\(|localStorage|sessionStorage|saveFoundationProject|applyStoryCommand|providerRequest|generateVideo|generateImage/u);
});

test("#2173 preserves source and revision provenance through production compilation", async () => {
  const [convergence, director, handoff, execution, evidence] = await Promise.all([
    read("lib/preproduction/production-convergence.ts"),
    read("lib/preproduction/director-specification.ts"),
    read("lib/preproduction/production-intent-handoff.ts"),
    read("lib/preproduction/provider-instruction-execution.ts"),
    read("lib/preproduction/render-evidence-handoff.ts"),
  ]);

  assert.match(convergence, /canonicalRevision/u);
  assert.match(convergence, /sourceRefs/u);
  assert.match(director, /canonicalRevision: readiness\.canonicalRevision/u);
  assert.match(director, /sourceRefs: stableStrings/u);
  assert.match(handoff, /storyboardDependencyKey/u);
  assert.match(execution, /sourceRefs: \[\.\.\.inspection\.sourceRefs\]/u);
  assert.match(evidence, /storyboardDependencyKey/u);
  assert.match(evidence, /Sequence Evidence/u);
});

test("#2173 remains a projection/compiler boundary and introduces no second canon, router or production store", async () => {
  const source = await read("lib/preproduction/production-convergence.ts");

  assert.match(source, /providerNeutral: true/u);
  assert.match(source, /canonical: false/u);
  assert.doesNotMatch(source, /new .*Store|create.*Store|persist|writeStore|canonical: true|PPF.*=.*provider|prompt.*canon/i);
});
