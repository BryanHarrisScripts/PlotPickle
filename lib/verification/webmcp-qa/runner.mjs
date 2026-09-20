import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runWebMcpInteractionProfile } from "../browser-probes/interaction.mjs";
import { runWebMcpResilienceProfile } from "../browser-probes/resilience.mjs";
import { runWebMcpContinuityProfile } from "../browser-probes/continuity.mjs";
import { runWebMcpRuntimeProfile } from "../browser-probes/runtime.mjs";
import {
  WEBMCP_FULL_QA_ORDER,
  resolveWebMcpQaProfile,
} from "./profiles.mjs";
import {
  WEBMCP_FULL_QA_ARTIFACT_ROOT,
  finalizeWebMcpFullQaArtifacts,
} from "./artifacts.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function safeRunId(prefix = "webmcp-qa") {
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  return `${prefix}-${timestamp}-${randomUUID().slice(0, 8)}`;
}

function resultRecord(profile, result = {}) {
  const totals = result.totals || {};
  return {
    id: profile.id,
    key: profile.key,
    label: profile.label,
    status: result.status || "PASS",
    blockers: Number(totals.blockers ?? result.blockers ?? 0),
    advisories: Number(totals.advisories ?? result.advisories ?? 0),
    report: result.report || result.evidence || "",
    raw: result,
  };
}

async function writeFailure(artifactRoot, profile, error) {
  const folder = path.join(artifactRoot, `profile-${profile.id}-${profile.key}`);
  await mkdir(folder, { recursive: true });
  const report = path.join(folder, "failure.json");
  await writeFile(report, `${JSON.stringify({
    schemaVersion: 1,
    profile: profile.key,
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
  }, null, 2)}\n`, "utf8");
  return report;
}

async function executeProfile({
  profile,
  serverUrl,
  toolRoot,
  storageStatePath,
  getStorageStatePath,
  runId,
  artifactRoot,
  runStandard,
}) {
  if (profile.id === "1") {
    if (typeof runStandard !== "function") throw new Error("Profile 1 requires the existing Standard WebMCP runner.");
    const result = await runStandard();
    return resultRecord(profile, {
      status: "PASS",
      blockers: result.visualDirector?.totals?.blockers || 0,
      advisories: result.visualDirector?.totals?.advisories || 0,
      report: result.evidence || result.findingsReport || "",
      ...result,
    });
  }

  const resolvedStorageStatePath = storageStatePath
    || (typeof getStorageStatePath === "function" ? await getStorageStatePath() : "");
  if (!resolvedStorageStatePath) {
    throw new Error(`WebMCP ${profile.label} requires an authenticated synthetic browser storage state.`);
  }
  const args = { serverUrl, toolRoot, storageStatePath: resolvedStorageStatePath, runId, artifactRoot };
  const result = profile.id === "2"
    ? await runWebMcpInteractionProfile(args)
    : profile.id === "3"
      ? await runWebMcpResilienceProfile(args)
      : profile.id === "4"
        ? await runWebMcpContinuityProfile(args)
        : profile.id === "5"
          ? await runWebMcpRuntimeProfile(args)
          : null;
  if (!result) throw new Error(`No WebMCP QA executor is registered for profile ${profile.id}.`);
  return resultRecord(profile, result);
}

export async function runWebMcpQaProfile({
  profile: requestedProfile = "1",
  serverUrl,
  toolRoot,
  storageStatePath,
  getStorageStatePath,
  runStandard,
  onEvent = null,
} = {}) {
  const selected = resolveWebMcpQaProfile(requestedProfile);
  const runId = safeRunId(selected.id === "6" ? "webmcp-full-qa" : `webmcp-${selected.key}`);
  const startedAt = new Date().toISOString();
  const artifactRoot = path.resolve(
    repoRoot,
    selected.id === "6" ? WEBMCP_FULL_QA_ARTIFACT_ROOT : ".artifacts/webmcp-qa",
    runId,
  );
  await mkdir(artifactRoot, { recursive: true });

  if (selected.id !== "6") {
    await onEvent?.({ type: "stage", label: `WebMCP ${selected.label}`, detail: selected.description });
    const result = await executeProfile({
      profile: selected,
      serverUrl,
      toolRoot,
      storageStatePath,
      getStorageStatePath,
      runId,
      artifactRoot,
      runStandard,
    });
    return {
      selected,
      runId,
      startedAt,
      endedAt: new Date().toISOString(),
      overall: result.status,
      profiles: [result],
      artifactRoot,
      zipPath: "",
    };
  }

  const results = [];
  let standardFailed = false;
  for (const id of WEBMCP_FULL_QA_ORDER) {
    const profile = resolveWebMcpQaProfile(id);
    if (standardFailed) {
      results.push({
        id: profile.id,
        key: profile.key,
        label: profile.label,
        status: "SKIPPED",
        blockers: 0,
        advisories: 0,
        skipped: true,
        skippedReason: "Profile 1 Standard did not establish a trustworthy governed application baseline.",
        report: "",
      });
      continue;
    }

    await onEvent?.({ type: "stage", label: `FULL QA ${profile.id}/5 · ${profile.label}`, detail: profile.description });
    try {
      const result = await executeProfile({
        profile,
        serverUrl,
        toolRoot,
        storageStatePath,
        runId,
        artifactRoot,
        runStandard,
      });
      results.push(result);
      if (profile.id === "1" && result.status !== "PASS") standardFailed = true;
    } catch (error) {
      const report = await writeFailure(artifactRoot, profile, error);
      results.push({
        id: profile.id,
        key: profile.key,
        label: profile.label,
        status: "FAIL",
        blockers: 1,
        advisories: 0,
        report,
        error: error instanceof Error ? error.message : String(error),
      });
      if (profile.id === "1") standardFailed = true;
    }
  }

  const overall = results.some((result) => result.status === "FAIL" || Number(result.blockers) > 0) ? "FAIL" : "PASS";
  const artifacts = await finalizeWebMcpFullQaArtifacts({
    repoRoot,
    runId,
    startedAt,
    profileResults: results,
    overall,
  });
  return {
    selected,
    runId,
    startedAt,
    endedAt: artifacts.aggregate.endedAt,
    overall,
    profiles: results,
    artifactRoot,
    zipPath: artifacts.zipPath,
    manifestPath: artifacts.manifestPath,
    aggregatePath: artifacts.aggregatePath,
  };
}
