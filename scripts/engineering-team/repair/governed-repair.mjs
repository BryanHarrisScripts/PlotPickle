#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { readEngineeringEvidenceState } from "../evidence/evidence-state.mjs";

const exec = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");
const POLICY_PATH = path.join(HERE, "policy.json");
const REPORT_PATH = path.join(REPO, ".artifacts", "webmcp-acceptance", "story-factory-read-only-journey", "exact-head.json");
const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const REF = /^[a-z0-9][a-z0-9._:/-]{0,199}$/i;
const MODEL = /^[a-z0-9][a-z0-9._:/+\-]{0,159}$/i;
const FAILURE_ID = /^[a-z0-9][a-z0-9-]{1,119}$/;
const MAX_BYTES = 64 * 1024;
const ENVELOPE_KEYS = [
  "schemaVersion", "kind", "candidateId", "campaignId", "scopeHash", "exactSha", "taskRef",
  "state", "issueNumber", "issueRef", "fingerprint", "verifier", "evidenceRefs",
  "originalTestOracle", "sourceAllowance", "route", "budget", "grants", "denialCodes",
  "startedUncertainMayReplay", "independentVerificationAuthority", "productGate", "mergeAllowed",
  "digest",
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sorted = (value) => [...new Set(value)].sort();
const sameKeys = (value, keys) => value && typeof value === "object"
  && Object.keys(value).sort().join("|") === [...keys].sort().join("|");

function privateRunRoot() {
  return path.join(process.env.LOCALAPPDATA || (process.platform === "win32"
    ? path.join(os.homedir(), "AppData", "Local")
    : path.join(os.homedir(), ".local", "share")), "PlotPickle");
}

function safeString(value, pattern, label) {
  const result = String(value || "").trim();
  if (!pattern.test(result)) throw new Error(`Governed repair ${label} is invalid.`);
  return result;
}

function normalizedEndpoint(value) {
  const raw = String(value || "").trim().replace(/\/$/u, "");
  if (!raw) return "";
  if (!URL.canParse(raw)) return "";
  const parsed = new URL(raw);
  if (parsed.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)
    || parsed.username || parsed.password || parsed.search || parsed.hash) return "";
  if (parsed.pathname !== "/v1" || !parsed.port) return "";
  const port = Number(parsed.port);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? parsed.toString().replace(/\/$/u, "") : "";
}

function assertEvidenceState(state, policy) {
  if (!state || state.schemaVersion !== 1 || state.state !== "observed-unverified"
    || !SHA.test(state.exactSha || "") || !HASH.test(state.scopeHash || "")
    || state.taskRef !== policy.taskRef || state.startedUncertainMayReplay !== false
    || state.sourceMutationAllowed !== false || state.modelDispatchAuthorized !== false
    || state.independentProductVerification !== "unproven" || state.mergeEligible !== false
    || !Array.isArray(state.observations)) {
    throw new Error("Governed repair requires the validated denied-by-default #3126 evidence state.");
  }
  const matching = state.observations.filter((item) => item?.findingRef === policy.fingerprint
    && item.state === "reproduced" && Array.isArray(item.evidenceRefs)
    && item.evidenceRefs.includes(policy.evidenceRef));
  const roles = new Set(matching.map((item) => item.role));
  if (!roles.has("tester") || !roles.has("challenger")) {
    throw new Error("Governed repair requires independent Tester and Challenger reproduction references.");
  }
}

function verifierProjection(report, state, policy) {
  if (!report || report.schemaVersion !== 1 || report.journeyId !== policy.journeyId
    || report.mode !== policy.reportMode || report.commitSha !== state.exactSha
    || report.state !== "failed" || report.status !== "FAIL" || report.rendered !== true
    || report.deterministic !== true || report.isolatedBrowserContext !== true
    || !Array.isArray(report.assertions) || report.assertions.length !== policy.requiredAssertionCount) {
    throw new Error("Governed repair requires the independently observed exact-head red Story Factory report.");
  }
  const ids = report.assertions.map((item) => safeString(item?.id, FAILURE_ID, "assertion ID"));
  if (new Set(ids).size !== ids.length) throw new Error("Governed repair verifier assertion IDs must be unique.");
  const failedIds = sorted(report.assertions.filter((item) => item?.status !== "PASS").map((item) => item.id));
  if (failedIds.join("|") !== sorted(policy.requiredFailureIds).join("|")
    || Number(report.blockerCount) !== policy.requiredFailureIds.length) {
    throw new Error("Governed repair refuses changed, missing or false-green original failures.");
  }
  return Object.freeze({
    authority: "independent-windows-browser-verifier",
    journeyId: policy.journeyId,
    mode: policy.reportMode,
    reportDigest: sha256(JSON.stringify(report)),
    assertionCount: ids.length,
    failedIds: Object.freeze(failedIds),
    result: "RED",
  });
}

function denialCodes({ authorization = {}, route = {}, budget = {}, policy }) {
  const denied = [];
  if (authorization.humanApproved !== true || !REF.test(String(authorization.grantRef || ""))) denied.push("HUMAN_AUTHORIZATION_REQUIRED");
  if (authorization.sourceMutation !== true) denied.push("SOURCE_MUTATION_GRANT_REQUIRED");
  if (authorization.modelDispatch !== true) denied.push("MODEL_DISPATCH_GRANT_REQUIRED");
  if (authorization.localToolExecution !== true) denied.push("LOCAL_TOOL_GRANT_REQUIRED");
  if (authorization.providerEndpointAccess !== true) denied.push("LOCAL_PROVIDER_GRANT_REQUIRED");
  if (authorization.stopRequested === true) denied.push("STOP_REQUESTED");
  if (!policy.allowedWorkers.includes(route.worker)) denied.push("WORKER_ROUTE_NOT_ALLOWED");
  if (route.provider !== "local-openai-compatible" || !normalizedEndpoint(route.endpoint)
    || !MODEL.test(String(route.model || "")) || route.cloudAllowed !== false) denied.push("MODEL_ROUTE_NOT_EXPLICIT_LOCAL");
  if (!Number.isInteger(budget.attempt) || budget.attempt < 1 || budget.attempt > policy.maxAttempts) denied.push("ATTEMPT_BUDGET_EXCEEDED");
  if (budget.maxAttempts !== policy.maxAttempts || budget.maxDurationMs !== policy.maxDurationMs
    || budget.maxCloudCostUsd !== 0) denied.push("REPAIR_BUDGET_MISMATCH");
  return Object.freeze(sorted(denied));
}

export async function loadGovernedRepairPolicy(policyPath = POLICY_PATH, taskRef = "issue-3123") {
  const document = JSON.parse(await readFile(policyPath, "utf8"));
  const policy = document?.schemaVersion === 1 ? document.campaigns?.[taskRef] : null;
  if (!policy || policy.taskRef !== taskRef || !Number.isInteger(policy.issueNumber)
    || !REF.test(policy.fingerprint || "") || !REF.test(policy.evidenceRef || "")
    || !Array.isArray(policy.requiredFailureIds) || !Array.isArray(policy.allowedWorkers)
    || !Array.isArray(policy.allowedMutationRoots) || !Array.isArray(policy.immutablePaths)
    || !HASH.test(policy.oracle?.digest || "")) {
    throw new Error("Governed repair policy is missing or malformed.");
  }
  return Object.freeze(policy);
}

export function createGovernedRepairEnvelope({
  evidenceState, verifierReport, policy, authorization = {}, route = {}, budget = {},
} = {}) {
  assertEvidenceState(evidenceState, policy);
  const verifier = verifierProjection(verifierReport, evidenceState, policy);
  const denied = denialCodes({ authorization, route, budget, policy });
  const endpoint = normalizedEndpoint(route.endpoint);
  const payload = {
    schemaVersion: 1,
    kind: "plotpickle-governed-repair-candidate",
    candidateId: `repair-${evidenceState.scopeHash.slice(0, 16)}-${Number(budget.attempt || 0)}`,
    campaignId: safeString(evidenceState.campaignId, REF, "campaign ID"),
    scopeHash: evidenceState.scopeHash,
    exactSha: evidenceState.exactSha,
    taskRef: policy.taskRef,
    state: denied.length ? "DENIED" : "ADMITTED",
    issueNumber: policy.issueNumber,
    issueRef: `issue-${policy.issueNumber}`,
    fingerprint: policy.fingerprint,
    verifier,
    evidenceRefs: Object.freeze([policy.evidenceRef]),
    originalTestOracle: Object.freeze({ path: policy.oracle.path, digest: policy.oracle.digest, mutable: false }),
    sourceAllowance: Object.freeze({
      allowedMutationRoots: Object.freeze([...policy.allowedMutationRoots]),
      immutablePaths: Object.freeze([...policy.immutablePaths]),
    }),
    route: Object.freeze({
      worker: String(route.worker || ""),
      provider: String(route.provider || ""),
      endpoint,
      model: String(route.model || ""),
      cloudAllowed: false,
    }),
    budget: Object.freeze({
      attempt: Number(budget.attempt || 0),
      maxAttempts: Number(budget.maxAttempts || 0),
      maxDurationMs: Number(budget.maxDurationMs || 0),
      maxCloudCostUsd: 0,
    }),
    grants: Object.freeze({
      humanGrantRef: REF.test(String(authorization.grantRef || "")) ? String(authorization.grantRef) : null,
      sourceMutation: authorization.sourceMutation === true,
      modelDispatch: authorization.modelDispatch === true,
      localToolExecution: authorization.localToolExecution === true,
      providerEndpointAccess: authorization.providerEndpointAccess === true,
    }),
    denialCodes: denied,
    startedUncertainMayReplay: false,
    independentVerificationAuthority: "tester-challenger-windows-product-gate",
    productGate: "required-unproven",
    mergeAllowed: false,
  };
  return Object.freeze({ ...payload, digest: sha256(JSON.stringify(payload)) });
}

export function validateGovernedRepairEnvelope(envelope, policy) {
  if (!sameKeys(envelope, ENVELOPE_KEYS) || envelope.schemaVersion !== 1
    || envelope.kind !== "plotpickle-governed-repair-candidate" || !HASH.test(envelope.digest || "")
    || !HASH.test(envelope.scopeHash || "") || !SHA.test(envelope.exactSha || "")
    || !REF.test(envelope.campaignId || "") || !REF.test(envelope.candidateId || "")
    || envelope.taskRef !== policy.taskRef || envelope.issueNumber !== policy.issueNumber
    || envelope.issueRef !== `issue-${policy.issueNumber}` || envelope.fingerprint !== policy.fingerprint
    || envelope.startedUncertainMayReplay !== false || envelope.productGate !== "required-unproven"
    || envelope.independentVerificationAuthority !== "tester-challenger-windows-product-gate"
    || envelope.mergeAllowed !== false || !sameKeys(envelope.verifier,
      ["authority", "journeyId", "mode", "reportDigest", "assertionCount", "failedIds", "result"])
    || envelope.verifier.authority !== "independent-windows-browser-verifier"
    || envelope.verifier.journeyId !== policy.journeyId || envelope.verifier.mode !== policy.reportMode
    || !HASH.test(envelope.verifier.reportDigest || "") || envelope.verifier.assertionCount !== policy.requiredAssertionCount
    || envelope.verifier.result !== "RED"
    || JSON.stringify(envelope.verifier.failedIds) !== JSON.stringify(sorted(policy.requiredFailureIds))
    || JSON.stringify(envelope.evidenceRefs) !== JSON.stringify([policy.evidenceRef])
    || !sameKeys(envelope.originalTestOracle, ["path", "digest", "mutable"])
    || !sameKeys(envelope.sourceAllowance, ["allowedMutationRoots", "immutablePaths"])
    || !sameKeys(envelope.route, ["worker", "provider", "endpoint", "model", "cloudAllowed"])
    || !sameKeys(envelope.budget, ["attempt", "maxAttempts", "maxDurationMs", "maxCloudCostUsd"])
    || !sameKeys(envelope.grants, ["humanGrantRef", "sourceMutation", "modelDispatch", "localToolExecution", "providerEndpointAccess"])
    || !Array.isArray(envelope.denialCodes) || envelope.denialCodes.some((item) => !FAILURE_ID.test(String(item).toLowerCase().replaceAll("_", "-")))
    || envelope.originalTestOracle?.mutable !== false
    || envelope.originalTestOracle?.path !== policy.oracle.path
    || envelope.originalTestOracle?.digest !== policy.oracle.digest
    || JSON.stringify(envelope.sourceAllowance?.allowedMutationRoots) !== JSON.stringify(policy.allowedMutationRoots)
    || JSON.stringify(envelope.sourceAllowance?.immutablePaths) !== JSON.stringify(policy.immutablePaths)) {
    throw new Error("Governed repair envelope is outside the approved campaign policy.");
  }
  const { digest, ...payload } = envelope;
  if (sha256(JSON.stringify(payload)) !== digest) throw new Error("Governed repair envelope digest mismatch.");
  const denied = denialCodes({
    authorization: {
      humanApproved: envelope.grants?.humanGrantRef !== null,
      grantRef: envelope.grants?.humanGrantRef,
      sourceMutation: envelope.grants?.sourceMutation,
      modelDispatch: envelope.grants?.modelDispatch,
      localToolExecution: envelope.grants?.localToolExecution,
      providerEndpointAccess: envelope.grants?.providerEndpointAccess,
    },
    route: envelope.route,
    budget: envelope.budget,
    policy,
  });
  if (JSON.stringify(envelope.denialCodes) !== JSON.stringify(denied)) {
    throw new Error("Governed repair envelope denial state is inconsistent.");
  }
  if (envelope.state === "ADMITTED" && (denied.length || envelope.denialCodes.length)) {
    throw new Error("Governed repair envelope forges admission authority.");
  }
  if (envelope.state === "DENIED" && !envelope.denialCodes.length) {
    throw new Error("Governed repair denied envelope lacks a reason.");
  }
  if (!["ADMITTED", "DENIED"].includes(envelope.state)) throw new Error("Governed repair envelope state is invalid.");
  return Object.freeze(envelope);
}

export async function writeGovernedRepairEnvelope(runDir, envelope) {
  if (!path.isAbsolute(runDir) || !Number.isInteger(envelope?.budget?.attempt)) {
    throw new Error("Governed repair storage requires an absolute private run directory and attempt.");
  }
  const info = await lstat(runDir);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Governed repair requires an ordinary private run directory.");
  const file = path.join(runDir, `repair-candidate-attempt-${envelope.budget.attempt}.json`);
  const bytes = `${JSON.stringify(envelope)}\n`;
  if (Buffer.byteLength(bytes) > MAX_BYTES) throw new Error("Governed repair envelope exceeds the storage limit.");
  await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
  return file;
}

export async function readGovernedRepairEnvelope(file, policyPath = POLICY_PATH) {
  if (!path.isAbsolute(file)) throw new Error("Governed repair envelope path must be absolute.");
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_BYTES) {
    throw new Error("Governed repair requires a bounded ordinary private envelope.");
  }
  const envelope = JSON.parse(await readFile(file, "utf8"));
  const policy = await loadGovernedRepairPolicy(policyPath, envelope.taskRef);
  return validateGovernedRepairEnvelope(envelope, policy);
}

export function governedRepairFinding(envelope) {
  if (envelope?.state !== "ADMITTED") throw new Error("Governed repair finding requires an admitted envelope.");
  return Object.freeze({
    fingerprint: envelope.fingerprint,
    title: "Story Factory selected-project continuity",
    area: "story-factory-project-selection",
    severity: "blocker",
    message: "Independent exact-head browser verification reproduced the approved project-continuity failures.",
    evidence: Object.freeze({
      exactSha: envelope.exactSha,
      reportDigest: envelope.verifier.reportDigest,
      failureIds: envelope.verifier.failedIds,
      evidenceRefs: envelope.evidenceRefs,
    }),
  });
}

function pathMatchesRoot(file, root) {
  const normalized = file.replaceAll("\\", "/");
  if (!/^[a-zA-Z0-9._/-]{1,260}$/u.test(normalized) || normalized.startsWith("/") || normalized.includes("../")) return false;
  const prefix = root.endsWith("/**") ? root.slice(0, -3) : root;
  return root.endsWith("/**") ? normalized === prefix || normalized.startsWith(`${prefix}/`) : normalized === root;
}

export function assertGovernedRepairChangedPaths(envelope, changedPaths) {
  if (envelope?.state !== "ADMITTED" || !Array.isArray(changedPaths) || !changedPaths.length) {
    throw new Error("Governed repair requires admitted, non-empty source changes.");
  }
  for (const file of changedPaths) {
    if (envelope.sourceAllowance.immutablePaths.includes(file)) {
      throw new Error(`Governed repair changed immutable oracle path: ${file}`);
    }
    if (!envelope.sourceAllowance.allowedMutationRoots.some((root) => pathMatchesRoot(file, root))) {
      throw new Error(`Governed repair changed source outside its allowance: ${file}`);
    }
  }
  return Object.freeze([...changedPaths]);
}

function parseCommand(args) {
  const allowedFlags = new Set([
    "--dispatch", "--authorize-human", "--authorize-source-mutation", "--authorize-model-dispatch",
    "--authorize-local-tools", "--authorize-local-provider", "--stop-requested",
  ]);
  const allowedValues = new Set(["--scope", "--head", "--attempt", "--worker", "--endpoint", "--model", "--grant-ref"]);
  const values = {};
  const flags = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (allowedFlags.has(item)) { flags.add(item); continue; }
    if (!allowedValues.has(item) || values[item] !== undefined || !args[index + 1] || args[index + 1].startsWith("--")) {
      throw new Error("Governed repair command contains unsupported, repeated or missing arguments.");
    }
    values[item] = args[++index];
  }
  return { values, flags };
}

function runNode(script, args, { timeout = 0 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: REPO, env: process.env, stdio: "inherit", windowsHide: true,
      ...(timeout ? { timeout } : {}),
    });
    child.once("error", () => resolve(1));
    child.once("exit", (code) => resolve(Number(code ?? 1)));
  });
}

async function main() {
  const { values, flags } = parseCommand(process.argv.slice(2));
  const scopeHash = safeString(values["--scope"], HASH, "scope hash");
  const exactSha = safeString(values["--head"], SHA, "exact head");
  const runDir = path.join(privateRunRoot(), "engineering-team", "runs", scopeHash);
  const policy = await loadGovernedRepairPolicy();
  const evidenceState = await readEngineeringEvidenceState(runDir, { scopeHash, exactSha });
  const verifierReport = JSON.parse(await readFile(REPORT_PATH, "utf8"));
  const oracleBytes = (await readFile(path.join(REPO, policy.oracle.path), "utf8")).replaceAll("\r\n", "\n");
  if (sha256(oracleBytes) !== policy.oracle.digest) throw new Error("Governed repair original test oracle changed.");
  const currentHead = String((await exec("git", ["rev-parse", "HEAD"], { cwd: REPO })).stdout).trim().toLowerCase();
  if (currentHead !== exactSha) throw new Error("Governed repair checkout head differs from the admitted evidence head.");
  const attempt = Number(values["--attempt"] || 1);
  const envelope = createGovernedRepairEnvelope({
    evidenceState,
    verifierReport,
    policy,
    authorization: {
      humanApproved: flags.has("--authorize-human"),
      grantRef: values["--grant-ref"] || "",
      sourceMutation: flags.has("--authorize-source-mutation"),
      modelDispatch: flags.has("--authorize-model-dispatch"),
      localToolExecution: flags.has("--authorize-local-tools"),
      providerEndpointAccess: flags.has("--authorize-local-provider"),
      stopRequested: flags.has("--stop-requested"),
    },
    route: {
      worker: values["--worker"] || "",
      provider: values["--endpoint"] ? "local-openai-compatible" : "",
      endpoint: values["--endpoint"] || "",
      model: values["--model"] || "",
      cloudAllowed: false,
    },
    budget: { attempt, maxAttempts: policy.maxAttempts, maxDurationMs: policy.maxDurationMs, maxCloudCostUsd: 0 },
  });
  const envelopePath = await writeGovernedRepairEnvelope(runDir, envelope);
  process.stdout.write(`${JSON.stringify({ state: envelope.state, denialCodes: envelope.denialCodes, envelopePath }, null, 2)}\n`);
  if (!flags.has("--dispatch")) return;
  if (envelope.state !== "ADMITTED") { process.exitCode = 2; return; }

  const childArgs = [
    "--governed-envelope", envelopePath,
    "--worker", envelope.route.worker,
    "--issue", String(envelope.issueNumber),
    "--fingerprint", envelope.fingerprint,
    "--endpoint", envelope.route.endpoint,
    "--model", envelope.route.model,
  ];
  const preflight = await runNode(path.join(REPO, "scripts", "run-uat-repair-agent.mjs"), [
    ...childArgs, "--preflight", "--json", "--require-ready",
  ]);
  if (preflight !== 0) {
    process.stderr.write("Governed repair WAITING: approved local worker/provider route is not ready; no attempt was started.\n");
    process.exitCode = preflight;
    return;
  }
  const reservation = path.join(runDir, `repair-attempt-${attempt}-started-uncertain.json`);
  await writeFile(reservation, `${JSON.stringify({
    schemaVersion: 1, candidateId: envelope.candidateId, exactSha, scopeHash, attempt,
    state: "started-uncertain", startedUncertainMayReplay: false,
  })}\n`, { flag: "wx", mode: 0o600 });
  const code = await runNode(path.join(REPO, "scripts", "run-semantic-uat-repair.mjs"), childArgs, {
    timeout: policy.maxDurationMs,
  });
  const resultPath = path.join(runDir, `repair-attempt-${attempt}-result.json`);
  await writeFile(resultPath, `${JSON.stringify({
    schemaVersion: 1, candidateId: envelope.candidateId, exactSha, scopeHash, attempt,
    state: code === 0 ? "completed" : "blocked-uncertain", exitCode: code,
    startedUncertainMayReplay: false,
  })}\n`, { flag: "wx", mode: 0o600 });
  process.exitCode = code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Governed repair BLOCKED: ${String(error?.message || "unknown failure").slice(0, 300)}\n`);
    process.exitCode = 1;
  });
}
