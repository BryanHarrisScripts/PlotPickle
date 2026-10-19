#!/usr/bin/env node

import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  parseWindowsUatCommand,
  requestStopWindowsUat,
  startWindowsUat,
  statusWindowsUat,
} from "../../windows-uat-control.mjs";

const runFile = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");
const DEFAULT_APP_ROOT = path.join(process.env.LOCALAPPDATA || (process.platform === "win32"
  ? path.join(os.homedir(), "AppData", "Local")
  : path.join(os.homedir(), ".local", "share")), "PlotPickle");
const MARKER = "<!-- plotpickle-windows-control:v1 -->";
const RESULT_MARKER = "plotpickle-windows-control-result";
const LABEL = "plotpickle:windows-control";
const CONSENT = "AUTHENTICATED_WINDOWS_CONTROL";
const REQUEST_KIND = "github-authenticated-windows-control";
const REQUEST_ID = /^[a-f0-9]{32,64}$/;
const HOST_ID = /^host-[a-f0-9]{32}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const ACTOR = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const SCOPE = /^[a-f0-9]{64}$/;
const MAX_BODY_BYTES = 12 * 1024;
const MAX_TTL_MS = 10 * 60_000;
const CLOCK_SKEW_MS = 30_000;
const PAIRING_KEYS = [
  "schemaVersion", "kind", "enabled", "hostId", "repository", "authorizedActor",
  "label", "permissions", "pairedAt",
];
const REQUEST_KEYS = [
  "schemaVersion", "kind", "requestId", "hostId", "action", "issuedAt", "expiresAt", "parameters",
];

const controlRoot = (appRoot = DEFAULT_APP_ROOT) => path.join(appRoot, "engineering-team", "windows-paired-control");
const sameKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const safeIso = (value, label) => {
  const text = String(value || "");
  const milliseconds = Date.parse(text);
  if (!text || !Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== text) {
    throw new Error(`Paired Windows control ${label} must be an exact ISO timestamp.`);
  }
  return { text, milliseconds };
};

async function ordinaryJson(file, maximum = MAX_BODY_BYTES) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > maximum) {
    throw new Error("Paired Windows control requires a bounded ordinary JSON file.");
  }
  return JSON.parse(await readFile(file, "utf8"));
}

async function ensureOrdinaryDirectory(directory) {
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Paired Windows control requires a private ordinary directory.");
  }
  return directory;
}

function validatePairing(value) {
  if (!sameKeys(value, PAIRING_KEYS) || value.schemaVersion !== 1
    || value.kind !== "plotpickle-windows-control-pairing" || value.enabled !== true
    || !HOST_ID.test(value.hostId || "") || !REPOSITORY.test(value.repository || "")
    || !ACTOR.test(value.authorizedActor || "") || value.label !== LABEL
    || JSON.stringify(value.permissions) !== JSON.stringify(["start", "status", "stop"])) {
    throw new Error("Paired Windows control pairing is malformed or over-privileged.");
  }
  safeIso(value.pairedAt, "pairing time");
  return Object.freeze({ ...value, permissions: Object.freeze([...value.permissions]) });
}

export async function pairWindowsGitHubControl({ repository, authorizedActor, consent }, {
  appRoot = DEFAULT_APP_ROOT,
  now = () => new Date(),
  random = (size) => randomBytes(size),
} = {}) {
  if (consent !== CONSENT) throw new Error("Paired Windows control requires explicit local Human consent.");
  if (!REPOSITORY.test(repository || "") || !ACTOR.test(authorizedActor || "")) {
    throw new Error("Paired Windows control requires one bounded repository and GitHub actor.");
  }
  const root = controlRoot(appRoot);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await ensureOrdinaryDirectory(root);
  if (existsSync(path.join(root, "disabled.json"))) {
    throw new Error("Paired Windows control was disabled; a new pairing identity requires a separately reviewed reset.");
  }
  const pairing = validatePairing({
    schemaVersion: 1,
    kind: "plotpickle-windows-control-pairing",
    enabled: true,
    hostId: `host-${random(16).toString("hex")}`,
    repository,
    authorizedActor,
    label: LABEL,
    permissions: ["start", "status", "stop"],
    pairedAt: now().toISOString(),
  });
  await writeFile(path.join(root, "pairing.json"), `${JSON.stringify(pairing)}\n`, { flag: "wx", mode: 0o600 });
  return pairing;
}

export async function disableWindowsGitHubControl({ appRoot = DEFAULT_APP_ROOT, now = () => new Date() } = {}) {
  const root = await ensureOrdinaryDirectory(controlRoot(appRoot));
  const pairing = validatePairing(await ordinaryJson(path.join(root, "pairing.json")));
  const disabled = { schemaVersion: 1, hostId: pairing.hostId, disabledAt: now().toISOString(), enabled: false };
  try {
    await writeFile(path.join(root, "disabled.json"), `${JSON.stringify(disabled)}\n`, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    return ordinaryJson(path.join(root, "disabled.json"));
  }
  return Object.freeze(disabled);
}

export async function readWindowsGitHubPairing({ appRoot = DEFAULT_APP_ROOT } = {}) {
  const root = controlRoot(appRoot);
  if (!existsSync(path.join(root, "pairing.json"))) {
    return Object.freeze({ state: "OFF", enabled: false, reason: "NOT_PAIRED" });
  }
  await ensureOrdinaryDirectory(root);
  const pairing = validatePairing(await ordinaryJson(path.join(root, "pairing.json")));
  if (existsSync(path.join(root, "disabled.json"))) {
    const disabled = await ordinaryJson(path.join(root, "disabled.json"));
    return Object.freeze({ state: "OFF", enabled: false, reason: "LOCALLY_DISABLED",
      hostId: pairing.hostId, disabledAt: disabled.disabledAt });
  }
  return Object.freeze({ state: "PAIRED_IDLE", enabled: true, ...pairing });
}

function validatedParameters(action, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Paired Windows control parameters are required.");
  }
  if (action === "start") {
    if (!sameKeys(value, ["head", "base", "task", "attempt"])) {
      throw new Error("Paired Windows start parameters are not exact.");
    }
    return parseWindowsUatCommand(["--start", "--head", value.head, "--base", value.base,
      "--task", value.task, "--attempt", String(value.attempt)]);
  }
  if (!sameKeys(value, ["scope"]) || !SCOPE.test(value.scope || "")) {
    throw new Error("Paired Windows status/stop requires one exact private scope.");
  }
  return parseWindowsUatCommand([`--${action}`, "--scope", value.scope]);
}

export function validateWindowsGitHubRequest(value, pairing, { now = Date.now() } = {}) {
  if (!sameKeys(value, REQUEST_KEYS) || value.schemaVersion !== 1 || value.kind !== REQUEST_KIND
    || !REQUEST_ID.test(value.requestId || "") || value.hostId !== pairing.hostId
    || !pairing.permissions.includes(value.action)) {
    throw new Error("Paired Windows control request is malformed, misbound or unauthorized.");
  }
  const issued = safeIso(value.issuedAt, "issued time");
  const expires = safeIso(value.expiresAt, "expiry");
  if (expires.milliseconds <= issued.milliseconds || expires.milliseconds - issued.milliseconds > MAX_TTL_MS
    || issued.milliseconds > now + CLOCK_SKEW_MS || expires.milliseconds < now) {
    throw new Error("Paired Windows control request is expired or outside its bounded time window.");
  }
  const parameters = validatedParameters(value.action, value.parameters);
  return Object.freeze({ ...value, parameters });
}

export function parseWindowsGitHubControlIssue(issue, pairing, options = {}) {
  if (!Number.isInteger(issue?.number) || issue.number < 1 || issue.state !== "open"
    || issue.user?.login !== pairing.authorizedActor
    || !Array.isArray(issue.labels) || !issue.labels.some((item) => (item?.name || item) === pairing.label)) {
    throw new Error("GitHub control issue is not authenticated for this paired host.");
  }
  const body = String(issue.body || "");
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) throw new Error("GitHub control issue is oversized.");
  const match = /^<!-- plotpickle-windows-control:v1 -->\r?\n```json\r?\n([\s\S]+)\r?\n```\s*$/u.exec(body);
  if (!match) throw new Error("GitHub control issue does not contain one exact command envelope.");
  const request = validateWindowsGitHubRequest(JSON.parse(match[1]), pairing, options);
  const expectedTitle = `[PlotPickle Windows Control] ${request.action} ${request.requestId}`;
  if (issue.title !== expectedTitle) throw new Error("GitHub control issue title does not match its envelope.");
  return Object.freeze({ issueNumber: issue.number, request });
}

export function renderWindowsGitHubControlIssue(request, pairing, options = {}) {
  const validated = validateWindowsGitHubRequest(request, pairing, options);
  return Object.freeze({
    title: `[PlotPickle Windows Control] ${validated.action} ${validated.requestId}`,
    label: pairing.label,
    body: `${MARKER}\n\`\`\`json\n${JSON.stringify(request, null, 2)}\n\`\`\``,
  });
}

function publicResult(request, outcome, extra = {}) {
  const observedState = String(outcome?.state || outcome?.status || "UNKNOWN");
  const state = /^[A-Za-z0-9_-]{1,80}$/u.test(observedState) ? observedState : "UNKNOWN";
  return Object.freeze({
    schemaVersion: 1,
    requestId: request.requestId,
    hostId: request.hostId,
    action: request.action,
    state,
    scope: SCOPE.test(outcome?.scope || "") ? outcome.scope : (SCOPE.test(request.parameters?.scope || "") ? request.parameters.scope : null),
    exactSha: /^[a-f0-9]{40}$/.test(outcome?.exactSha || request.parameters?.head || "")
      ? (outcome.exactSha || request.parameters.head) : null,
    cancellationAcknowledged: outcome?.cancellationAcknowledged === true,
    childExitObserved: outcome?.childExitObserved === true,
    evidenceSha256: SCOPE.test(outcome?.evidenceSha256 || "") ? outcome.evidenceSha256 : null,
    stopDisposition: request.action === "stop"
      ? (["ALREADY_TERMINAL_NOOP", "DIRECT_CHILD_CANCELLATION_OBSERVED",
        "CANCELLED_BEFORE_CHILD", "TERMINAL_DURING_REQUEST_UNPROVEN",
        "STOP_REQUESTED_UNCONFIRMED"].includes(outcome?.stopDisposition)
        ? outcome.stopDisposition : "STOP_UNVERIFIED")
      : null,
    ownedDescendantsVerifiedGone: false,
    ...extra,
    pairedControlAuthenticated: true,
    browserUatProven: false,
    independentVerification: false,
    mergeEligible: false,
    modelDispatchAllowed: false,
  });
}

export async function executeWindowsGitHubControlIssue(issue, {
  appRoot = DEFAULT_APP_ROOT,
  now = Date.now,
  start = startWindowsUat,
  status = statusWindowsUat,
  stop = requestStopWindowsUat,
} = {}) {
  const pairingState = await readWindowsGitHubPairing({ appRoot });
  if (!pairingState.enabled) throw new Error(`Paired Windows control is ${pairingState.reason}.`);
  const { request } = parseWindowsGitHubControlIssue(issue, pairingState, { now: now() });
  const requestsRoot = path.join(controlRoot(appRoot), "requests");
  await mkdir(requestsRoot, { recursive: true, mode: 0o700 });
  await ensureOrdinaryDirectory(requestsRoot);
  const requestRoot = path.join(requestsRoot, request.requestId);
  await mkdir(requestRoot, { recursive: true, mode: 0o700 });
  await ensureOrdinaryDirectory(requestRoot);
  const reservationPath = path.join(requestRoot, "reservation.json");
  const terminalPath = path.join(requestRoot, "terminal.json");
  try {
    await writeFile(reservationPath, `${JSON.stringify({ schemaVersion: 1, requestId: request.requestId,
      issueNumber: issue.number, action: request.action, hostId: request.hostId,
      reservedAt: new Date(now()).toISOString(), replayAuthorized: false })}\n`, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    if (!existsSync(terminalPath)) {
      const state = request.action === "start" ? "STARTED_UNCONFIRMED" : `${request.action.toUpperCase()}_UNCONFIRMED`;
      return publicResult(request, { state }, { deduplicated: true, replayed: false });
    }
    const terminal = await ordinaryJson(terminalPath);
    return Object.freeze({ ...terminal, deduplicated: true, replayed: false });
  }

  let outcome;
  if (request.action === "start") outcome = await start(request.parameters, { appRoot, repoRoot: REPO });
  else if (request.action === "status") outcome = await status(request.parameters.scope, { appRoot, now });
  else outcome = await stop(request.parameters.scope, { appRoot, now });
  const result = publicResult(request, outcome, { deduplicated: false, replayed: false });
  await writeFile(terminalPath, `${JSON.stringify(result)}\n`, { flag: "wx", mode: 0o600 });
  return result;
}

function renderResultComment(result) {
  return `<!-- ${RESULT_MARKER}:${result.requestId} -->\n`
    + `Authenticated paired Windows command: **${result.action} / ${result.state}**\n\n`
    + `- Host: \`${result.hostId}\`\n- Scope: ${result.scope ? `\`${result.scope}\`` : "not assigned"}\n`
    + `- Exact head: ${result.exactSha ? `\`${result.exactSha}\`` : "not reported"}\n`
    + `- Cancellation acknowledged: ${result.cancellationAcknowledged}\n- Child exit observed: ${result.childExitObserved}\n`
    + `- STOP disposition: ${result.stopDisposition || "not applicable"}\n- Owned descendants verified gone: false\n`
    + `- Browser UAT proven: false\n- Independent verification: false\n- Merge eligible: false\n\n`
    + "This receipt confirms only authenticated command admission and the bounded local runner response. Silence or an expired request is OFFLINE/UNKNOWN, never PASS.";
}

export function createGitHubControlClient({ repository, execute = runFile } = {}) {
  if (!REPOSITORY.test(repository || "")) throw new Error("GitHub control client requires owner/repository.");
  const api = async (args) => {
    const result = await execute("gh", ["api", "-H", "Accept: application/vnd.github+json", ...args], {
      cwd: REPO, encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024,
    });
    return String(result.stdout || "");
  };
  return Object.freeze({
    async listOpen(label) {
      const json = await api([`repos/${repository}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=20`]);
      const issues = JSON.parse(json);
      return issues.filter((item) => !item.pull_request);
    },
    async hasResult(issueNumber, requestId) {
      const json = await api([`repos/${repository}/issues/${issueNumber}/comments?per_page=100`]);
      return JSON.parse(json).some((comment) => String(comment.body || "").includes(`<!-- ${RESULT_MARKER}:${requestId} -->`));
    },
    async publish(issueNumber, result) {
      await api(["--method", "POST", `repos/${repository}/issues/${issueNumber}/comments`, "-f", `body=${renderResultComment(result)}`]);
    },
    async close(issueNumber) {
      await api(["--method", "PATCH", `repos/${repository}/issues/${issueNumber}`, "-f", "state=closed"]);
    },
  });
}

export async function pollWindowsGitHubControlOnce({
  appRoot = DEFAULT_APP_ROOT,
  client,
  now = Date.now,
  execute = executeWindowsGitHubControlIssue,
} = {}) {
  const pairing = await readWindowsGitHubPairing({ appRoot });
  if (!pairing.enabled) return Object.freeze({ state: "OFF", processed: 0, reason: pairing.reason });
  const github = client || createGitHubControlClient({ repository: pairing.repository });
  const issues = (await github.listOpen(pairing.label)).sort((left, right) => left.number - right.number);
  const results = [];
  for (const issue of issues.slice(0, 10)) {
    if (issue.user?.login !== pairing.authorizedActor) continue;
    let requestId = null;
    let result;
    try {
      const parsed = parseWindowsGitHubControlIssue(issue, pairing, { now: now() });
      requestId = parsed.request.requestId;
    } catch (error) {
      void error;
      result = Object.freeze({ schemaVersion: 1, requestId: requestId || "invalid", hostId: pairing.hostId,
        action: "denied", state: "DENIED_INVALID_ENVELOPE", scope: null, exactSha: null,
        cancellationAcknowledged: false, childExitObserved: false, evidenceSha256: null,
        pairedControlAuthenticated: false, browserUatProven: false, independentVerification: false,
        mergeEligible: false, modelDispatchAllowed: false, deduplicated: false, replayed: false });
    }
    if (!result) result = await execute(issue, { appRoot, now });
    if (!(await github.hasResult(issue.number, result.requestId))) await github.publish(issue.number, result);
    await github.close(issue.number);
    results.push(result);
  }
  return Object.freeze({ state: "POLL_COMPLETE", processed: results.length, results: Object.freeze(results) });
}

function parseCli(args) {
  const modes = ["--pair", "--disable", "--pairing-status", "--poll-once"].filter((item) => args.includes(item));
  if (modes.length !== 1) throw new Error("Paired Windows control requires exactly one local operation.");
  const values = {};
  const allowed = new Set(["--repo", "--actor", "--consent"]);
  for (let index = 0; index < args.length; index += 1) {
    if (modes.includes(args[index])) continue;
    if (!allowed.has(args[index]) || values[args[index]] !== undefined || !args[index + 1]?.trim()) {
      throw new Error("Paired Windows control received an unknown, duplicate or missing option.");
    }
    values[args[index]] = args[++index];
  }
  const mode = modes[0].slice(2);
  if (mode === "pair") return { mode, repository: values["--repo"], authorizedActor: values["--actor"], consent: values["--consent"] };
  if (Object.keys(values).length) throw new Error("This paired Windows control operation takes no additional options.");
  return { mode };
}

async function main() {
  const command = parseCli(process.argv.slice(2));
  let result;
  if (command.mode === "pair") result = await pairWindowsGitHubControl(command);
  else if (command.mode === "disable") result = await disableWindowsGitHubControl();
  else if (command.mode === "pairing-status") result = await readWindowsGitHubPairing();
  else result = await pollWindowsGitHubControlOnce();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
