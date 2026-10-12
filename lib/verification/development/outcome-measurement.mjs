import { assuranceDigest } from "./safety-progress.mjs";
import { readVerifierObservations, verifierObservationAuthority } from "./verifier-observations.mjs";

const metrics = ["outcomeMinutes", "escapedFailures", "repeatRepairs", "unexpectedChanges", "diagnosisMinutes", "implementationMinutes", "contractMinutes", "verificationMinutes", "contractCostCad", "verificationCostCad", "restatements", "manualReproductions", "humanMinutes", "unnecessaryDecisions"];
const counts = new Set(["escapedFailures", "repeatRepairs", "unexpectedChanges", "restatements", "manualReproductions", "unnecessaryDecisions"]);
const present = value => typeof value === "string" && value.trim().length > 0;
const time = value => typeof value === "string" ? Date.parse(value) : NaN;
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const measurementDigest = value => assuranceDigest(JSON.stringify(canonical(value)));
const same = (left, right) => measurementDigest(left) === measurementDigest(right);

// Approval is host configuration, never an approval flag in a public dataset.
// The final Human campaign supplies this only after reviewing the exact plan.
export function measurementApprovalAuthority(env = process.env) {
  return { protocolDigest: env.PLOTPICKLE_MEASUREMENT_APPROVED_PROTOCOL_DIGEST || "", approvedAt: env.PLOTPICKLE_MEASUREMENT_APPROVED_AT || "", approvalRef: env.PLOTPICKLE_MEASUREMENT_APPROVAL_REF || "" };
}

export function validateMeasurementProtocol(protocol) {
  const findings = [], fail = (code, detail) => findings.push({ code, detail });
  if (protocol?.schemaVersion !== 1 || protocol?.issue !== 2940 || protocol?.finalConfirmationIssue !== 2943 || protocol?.semanticReview !== "PENDING" || protocol?.benefit !== "UNPROVEN" || protocol?.truthEdition !== "PP-SAVE-001:1.0.0") fail("invalid-scope", "Preparation cannot self-certify approval or benefit.");
  if (!Array.isArray(protocol?.metrics) || !same(protocol.metrics.map(row => row?.id).sort(), [...metrics].sort()) || protocol.metrics.some(row => !present(row.definition) || !present(row.unit) || row.missing !== "UNKNOWN")) fail("invalid-metric-definitions", "All practical and Human burden metrics need explicit definitions.");
  if (!Array.isArray(protocol?.cases) || !protocol.cases.length || protocol.cases.length > 32 || new Set(protocol.cases).size !== protocol.cases.length || !protocol.cases.every(present)) fail("invalid-pilot-cases", "Bounded matched cases required.");
  if (!Number.isInteger(protocol?.episodesPerCase) || protocol.episodesPerCase < 1 || protocol.episodesPerCase > 32 || protocol?.thresholds?.maxEscapedFailures !== 0 || protocol?.thresholds?.maxUnexpectedChanges !== 0 || protocol?.thresholds?.allCandidateOutcomesVerified !== true || protocol?.thresholds?.maxEffortRatio !== 1 || protocol?.thresholds?.maxHumanBurdenRatio !== 1 || protocol?.thresholds?.maxEachMetricRatio !== 1 || protocol?.thresholds?.strictPracticalImprovement !== true) fail("invalid-thresholds", "Explicit predeclared exploratory decision thresholds required.");
  if (!present(protocol?.baselineRule) || !present(protocol?.collectionRule) || !present(protocol?.comparisonLimits)) fail("missing-protocol-rules", "Reproducible prospective baseline, collection and comparison limits required.");
  return { status: findings.length ? "INVALID_PROTOCOL" : "PREPARED_PROTOCOL", findings, protocolDigest: measurementDigest(protocol), semanticReview: "PENDING", benefit: "UNPROVEN" };
}

// Reuse existing authenticated observation admission. Measurement bytes and
// protocol edition must match fields signed by the independent operator.
export async function admitMeasurementEntry(entry, protocolDigest, { observationAuthority = verifierObservationAuthority(), now = Date.now() } = {}) {
  const payload = entry?.measurement;
  const result = await readVerifierObservations({ authority: observationAuthority, subject: { kind: "casebook", caseId: "pp-save-restart-measurement", runId: payload?.episodeId }, testedCommit: payload?.commit, receiptIds: [entry?.receiptId], receiptDigests: { [entry?.receiptId]: entry?.receiptDigest }, now });
  const record = result.observations[0];
  const admitted = result.diagnostics.length === 0 && record?.contractId === "WHITE-PAPER-V3" && record?.contractVersion === "3.0" && record?.obligationId === "W12" && record?.finding === "supports" && record?.measurementDigest === measurementDigest(payload) && record?.measurementProtocolDigest === protocolDigest && record?.environment === payload?.environment && record?.configuration === payload?.configuration;
  return { admitted, diagnostics: admitted ? [] : [...result.diagnostics, { reason: "measurement-receipt-mismatch" }] };
}

export async function compareMeasuredOutcomes(protocol, dataset, { approval = measurementApprovalAuthority(), now = Date.now(), admit = entry => admitMeasurementEntry(entry, measurementDigest(protocol)) } = {}) {
  const findings = [], fail = (code, detail) => findings.push({ code, detail });
  const prepared = validateMeasurementProtocol(protocol);
  const unproven = () => ({ status: "UNPROVEN", findings, benefit: "UNPROVEN", baseline: "UNKNOWN", candidate: "UNKNOWN", protocolDigest: prepared.protocolDigest, scope: "DECLARED_MATCHED_PILOT_ONLY" });
  if (prepared.status !== "PREPARED_PROTOCOL") { findings.push(...prepared.findings); return unproven(); }
  const approvedAt = time(approval?.approvedAt);
  if (approval?.protocolDigest !== prepared.protocolDigest || !present(approval?.approvalRef) || !Number.isFinite(approvedAt) || approvedAt > now) { fail("protocol-approval-required", "Human review of the exact predeclared protocol is pending."); return unproven(); }
  if (![protocol?.revisions?.baseline, protocol?.revisions?.candidate].every(value => /^[a-f0-9]{40}$/u.test(value || ""))) { fail("unfrozen-cohort-revisions", "Freeze both actual cohort revisions before Human protocol approval and collection."); return unproven(); }
  if (dataset?.protocolDigest !== prepared.protocolDigest || !Array.isArray(dataset?.baseline) || !Array.isArray(dataset?.candidate) || !dataset.baseline.length || !dataset.candidate.length || dataset.baseline.length > 1024 || dataset.candidate.length > 1024) { fail("missing-comparable-baseline", "No complete observed baseline/candidate can be inferred from CI."); return unproven(); }
  const allowedEntry = new Set(["measurement", "receiptId", "receiptDigest"]);
  const allowedMeasurement = new Set(["episodeId", "caseId", "repetition", "commit", "environment", "configuration", "conditionsDigest", "truthEdition", "workloadDigest", "outcome", "acceptedTruthAt", "verifiedOutcomeAt", "recordedAt", "metrics"]);
  const cohorts = {}, ids = new Set(), receipts = new Set();
  for (const cohort of ["baseline", "candidate"]) {
    const pairs = new Map(), totals = Object.fromEntries(metrics.map(id => [id, 0]));
    let verified = 0;
    for (const entry of dataset[cohort]) {
      const row = entry?.measurement;
      if (!row || Object.keys(entry).some(key => !allowedEntry.has(key)) || Object.keys(row).some(key => !allowedMeasurement.has(key)) || !present(row.episodeId) || ids.has(row.episodeId) || !present(entry.receiptId) || receipts.has(entry.receiptId) || !/^[a-f0-9]{64}$/u.test(entry.receiptDigest || "") || !protocol.cases.includes(row.caseId) || !Number.isInteger(row.repetition) || row.repetition < 1 || row.repetition > protocol.episodesPerCase || !/^[a-f0-9]{40}$/u.test(row.commit || "") || ![row.environment, row.configuration, row.conditionsDigest, row.truthEdition, row.workloadDigest].every(present) || !["PASS", "FAIL", "BLOCKED", "UNPROVEN"].includes(row.outcome)) { fail("invalid-episode", row?.episodeId); continue; }
      if (row.commit !== protocol.revisions[cohort] || row.truthEdition !== protocol.truthEdition) fail("wrong-cohort-revision", row.episodeId);
      ids.add(row.episodeId); receipts.add(entry.receiptId);
      const pair = `${row.caseId}:${row.repetition}`;
      if (pairs.has(pair)) fail("duplicate-matched-episode", pair);
      pairs.set(pair, row);
      const started = time(row.acceptedTruthAt), ended = time(row.verifiedOutcomeAt), recorded = time(row.recordedAt);
      if (!Number.isFinite(started) || !Number.isFinite(recorded) || started <= approvedAt || recorded < started || recorded > now || (row.outcome === "PASS" && (!Number.isFinite(ended) || ended < started || recorded < ended))) fail("invalid-episode-time", row.episodeId);
      if (row.outcome === "PASS") verified += 1;
      else fail("outcome-not-verified", row.episodeId);
      if (!row.metrics || Object.keys(row.metrics).some(id => !metrics.includes(id))) { fail("invalid-metrics", row.episodeId); continue; }
      for (const id of metrics) {
        const value = row.metrics[id];
        if (!Number.isFinite(value) || value < 0 || (counts.has(id) && !Number.isInteger(value))) fail("unknown-or-invalid-measurement", `${row.episodeId}:${id}`);
        else totals[id] += value;
      }
      if (row.outcome === "PASS" && Math.abs(row.metrics.outcomeMinutes - (ended - started) / 60000) > 0.000001) fail("outcome-clock-mismatch", row.episodeId);
      try { if ((await admit(entry))?.admitted !== true) fail("independent-measurement-required", row.episodeId); }
      catch { fail("independent-measurement-required", row.episodeId); }
    }
    for (const caseId of protocol.cases) for (let i = 1; i <= protocol.episodesPerCase; i += 1) if (!pairs.has(`${caseId}:${i}`)) fail("missing-registered-episode", `${cohort}:${caseId}:${i}`);
    cohorts[cohort] = { pairs, totals, verified };
  }
  for (const [id, row] of cohorts.baseline.pairs) {
    const next = cohorts.candidate.pairs.get(id);
    if (!next || ["environment", "configuration", "conditionsDigest", "truthEdition", "workloadDigest"].some(key => row[key] !== next[key])) fail("incomparable-episode", id);
  }
  if (findings.length) return unproven();
  const baseline = cohorts.baseline.totals, candidate = cohorts.candidate.totals;
  const effort = values => values.diagnosisMinutes + values.implementationMinutes + values.contractMinutes + values.verificationMinutes;
  const burden = ["restatements", "manualReproductions", "humanMinutes", "unnecessaryDecisions"];
  const practical = ["escapedFailures", "repeatRepairs", "unexpectedChanges", ...burden];
  const nonincrease = metrics.every(id => candidate[id] <= baseline[id]);
  const meets = candidate.escapedFailures === 0 && candidate.unexpectedChanges === 0 && effort(candidate) <= effort(baseline) && burden.every(id => candidate[id] <= baseline[id]) && nonincrease && practical.some(id => candidate[id] < baseline[id]);
  return { status: meets ? "EXPLORATORY_CRITERIA_MET" : "EXPLORATORY_CRITERIA_NOT_MET", findings: [], baseline, candidate, episodesPerCohort: dataset.baseline.length, benefit: "UNPROVEN", protocolDigest: prepared.protocolDigest, scope: "DECLARED_MATCHED_PILOT_ONLY", limits: "Arithmetic over admitted matched observations is not causal or population evidence. Human review under #2943 remains required." };
}
