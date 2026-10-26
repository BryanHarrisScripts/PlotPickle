#!/usr/bin/env node
/**
 * #3142: locally invoked, owner-controlled Windows acceptance admission.
 * Not a remotely exposed MCP action, background dispatcher, product verifier,
 * general shell, or replacement for PlotPickleIndependentSupervisor.
 * Staging uses the existing bounded candidate adapter and retains its evidence.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, lstat, open, readFile } from "node:fs/promises";
import { privateFactoryRoot, observeCandidateStageLock } from "../../mcp/factory-readonly-server.mjs";
import { assessCandidateStageCount } from "../../mcp/storage/factory-stage-budget.mjs";
import { inspectFactoryCandidatePr, readFactoryVerificationHead, stageFactoryCandidatePr } from "../../mcp/factory-named-tests.mjs";
import { supervisorStatus } from "../supervisor/unattended-supervisor.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const SHA = /^[a-f0-9]{40}$/;
const ID = /^[a-f0-9]{32}$/;
const CONSENT = "AUTHORIZE_OWNER_WINDOWS_CANDIDATE_STAGE";
const allowedCode = /^[A-Z][A-Z0-9_]{2,96}$/;
const blocked = (code) => ({ state: "BLOCKED", code, replayAuthorized: false,
  independentVerification: false, automaticMergeAuthorized: false });
const uncertain = (id) => ({ state: "STARTED_UNCONFIRMED", requestId: id,
  replayAuthorized: false, independentVerification: false, automaticMergeAuthorized: false });
const receiptDir = root => path.join(root, "owner-windows-acceptance", "receipts");

async function safeRecord(filename) {
  try {
    const stat = await lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 4096) return null;
    const value = JSON.parse(await readFile(filename, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch { return null; }
}
async function exists(filename) {
  try { await lstat(filename); return true; }
  catch (error) { return error?.code !== "ENOENT"; }
}
async function writeOnce(filename, value) {
  let file;
  try {
    file = await open(filename, "wx", 0o600);
    await file.writeFile(JSON.stringify(value) + "\n", "utf8");
    await file.sync();
    return true;
  } catch { return false; }
  finally { await file?.close().catch(() => {}); }
}
async function safeReceiptDirectory(root) {
  // Never follow a user-planted junction/symlink into another private domain.
  // The canonical Factory root must already exist; no arbitrary root creation.
  const parent = path.join(root, "owner-windows-acceptance");
  for (const dir of [root, parent, receiptDir(root)]) {
    if (dir !== root) {
      try { await mkdir(dir, { mode: 0o700 }); }
      catch (error) { if (error?.code !== "EEXIST") throw error; }
    }
    const stat = await lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw Error("RECEIPT_DIRECTORY_UNVERIFIABLE");
  }
  return receiptDir(root);
}

/** Read-only result: missing is distinct from a damaged or ambiguous record. */
export async function readOwnerAcceptanceReceipt({ root, requestId } = {}) {
  if (!ID.test(requestId || "")) return blocked("INVALID_REQUEST_ID");
  const dir = receiptDir(root), reservedFile = path.join(dir, requestId + ".reserved.json");
  const reserved = await safeRecord(reservedFile);
  if (!reserved || reserved.requestId !== requestId || reserved.schemaVersion !== 1 ||
      !SHA.test(reserved.expectedHead || "") || !SHA.test(reserved.candidateHead || "") ||
      !Number.isSafeInteger(reserved.candidatePrNumber))
    return await exists(reservedFile) ? uncertain(requestId)
      : { state: "NO_REQUEST", requestId, replayAuthorized: false };
  const result = await safeRecord(path.join(dir, requestId + ".result.json"));
  if (result?.requestId !== requestId || result.expectedHead !== reserved.expectedHead ||
      result.candidateHead !== reserved.candidateHead ||
      result.candidatePrNumber !== reserved.candidatePrNumber)
    return uncertain(requestId);
  const ok = result.state === "STAGED_NOT_ACCEPTED" &&
    result.code === "CANDIDATE_STATIC_STAGED" &&
    result.stageId === requestId &&
    Number.isSafeInteger(result.changedFileCount) && result.changedFileCount >= 1 &&
    result.changedFileCount <= 500;
  const refused = result.state === "BLOCKED" && allowedCode.test(result.code || "");
  if (!ok && !refused) return uncertain(requestId);
  return { ...result, replayAuthorized: false, independentVerification: false,
    automaticMergeAuthorized: false };
}

/** Native local entrypoint; injection seams are for disposable fixture tests only. */
export async function ownerWindowsAcceptanceAction(args, {
  root = privateFactoryRoot(), repoRoot = REPO, platform = process.platform,
  interactive = process.stdin.isTTY === true,
  source = () => readFactoryVerificationHead({ repoRoot }),
  supervisor = supervisorStatus, inspect = inspectFactoryCandidatePr,
  stage = stageFactoryCandidatePr, capacity = assessCandidateStageCount,
  lock = observeCandidateStageLock, now = Date.now,
} = {}) {
  // An owner-local, explicitly selected trusted MAIN path is required when
  // the reviewed broker is executed from an isolated preview of an unmerged PR.
  // This path is never accepted through MCP, GitHub issue text or a queue.
  if (args?.mainRoot !== undefined) {
    if (typeof args.mainRoot !== "string" || !path.isAbsolute(args.mainRoot))
      return blocked("TRUSTED_MAIN_PATH_INVALID");
    repoRoot = path.resolve(args.mainRoot);
  }
  if (args?.action === "receipt")
    return readOwnerAcceptanceReceipt({ root, requestId: args.requestId });
  if (args?.action === "status") {
    if (platform !== "win32") return blocked("WINDOWS_ONLY");
    const [head, running, stages, held] = await Promise.all([
      source().catch(() => null), supervisor().catch(() => null),
      capacity({ base: path.join(root, "chat-candidate-stages") }).catch(() => null),
      lock({ root }).catch(() => null),
    ]);
    return { state: "OBSERVED_NOT_ACCEPTED", sourceHead: SHA.test(head || "") ? head : null,
      supervisorState: running?.state || "UNVERIFIED",
      supervisorHead: SHA.test(running?.exactSha || "") ? running.exactSha : null,
      stageCapacityState: stages?.state || "UNVERIFIED",
      retainedStages: Number.isSafeInteger(stages?.observedRetainedStages)
        ? stages.observedRetainedStages : null,
      stageLockState: held?.state || "UNVERIFIED",
      ownerWindowsAcceptance: false, independentVerification: false,
      automaticMergeAuthorized: false };
  }
  if (args?.action !== "stage" || !ID.test(args.requestId || "") ||
      !SHA.test(args.expectedHead || "") || !SHA.test(args.candidateHead || "") ||
      !Number.isSafeInteger(args.candidatePrNumber) || args.candidatePrNumber < 1 ||
      args.candidatePrNumber > 9_999_999) return blocked("INVALID_STAGE_SELECTION");
  // Only a conscious local console invocation can request staging. There is
  // deliberately no local HTTP listener, MCP registration, queue poll or task.
  if (platform !== "win32" || !interactive || args.consent !== CONSENT)
    return blocked("LOCAL_OPERATOR_CONSENT_REQUIRED");
  let running, head;
  try { [head, running] = await Promise.all([source(), supervisor()]); }
  catch { return blocked("OWNER_SOURCE_OR_SUPERVISOR_UNVERIFIABLE"); }
  if (head !== args.expectedHead) return blocked("EXACT_CLEAN_MAIN_REQUIRED");
  if (running?.state !== "RUNNING" || running.exactSha !== head ||
      !Number.isSafeInteger(running.checkedAt) || now() - running.checkedAt < 0 ||
      now() - running.checkedAt > 180_000)
    return blocked("SUPERVISOR_NOT_FRESH_RUNNING_ON_MAIN");
  let identity;
  try { identity = await inspect({ prNumber: args.candidatePrNumber,
    candidateHead: args.candidateHead, expectedHead: head, repoRoot, platform }); }
  catch { return blocked("CANDIDATE_IDENTITY_UNVERIFIABLE"); }
  if (identity?.state !== "TEST_PASSED" || identity.code !== "CANDIDATE_HEAD_VERIFIED")
    return blocked(allowedCode.test(identity?.code || "") ? identity.code : "CANDIDATE_IDENTITY_UNVERIFIABLE");
  let dir;
  try { dir = await safeReceiptDirectory(root); }
  catch { return blocked("RECEIPT_DIRECTORY_UNVERIFIABLE"); }
  const reservation = path.join(dir, args.requestId + ".reserved.json");
  if (!await writeOnce(reservation, { schemaVersion: 1, requestId: args.requestId,
    expectedHead: head, candidatePrNumber: args.candidatePrNumber,
    candidateHead: args.candidateHead, reservedAt: now(), state: "RESERVED_NO_REPLAY" }))
    return blocked("REQUEST_ALREADY_RESERVED_OR_UNVERIFIABLE");
  let outcome;
  try {
    // STOP/PAUSE precedence after the durable reservation, before candidate I/O.
    const latest = await supervisor();
    if (latest?.state !== "RUNNING" || latest.exactSha !== head)
      outcome = blocked("INTENTIONAL_STOP_OR_SUPERVISOR_CHANGED");
    else {
      const result = await stage({ root, repoRoot, platform,
        requestId: args.requestId, prNumber: args.candidatePrNumber,
        candidateHead: args.candidateHead, expectedHead: head });
      outcome = result?.state === "TEST_PASSED" &&
        result.code === "CANDIDATE_STATIC_STAGED" &&
        result.sourceHead === head && result.candidateHead === args.candidateHead &&
        result.candidatePrNumber === args.candidatePrNumber &&
        result.stageId === args.requestId &&
        Number.isSafeInteger(result.changedFileCount) && result.changedFileCount >= 1 &&
        result.changedFileCount <= 500
        ? { state: "STAGED_NOT_ACCEPTED", code: "CANDIDATE_STATIC_STAGED",
          stageId: args.requestId, changedFileCount: result.changedFileCount,
          sourceExecuted: false, ownerWindowsAcceptance: false }
        : blocked(result?.state === "BLOCKED" && allowedCode.test(result.code || "")
          ? result.code : "STAGE_OUTCOME_UNVERIFIABLE");
    }
  } catch { return uncertain(args.requestId); }
  const stored = { ...outcome, requestId: args.requestId, expectedHead: head,
    candidateHead: args.candidateHead, candidatePrNumber: args.candidatePrNumber,
    replayAuthorized: false, independentVerification: false,
    automaticMergeAuthorized: false };
  if (!await writeOnce(path.join(dir, args.requestId + ".result.json"), stored))
    return uncertain(args.requestId);
  return readOwnerAcceptanceReceipt({ root, requestId: args.requestId });
}

function parseCli(argv) {
  if (argv.length === 1 && argv[0] === "--status") return { action: "status" };
  if (argv.length === 3 && argv[0] === "--status" && argv[1] === "--main-root")
    return { action: "status", mainRoot: argv[2] };
  if (argv.length === 2 && argv[0] === "--receipt") return { action: "receipt", requestId: argv[1] };
  // No implicit repo selection for an owner stage: the code checkout and
  // clean trusted MAIN must be independently identified by the operator.
  if (argv.length === 8 && argv[0] === "--stage" && argv[6] === "--main-root") return {
    action: "stage", candidatePrNumber: Number(argv[1]), candidateHead: argv[2],
    expectedHead: argv[3], requestId: argv[4], consent: argv[5],
    mainRoot: argv[7],
  };
  return null;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await ownerWindowsAcceptanceAction(parseCli(process.argv.slice(2)));
  process.stdout.write(JSON.stringify(result) + "\n");
  if (!["OBSERVED_NOT_ACCEPTED", "STAGED_NOT_ACCEPTED", "NO_REQUEST"].includes(result.state))
    process.exitCode = 1;
}
