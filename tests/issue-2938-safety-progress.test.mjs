import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkSaveModel, validateSafetyAssurance } from "../lib/verification/development/safety-progress.mjs";

const baseline = JSON.parse(await readFile("docs/verification/2938-safety-progress.json", "utf8"));
const catalog = JSON.parse(await readFile("config/verification/test-catalog.json", "utf8"));
const context = { readSource: (file) => readFile(file, "utf8"), catalogueTargets: new Set(catalog.entries.flatMap((entry) => entry.runner.targets)) };
const model = () => structuredClone(baseline.model);
const node = (graph, id) => graph.states.find((state) => state.id === id);
const codes = (result) => result.findings.map((finding) => finding.code);

test("T1/T2/T8: exhaustive bounded model distinguishes safety, progress and product observation", () => {
  const result = checkSaveModel(model());
  assert.equal(result.status, "PASS");
  assert.equal(result.reachableStates, baseline.model.states.length);
  assert.equal(result.scope, "FINITE_MODEL_ONLY");
  assert.equal(result.productConformance, "UNPROVEN");
});

test("T1: project-only acknowledgement cannot report Saved or invent full commit", () => {
  for (const patch of [{ reportedSaved: "image:v1" }, { committedIdentity: "image:v1" }]) {
    const graph = model(); Object.assign(node(graph, "index-pending"), patch);
    const result = checkSaveModel(graph);
    assert.equal(result.status, "FAIL");
    assert.ok(result.findings.some((finding) => finding.trace.includes("project-ack")));
  }
});

test("T2: pending unsaved and newer selected versions cannot Lock", () => {
  for (const id of ["project-pending", "unknown", "rejected", "new-edit"]) {
    const graph = model(); node(graph, id).allowLock = true;
    assert.ok(codes(checkSaveModel(graph)).includes("T2-lock-prerequisite"));
  }
});

test("T2: visible Locked requires exact confirmed approval and committed image", () => {
  for (const patch of [{ approvedIdentity: "other-image" }, { committedIdentity: "other-image" }, { approvedIdentity: null }]) {
    const graph = model(); Object.assign(node(graph, "locked"), patch);
    assert.ok(codes(checkSaveModel(graph)).includes("T2-false-locked"));
  }
});

test("T1: late acknowledgement cannot mark the newer version Saved", () => {
  const graph = model(); node(graph, "new-edit").reportedSaved = "image:v2";
  assert.ok(codes(checkSaveModel(graph)).includes("T1-false-saved"));
});

test("T8: never-completing pending implementation fails despite valid safety", () => {
  const graph = model(); graph.transitions = graph.transitions.filter((edge) => edge.from !== "project-pending");
  graph.transitions.push({ id: "forever", from: "project-pending", to: "project-pending", action: "wait forever" });
  const result = checkSaveModel(graph);
  assert.equal(result.status, "FAIL");
  assert.ok(codes(result).includes("T8-nontermination"));
  assert.ok(!codes(result).includes("T1-false-saved"));
});

test("T8: existence of a success path does not hide an alternate infinite branch", () => {
  const graph = model(); graph.transitions.push({ id: "optional-wait", from: "index-pending", to: "index-pending", action: "delay forever" });
  assert.ok(codes(checkSaveModel(graph)).includes("T8-nontermination"));
});

test("T8: pending dead end and interrupted lost work are counterexamples", () => {
  const graph = model(); graph.transitions = graph.transitions.filter((edge) => edge.from !== "reconciling");
  assert.ok(codes(checkSaveModel(graph)).includes("T8-dead-end"));
  node(graph, "unknown").workRetained = false;
  assert.ok(codes(checkSaveModel(graph)).includes("T8-false-unknown"));
});

test("T8: lost acknowledgement is UNKNOWN with work retained, never a successful save", () => {
  const graph = model(), state = node(graph, "unknown");
  assert.equal(state.outcome, "UNKNOWN"); assert.equal(state.reportedSaved, null); assert.equal(state.workRetained, true);
  state.reportedSaved = "image:v1";
  assert.ok(codes(checkSaveModel(graph)).includes("T8-false-unknown"));
});

test("W8: multi-step distributed writes cannot be modeled as atomic", () => {
  const graph = model(); graph.transitions.push({ id: "atomic-shortcut", from: "project-pending", to: "committed", action: "pretend one write", atomic: true, boundaries: ["save-project", "sync-library-index"] });
  assert.ok(codes(checkSaveModel(graph)).includes("unsupported-atomicity"));
});

test("W8/W9: fresh correspondence references retain actual implementation gaps", async () => {
  const result = await validateSafetyAssurance(baseline, context);
  assert.equal(result.status, "VALID_ASSURANCE_RECORD", JSON.stringify(result.findings));
  assert.equal(result.correspondence, "PARTIAL"); assert.equal(result.productConformance, "UNPROVEN");
  assert.equal(result.semanticReview, "PENDING");
  const source = await readFile("core/storage/profile-private-browser.ts", "utf8");
  assert.ok(source.includes('await privateMutation("save-project"'));
  assert.ok(source.includes('await privateMutation("sync-library-index"'));
  assert.equal(baseline.gaps.find((gap) => gap.id === "FINITE_RESPONSE_POLICY").issue, 2943);
});

test("W9: source drift invalidates model-to-implementation mapping", async () => {
  const result = await validateSafetyAssurance(baseline, { ...context, readSource: async (file) => `${await readFile(file, "utf8")}\n// changed implementation` });
  assert.ok(codes(result).includes("stale-correspondence-source"));
});

test("W8: model or fixture success cannot certify real product conformance", async () => {
  for (const patch of [{ productConformance: "PASS" }, { correspondence: "ENFORCED" }, { semanticReview: "APPROVED" }]) {
    const record = { ...structuredClone(baseline), ...patch };
    assert.ok(codes(await validateSafetyAssurance(record, context)).includes("invalid-claim-scope"));
  }
});

test("W8/W9: missing assumptions mappings gaps or integration owners invalidate assurance", async () => {
  for (const patch of [{ assumptions: [] }, { correspondenceRows: baseline.correspondenceRows.slice(1) }, { gaps: [] }, { integrationTargets: ["invented-test"] }]) {
    assert.equal((await validateSafetyAssurance({ ...structuredClone(baseline), ...patch }, context)).status, "INVALID_ASSURANCE_RECORD");
  }
});

test("W8: malformed graph cannot pass through duplicate or absent states", () => {
  for (const patch of [{ initial: "missing" }, { states: [...baseline.model.states, baseline.model.states[0]] }, { transitions: [{ id: "wrong", from: "ready", to: "missing", action: "invalid" }] }]) assert.equal(checkSaveModel({ ...model(), ...patch }).status, "INVALID");
});


test("T8: pending cannot silently disappear into idle without response", () => {
  const graph = model(); graph.transitions.push({ id: "drop-request", from: "project-pending", to: "ready", action: "silently abandon operation" });
  assert.ok(codes(checkSaveModel(graph)).includes("T8-missing-response"));
});

test("T2: null selected and committed identities cannot grant Lock", () => {
  const graph = model(), state = node(graph, "ready");
  state.selectedIdentity = null; state.allowLock = true;
  assert.ok(codes(checkSaveModel(graph)).includes("T2-lock-prerequisite"));
});
