/**
 * #3142 — fixed authenticated request to start the EXISTING owner-authorized
 * independent Windows supervisor. This is not a ChatGPT coding dispatcher.
 * No Task Scheduler installation, credential, shell, Pi process or queue replay.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { readFactoryVerificationHead } from "../factory-named-tests.mjs";

const exec = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const SCRIPT = path.resolve(ROOT, "scripts/engineering-team/windows/supervisor/Install-PlotPickleIndependentSupervisor.ps1");
const SHA = /^[a-f0-9]{40}$/;
const CONSENT = "ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR";
const COMMAND_OPTIONS = Object.freeze({
  cwd: ROOT, windowsHide: true, shell: false, encoding: "utf8",
  timeout: 25_000, maxBuffer: 4096,
});
const blocked = (code, head = null) => Object.freeze({
  state: "BLOCKED", code, sourceHead: SHA.test(head || "") ? head : null,
  modelInvoked: false, workerProcessVerified: false, replayAuthorized: false,
});

/**
 * Start only an already-registered, identity-checked owner Task Scheduler job.
 * The existing PowerShell script verifies task action, user, exact clean Git
 * source, legacy Pi absence, STOP state and OFFLINE readiness again at Start.
 * A returned start request is NEVER proof of process health or coding.
 */
export async function requestIndependentSupervisorStart({
  expectedHead, platform = process.platform, verifyHead = readFactoryVerificationHead,
  run = exec,
} = {}) {
  if (platform !== "win32") return blocked("WINDOWS_ONLY");
  if (!SHA.test(expectedHead || "")) return blocked("SUPERVISOR_SOURCE_UNVERIFIED");
  let initial;
  try { initial = await verifyHead({ repoRoot: ROOT }); }
  catch { return blocked("SUPERVISOR_SOURCE_UNVERIFIED"); }
  if (initial !== expectedHead) return blocked("SUPERVISOR_SOURCE_UNVERIFIED", initial);

  const invoke = (args) => run("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-File", SCRIPT, ...args,
  ], COMMAND_OPTIONS);
  let observed;
  try {
    const result = await invoke(["-Status"]);
    if (Buffer.byteLength(String(result?.stdout || ""), "utf8") > 4096)
      return blocked("SUPERVISOR_STATUS_UNVERIFIED", initial);
    observed = JSON.parse(String(result?.stdout || ""));
  } catch {
    return blocked("SUPERVISOR_STATUS_UNVERIFIED", initial);
  }
  if (observed?.state !== "OBSERVED_NOT_INDEPENDENTLY_VERIFIED" ||
      observed?.sourceHead !== expectedHead ||
      observed?.supervisorState !== "OFFLINE")
    return blocked("SUPERVISOR_NOT_OFFLINE_ON_CURRENT_HEAD", initial);
  if (observed.taskInstalled !== true)
    return blocked("SUPERVISOR_TASK_NOT_INSTALLED", initial);
  if (observed.taskState !== "Ready")
    return blocked("SUPERVISOR_TASK_NOT_READY", initial);

  // Recheck immediately before the non-idempotent OS task request. The
  // reviewed PowerShell -Start repeats clean-source and task ownership checks.
  try {
    if (await verifyHead({ repoRoot: ROOT }) !== expectedHead)
      return blocked("SUPERVISOR_SOURCE_UNVERIFIED", initial);
  } catch { return blocked("SUPERVISOR_SOURCE_UNVERIFIED", initial); }

  // From this point an error is ambiguous: Task Scheduler may have accepted
  // the request. The MCP reservation must remain non-replayable.
  try {
    const result = await invoke(["-Start", "-Consent", CONSENT]);
    const receipt = JSON.parse(String(result?.stdout || ""));
    if (receipt?.state !== "START_REQUESTED_UNCONFIRMED")
      return Object.freeze({ state: "START_REQUESTED_UNCONFIRMED",
        code: "SUPERVISOR_START_OUTCOME_UNVERIFIED", sourceHead: expectedHead,
        modelInvoked: false, workerProcessVerified: false, replayAuthorized: false });
  } catch {
    return Object.freeze({ state: "START_REQUESTED_UNCONFIRMED",
      code: "SUPERVISOR_START_OUTCOME_UNVERIFIED", sourceHead: expectedHead,
      modelInvoked: false, workerProcessVerified: false, replayAuthorized: false });
  }
  return Object.freeze({
    state: "START_REQUESTED_UNCONFIRMED",
    code: "SUPERVISOR_START_SUBMITTED_UNVERIFIED", sourceHead: expectedHead,
    modelInvoked: false, workerProcessVerified: false, replayAuthorized: false,
  });
}
