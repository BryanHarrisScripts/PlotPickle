#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { bestEffortLiveBuzzActivity } from "./buzz-live-activity.mjs";
import { redactVerificationText, verificationInboxRoot } from "./verification-record.mjs";

const exec = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const argument = (name, fallback = "") => { const index = argv.indexOf(name); return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback; };
const has = (name) => argv.includes(name);
const runId = argument("--run-id");
const repairRequested = has("--repair");
const githubReport = has("--github-report");
const SAFE_RUN_ID = /^verification-[A-Za-z0-9._-]{8,120}$/;
const REPO = "BryanHarrisScripts/PlotPickle";

function appRoot() {
  if (process.env.PLOTPICKLE_HOME) return path.resolve(process.env.PLOTPICKLE_HOME);
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "PlotPickle");
  return path.dirname(verificationInboxRoot());
}
function safe(value, limit = 500) { return redactVerificationText(value).slice(0, limit); }
function timestampId(prefix) { return `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}`; }
function withinRun(generatedAt, record) {
  const value = Date.parse(String(generatedAt || "")); const start = Date.parse(record.startedAt || "") - 5 * 60_000; const end = Date.parse(record.completedAt || "") + 5 * 60_000;
  return Number.isFinite(value) && Number.isFinite(start) && Number.isFinite(end) && value >= start && value <= end;
}
async function json(pathname) { try { return JSON.parse(await readFile(pathname, "utf8")); } catch { return null; } }
async function loadRecord(id) {
  if (!SAFE_RUN_ID.test(id)) throw new Error("Choose a valid Verification Inbox run ID.");
  const record = await json(path.join(verificationInboxRoot(), "records", `${id}.json`));
  if (!record || record.runId !== id || !Array.isArray(record.stages) || record.stages.length !== 9) throw new Error(`Verification record ${id} was not found or failed integrity checks.`);
  const passCount = record.stages.filter((stage) => stage.status === "PASS").length;
  const derived = passCount === 9 ? "PASS" : "FAIL";
  if (record.deterministicResult !== derived || record.integrity?.agentMayOverrideResult !== false) throw new Error("The immutable verification record failed deterministic integrity checks.");
  return record;
}
async function latestWriterReport(record) {
  const root = path.join(appRoot(), "writer-in-residence");
  try {
    const entries = (await readdir(root, { withFileTypes: true })).filter((item) => item.isDirectory()).map((item) => item.name).sort().reverse().slice(0, 12);
    for (const entry of entries) { const report = await json(path.join(root, entry, "writer-in-residence-report.json")); if (report && withinRun(report.generatedAt, record)) return report; }
  } catch {}
  return null;
}
async function exhaustiveReport(record) {
  const report = await json(path.join(appRoot(), "uat-exhaustive", "exhaustive-ui-uat-report.json"));
  return report && withinRun(report.generatedAt, record) ? report : null;
}
function cleanObservation(item, agent) {
  return { agent, kind: safe(item?.kind || "observation", 60), severity: safe(item?.severity || "low", 30), summary: safe(item?.summary, 500), route: safe(item?.route, 180), authority: "advisory-only" };
}
function stageStatus(record, number) { return record.stages.find((stage) => stage.number === number)?.status || "BLOCKED"; }

export function buildVerificationReview(record, writer = null, uat = null) {
  const writerObservations = Array.isArray(writer?.observations) ? writer.observations : [];
  const observations = writerObservations.flatMap((item) => {
    if (!item?.summary) return [];
    const source = String(item.source || "writer");
    const turn = String(item.turn || "");
    const agent = source === "rendered-visual-observer" ? "Visual Observer" : /^sage/i.test(turn) ? "Sage Brinewick" : "Avery North";
    return [cleanObservation(item, agent)];
  });
  const productDefects = Array.isArray(uat?.findings) ? uat.findings.map((item) => safe(item?.message || item?.summary, 600)).filter(Boolean) : [];
  const harnessDefects = Array.isArray(uat?.harnessFindings) ? uat.harnessFindings.map((item) => safe(item?.summary || item?.message, 600)).filter(Boolean) : [];
  const visualScreens = Array.isArray(writer?.visualReview?.screens) ? writer.visualReview.screens.length : 0;
  const wyrmwoodSeen = Array.isArray(writer?.diary) && writer.diary.some((item) => /wyrmwood/i.test(`${item?.area || ""} ${item?.route || ""}`));
  const participants = [
    { id: "deterministic-runner", label: "Deterministic runner", relatedStages: [1,2,3,4,5,6,7,8,9], participated: true, authority: "sole-pass-fail-authority" },
    { id: "sage-brinewick", label: "Sage Brinewick", relatedStages: [2,3,9], participated: Number(writer?.sageConversation?.completed || 0) > 0, authority: "observation-only" },
    { id: "avery-north", label: "Avery North", relatedStages: [9], participated: Boolean(writer), authority: "synthetic-writer-observation-only" },
    { id: "visual-observer", label: "Visual Observer", relatedStages: [8,9], participated: Boolean(uat || visualScreens), authority: "read-only-rendered-layout-facts" },
    { id: "wyrmwood", label: "Wyrmwood test persona", relatedStages: [8], participated: wyrmwoodSeen, authority: "test-persona-no-grading" },
    { id: "pi", label: "Pi repair worker", relatedStages: [5,6], participated: stageStatus(record,5) !== "BLOCKED" || stageStatus(record,6) !== "BLOCKED", authority: "bounded-repair-no-grading" },
    { id: "buzz", label: "BUZZ", relatedStages: [7], participated: stageStatus(record,7) !== "BLOCKED", authority: "transport-coordination-only" },
  ];
  const failures = Array.isArray(record.failureSummaries) ? record.failureSummaries.map((item) => ({ stage: safe(item.stage, 180), status: safe(item.status, 30), summary: safe(item.summary, 600) })) : [];
  const successfulAreas = (record.categoryResults || []).filter((item) => item.status === "PASS").map((item) => safe(item.category, 120));
  const recommendedRepairOrder = [...failures.map((item) => item.stage), ...productDefects.map((item) => `Review product observation: ${item}`)];
  const cleanRun = record.deterministicResult === "PASS" && failures.length === 0 && productDefects.length === 0;
  return {
    schemaVersion: 1,
    reviewId: timestampId("review"),
    runId: record.runId,
    testedCommit: safe(record.git?.commit, 80),
    generatedAt: new Date().toISOString(),
    originalDeterministicResult: record.deterministicResult,
    originalHeadline: safe(record.headline, 220),
    participants,
    deterministicFailures: failures,
    likelyProductDefects: productDefects,
    likelyHarnessDefects: harnessDefects,
    agentObservations: observations,
    successfulAreas,
    recommendedRepairOrder,
    repairRequired: record.deterministicResult === "FAIL",
    summary: cleanRun ? "All nine deterministic checks passed. No repair is required and no findings were invented." : record.deterministicResult === "FAIL" ? `${failures.length} deterministic failure(s) require review before any result can change.` : `Deterministic verification passed; ${observations.length + productDefects.length + harnessDefects.length} advisory observation(s) remain available for review.`,
    authority: { deterministicRunnerOwnsPassFail: true, agentsMayObserve: true, agentsMayOverridePassFail: false, buzzIsTransportOnly: true, ppfIsUntouched: true },
  };
}

async function writeCompanion(folder, runId, value) {
  const root = path.join(verificationInboxRoot(), folder); await mkdir(root, { recursive: true, mode: 0o700 });
  const file = path.join(root, `${runId}-${timestampId(folder)}.json`); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 }); return file;
}
async function boundedRepair(record) {
  if (record.deterministicResult !== "FAIL") return { requested: true, attempted: false, status: "NOT_REQUIRED", requiresRerun: false, message: "No deterministic failure exists, so Pi repair was not started." };
  const failures = (record.failureSummaries || []).map((item) => `${safe(item.stage,160)}: ${safe(item.summary,500)}`).join(" | ");
  const fingerprint = `verification.${String(record.runId).replace(/[^a-z0-9]+/gi,"-").slice(-48)}`;
  const boundedRoot = path.join(verificationInboxRoot(), "bounded-repair"); await mkdir(boundedRoot, { recursive: true, mode: 0o700 });
  const boundedFile = path.join(boundedRoot, `${record.runId}.json`);
  await writeFile(boundedFile, `${JSON.stringify({ schemaVersion:1, findings:[{ fingerprint, title:`Full Verification failure ${record.runId}`, area:"full-verification", severity:"blocker", message:failures || "Full Verification failed.", evidence:{ verificationRunId:record.runId, testedCommit:safe(record.git?.commit,80), failedStages:(record.failureSummaries || []).map((item)=>safe(item.stage,160)) } }] }, null, 2)}\n`, { encoding:"utf8", mode:0o600 });
  let exitCode = 1; let error = "";
  try { await exec(process.execPath, [path.join(repoRoot,"scripts","run-uat-repair-agent.mjs"),"--worker","pi","--report",boundedFile], { cwd:repoRoot, env:process.env, windowsHide:true, timeout:2_100_000, maxBuffer:4*1024*1024 }); exitCode = 0; } catch (reason) { exitCode = Number(reason?.code ?? 1); error = safe(reason?.stderr || reason?.message || "Pi repair workflow failed.", 700); }
  return { requested:true, attempted:true, status:exitCode===0?"COMPLETE":"FAILED", worker:"Pi", originalRunId:record.runId, testedCommit:safe(record.git?.commit,80), exitCode, summary:error || "Pi completed the existing bounded repair workflow. A deterministic rerun is still required before PASS can change.", evidenceRef:`bounded-repair/${path.basename(boundedFile)}`, deterministicSuccessClaimed:false, requiresRerun:true, generatedAt:new Date().toISOString() };
}
function githubBody(record, review) {
  const stageLines = record.stages.map((stage)=>`- ${stage.status} — ${safe(stage.name,180)}`).join("\n");
  const observationLines = review.agentObservations.slice(0,8).map((item)=>`- ${item.agent}: ${item.summary}`).join("\n") || "- No separate agent observations were recorded.";
  return [`## PlotPickle Full Verification`,"",`**Run:** \`${record.runId}\``,`**Tested commit:** \`${safe(record.git?.commit,80)}\``,`**Version:** ${safe(record.plotPickleVersion,80)}`,`**Deterministic result:** **${record.headline}**`,"","### Nine authoritative stages",stageLines,"","### Advisory agent review",observationLines,"",`**Review:** ${review.summary}`,"","Deterministic tests remain the sole PASS/FAIL authority. Agent observations, Pi repair work, and BUZZ delivery cannot change this result without a new authoritative rerun."].join("\n");
}
async function publishGithub(record, review) {
  if (!/^[a-f0-9]{40}$/i.test(record.git?.commit || "")) throw new Error("The tested commit is unavailable; GitHub review handoff was not published.");
  const body = githubBody(record, review); await exec("gh", ["api","-X","POST",`repos/${REPO}/commits/${record.git.commit}/comments`,"-f",`body=${body}`], { cwd:repoRoot, env:process.env, windowsHide:true, timeout:30_000, maxBuffer:2*1024*1024 });
  return { kind:"github-commit-comment", repo:REPO, commit:record.git.commit, publishedAt:new Date().toISOString() };
}

async function main() {
  const record = await loadRecord(runId); const writer = await latestWriterReport(record); const uat = await exhaustiveReport(record); const review = buildVerificationReview(record, writer, uat);
  const reviewFile = await writeCompanion("reviews", record.runId, review);
  let repair = null; if (repairRequested) { repair = await boundedRepair(record); await writeCompanion("repairs", record.runId, repair); }
  let github = null; if (githubReport) github = await publishGithub(record, review);
  await bestEffortLiveBuzzActivity({ type:"decision.record", actorId:"bram-gatewick", summary:`Full Verification ${record.deterministicResult}: ${record.passCount}/${record.totalStages} deterministic stages passed; advisory observations=${review.agentObservations.length}; repair=${repair?.status || "not-requested"}.`, severity:record.deterministicResult==="PASS"?"info":"high", target:`verification run ${record.runId}`, verified:true, actionable:record.deterministicResult==="FAIL", evidence:[{label:"Verification review",ref:`reviews/${path.basename(reviewFile)}`} ] }).catch(()=>undefined);
  process.stdout.write(`${JSON.stringify({ ok:true, runId:record.runId, deterministicResult:record.deterministicResult, reviewId:review.reviewId, observations:review.agentObservations.length, repair:repair?.status || "not-requested", githubReport:Boolean(github) })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error)=>{ console.error(safe(error instanceof Error?error.message:String(error),900)); process.exitCode=1; });
