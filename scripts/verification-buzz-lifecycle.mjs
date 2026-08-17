import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { bestEffortLiveBuzzActivity } from "./buzz-live-activity.mjs";
import { verificationInboxRoot } from "./verification-record.mjs";

async function emit(input, baseUrl) {
  return bestEffortLiveBuzzActivity(input, baseUrl ? { baseUrl } : undefined);
}

export async function reportVerificationLifecycle({ record, review, repair, github, reviewRef, baseUrl = "" }) {
  const results = [];
  results.push(await emit({
    type: "decision.record",
    actorId: "bram-gatewick",
    summary: `Full Verification ${record.runId} started for commit ${String(record.git?.commit || "unknown").slice(0, 12)}. Deterministic stages own PASS/FAIL.`,
    severity: "info",
    target: `verification run ${record.runId}`,
    verified: true,
    actionable: false,
    occurredAt: record.startedAt,
  }, baseUrl));

  if (Array.isArray(record.failureSummaries) && record.failureSummaries.length) {
    results.push(await emit({
      type: "uat.result",
      actorId: "bram-gatewick",
      summary: `Full Verification ${record.runId} recorded ${record.failureSummaries.length} deterministic failed or blocked stage(s): ${record.failureSummaries.map((item) => item.stage).join("; ")}.`,
      severity: "high",
      target: `verification run ${record.runId}`,
      verified: true,
      actionable: true,
      occurredAt: record.completedAt,
    }, baseUrl));
  }

  results.push(await emit({
    type: "decision.record",
    actorId: "bram-gatewick",
    summary: `Full Verification ${record.runId} completed ${record.passCount}/${record.totalStages} deterministic stages. Advisory agent review was queued separately from the authoritative result.`,
    severity: record.deterministicResult === "PASS" ? "info" : "high",
    target: `verification run ${record.runId}`,
    verified: true,
    actionable: record.deterministicResult === "FAIL",
    occurredAt: record.completedAt,
  }, baseUrl));

  results.push(await emit({
    type: "decision.record",
    actorId: "bram-gatewick",
    summary: `Advisory review for ${record.runId} completed: agent observations=${review.agentObservations.length}, product defects=${review.likelyProductDefects.length}, harness/environment observations=${review.likelyHarnessDefects.length}. The deterministic result remains ${record.deterministicResult}.`,
    severity: record.deterministicResult === "PASS" ? "info" : "medium",
    target: `verification run ${record.runId}`,
    verified: true,
    actionable: review.repairRequired === true,
    evidence: reviewRef ? [{ label: "Verification review", ref: reviewRef }] : [],
  }, baseUrl));

  if (repair?.attempted) {
    results.push(await emit({
      type: "repair.request",
      actorId: "rook-ironquill",
      summary: `Pi repair workflow for ${record.runId} ${String(repair.status || "completed").toLowerCase()}. A new deterministic Full Verification rerun is required before PASS/FAIL can change.`,
      severity: repair.status === "COMPLETE" ? "medium" : "high",
      target: `verification run ${record.runId}`,
      verified: repair.status === "COMPLETE",
      actionable: repair.status !== "COMPLETE",
      evidence: repair.evidenceRef ? [{ label: "Bounded repair evidence", ref: repair.evidenceRef }] : [],
    }, baseUrl));
  }

  const retestOf = Array.isArray(record.retests) ? record.retests.find((item) => item?.kind === "retest-of" && item.runId)?.runId : "";
  if (retestOf) {
    results.push(await emit({
      type: "uat.result",
      actorId: "bram-gatewick",
      summary: `Deterministic retest ${record.runId} completed for earlier run ${retestOf}: ${record.headline}. The earlier result remains preserved in the Verification Inbox.`,
      severity: record.deterministicResult === "PASS" ? "info" : "high",
      target: `retest of ${retestOf}`,
      verified: true,
      actionable: record.deterministicResult === "FAIL",
    }, baseUrl));
  }

  if (github) {
    results.push(await emit({
      type: "github.status",
      actorId: "fen-copperwind",
      summary: `Sanitized Full Verification review for ${record.runId} was published as one commit-linked GitHub comment for ${String(record.git?.commit || "").slice(0, 12)}.`,
      severity: "info",
      target: `commit ${record.git?.commit || "unknown"}`,
      verified: true,
      actionable: false,
    }, baseUrl));
  }

  return results;
}

async function json(file) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch { return null; }
}

async function latestCompanion(folder, runId) {
  const directory = path.join(verificationInboxRoot(), folder);
  let names = [];
  try { names = (await readdir(directory)).filter((name) => name.startsWith(`${runId}-`) && name.endsWith(".json")).sort().reverse(); }
  catch { return { value: null, ref: "" }; }
  for (const name of names) {
    const value = await json(path.join(directory, name));
    const linked = value && (folder === "reviews" ? value.runId === runId : value.originalRunId === runId);
    if (linked) return { value, ref: `${folder}/${name}` };
  }
  return { value: null, ref: "" };
}

async function main() {
  const args = process.argv.slice(2);
  const index = args.indexOf("--run-id");
  const runId = index >= 0 ? String(args[index + 1] || "") : "";
  const github = args.includes("--github-report");
  if (!/^verification-[A-Za-z0-9._-]{8,120}$/.test(runId)) throw new Error("Choose a valid verification run ID.");
  const record = await json(path.join(verificationInboxRoot(), "records", `${runId}.json`));
  const review = await latestCompanion("reviews", runId);
  const repair = await latestCompanion("repairs", runId);
  if (!record || !review.value) throw new Error("Verification lifecycle requires the immutable record and completed advisory review.");
  const results = await reportVerificationLifecycle({ record, review: review.value, repair: repair.value, github, reviewRef: review.ref });
  const delivered = results.filter((item) => item?.ok !== false).length;
  process.stdout.write(`${JSON.stringify({ ok: true, runId, events: results.length, delivered })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
