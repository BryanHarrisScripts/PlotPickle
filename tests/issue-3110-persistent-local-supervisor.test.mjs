import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  validateSupervisorConsent, enableSupervisor, disableSupervisor,
  supervisorStatus, supervisorCycle, serveSupervisor,
} from "../scripts/engineering-team/windows/unattended-supervisor.mjs";

const SHA = "a".repeat(40);
const CONSENT = "ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR";
const PAIRING = { enabled: true, hostId: "host-" + "1".repeat(32), authorizedActor: "BryanHarrisScripts" };
const paired = async () => PAIRING;
const head = async () => SHA;
const now = () => 1_800_000_000_000;
const folder = root => path.join(root, "engineering-team", "supervisor");
async function sandbox(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-3110-supervisor-"));
  try { return await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
const enable = appRoot => enableSupervisor({ appRoot, consent: CONSENT, platform: "win32", head, paired, now });

test("explicit opt-in refuses Linux, absent consent and unpaired host", () => sandbox(async root => {
  assert.equal(validateSupervisorConsent(CONSENT, "linux"), false);
  await assert.rejects(enableSupervisor({ appRoot: root, consent: CONSENT, platform: "linux", head, paired }), /LOCAL_WINDOWS_CONSENT_REQUIRED/);
  await assert.rejects(enableSupervisor({ appRoot: root, consent: "yes", platform: "win32", head, paired }), /LOCAL_WINDOWS_CONSENT_REQUIRED/);
  await assert.rejects(enableSupervisor({ appRoot: root, consent: CONSENT, platform: "win32",
    head, paired: async () => ({ enabled: false }) }), /PAIRED_HOST_REQUIRED/);
  assert.equal((await supervisorStatus({ appRoot: root })).state, "OFF");
}));
test("enable never starts the worker and OFFLINE is truthful without a fresh heartbeat", () => sandbox(async root => {
  const result = await enable(root);
  assert.equal(result.state, "ENABLED_NOT_RUNNING");
  assert.equal(result.sourceMutationAllowed, false);
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "OFFLINE");
  await assert.rejects(enable(root), /SUPERVISOR_ALREADY_ENABLED/);
}));
test("single cycle polls only the existing paired bounded control, inspects queue and emits private heartbeat", () => sandbox(async root => {
  await enable(root);
  let calls = 0;
  const result = await supervisorCycle({ appRoot: root, platform: "win32", head, paired, now,
    queue: async () => ({ state: "ADMITTED_NOT_EXECUTED", eligible: 2 }),
    poll: async () => { calls++; return { state: "POLL_COMPLETE", processed: 1 }; },
  });
  assert.equal(calls, 1);
  assert.equal(result.state, "RUNNING");
  assert.equal(result.queueEligible, 2);
  assert.equal(result.remoteProcessed, 1);
  assert.equal(result.agentExecutionProven, false);
  const report = await supervisorStatus({ appRoot: root, now });
  assert.equal(report.state, "RUNNING");
  assert.equal(report.autonomousPrLifecycleProven, false);
  const hb = JSON.parse(await readFile(path.join(folder(root), "heartbeat.json"), "utf8"));
  assert.equal(hb.sourceHead, SHA);
}));
test("GitHub outage is BLOCKED, never fabricated success", () => sandbox(async root => {
  await enable(root);
  const result = await supervisorCycle({ appRoot: root, platform: "win32", head, paired, now,
    queue: async () => ({ eligible: 1 }), poll: async () => { throw Error("network credentials"); } });
  assert.equal(result.state, "BLOCKED");
  assert.equal(result.reason, "GITHUB_TRANSPORT_OFFLINE");
  assert.equal(result.remoteProcessed, 0);
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "BLOCKED");
}));
test("stale checkout or changed pairing blocks polling without touching GitHub", () => sandbox(async root => {
  await enable(root);
  let called = 0;
  const opts = { appRoot: root, platform: "win32", now,
    queue: async () => ({ eligible: 1 }), poll: async () => { called++; return { state: "POLL_COMPLETE", processed: 1 }; } };
  assert.equal((await supervisorCycle({ ...opts, head: async () => "b".repeat(40), paired })).reason, "STALE_SOURCE_HEAD");
  assert.equal((await supervisorCycle({ ...opts, head, paired: async () => ({ ...PAIRING, hostId: "wrong" }) })).reason, "PAIRING_CHANGED_OR_DISABLED");
  assert.equal(called, 0);
}));
test("local STOP prevents further remote polls and service startup", () => sandbox(async root => {
  await enable(root);
  const stop = await disableSupervisor({ appRoot: root, now });
  assert.equal(stop.state, "STOP_REQUESTED");
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "STOP_REQUESTED");
  let called = false;
  const result = await supervisorCycle({ appRoot: root, platform: "win32", head, paired, now,
    poll: async () => { called = true; } });
  assert.equal(result.state, "STOPPED");
  assert.equal(called, false);
  await assert.rejects(serveSupervisor({ appRoot: root, platform: "win32", consent: CONSENT }), /LOCAL_STOP_REQUIRES_OPERATOR_REENABLE/);
}));
test("service runs bounded injected cycles and releases lock, never claims code or PRs", () => sandbox(async root => {
  await enable(root);
  let cycles = 0;
  const loop = () => serveSupervisor({ appRoot: root, consent: CONSENT, platform: "win32", maxCycles: 1,
    now, cycle: async () => { cycles++; return { state: "RUNNING" }; } });
  const first = await loop();
  assert.equal(first.state, "STOPPED");
  assert.equal(cycles, 1);
  assert.equal((await loop()).state, "STOPPED");
  assert.equal(cycles, 2);
}));
