import test from "node:test";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateSupervisorConsent, enableSupervisor, reenableSupervisor, disableSupervisor,
  supervisorStatus, supervisorCycle, serveSupervisor, pauseSupervisor, resumeSupervisor,
} from "../scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs";

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
  await assert.rejects(reenableSupervisor({ appRoot: root, platform: "win32", consent: "yes", head, paired }),
    /LOCAL_WINDOWS_CONSENT_REQUIRED/);
  const resumed = await reenableSupervisor({ appRoot: root, platform: "win32", consent: CONSENT, head, paired });
  assert.equal(resumed.state, "ENABLED_NOT_RUNNING");
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "OFFLINE");
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
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "OFFLINE");
}));

test("#3142 PAUSE request is not ACK until worker observes it; RESUME has same exact host authority", () => sandbox(async root => {
  await enable(root);
  const opts = { appRoot: root, platform: "win32", consent: CONSENT, head, paired, now };
  const first = await pauseSupervisor(opts);
  assert.equal(first.state, "PAUSE_REQUESTED");
  assert.equal(first.pauseAcknowledged, false);
  const pending = await supervisorStatus({ appRoot: root, now });
  assert.equal(pending.state, "PAUSE_REQUESTED");
  assert.equal(pending.pauseAcknowledged, false);
  assert.equal(pending.reason, "NO_FRESH_OWNED_HEARTBEAT");
  const repeat = await pauseSupervisor(opts);
  assert.equal(repeat.alreadyRequested, true);

  let polls = 0, queueReads = 0;
  const cycle = () => supervisorCycle({
    appRoot: root, platform: "win32", head, paired, now,
    queue: async () => { queueReads++; return { eligible: 1 }; },
    poll: async () => { polls++; return { state: "POLL_COMPLETE", processed: 1 }; },
  });
  const paused = await cycle();
  assert.equal(paused.state, "PAUSED");
  assert.equal(paused.remoteProcessed, 0);
  assert.equal(paused.agentExecutionProven, false);
  assert.equal(polls, 0);
  assert.equal(queueReads, 0);
  const ack = await supervisorStatus({ appRoot: root, now });
  assert.equal(ack.state, "PAUSED");
  assert.equal(ack.pauseAcknowledged, true);
  assert.equal(ack.autonomousPrLifecycleProven, false);

  const resume = await resumeSupervisor(opts);
  assert.equal(resume.state, "RESUME_REQUESTED");
  assert.equal(resume.workerRunningProven, false);
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "RESUME_REQUESTED");
  assert.equal((await resumeSupervisor(opts)).alreadyResumed, true);
  const running = await cycle();
  assert.equal(running.state, "RUNNING");
  assert.equal(polls, 1);
  assert.equal(queueReads, 1);
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "RUNNING");
}));

test("#3142 pause arriving during queue observation does not authorize the next remote poll", () => sandbox(async root => {
  await enable(root);
  let polls = 0;
  const mid = await supervisorCycle({
    appRoot: root, platform: "win32", head, paired, now,
    queue: async () => {
      await pauseSupervisor({ appRoot: root, platform: "win32", consent: CONSENT, head, paired, now });
      return { eligible: 1 };
    },
    poll: async () => { polls++; return { state: "POLL_COMPLETE", processed: 1 }; },
  });
  assert.equal(mid.state, "PAUSE_REQUESTED");
  assert.equal(mid.remoteProcessed, 0);
  assert.equal(polls, 0);
  const acknowledged = await supervisorCycle({
    appRoot: root, platform: "win32", head, paired, now,
    queue: async () => { throw Error("paused queue must not inspect"); },
    poll: async () => { throw Error("paused control must not poll"); },
  });
  assert.equal(acknowledged.state, "PAUSED");
  assert.equal((await supervisorStatus({ appRoot: root, now })).pauseAcknowledged, true);
}));

test("#3142 STOP supersedes PAUSE and forbids RESUME; restart never replays a paused request", () => sandbox(async root => {
  await enable(root);
  const opts = { appRoot: root, platform: "win32", consent: CONSENT, head, paired, now };
  await pauseSupervisor(opts);
  const stop = await disableSupervisor({ appRoot: root, now });
  assert.equal(stop.state, "STOP_REQUESTED");
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "STOP_REQUESTED");
  await assert.rejects(resumeSupervisor(opts), /LOCAL_STOP_REQUIRES_OPERATOR_REENABLE/);
  await assert.rejects(pauseSupervisor(opts), /LOCAL_STOP_REQUIRES_OPERATOR_REENABLE/);
  const stopped = await supervisorCycle({ appRoot: root, platform: "win32", head, paired, now,
    queue: async () => { throw Error("no polling after STOP"); },
    poll: async () => { throw Error("no polling after STOP"); } });
  assert.equal(stopped.state, "STOPPED");
  await reenableSupervisor(opts);
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "OFFLINE");
  assert.equal((await resumeSupervisor(opts)).alreadyResumed, true);
}));

test("#3142 stale SHA/pairing, corrupt private PAUSE and expired heartbeat block safely", () => sandbox(async root => {
  await enable(root);
  const opts = { appRoot: root, platform: "win32", consent: CONSENT, head, paired, now };
  await assert.rejects(pauseSupervisor({ ...opts, head: async () => "b".repeat(40) }), /STALE_SOURCE_HEAD/);
  await assert.rejects(pauseSupervisor({ ...opts, paired: async () => ({ ...PAIRING, hostId: "forged-host" }) }), /PAIRING_CHANGED_OR_DISABLED/);
  await pauseSupervisor(opts);
  await assert.rejects(resumeSupervisor({ ...opts, head: async () => "b".repeat(40) }), /STALE_SOURCE_HEAD/);
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "PAUSE_REQUESTED");
  const pauseFile = path.join(folder(root), "pause-request.json");
  await writeFile(pauseFile, JSON.stringify({ schemaVersion: 1, sourceHead: "b".repeat(40),
    hostId: PAIRING.hostId, requestedAt: now() }) + "\n");
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "BLOCKED");
  let called = false;
  const failed = await supervisorCycle({ appRoot: root, platform: "win32", head, paired, now,
    queue: async () => { called = true; return { eligible: 1 }; },
    poll: async () => { called = true; return { state: "POLL_COMPLETE", processed: 1 }; } });
  assert.equal(failed.reason, "PAUSE_REQUEST_UNVERIFIABLE");
  assert.equal(called, false);
  await assert.rejects(resumeSupervisor(opts), /PAUSE_REQUEST_UNVERIFIABLE/);
}));

test("#3142 real local Node supervisor loop honors PAUSE without dispatch (Windows runner fixture)", {
  skip: process.platform !== "win32" || process.env.PLOTPICKLE_NATIVE_SUPERVISOR_PAUSE !== "1",
  timeout: 15_000,
}, () => sandbox(async root => {
  await enable(root);
  let calls = 0;
  const opts = { appRoot: root, platform: process.platform, consent: CONSENT, head, paired, now };
  await pauseSupervisor(opts);
  const result = await serveSupervisor({
    appRoot: root, consent: CONSENT, platform: process.platform, now, maxCycles: 2,
    cycle: args => supervisorCycle({ ...args, platform: process.platform, head, paired, now,
      queue: async () => { calls++; throw Error("must not inspect paused work"); },
      poll: async () => { calls++; throw Error("must not poll paused work"); } }),
    delay: async () => {},
  });
  assert.equal(result.state, "STOPPED");
  assert.equal(calls, 0);
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "PAUSE_REQUESTED",
    "terminal stale heartbeat is not proof of a still-running worker");
  assert.equal((await resumeSupervisor(opts)).workerRunningProven, false);
}));

test("#3142 independent Windows logon plan never starts or modifies the legacy Pi factory", async () => {
  const script = await readFile(new URL("../scripts/engineering-team/windows/supervisor/Install-PlotPickleIndependentSupervisor.ps1", import.meta.url), "utf8");
  assert.match(script, /PlotPickleIndependentSupervisor/);
  assert.match(script, /PlotPickleSoftwareFactory/);
  assert.match(script, /LEGACY_PI_FACTORY_TASK_PRESENT_DISABLE_SEPARATELY/);
  // A separate Pi task can be registered *after* our initial install, so Start
  // must refuse that too; otherwise the two schedules could run side by side.
  const startMode = script.slice(script.indexOf("if ($Start) {"), script.indexOf("if ($Uninstall) {"));
  assert.match(startMode, /Get-TaskByName \$legacyTask/);
  assert.match(startMode, /LEGACY_PI_FACTORY_TASK_PRESENT_DISABLE_SEPARATELY/);
  assert.match(script, /unattended-supervisor\.mjs/);
  assert.match(script, /--serve --consent/);
  assert.match(script, /ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR/);
  assert.match(script, /-AtLogOn -User \$identity/);
  assert.match(script, /-MultipleInstances IgnoreNew/);
  assert.match(script, /-RestartCount 3 -RestartInterval \(New-TimeSpan -Minutes 5\) -StartWhenAvailable/);
  assert.match(script, /AtLogOn\/Interactive cannot guarantee startup before a user signs in/);
  assert.match(script, /-LogonType Interactive -RunLevel Limited/);
  assert.match(script, /SUPERVISOR_TASK_OWNERSHIP_UNVERIFIED/);
  assert.match(script, /TRACKED_SOURCE_NOT_CLEAN/);
  assert.match(script, /SUPERVISOR_NOT_OFFLINE_ON_CURRENT_HEAD/);
  assert.match(script, /SUPERVISOR_TASK_MAY_STILL_BE_RUNNING_REQUEST_STOP_FIRST/);
  assert.match(script, /START_REQUESTED_UNCONFIRMED/);
  assert.match(script, /STOP_REQUESTED_UNCONFIRMED/);
  assert.doesNotMatch(script, /Start-ScheduledTask\s+-TaskName\s+\$legacyTask/);
  // Only executable PowerShell lines count; explanatory comments that name
  // forbidden operations are not an execution path.
  const executable = script.replace(/<#[\s\S]*?#>/gu, "")
    .split(/\r?\n/u).filter(line => !line.trimStart().startsWith("#")).join("\n");
  assert.doesNotMatch(executable, /Stop-ScheduledTask|taskkill|TerminateProcess|--merge|--code|autonomous-queue\.mjs/u);
});

test("#3142 native Windows PowerShell logon installer denies unauthorized install/start/uninstall and reports only observation", {
  skip: process.platform !== "win32" || process.env.PLOTPICKLE_NATIVE_SUPERVISOR_INSTALL_FIXTURE !== "1",
  timeout: 25_000,
}, () => {
  const file = new URL("../scripts/engineering-team/windows/supervisor/Install-PlotPickleIndependentSupervisor.ps1", import.meta.url);
  const script = fileURLToPath(file);
  const run = (args) => execFileSync("pwsh", ["-NoProfile", "-NonInteractive", "-File", script, ...args], {
    windowsHide: true, encoding: "utf8", timeout: 8000,
  });
  // All denial probes exit before Get-ScheduledTask/Register/Start/Unregister.
  for (const arguments_ of [
    [], ["-Install"], ["-Start"], ["-Uninstall"],
    ["-Install", "-Consent", "WRONG_CONSENT"],
    ["-Start", "-Consent", "WRONG_CONSENT"],
    ["-Uninstall", "-Consent", "WRONG_CONSENT"],
  ]) {
    assert.throws(() => run(arguments_), /Command failed/, String(arguments_));
  }
  const result = JSON.parse(run(["-Status"]));
  assert.equal(result.state, "OBSERVED_NOT_INDEPENDENTLY_VERIFIED");
  assert.equal(result.workerProcessVerified, false);
  assert.equal(result.autonomousCodingVerified, false);
  assert.equal(result.automaticMergeEnabled, false);
  assert.equal(result.taskInstalled, false, "disposable Windows CI must not have installed a supervisor task");
});

test("#3142 malformed STOP marker blocks status, polling and startup rather than being ignored", () => sandbox(async root => {
  await enable(root);
  const opts = { appRoot: root, platform: "win32", consent: CONSENT, head, paired, now };
  await writeFile(path.join(folder(root), "stop-request.json"), "{invalid JSON\n");
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "STOP_REQUESTED");
  let calls = 0;
  const result = await supervisorCycle({ ...opts,
    queue: async () => { calls++; return { eligible: 1 }; },
    poll: async () => { calls++; return { state: "POLL_COMPLETE", processed: 1 }; },
  });
  assert.equal(result.state, "STOPPED");
  assert.equal(result.reason, "LOCAL_KILL_SWITCH");
  assert.equal(calls, 0);
  await assert.rejects(pauseSupervisor(opts), /LOCAL_STOP_REQUIRES_OPERATOR_REENABLE/);
  await assert.rejects(resumeSupervisor(opts), /LOCAL_STOP_REQUIRES_OPERATOR_REENABLE/);
  await assert.rejects(serveSupervisor({ appRoot: root, platform: "win32",
    consent: CONSENT, maxCycles: 1 }), /LOCAL_STOP_REQUIRES_OPERATOR_REENABLE/);
}));

test("#3142 STOP arriving during queue inspection prevents the next remote poll", () => sandbox(async root => {
  await enable(root);
  let polled = false;
  const result = await supervisorCycle({ appRoot: root, platform: "win32", head, paired, now,
    queue: async () => {
      await writeFile(path.join(folder(root), "stop-request.json"), "{unreadable\n");
      return { eligible: 1 };
    },
    poll: async () => { polled = true; return { state: "POLL_COMPLETE", processed: 1 }; },
  });
  assert.equal(result.state, "STOPPED");
  assert.equal(result.remoteProcessed, 0);
  assert.equal(polled, false);
}));

test("#3142 STOP during in-flight poll preserves observed work but never reports RUNNING", () => sandbox(async root => {
  await enable(root);
  const result = await supervisorCycle({ appRoot: root, platform: "win32", head, paired, now,
    queue: async () => ({ eligible: 1 }),
    poll: async () => {
      await writeFile(path.join(folder(root), "stop-request.json"), "{unreadable\n");
      return { state: "POLL_COMPLETE", processed: 1 };
    },
  });
  assert.equal(result.state, "STOP_REQUESTED");
  assert.equal(result.reason, "LOCAL_KILL_SWITCH");
  assert.equal(result.remoteProcessed, 1, "already observed in-flight work is not erased");
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "STOP_REQUESTED");
}));

test("#3142 supervisor exits promptly when STOP arrives between bounded cycles", () => sandbox(async root => {
  await enable(root);
  let cycles = 0;
  const result = await serveSupervisor({ appRoot: root, platform: "win32",
    consent: CONSENT, now, maxCycles: 2,
    cycle: async () => {
      cycles++;
      await writeFile(path.join(folder(root), "stop-request.json"), "{invalid\n");
      return { state: "RUNNING" };
    },
    delay: async () => { throw Error("STOP must not wait for another cycle"); },
  });
  assert.equal(result.state, "STOPPED");
  assert.equal(cycles, 1);
}));

test("#3142 malformed or escalated supervisor authority cannot report online or poll", () => sandbox(async root => {
  await enable(root);
  const enabledPath = path.join(folder(root), "enabled.json");
  const original = JSON.parse(await readFile(enabledPath, "utf8"));
  // First establish a genuine heartbeat. An altered grant must invalidate
  // that heartbeat instead of allowing a stale RUNNING observation.
  await supervisorCycle({ appRoot: root, platform: "win32", head, paired, now,
    queue: async () => ({ eligible: 0 }),
    poll: async () => ({ state: "POLL_COMPLETE", processed: 0 }) });
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "RUNNING");
  const invalid = [
    { ...original, modelDispatchAllowed: true },
    { ...original, sourceMutationAllowed: true },
    { ...original, autonomousMergeAllowed: true },
    { ...original, remoteControlScope: "unbounded" },
    { ...original, hostId: "forged" },
    { schemaVersion: 1, sourceHead: SHA, hostId: PAIRING.hostId },
  ];
  let remoteCalls = 0;
  for (const record of invalid) {
    await writeFile(enabledPath, JSON.stringify(record) + "\n");
    const observed = await supervisorStatus({ appRoot: root, now });
    assert.equal(observed.state, "BLOCKED");
    assert.equal(observed.reason, "SUPERVISOR_AUTHORITY_UNVERIFIABLE");
    const cycle = await supervisorCycle({ appRoot: root, platform: "win32", head, paired, now,
      queue: async () => { remoteCalls++; return { eligible: 1 }; },
      poll: async () => { remoteCalls++; return { state: "POLL_COMPLETE", processed: 1 }; } });
    assert.equal(cycle.state, "BLOCKED");
    assert.equal(cycle.reason, "SUPERVISOR_AUTHORITY_UNVERIFIABLE");
    const opts = { appRoot: root, platform: "win32", consent: CONSENT, head, paired, now };
    await assert.rejects(pauseSupervisor(opts), /SUPERVISOR_AUTHORITY_UNVERIFIABLE/);
    await assert.rejects(resumeSupervisor(opts), /SUPERVISOR_AUTHORITY_UNVERIFIABLE/);
    await assert.rejects(reenableSupervisor(opts), /SUPERVISOR_AUTHORITY_UNVERIFIABLE/);
    await assert.rejects(serveSupervisor({ ...opts, maxCycles: 1 }),
      /SUPERVISOR_AUTHORITY_UNVERIFIABLE/);
  }
  assert.equal(remoteCalls, 0);
  await writeFile(enabledPath, JSON.stringify(original) + "\n");
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "RUNNING");
}));


test("#3142 malformed running lock never clears local STOP during explicit reenable", () => sandbox(async root => {
  await enable(root);
  const opts = { appRoot: root, platform: "win32", consent: CONSENT, head, paired, now };
  await disableSupervisor({ appRoot: root, now });
  const lock = path.join(folder(root), "running.lock");
  await writeFile(lock, "{malformed lock\\n");
  await assert.rejects(reenableSupervisor(opts), /SUPERVISOR_LOCKED_OR_STALE/);
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "STOP_REQUESTED");
  assert.match(await readFile(path.join(folder(root), "stop-request.json"), "utf8"), /localOperator/);
  await rm(lock);
  assert.equal((await reenableSupervisor(opts)).state, "ENABLED_NOT_RUNNING");
}));

test("#3142 Windows scheduled-task principal ownership uses SID and rejects a different account", {
  skip: process.platform !== "win32",
}, () => {
  const installer = fileURLToPath(new URL("../scripts/engineering-team/windows/supervisor/Install-PlotPickleIndependentSupervisor.ps1", import.meta.url));
  const powershell = [
    "$ErrorActionPreference = 'Stop'",
    "$source = [System.IO.File]::ReadAllText($env:PLOTPICKLE_INSTALLER)",
    "$begin = $source.IndexOf('function Test-TaskPrincipalIsCurrentUser')",
    "$end = $source.IndexOf('function Read-OwnedTask', $begin)",
    "if ($begin -lt 0 -or $end -le $begin) { throw 'OWNER_FUNCTION_MISSING' }",
    "Invoke-Expression $source.Substring($begin, $end - $begin)",
    "$current = [System.Security.Principal.WindowsIdentity]::GetCurrent()",
    "$short = ($current.Name -split [regex]::Escape([string][char]92))[-1]",
    "if (-not (Test-TaskPrincipalIsCurrentUser $current.Name)) { throw 'QUALIFIED_OWNER_REJECTED' }",
    "if (-not (Test-TaskPrincipalIsCurrentUser $current.User.Value)) { throw 'SID_OWNER_REJECTED' }",
    "if (-not (Test-TaskPrincipalIsCurrentUser $short)) { throw 'NORMALIZED_OWNER_REJECTED' }",
    "if (Test-TaskPrincipalIsCurrentUser 'NT AUTHORITY\\SYSTEM') { throw 'SYSTEM_ACCOUNT_ACCEPTED' }",
    "if (Test-TaskPrincipalIsCurrentUser 'nonexistent-plotpickle-user-3142') { throw 'UNKNOWN_ACCOUNT_ACCEPTED' }",
    "if (Test-TaskPrincipalIsCurrentUser '') { throw 'EMPTY_ACCOUNT_ACCEPTED' }",
  ].join("; ");
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", powershell], {
    windowsHide: true, timeout: 12000, env: { ...process.env, PLOTPICKLE_INSTALLER: installer },
  });
});

test("#3142 disposable Windows Task Scheduler registration retains SID ownership", {
  skip: process.platform !== "win32" || process.env.PLOTPICKLE_NATIVE_SUPERVISOR_INSTALL_FIXTURE !== "1",
  timeout: 30_000,
}, () => {
  const installer = fileURLToPath(new URL("../scripts/engineering-team/windows/supervisor/Install-PlotPickleIndependentSupervisor.ps1", import.meta.url));
  // Register an inert, uniquely named CI task; never touch the owner's
  // PlotPickleIndependentSupervisor task or start any registered action.
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$source = [System.IO.File]::ReadAllText($env:PLOTPICKLE_INSTALLER)",
    "$begin = $source.IndexOf('function Test-TaskPrincipalIsCurrentUser')",
    "$end = $source.IndexOf('function Read-OwnedTask', $begin)",
    "if ($begin -lt 0 -or $end -le $begin) { throw 'OWNER_FUNCTION_MISSING' }",
    "Invoke-Expression $source.Substring($begin, $end - $begin)",
    "$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name",
    "$name = 'PlotPickle-SID-CI-' + [guid]::NewGuid().ToString('N')",
    "$created = $false",
    "try {",
    "  $action = New-ScheduledTaskAction -Execute $env:ComSpec -Argument '/c exit 0'",
    "  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity",
    "  $principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited",
    "  $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -StartWhenAvailable",
    "  Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null",
    "  $created = $true",
    "  $task = Get-ScheduledTask -TaskName $name -ErrorAction Stop",
    "  if (-not (Test-TaskPrincipalIsCurrentUser ([string]$task.Principal.UserId))) { throw 'REGISTERED_OWNER_REJECTED' }",
    "  if ($task.State -ne 'Ready') { throw 'REGISTERED_TASK_NOT_READY' }",
    "  if ($task.Settings.RestartCount -ne 3) { throw 'BOUNDED_RESTART_COUNT_MISSING' }",
    "  if ($task.Settings.RestartInterval -ne 'PT5M') { throw 'BOUNDED_RESTART_INTERVAL_MISSING' }",
    "  if (-not $task.Settings.StartWhenAvailable) { throw 'MISSED_LOGON_RECOVERY_MISSING' }",
    "  if (Test-TaskPrincipalIsCurrentUser 'NT AUTHORITY\\SYSTEM') { throw 'FOREIGN_OWNER_ACCEPTED' }",
    "} finally {",
    "  if ($created) { Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction Stop }",
    "}",
  ].join("\n");
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    windowsHide: true, timeout: 25000, env: { ...process.env, PLOTPICKLE_INSTALLER: installer },
  });
});
