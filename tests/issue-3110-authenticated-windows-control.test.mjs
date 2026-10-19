import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createGitHubControlClient,
  disableWindowsGitHubControl,
  executeWindowsGitHubControlIssue,
  pairWindowsGitHubControl,
  parseWindowsGitHubControlIssue,
  pollWindowsGitHubControlOnce,
  readWindowsGitHubPairing,
  renderWindowsGitHubControlIssue,
} from "../scripts/engineering-team/windows/paired-github-control.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);
const SCOPE = "c".repeat(64);
const REQUEST_ID = "d".repeat(32);
const NOW = Date.parse("2026-10-19T15:00:00.000Z");

async function sandbox(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-3110-paired-"));
  try { return await run(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}

async function paired(root) {
  return pairWindowsGitHubControl({
    repository: "BryanHarrisScripts/PlotPickle",
    authorizedActor: "BryanHarrisScripts",
    consent: "AUTHENTICATED_WINDOWS_CONTROL",
  }, {
    appRoot: root,
    now: () => new Date(NOW),
    random: () => Buffer.from("1".repeat(32), "hex"),
  });
}

function request(pairing, action = "start", requestId = REQUEST_ID) {
  return {
    schemaVersion: 1,
    kind: "github-authenticated-windows-control",
    requestId,
    hostId: pairing.hostId,
    action,
    issuedAt: "2026-10-19T14:59:00.000Z",
    expiresAt: "2026-10-19T15:05:00.000Z",
    parameters: action === "start"
      ? { head: HEAD, base: BASE, task: "issue-3110", attempt: 1 }
      : { scope: SCOPE },
  };
}

function issue(pairing, action = "start", requestId = REQUEST_ID) {
  const envelope = request(pairing, action, requestId);
  const rendered = renderWindowsGitHubControlIssue(envelope, pairing, { now: NOW });
  return {
    number: action === "start" ? 31101 : action === "status" ? 31102 : 31103,
    state: "open",
    title: rendered.title,
    body: rendered.body,
    user: { login: pairing.authorizedActor },
    labels: [{ name: pairing.label }],
  };
}

test("paired control is OFF by default and pairing requires exact local Human consent", () => sandbox(async root => {
  assert.deepEqual(await readWindowsGitHubPairing({ appRoot: root }), {
    state: "OFF", enabled: false, reason: "NOT_PAIRED",
  });
  await assert.rejects(pairWindowsGitHubControl({
    repository: "BryanHarrisScripts/PlotPickle", authorizedActor: "BryanHarrisScripts", consent: "yes",
  }, { appRoot: root }), /explicit local Human consent/);
  const pairing = await paired(root);
  assert.equal(pairing.enabled, true);
  assert.equal(pairing.hostId, `host-${"1".repeat(32)}`);
  assert.deepEqual(pairing.permissions, ["start", "status", "stop"]);
  await assert.rejects(paired(root), /EEXIST/);
  assert.equal((await disableWindowsGitHubControl({ appRoot: root, now: () => new Date(NOW) })).enabled, false);
  assert.equal((await readWindowsGitHubPairing({ appRoot: root })).reason, "LOCALLY_DISABLED");
  await assert.rejects(paired(root), /separately reviewed reset/);
}));

test("GitHub envelope binds exact actor, label, host, title, parameters and ten-minute lifetime", () => sandbox(async root => {
  const pairing = await paired(root);
  const valid = issue(pairing);
  const parsed = parseWindowsGitHubControlIssue(valid, pairing, { now: NOW });
  assert.equal(parsed.request.parameters.mode, "start");
  assert.equal(parsed.request.parameters.head, HEAD);
  const mutations = [
    { ...valid, user: { login: "Mallory" } },
    { ...valid, labels: [{ name: "bug" }] },
    { ...valid, title: `${valid.title} please` },
    { ...valid, body: `${valid.body}\nrun calc.exe` },
  ];
  for (const candidate of mutations) {
    assert.throws(() => parseWindowsGitHubControlIssue(candidate, pairing, { now: NOW }));
  }
  const wrongHost = request(pairing);
  wrongHost.hostId = `host-${"2".repeat(32)}`;
  assert.throws(() => renderWindowsGitHubControlIssue(wrongHost, pairing, { now: NOW }), /misbound/);
  const expired = request(pairing);
  expired.expiresAt = "2026-10-19T14:59:59.000Z";
  assert.throws(() => renderWindowsGitHubControlIssue(expired, pairing, { now: NOW }), /expired/);
  const overlong = request(pairing);
  overlong.expiresAt = "2026-10-19T15:20:00.000Z";
  assert.throws(() => renderWindowsGitHubControlIssue(overlong, pairing, { now: NOW }), /time window/);
  const extra = request(pairing);
  extra.parameters.command = "whoami";
  assert.throws(() => renderWindowsGitHubControlIssue(extra, pairing, { now: NOW }), /not exact/);
}));

test("authenticated start maps only to the existing runner and a duplicate never replays", () => sandbox(async root => {
  const pairing = await paired(root);
  const admitted = issue(pairing);
  const calls = [];
  const first = await executeWindowsGitHubControlIssue(admitted, {
    appRoot: root,
    now: () => NOW,
    start: async (config, options) => {
      calls.push({ config, options });
      return { status: "dispatched-unconfirmed", scope: SCOPE, exactSha: config.head };
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].config.mode, "start");
  assert.equal(calls[0].config.task, "issue-3110");
  assert.equal(first.state, "dispatched-unconfirmed");
  assert.equal(first.browserUatProven, false);
  assert.equal(first.independentVerification, false);
  assert.equal(first.mergeEligible, false);
  assert.equal(first.modelDispatchAllowed, false);
  const duplicate = await executeWindowsGitHubControlIssue(admitted, {
    appRoot: root,
    now: () => NOW,
    start: async () => { throw new Error("duplicate start must not execute"); },
  });
  assert.equal(duplicate.deduplicated, true);
  assert.equal(duplicate.replayed, false);
  assert.equal(calls.length, 1);
}));

test("a crash after reservation remains STARTED_UNCONFIRMED and cannot replay", () => sandbox(async root => {
  const pairing = await paired(root);
  const admitted = issue(pairing);
  await assert.rejects(executeWindowsGitHubControlIssue(admitted, {
    appRoot: root,
    now: () => NOW,
    start: async () => { throw new Error("uncertain launch boundary"); },
  }), /uncertain launch boundary/);
  const duplicate = await executeWindowsGitHubControlIssue(admitted, {
    appRoot: root,
    now: () => NOW,
    start: async () => { throw new Error("must not replay"); },
  });
  assert.equal(duplicate.state, "STARTED_UNCONFIRMED");
  assert.equal(duplicate.deduplicated, true);
  assert.equal(duplicate.replayed, false);
}));

test("status and stop preserve runner truth and do not invent cancellation acknowledgement", () => sandbox(async root => {
  const pairing = await paired(root);
  let statuses = 0;
  let stops = 0;
  const statusResult = await executeWindowsGitHubControlIssue(issue(pairing, "status", "e".repeat(32)), {
    appRoot: root,
    now: () => NOW,
    status: async scope => {
      statuses += 1;
      assert.equal(scope, SCOPE);
      return { state: "running-heartbeat", scope, exactSha: HEAD };
    },
  });
  assert.equal(statusResult.state, "running-heartbeat");
  assert.equal(statusResult.cancellationAcknowledged, false);
  const stopResult = await executeWindowsGitHubControlIssue(issue(pairing, "stop", "f".repeat(32)), {
    appRoot: root,
    now: () => NOW,
    stop: async scope => {
      stops += 1;
      return { state: "stop-requested", scope, exactSha: HEAD, cancellationAcknowledged: false };
    },
  });
  assert.equal(statuses, 1);
  assert.equal(stops, 1);
  assert.equal(stopResult.state, "stop-requested");
  assert.equal(stopResult.cancellationAcknowledged, false);
  assert.equal(stopResult.childExitObserved, false);
  assert.equal(stopResult.stopDisposition,"STOP_UNVERIFIED");
  assert.equal(stopResult.ownedDescendantsVerifiedGone,false);
  const completedStop = await executeWindowsGitHubControlIssue(issue(pairing, "stop", "a".repeat(32)), {
    appRoot: root,
    now: () => NOW,
    stop: async scope => ({
      state: "observed-pass", scope, exactSha: HEAD,
      childExitObserved: true, cancellationAcknowledged: false,
      stopDisposition: "ALREADY_TERMINAL_NOOP",
    }),
  });
  assert.equal(completedStop.stopDisposition, "ALREADY_TERMINAL_NOOP");
  assert.equal(completedStop.childExitObserved,true);
  assert.equal(completedStop.ownedDescendantsVerifiedGone,false);
}));

test("one poll processes only the paired GitHub actor and publishes one bounded receipt", () => sandbox(async root => {
  const pairing = await paired(root);
  const admitted = issue(pairing, "status", "e".repeat(32));
  const ignored = { ...issue(pairing, "status", "f".repeat(32)), number: 31104, user: { login: "Mallory" } };
  const published = [];
  const closed = [];
  const result = await pollWindowsGitHubControlOnce({
    appRoot: root,
    now: () => NOW,
    client: {
      listOpen: async label => {
        assert.equal(label, pairing.label);
        return [ignored, admitted];
      },
      hasResult: async () => false,
      publish: async (number, receipt) => published.push({ number, receipt }),
      close: async number => closed.push(number),
    },
    execute: async incoming => {
      assert.equal(incoming.number, admitted.number);
      return {
        schemaVersion: 1, requestId: "e".repeat(32), hostId: pairing.hostId,
        action: "status", state: "running-heartbeat", scope: SCOPE, exactSha: HEAD,
        cancellationAcknowledged: false, childExitObserved: false, evidenceSha256: null,
        pairedControlAuthenticated: true, browserUatProven: false, independentVerification: false,
        mergeEligible: false, modelDispatchAllowed: false, deduplicated: false, replayed: false,
      };
    },
  });
  assert.equal(result.processed, 1);
  assert.deepEqual(closed, [admitted.number]);
  assert.equal(published.length, 1);
  assert.equal(published[0].receipt.state, "running-heartbeat");
  assert.equal(published[0].receipt.mergeEligible, false);
}));

test("GitHub transport uses argument arrays and never treats issue prose as a shell command", async () => {
  const calls = [];
  const client = createGitHubControlClient({
    repository: "BryanHarrisScripts/PlotPickle",
    execute: async (program, args, options) => {
      calls.push({ program, args, options });
      return { stdout: "[]" };
    },
  });
  await client.listOpen("plotpickle:windows-control");
  assert.equal(calls[0].program, "gh");
  assert.equal(Array.isArray(calls[0].args), true);
  assert.equal(calls[0].options.shell, undefined);
  assert.equal(calls[0].args.some(value => value.includes("calc.exe")), false);
  const source = await readFile(new URL("../scripts/engineering-team/windows/paired-github-control.mjs", import.meta.url), "utf8");
  assert.match(source, /execFile/);
  assert.doesNotMatch(source, /shell\s*:\s*true/);
  assert.doesNotMatch(source, /import\s*\{[^}]*\bexec\b[^}]*\}\s*from\s*["']node:child_process["']/s);
});
