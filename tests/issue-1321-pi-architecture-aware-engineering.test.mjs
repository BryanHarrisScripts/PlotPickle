import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PI_ARCHITECTURE_REVIEW_TOOLS,
  PI_CI_CLASSIFICATIONS,
  buildPiArchitectureReviewPrompt,
  buildPiCiClassificationPrompt,
  buildPiImpactMapPrompt,
  buildPiSpecReviewPrompt,
  buildPiStandardsReviewPrompt,
  createPiArchitectureReviewEvidence,
  normalizePiImpactMap,
  normalizePiReviewAxis,
  parsePiJsonResponse,
  resolvePiReviewTarget,
  resolvePiSpecDescriptor,
} from "../scripts/pi-architecture-review-core.mjs";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #1321 registers progressive Diagnosis and Architecture Review skills", async () => {
  const registry = JSON.parse(await source("config/agent-skills.json"));
  const diagnosis = registry.skills.find((skill) => skill.id === "diagnosis");
  const architecture = registry.skills.find((skill) => skill.id === "plotpickle-architecture-review");
  assert.equal(registry.discovery, "progressive");
  assert.equal(diagnosis?.entry, ".agents/skills/diagnosis/SKILL.md");
  assert.equal(diagnosis?.localOnly, true);
  assert.deepEqual(diagnosis?.consumers, ["pi", "developer-worker"]);
  assert.equal(architecture?.entry, ".agents/skills/plotpickle-architecture-review/SKILL.md");
  assert.ok(architecture?.roles.includes("architecture-scout"));
  assert.ok(architecture?.roles.includes("standards-review"));
  assert.ok(architecture?.roles.includes("spec-review"));
});

test("issue #1321 diagnosis requires an exact red-capable loop and reports missing regression seams", async () => {
  const [diagnosis, uatRepair] = await Promise.all([
    source(".agents/skills/diagnosis/SKILL.md"),
    source(".agents/skills/uat-repair/SKILL.md"),
  ]);
  for (const phrase of [
    "exact symptom",
    "red for the reported problem and green after repair",
    "Tighten or minimise the reproduction",
    "falsifiable hypotheses",
    "If no valid regression seam exists",
    "exact reviewed head SHA",
  ]) assert.ok(diagnosis.includes(phrase), `Diagnosis skill missing: ${phrase}`);
  assert.ok(uatRepair.includes("skill://plotpickle/diagnosis"));
  assert.ok(uatRepair.includes("Re-run the original unminimised feedback loop"));
});

test("issue #1321 impact map captures owner, blast radius, tests and do-not-touch boundaries", () => {
  const map = normalizePiImpactMap({
    verdict: "READY",
    summary: "BUILD route change",
    owningDomain: "modules/build",
    implementationFiles: ["modules/build/ui/a.tsx"],
    upstreamCallers: ["app/page.tsx"],
    downstreamConsumers: ["Foundations BUILD"],
    contracts: ["PPF"],
    runtimeTrustBoundaries: ["Pi is developer-only"],
    persistenceStorage: ["project library"],
    uiJourneys: ["PLAN -> BUILD"],
    packagingStartup: ["none"],
    testsUat: ["focused BUILD test"],
    compatibilityPaths: ["legacy BUILD"],
    doNotTouch: ["Mastra runtime"],
    smallestPlan: ["change one mounted workspace"],
    unresolvedQuestions: [],
  });
  assert.equal(map.owningDomain, "modules/build");
  assert.deepEqual(map.upstreamCallers, ["app/page.tsx"]);
  assert.deepEqual(map.doNotTouch, ["Mastra runtime"]);
  assert.deepEqual(map.testsUat, ["focused BUILD test"]);
});

test("issue #1321 resolves an explicit fixed point and exact reviewed head through host-owned git", async () => {
  const calls = [];
  const outputs = new Map([
    ["rev-parse HEAD", { stdout: "head-sha\n" }],
    ["merge-base main head-sha", { stdout: "base-sha\n" }],
    ["diff --name-only base-sha..head-sha", { stdout: "a.ts\ntests/a.test.mjs\n" }],
  ]);
  const target = await resolvePiReviewTarget({
    baseRef: "main",
    headRef: "HEAD",
    runGit: async (args) => {
      const key = args.join(" ");
      calls.push(key);
      return outputs.get(key) || { stdout: "" };
    },
  });
  assert.equal(target.fixedPoint, "base-sha");
  assert.equal(target.reviewedHead, "head-sha");
  assert.deepEqual(target.changedFiles, ["a.ts", "tests/a.test.mjs"]);
  assert.deepEqual(calls, ["rev-parse HEAD", "merge-base main head-sha", "diff --name-only base-sha..head-sha"]);
});

test("issue #1321 reports NO SPEC deterministically rather than inventing requirements", () => {
  const missing = resolvePiSpecDescriptor();
  assert.deepEqual(missing, { status: "missing", source: "", verdict: "NO SPEC" });
  assert.throws(() => buildPiSpecReviewPrompt({ targetFile: "target.json", diffFile: "review.diff", specFile: "" }), /NO SPEC/);
});

test("issue #1321 Architecture, Standards and Spec remain independent axes", () => {
  const target = { fixedPoint: "base", reviewedHead: "head", changedFiles: ["a.ts"] };
  const architecture = normalizePiReviewAxis("architecture", {
    verdict: "FINDINGS",
    summary: "legacy path remains",
    findings: [{ severity: "medium", file: "a.ts", evidence: "duplicate path", recommendation: "remove duplicate" }],
  });
  const standards = normalizePiReviewAxis("standards", { verdict: "PASS", summary: "meets standards", findings: [] });
  const evidence = createPiArchitectureReviewEvidence({
    target,
    spec: resolvePiSpecDescriptor(),
    impactMap: null,
    architecture,
    standards,
    specReview: null,
  });
  assert.equal(evidence.architecture.verdict, "FINDINGS");
  assert.equal(evidence.standards.verdict, "PASS");
  assert.equal(evidence.spec.verdict, "NO SPEC");
  assert.equal(evidence.reviewedHead, "head");
  assert.equal(evidence.authoritative, false);
  assert.equal(evidence.writesAllowed, false);
});

test("issue #1321 uses separate prompts for impact, Architecture, Standards and Spec", () => {
  const common = { targetFile: ".artifacts/target.json", diffFile: ".artifacts/review.diff", impactMapFile: ".artifacts/impact.json" };
  const impact = buildPiImpactMapPrompt({ targetFile: common.targetFile, specFile: ".artifacts/spec.md" });
  const architecture = buildPiArchitectureReviewPrompt({ ...common, specFile: ".artifacts/spec.md" });
  const standards = buildPiStandardsReviewPrompt({ ...common, benEvidenceFile: ".artifacts/ben/scan.json" });
  const spec = buildPiSpecReviewPrompt({ targetFile: common.targetFile, diffFile: common.diffFile, specFile: ".artifacts/spec.md" });
  assert.ok(impact.includes("smallest architecture impact map"));
  assert.ok(architecture.includes("Review only Architecture"));
  assert.ok(standards.includes("Review only Standards"));
  assert.ok(standards.includes("BEN evidence"));
  assert.ok(spec.includes("Review only Spec fidelity"));
  assert.ok(!spec.includes("BEN evidence"));
});

test("issue #1321 CI classification is bounded and correlated to exact evidence", () => {
  const prompt = buildPiCiClassificationPrompt({
    targetFile: ".artifacts/target.json",
    diffFile: ".artifacts/review.diff",
    ciEvidenceFile: ".artifacts/ci.log",
    impactMapFile: ".artifacts/impact.json",
  });
  for (const classification of PI_CI_CLASSIFICATIONS) assert.ok(prompt.includes(classification));
  assert.ok(prompt.includes("Do not automatically weaken a red test"));
});

test("issue #1321 Pi review parser stores concise JSON findings rather than raw model transcripts", () => {
  const parsed = parsePiJsonResponse("```json\n{\"verdict\":\"PASS\",\"summary\":\"ok\",\"findings\":[]}\n```", "test review");
  const result = normalizePiReviewAxis("standards", parsed);
  assert.equal(result.verdict, "PASS");
  assert.equal(result.summary, "ok");
  assert.deepEqual(result.findings, []);
});

test("issue #1321 runner keeps Pi local, read-only, non-authoritative and session-independent", async () => {
  const [runner, runtime] = await Promise.all([
    source("scripts/run-pi-architecture-review.mjs"),
    source("scripts/pi-worker-runtime.mjs"),
  ]);
  assert.deepEqual(PI_ARCHITECTURE_REVIEW_TOOLS, ["read", "grep", "find", "ls"]);
  for (const purpose of ["architecture-impact", "architecture-review", "standards-review", "spec-review", "ci-classification"]) {
    assert.ok(runner.includes(`purpose: \"${purpose}\"`), `Runner missing independent Pi purpose ${purpose}`);
  }
  assert.ok(runner.includes("ensureManagedPiInstalled({ allowInstall: false })"));
  assert.ok(runner.includes("resolvePiLocalRuntime()"));
  assert.ok(runtime.includes('"--no-session"'));
  assert.ok(runtime.includes('"--tools", "read,grep,find,ls"'));
  assert.ok(!runner.includes("merge_pull_request"));
  assert.ok(!runner.includes("git push"));
});
