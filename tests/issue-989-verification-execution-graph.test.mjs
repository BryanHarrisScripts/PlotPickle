import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FULL_VERIFICATION_GRAPH,
  FULL_VERIFICATION_STAGE_NAMES,
  createVerificationGraphState,
  readyVerificationNodeIds,
  runVerificationGraph,
  validateFullVerificationGraph,
  validateVerificationNodeResult,
} from "../scripts/full-verification-graph.mjs";
import {
  VERIFICATION_FINDING_FIELDS,
  buildConfirmedRepairBundle,
  buildVerificationFindings,
  dedupeVerificationFindings,
  normalizeVerificationFinding,
  planRepairClusters,
  validateVerificationFinding,
} from "../scripts/verification-findings.mjs";

const categories = ["Architecture", "Architecture", "Curriculum", "Production Build", "Local AI / Pi", "Local AI / Pi", "BUZZ", "UI / UX UAT", "Writer Journey"];

function record(statuses = Array(9).fill("PASS")) {
  return {
    runId: "verification-graph-test-12345678",
    git: { commit: "a".repeat(40), ref: "main" },
    deterministicResult: statuses.every((status) => status === "PASS") ? "PASS" : "FAIL",
    stages: FULL_VERIFICATION_STAGE_NAMES.map((name, index) => ({
      number: index + 1,
      name,
      category: categories[index],
      status: statuses[index],
      exitCode: statuses[index] === "PASS" ? 0 : 1,
      detail: statuses[index] === "PASS" ? "" : `failure evidence for stage ${index + 1}`,
    })),
  };
}

const passResult = (durationMs = 1) => ({ status: "PASS", exitCode: 0, detail: "", durationMs });

test("#989 preserves nine authoritative stages while allowing bounded internal prerequisite nodes", () => {
  assert.deepEqual(validateFullVerificationGraph(), []);
  const authoritative = FULL_VERIFICATION_GRAPH.filter((node) => node.authoritative).sort((a, b) => a.number - b.number);
  assert.equal(authoritative.length, 9);
  assert.deepEqual(authoritative.map((node) => node.name), FULL_VERIFICATION_STAGE_NAMES);
  const internal = FULL_VERIFICATION_GRAPH.filter((node) => !node.authoritative);
  assert.deepEqual(internal.map((node) => node.id), ["plotpickle-auth-security", "app-ready"]);
});

test("every Full Verification graph node has a bounded typed input and output contract", () => {
  for (const node of FULL_VERIFICATION_GRAPH) {
    assert.equal(node.inputSchema.type, "object");
    assert.equal(node.outputSchema.type, "object");
    assert.ok(node.outputSchema.required.includes("status"));
    assert.ok(node.outputSchema.required.includes("exitCode"));
    assert.ok(node.outputSchema.required.includes("detail"));
    assert.ok(node.outputSchema.required.includes("durationMs"));
    assert.equal(validateVerificationNodeResult(node, passResult()).ok, true);
    assert.equal(validateVerificationNodeResult(node, { status: "PASS", exitCode: 0 }).ok, false);
  }
});

test("independent verification work is schedulable concurrently with no artificial queue edge", () => {
  const state = createVerificationGraphState();
  const ready = readyVerificationNodeIds(FULL_VERIFICATION_GRAPH, state, 3);
  assert.deepEqual(ready, ["agent-skills-registry", "agent-skills-architecture", "learn-curriculum"]);
  assert.ok(ready.length > 1);
});

test("real dependencies and exclusive resources prevent unsafe parallel work", () => {
  const authSecurity = FULL_VERIFICATION_GRAPH.find((node) => node.id === "plotpickle-auth-security");
  const productionBuild = FULL_VERIFICATION_GRAPH.find((node) => node.id === "production-build");
  const piPreflight = FULL_VERIFICATION_GRAPH.find((node) => node.id === "pi-preflight");
  const appReady = FULL_VERIFICATION_GRAPH.find((node) => node.id === "app-ready");
  const uat = FULL_VERIFICATION_GRAPH.find((node) => node.id === "exhaustive-uat");
  const writer = FULL_VERIFICATION_GRAPH.find((node) => node.id === "writer-in-residence");

  assert.equal(authSecurity.authoritative, false);
  assert.deepEqual(productionBuild.dependencies.map(({ id, require }) => ({ id, require })), [{ id: "plotpickle-auth-security", require: "success" }]);
  assert.deepEqual(piPreflight.dependencies.map(({ id, require }) => ({ id, require })), [{ id: "ensure-pi-model", require: "success" }]);
  assert.deepEqual(appReady.dependencies.map(({ id, require }) => ({ id, require })), [{ id: "production-build", require: "complete" }]);
  assert.ok(productionBuild.dependencies[0].reason.length > 20);
  assert.ok(piPreflight.dependencies[0].reason.length > 20);
  assert.ok(appReady.dependencies[0].reason.length > 20);
  assert.deepEqual(uat.resources, ["browser-project-state"]);
  assert.deepEqual(writer.resources, ["browser-project-state"]);

  const state = createVerificationGraphState();
  for (const id of ["agent-skills-registry", "agent-skills-architecture", "learn-curriculum", "plotpickle-auth-security", "production-build", "ensure-pi-model", "pi-preflight", "app-ready"]) {
    state.set(id, { ...state.get(id), status: "PASS", exitCode: 0 });
  }
  assert.deepEqual(readyVerificationNodeIds(FULL_VERIFICATION_GRAPH, state, 3), ["buzz-live", "exhaustive-uat"]);
});

test("the graph executes independent nodes concurrently and isolates unrelated failure branches", async () => {
  let active = 0;
  let observed = 0;
  const result = await runVerificationGraph({
    echo: false,
    maxParallelism: 3,
    execute: async (node) => {
      active += 1;
      observed = Math.max(observed, active);
      await new Promise((resolve) => setTimeout(resolve, node.id === "production-build" ? 12 : 2));
      active -= 1;
      if (node.id === "production-build") return { status: "FAIL", exitCode: 1, detail: "synthetic build failure", durationMs: 12 };
      return passResult(2);
    },
  });

  assert.ok(observed > 1);
  assert.ok(result.maxParallelObserved > 1);
  assert.equal(result.deterministicResult, "FAIL");
  assert.equal(result.stages.find((stage) => stage.NodeId === "production-build").Status, "FAIL");
  for (const nodeId of ["agent-skills-registry", "agent-skills-architecture", "learn-curriculum", "ensure-pi-model", "pi-preflight", "buzz-live", "exhaustive-uat", "writer-in-residence"]) {
    assert.equal(result.stages.find((stage) => stage.NodeId === nodeId).Status, "PASS", `${nodeId} should survive an unrelated build failure`);
  }
  assert.equal(result.stages.length, 9);
  assert.deepEqual(result.stages.map((stage) => stage.Step), FULL_VERIFICATION_STAGE_NAMES);
});

test("a failed success dependency blocks only its dependent node", async () => {
  const result = await runVerificationGraph({
    echo: false,
    maxParallelism: 3,
    execute: async (node) => node.id === "ensure-pi-model"
      ? { status: "FAIL", exitCode: 1, detail: "model unavailable", durationMs: 1 }
      : passResult(),
  });
  assert.equal(result.stages.find((stage) => stage.NodeId === "ensure-pi-model").Status, "FAIL");
  assert.equal(result.stages.find((stage) => stage.NodeId === "pi-preflight").Status, "BLOCKED");
  assert.equal(result.stages.find((stage) => stage.NodeId === "production-build").Status, "PASS");
  assert.equal(result.stages.find((stage) => stage.NodeId === "exhaustive-uat").Status, "PASS");
});

test("the shared Finding contract includes all required #989 fields and rejects incomplete identity", () => {
  assert.deepEqual(VERIFICATION_FINDING_FIELDS, [
    "id", "source", "area", "severity", "confidence", "reproduction", "affectedFiles", "evidence", "suggestedFix", "verificationStatus",
  ]);
  const checked = validateVerificationFinding({
    source: "test",
    area: "learn",
    severity: "high",
    confidence: 0.8,
    reproduction: "Clicking Next does not advance.",
    affectedFiles: ["app/learn.tsx"],
    evidence: ["reproduced"],
    suggestedFix: "Repair navigation state.",
    verificationStatus: "confirmed",
  });
  assert.equal(checked.ok, true);
  for (const field of VERIFICATION_FINDING_FIELDS) assert.ok(Object.hasOwn(checked.finding, field));
});

test("deterministic failures and failed authoritative UAT confirm findings while Avery stays advisory", () => {
  const statuses = Array(9).fill("PASS");
  statuses[7] = "FAIL";
  const findings = buildVerificationFindings(record(statuses), {
    observations: [{ summary: "I could not tell what the button would do.", severity: "medium", route: "/?workspace=learn" }],
  }, {
    findings: [{ fingerprint: "uat-next-dead", area: "learn", severity: "high", message: "Next button does not advance.", affectedFiles: ["app/learn.tsx"] }],
    harnessFindings: [{ fingerprint: "harness-ref", summary: "A selector changed.", affectedFiles: ["scripts/run-exhaustive-ui-uat.mjs"] }],
  });

  assert.ok(findings.some((finding) => finding.source === "deterministic-full-verification" && finding.verificationStatus === "confirmed"));
  assert.equal(findings.find((finding) => finding.id === "uat-next-dead").verificationStatus, "confirmed");
  assert.equal(findings.find((finding) => finding.source === "writer-in-residence").verificationStatus, "needs-verification");
  assert.equal(findings.find((finding) => finding.id === "harness-ref").verificationStatus, "needs-verification");
});

test("an advisory UAT observation from an otherwise passing stage cannot silently become repair authority", () => {
  const findings = buildVerificationFindings(record(), null, {
    findings: [{ fingerprint: "uat-warning", area: "settings", severity: "medium", message: "Copy feels unclear.", affectedFiles: ["app/settings.tsx"] }],
  });
  assert.equal(findings.find((finding) => finding.id === "uat-warning").verificationStatus, "needs-verification");
  assert.equal(buildConfirmedRepairBundle(findings, { runId: "verification-test" }), null);
});

test("dedupe tracks all seen finding IDs and a confirmed verifier can upgrade an earlier observation", () => {
  const first = normalizeVerificationFinding({ id: "same", source: "writer", area: "learn", reproduction: "same defect", verificationStatus: "needs-verification" });
  const second = normalizeVerificationFinding({ id: "same", source: "verifier", area: "learn", reproduction: "same defect", verificationStatus: "confirmed", evidence: ["reproduced"] });
  const deduped = dedupeVerificationFindings([first, first, second]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].verificationStatus, "confirmed");
});

test("repair clustering merges overlapping files and quarantines unknown impact from parallel writers", () => {
  const confirmed = [
    { id: "a", source: "test", area: "a", reproduction: "a", affectedFiles: ["app/a.tsx", "lib/shared.ts"], verificationStatus: "confirmed" },
    { id: "b", source: "test", area: "b", reproduction: "b", affectedFiles: ["lib/shared.ts", "app/b.tsx"], verificationStatus: "confirmed" },
    { id: "c", source: "test", area: "c", reproduction: "c", affectedFiles: ["app/c.tsx"], verificationStatus: "confirmed" },
    { id: "d", source: "test", area: "d", reproduction: "d", affectedFiles: [], verificationStatus: "confirmed" },
  ];
  const clusters = planRepairClusters(confirmed);
  assert.equal(clusters.length, 3);
  assert.ok(clusters.some((cluster) => cluster.findingIds.includes("a") && cluster.findingIds.includes("b") && cluster.safeParallel));
  assert.ok(clusters.some((cluster) => cluster.findingIds.length === 1 && cluster.findingIds[0] === "c" && cluster.safeParallel));
  assert.ok(clusters.some((cluster) => cluster.id === "repair-cluster-unknown-impact" && cluster.safeParallel === false));
  assert.ok(clusters.every((cluster) => cluster.isolationRequired === "git-worktree"));
});

test("the verification orchestrator hands Pi only confirmed findings and keeps local repair concurrency conservative", async () => {
  const source = await readFile(new URL("../scripts/verification-orchestrator.mjs", import.meta.url), "utf8");
  assert.match(source, /buildConfirmedRepairBundle\(review\.findings/);
  assert.match(source, /BLOCKED_UNVERIFIED/);
  assert.match(source, /unverifiedFindingsExcluded/);
  assert.match(source, /defaultLocalRepairParallelism:\s*1/);
  assert.match(source, /parallelRepairRequiresDisjointFilesAndWorktrees:\s*true/);
  assert.match(source, /run-uat-repair-agent\.mjs/);
});
