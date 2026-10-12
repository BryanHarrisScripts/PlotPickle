import { createHash } from "node:crypto";

export const assuranceDigest = (text) => createHash("sha256").update(text.replaceAll("\r\n", "\n")).digest("hex");
const present = (value) => typeof value === "string" && value.trim().length > 0;
const safePath = (value) => present(value) && !value.includes("\\") && !value.startsWith("/") && !value.split("/").some((part) => !part || part === "." || part === "..") && !/[:\u0000\r\n]/u.test(value);
const outcomes = new Set(["COMMITTED", "REJECTED", "UNKNOWN"]);

// Exhaustive finite graph analysis. No scheduler fairness is assumed: an
// alternate pending cycle fails even if another branch can complete.
export function checkSaveModel(model) {
  const findings = [];
  const fail = (code, state, trace, detail) => findings.push({ code, state, trace, detail });
  if (!Array.isArray(model?.states) || !model.states.length || model.states.length > 128 || !Array.isArray(model?.transitions) || model.transitions.length > 512) {
    return { status: "INVALID", findings: [{ code: "invalid-model", detail: "A bounded state/transition graph is required." }] };
  }
  const states = new Map();
  for (const state of model.states) {
    if (!present(state.id) || states.has(state.id) || typeof state.requiresResponse !== "boolean" || typeof state.workRetained !== "boolean" || typeof state.allowLock !== "boolean" || typeof state.indexAcknowledged !== "boolean" || typeof state.interrupted !== "boolean"
      || ["selectedIdentity", "projectIdentity", "committedIdentity", "reportedSaved", "approvedIdentity", "reportedLocked"].some((key) => state[key] !== null && !present(state[key]))
      || (state.outcome !== null && !outcomes.has(state.outcome))) fail("invalid-state", state.id, [], "State facts must be explicit, typed and unique.");
    states.set(state.id, state);
  }
  if (!states.has(model.initial)) fail("missing-initial", model.initial, [], "Initial state must exist.");
  const edges = new Map([...states.keys()].map((id) => [id, []]));
  const ids = new Set();
  for (const edge of model.transitions) {
    if (!present(edge.id) || ids.has(edge.id) || !states.has(edge.from) || !states.has(edge.to) || !present(edge.action)) fail("invalid-transition", edge.id, [], "Every transition needs unique identity, known states and a named action.");
    ids.add(edge.id);
    edges.get(edge.from)?.push(edge);
    if (edge.atomic === true && edge.boundaries?.length > 1) fail("unsupported-atomicity", edge.from, [edge.id], "Separate project/index writes cannot be collapsed into one atomic transition without a reviewed implementation mechanism.");
  }
  if (findings.length) return { status: "INVALID", findings };
  const paths = new Map([[model.initial, []]]), queue = [model.initial];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor], state = states.get(id), trace = paths.get(id);
    if (state.committedIdentity && (state.projectIdentity !== state.committedIdentity || !state.indexAcknowledged)) fail("unsubstantiated-commit", id, trace, "Confirmed identity requires both separately acknowledged persistence boundaries in this abstraction.");
    if (state.reportedSaved && state.reportedSaved !== state.committedIdentity) fail("T1-false-saved", id, trace, "Reported saved version must be the exact confirmed durable identity.");
    if (state.allowLock && (!state.committedIdentity || state.selectedIdentity !== state.committedIdentity)) fail("T2-lock-prerequisite", id, trace, "Lock requires confirmed Save of the current exact selected version.");
    if (state.reportedLocked && (state.reportedLocked !== state.committedIdentity || state.reportedLocked !== state.approvedIdentity)) fail("T2-false-locked", id, trace, "Visible Lock needs the same committed identity and durable approval.");
    if (state.requiresResponse && !state.workRetained) fail("T8-work-lost", id, trace, "Pending work must remain retained.");
    if (state.outcome === "UNKNOWN" && (!state.interrupted || !state.workRetained || state.reportedSaved || state.reportedLocked)) fail("T8-false-unknown", id, trace, "Uncertainty must be explicit, retain work and not report success.");
    if (state.outcome === "COMMITTED" && !state.committedIdentity) fail("T1-false-outcome", id, trace, "A committed response needs confirmed identity.");
    if (state.requiresResponse && state.outcome) fail("invalid-response-state", id, trace, "A terminal response cannot also be awaiting that response.");
    for (const edge of edges.get(id)) if (!paths.has(edge.to)) { paths.set(edge.to, [...trace, edge.id]); queue.push(edge.to); }
  }
  // Reject a dead end or any reachable cycle among response-required states.
  const visited = new Set(), active = new Set();
  function progress(id, trail) {
    if (!states.get(id).requiresResponse || !paths.has(id)) return;
    if (active.has(id)) { fail("T8-nontermination", id, trail, "Reachable pending cycle permits an operation never to complete."); return; }
    if (visited.has(id)) return;
    visited.add(id); active.add(id);
    const next = edges.get(id);
    if (!next.length) fail("T8-dead-end", id, paths.get(id), "Submitted operation has no response or reconciliation transition.");
    for (const edge of next) {
      const target = states.get(edge.to);
      if (!target.requiresResponse && !target.outcome) fail("T8-missing-response", edge.to, [...trail, edge.id], "A submitted operation cannot disappear into an idle state without an observable response.");
      progress(edge.to, [...trail, edge.id]);
    }
    active.delete(id);
  }
  for (const id of paths.keys()) progress(id, paths.get(id));
  return { status: findings.length ? "FAIL" : "PASS", reachableStates: paths.size, findings, scope: "FINITE_MODEL_ONLY", productConformance: "UNPROVEN" };
}

// Source fingerprints establish correspondence-record freshness, never that
// the implementation executes the model or meets the recorded assumptions.
export async function validateSafetyAssurance(record, { readSource, catalogueTargets }) {
  const findings = [], fail = (code, detail) => findings.push({ code, detail });
  if (record?.schemaVersion !== 1 || record?.issue !== 2938 || record?.correspondence !== "PARTIAL" || record?.productConformance !== "UNPROVEN" || record?.semanticReview !== "PENDING" || record?.finalConfirmationIssue !== 2943) fail("invalid-claim-scope", "Keep model/integrity, correspondence, semantic review and real-product claims separate.");
  const sourceIds = new Set();
  for (const row of record?.sources || []) {
    if (!present(row.id) || sourceIds.has(row.id) || !safePath(row.path) || !present(row.start) || !present(row.end) || !present(row.digest) || !present(row.excerptDigest)) { fail("invalid-source", row.id); continue; }
    sourceIds.add(row.id);
    try {
      const text = (await readSource(row.path)).replaceAll("\r\n", "\n");
      const start = text.indexOf(row.start), end = text.indexOf(row.end, start + row.start.length);
      if (start < 0 || end < 0 || text.indexOf(row.start, start + row.start.length) >= 0 || assuranceDigest(text) !== row.digest || assuranceDigest(text.slice(start, end)) !== row.excerptDigest) fail("stale-correspondence-source", row.id);
    } catch (error) { fail("missing-source", `${row.id}: ${error.message}`); }
  }
  for (const id of ["white-paper-6", "save-contract", "profile-write", "revision-save"]) if (!sourceIds.has(id)) fail("missing-required-source", id);
  if (!record?.assumptions?.length || !record.assumptions.every(present)) fail("missing-assumptions", "Reviewed operating assumptions are required.");
  const modelResult = checkSaveModel(record?.model);
  if (modelResult.status !== "PASS") fail("model-counterexample", JSON.stringify(modelResult.findings));
  const mapped = new Set();
  for (const row of record?.correspondenceRows || []) {
    if (!present(row.transitionId) || mapped.has(row.transitionId) || !record.model?.transitions?.some((edge) => edge.id === row.transitionId) || !row.sourceIds?.length || row.sourceIds.some((id) => !sourceIds.has(id)) || !present(row.mechanism) || row.status !== "PARTIAL" || !row.gaps?.length || !row.gaps.every(present)) fail("invalid-correspondence", row.transitionId);
    mapped.add(row.transitionId);
  }
  for (const edge of record?.model?.transitions || []) if (!mapped.has(edge.id)) fail("missing-transition-correspondence", edge.id);
  for (const id of ["FINITE_RESPONSE_POLICY", "INTERRUPTED_MULTI_WRITE", "RESTART_OBSERVATION", "REVISION_IDENTITY"]) if (!record?.gaps?.some((gap) => gap.id === id && gap.status === "UNPROVEN" && gap.issue === 2943 && present(gap.detail))) fail("missing-owned-gap", id);
  if (!record?.integrationTargets?.length || record.integrationTargets.some((target) => !catalogueTargets.has(target))) fail("missing-integration-reference", "Existing integration proof targets must be registered; references do not mean executed product evidence.");
  return { status: findings.length ? "INVALID_ASSURANCE_RECORD" : "VALID_ASSURANCE_RECORD", findings, model: modelResult, correspondence: "PARTIAL", semanticReview: "PENDING", productConformance: "UNPROVEN", finalConfirmationIssue: 2943 };
}
