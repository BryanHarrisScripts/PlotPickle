import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { admitMeasurementEntry, compareMeasuredOutcomes, measurementApprovalAuthority, measurementDigest, validateMeasurementProtocol } from "../lib/verification/development/outcome-measurement.mjs";
const proposal = JSON.parse(await readFile("docs/verification/2940-measurement-protocol.json", "utf8"));
const empty = JSON.parse(await readFile("docs/verification/2940-measurements.json", "utf8"));
// These inputs/callbacks are unit fixtures, never real Human approval or data.
const fixture = () => {
  const protocol = structuredClone(proposal); protocol.revisions = { baseline: "a".repeat(40), candidate: "b".repeat(40) };
  const digest = measurementDigest(protocol), approval = { protocolDigest: digest, approvedAt: "2026-10-12T10:00:00Z", approvalRef: "fixture-only" };
  function entry(cohort, caseId, index) {
    const episodeId = `${cohort}-${index}`;
    const values = Object.fromEntries(protocol.metrics.map(row => [row.id, row.unit.startsWith("count") ? 0 : 1]));
    values.outcomeMinutes = 10; values.restatements = cohort === "baseline" ? 1 : 0;
    return { receiptId: episodeId, receiptDigest: "c".repeat(64), measurement: { episodeId, caseId, repetition: 1, commit: protocol.revisions[cohort], environment: "fixture-device", configuration: "fixture-config", conditionsDigest: "d".repeat(64), truthEdition: "PP-SAVE-001:1.0.0", workloadDigest: "e".repeat(64), outcome: "PASS", acceptedTruthAt: "2026-10-12T11:00:00Z", verifiedOutcomeAt: "2026-10-12T11:10:00Z", recordedAt: "2026-10-12T11:11:00Z", metrics: values } };
  }
  const dataset = { protocolDigest: digest, baseline: protocol.cases.map((id, i) => entry("baseline", id, i)), candidate: protocol.cases.map((id, i) => entry("candidate", id, i)) };
  return { protocol, dataset, context: { approval, admit: async () => ({ admitted: true }) } };
};
const compare = f => compareMeasuredOutcomes(f.protocol, f.dataset, f.context);
const codes = result => result.findings.map(row => row.code);

test("W12: complete metric definitions and thresholds prepare without invented baseline or benefit", async () => {
  assert.equal(validateMeasurementProtocol(proposal).status, "PREPARED_PROTOCOL");
  assert.equal(proposal.metrics.length, 14); assert.equal(proposal.revisions.candidate, null);
  assert.deepEqual(empty.baseline, []); assert.deepEqual(empty.candidate, []);
  const result = await compareMeasuredOutcomes(proposal, empty, { approval: measurementApprovalAuthority({}) });
  assert.equal(result.status, "UNPROVEN"); assert.equal(result.baseline, "UNKNOWN"); assert.equal(result.benefit, "UNPROVEN");
});
test("W12: thresholds and Human approval must precede observation and bind every definition", async () => {
  const f = fixture(); f.context.approval.approvedAt = "2026-10-12T11:01:00Z";
  assert.ok(codes(await compare(f)).includes("invalid-episode-time"));
  const altered = fixture(); altered.protocol.metrics[0].definition += " changed";
  assert.ok(codes(await compare(altered)).includes("protocol-approval-required"));
  const approvedFlag = fixture(); approvedFlag.dataset.approved = true;
  assert.ok(codes(await compareMeasuredOutcomes(approvedFlag.protocol, approvedFlag.dataset, { approval: measurementApprovalAuthority({}) })).includes("protocol-approval-required"));
});
test("W12: actual cohort revisions must be frozen before comparison", async () => {
  const f = fixture(); f.protocol.revisions.candidate = null; f.context.approval.protocolDigest = measurementDigest(f.protocol);
  assert.ok(codes(await compare(f)).includes("unfrozen-cohort-revisions"));
  const wrong = fixture(); wrong.dataset.candidate[0].measurement.commit = "f".repeat(40);
  assert.ok(codes(await compare(wrong)).includes("wrong-cohort-revision"));
});
test("W8/W12: green CI counts cannot substitute for comparable independently observed data", async () => {
  const f = fixture(); f.dataset.baseline = []; f.dataset.greenTests = 9999;
  assert.ok(codes(await compare(f)).includes("missing-comparable-baseline"));
  const unsupported = fixture(); delete unsupported.context.admit;
  assert.ok(codes(await compare(unsupported)).includes("independent-measurement-required"));
});
test("W12: exploratory arithmetic over fixture observations never certifies actual benefit", async () => {
  const result = await compare(fixture());
  assert.equal(result.status, "EXPLORATORY_CRITERIA_MET"); assert.equal(result.benefit, "UNPROVEN"); assert.equal(result.episodesPerCohort, 4);
  assert.equal(result.baseline.restatements, 4); assert.equal(result.candidate.restatements, 0);
});
test("W12: no observed practical improvement cannot earn criteria-met from test counts", async () => {
  const f = fixture(); for (const entry of f.dataset.candidate) entry.measurement.metrics.restatements = 1;
  assert.equal((await compare(f)).status, "EXPLORATORY_CRITERIA_NOT_MET");
});
test("W12: escaped failures cost increases and Human burden regressions cannot hide in averages", async () => {
  for (const id of ["escapedFailures", "unexpectedChanges", "contractCostCad", "verificationMinutes", "humanMinutes", "unnecessaryDecisions"]) {
    const f = fixture(); f.dataset.candidate[0].measurement.metrics[id] += 1;
    assert.equal((await compare(f)).status, "EXPLORATORY_CRITERIA_NOT_MET", id);
  }
});
test("W12: unknown or missing metrics remain unknown rather than zero", async () => {
  for (const value of [null, undefined, NaN, -1, "0"]) {
    const f = fixture(); f.dataset.baseline[0].measurement.metrics.diagnosisMinutes = value;
    assert.ok(codes(await compare(f)).includes("unknown-or-invalid-measurement"));
  }
});
test("W12: comparable truth conditions and workload are required for matched episodes", async () => {
  for (const key of ["environment", "configuration", "truthEdition", "conditionsDigest", "workloadDigest"]) {
    const f = fixture(); f.dataset.candidate[0].measurement[key] += "changed";
    assert.ok(codes(await compare(f)).includes("incomparable-episode"), key);
  }
});
test("W12: incomplete blocked failed or duplicated episodes cannot be dropped", async () => {
  const missing = fixture(); missing.dataset.candidate.pop();
  assert.ok(codes(await compare(missing)).includes("missing-registered-episode"));
  for (const outcome of ["BLOCKED", "FAIL", "UNPROVEN"]) {
    const f = fixture(); f.dataset.candidate[0].measurement.outcome = outcome;
    assert.ok(codes(await compare(f)).includes("outcome-not-verified"));
  }
  const duplicate = fixture(); duplicate.dataset.candidate.push(duplicate.dataset.candidate[0]);
  assert.ok(codes(await compare(duplicate)).includes("invalid-episode"));
});
test("W12: accepted-truth-to-outcome time is derived rather than supplied success duration", async () => {
  const f = fixture(); f.dataset.candidate[0].measurement.metrics.outcomeMinutes = 0;
  assert.ok(codes(await compare(f)).includes("outcome-clock-mismatch"));
});
test("W11/W12: metric payload rejects story text credentials and hidden reasoning fields", async () => {
  for (const key of ["storyText", "credentials", "hiddenReasoning"]) {
    const f = fixture(); f.dataset.candidate[0].measurement[key] = "fixture-only";
    assert.ok(codes(await compare(f)).includes("invalid-episode"));
  }
});
test("W12: altered threshold policy or self-promoted protocol cannot prepare", () => {
  for (const patch of [{ thresholds: { ...proposal.thresholds, maxEscapedFailures: 1 } }, { semanticReview: "APPROVED" }, { benefit: "PROVEN" }, { metrics: proposal.metrics.slice(1) }]) assert.equal(validateMeasurementProtocol({ ...proposal, ...patch }).status, "INVALID_PROTOCOL");
});
test("W8/W12: existing signed receipt admission binds exact protocol and measurement bytes", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pp-measurement-")); t.after(() => rm(root, { recursive: true, force: true }));
  const keys = generateKeyPairSync("ed25519"), f = fixture(), entry = f.dataset.candidate[0];
  const artifact = Buffer.from("Non-sensitive fixture metric summary."); await writeFile(path.join(root, "metrics.bin"), artifact);
  const payload = { schemaVersion: 1, receiptId: entry.receiptId, subject: { kind: "casebook", caseId: "pp-save-restart-measurement", runId: entry.measurement.episodeId }, observedAt: "2026-10-12T11:11:00Z", expiresAt: "2026-10-13T11:11:00Z", artifact: { path: "metrics.bin", sha256: createHash("sha256").update(artifact).digest("hex") }, observation: { source: "fixture-independent-operator", testedCommit: entry.measurement.commit, environment: entry.measurement.environment, configuration: entry.measurement.configuration, independent: true, simulated: false, scope: "real-product-observation", finding: "supports", action: "Fixture protocol measurement", observedResult: "Fixture numeric report", promise: "Observe declared W12 metrics", contractId: "WHITE-PAPER-V3", contractVersion: "3.0", obligationId: "W12", measurementDigest: measurementDigest(entry.measurement), measurementProtocolDigest: f.dataset.protocolDigest } };
  const bytes = Buffer.from(JSON.stringify(payload)); entry.receiptDigest = createHash("sha256").update(bytes).digest("hex");
  await writeFile(path.join(root, `${entry.receiptId}.json`), JSON.stringify({ schemaVersion: 1, payload: bytes.toString("base64"), signature: sign(null, bytes, keys.privateKey).toString("base64") }));
  const context = { now: Date.parse("2026-10-12T12:00:00Z"), observationAuthority: { root, publicKey: keys.publicKey.export({ type: "spki", format: "pem" }), source: payload.observation.source, environment: entry.measurement.environment, configuration: entry.measurement.configuration } };
  assert.equal((await admitMeasurementEntry(entry, f.dataset.protocolDigest, context)).admitted, true);
  entry.measurement.metrics.restatements = 99;
  assert.equal((await admitMeasurementEntry(entry, f.dataset.protocolDigest, context)).admitted, false);
  entry.measurement.metrics.restatements = 0;
  assert.equal((await admitMeasurementEntry(entry, "f".repeat(64), context)).admitted, false);
  await writeFile(path.join(root, "metrics.bin"), "changed");
  assert.equal((await admitMeasurementEntry(entry, f.dataset.protocolDigest, context)).admitted, false);
});
