import { createHash } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Restart input is an advisory evidence index, never a replay queue or a
// replacement for independent Windows/GitHub verification.
const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const REF = /^[a-z0-9][a-z0-9._:/-]{0,199}$/i;
const FAILURE_CODE = /^[A-Z][A-Z0-9_]{2,79}$/;
const ROLES = new Set(["scout", "tester", "performance", "challenger", "maintainer", "reporter", "repairer"]);
const STATES = new Set(["candidate", "reproduced", "disproved", "blocked"]);
const MAX_BYTES = 32 * 1024;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function assertScope(campaign) {
  if (campaign?.schemaVersion !== 1 || !SHA.test(campaign.exactSha || "")
    || !HASH.test(campaign.scopeHash || "") || !REF.test(campaign.campaignId || "")
    || !REF.test(campaign.taskRef || "")) {
    throw new Error("Engineering restart requires an admitted exact-head scope.");
  }
}

function observationIndex(campaign, observation) {
  if (observation?.exactSha !== campaign.exactSha || observation.scopeHash !== campaign.scopeHash
    || observation.campaignId !== campaign.campaignId || !ROLES.has(observation.role)
    || !STATES.has(observation.state) || !REF.test(observation.findingRef || "")
    || !REF.test(observation.observationId || "") || !Array.isArray(observation.evidenceRefs)
    || observation.evidenceRefs.length > 16 || observation.evidenceRefs.some((ref) => !REF.test(ref))) {
    throw new Error("Engineering restart observation is outside the admitted safe evidence scope.");
  }
  // Never include model summary, source excerpts, prompts, private paths or credentials.
  return {
    role: observation.role, state: observation.state,
    observationId: observation.observationId, findingRef: observation.findingRef,
    evidenceRefs: [...new Set(observation.evidenceRefs)],
    verification: "unverified-observation",
  };
}

export function createEngineeringEvidenceState(campaign, { result = null, failure = null } = {}) {
  assertScope(campaign);
  if (Boolean(result) === Boolean(failure)) {
    throw new Error("Engineering restart requires exactly one terminal observation or classified failure.");
  }
  if (result && (result.campaignId !== campaign.campaignId
    || result.exactSha !== campaign.exactSha || result.scopeHash !== campaign.scopeHash
    || !["observed", "blocked"].includes(result.status)
    || !Array.isArray(result.observations) || result.observations.length > 16
    || !Array.isArray(result.roleResults) || result.roleResults.length > 16)) {
    throw new Error("Engineering restart receipt scope is invalid.");
  }
  if (failure && (!FAILURE_CODE.test(failure.code || "") || typeof failure.stage !== "string"
    || !/^[a-z][a-z-]{1,79}$/.test(failure.stage))) {
    throw new Error("Engineering restart accepts only classified operational failure codes.");
  }
  const observations = (result?.observations || []).map((item) => observationIndex(campaign, item));
  const roleResults = (result?.roleResults || []).map((item) => {
    if (!ROLES.has(item?.role) || !["observed", "blocked"].includes(item?.status)) {
      throw new Error("Engineering restart has an unknown role result.");
    }
    return { role: item.role, status: item.status };
  });
  if (result?.status === "observed" && roleResults.some((item) => item.status !== "observed")) {
    throw new Error("Engineering restart refuses a false observed status.");
  }
  const state = failure || result?.status === "blocked" ? "blocked" : "observed-unverified";
  const payload = {
    schemaVersion: 1,
    campaignId: campaign.campaignId,
    exactSha: campaign.exactSha,
    scopeHash: campaign.scopeHash,
    taskRef: campaign.taskRef,
    state,
    failure: failure ? { code: failure.code, stage: failure.stage } : null,
    observations,
    roleResults,
    restartContext: "evidence-refs-only",
    originalTestOracle: "unchanged",
    newWorkerMayRead: true,
    startedUncertainMayReplay: false,
    sourceMutationAllowed: false,
    modelDispatchAuthorized: false,
    paidDispatchAuthorized: false,
    independentProductVerification: "unproven",
    mergeEligible: false,
  };
  const digest = sha256(JSON.stringify(payload));
  return Object.freeze({ ...payload, digest });
}

export async function writeEngineeringEvidenceState(runDir, state, { resume = false } = {}) {
  if (!path.isAbsolute(runDir) || !state || !HASH.test(state.scopeHash || "")) {
    throw new Error("Engineering restart storage requires an absolute private run directory.");
  }
  const { digest: suppliedDigest, ...payload } = state;
  const expected = sha256(JSON.stringify(payload));
  if (state.digest !== expected) throw new Error("Engineering restart state integrity mismatch.");
  const name = resume ? "resume-evidence-state.json" : "evidence-state.json";
  const bytes = JSON.stringify(state) + "\n";
  if (Buffer.byteLength(bytes) > MAX_BYTES) throw new Error("Engineering restart evidence exceeds the storage limit.");
  await writeFile(path.join(runDir, name), bytes, { flag: "wx", mode: 0o600 });
  return name;
}

export async function readEngineeringEvidenceState(runDir, { scopeHash, exactSha, resume = false }) {
  if (!path.isAbsolute(runDir) || !HASH.test(scopeHash || "") || !SHA.test(exactSha || "")) {
    throw new Error("Engineering restart read requires matching exact head and scope.");
  }
  const filename = path.join(runDir, resume ? "resume-evidence-state.json" : "evidence-state.json");
  const info = await lstat(filename);
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_BYTES) {
    throw new Error("Engineering restart requires a bounded ordinary private receipt.");
  }
  const state = JSON.parse(await readFile(filename, "utf8"));
  if (state.scopeHash !== scopeHash || state.exactSha !== exactSha
    || !HASH.test(state.digest || "") || state.schemaVersion !== 1
    || state.startedUncertainMayReplay !== false
    || state.sourceMutationAllowed !== false || state.modelDispatchAuthorized !== false
    || state.independentProductVerification !== "unproven" || state.mergeEligible !== false) {
    throw new Error("Engineering restart receipt is stale, untrusted or grants unapproved authority.");
  }
  const { digest, ...payload } = state;
  if (sha256(JSON.stringify(payload)) !== digest) throw new Error("Engineering restart receipt digest mismatch.");
  return Object.freeze(state);
}
