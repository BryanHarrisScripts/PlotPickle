import test from "node:test";
import assert from "node:assert/strict";
import { createTunnelWatchdogPolicy, WATCHDOG_RETRY_DELAYS_MS } from
  "../scripts/engineering-team/windows/tunnel/tunnel-watchdog-policy.mjs";

const child = () => ({ pid: 12345, exitCode: null, signalCode: null });
function fixture(overrides = {}) {
  let time = 100_000, enabled = true, stopped = false, port = "FREE";
  const started = [], reservations = [];
  const opts = {
    platform: "win32", now: () => time,
    ownerEnabled: async () => enabled,
    ownerStopRequested: async () => stopped,
    probeLocal: async () => ({ state: port }),
    verifyOwnerLauncher: async () => "C:\\PlotPickle\\Start-PlotPickle-Tunnel-Authenticated.ps1",
    reserveLaunch: async data => { reservations.push(data); return true; },
    startOwned: async launcher => { started.push(launcher); return child(); },
    ...overrides,
  };
  const watchdog = createTunnelWatchdogPolicy(opts);
  return { watchdog, started, reservations,
    setTime: t => { time = t; }, setEnabled: v => { enabled = v; },
    setStopped: v => { stopped = v; }, setPort: v => { port = v; } };
}

test("owner STOP and disabled prevent launch even with a free port", async () => {
  const f = fixture();
  f.setStopped(true);
  assert.equal((await f.watchdog.tick()).state, "OWNER_STOP_REQUESTED");
  f.setStopped(false); f.setEnabled(false);
  assert.equal((await f.watchdog.tick()).state, "OWNER_DISABLED");
  assert.equal(f.started.length, 0);
});

test("unowned or uncertain port never causes process adoption or launch", async () => {
  const f = fixture();
  f.setPort("LISTENING");
  const external = await f.watchdog.tick();
  assert.equal(external.state, "EXTERNAL_LISTENER_PRESENT");
  assert.equal(external.localListenerObserved, true);
  assert.equal(external.remoteAuthenticated, false);
  assert.equal(external.pluginReconnected, false);
  f.setPort("UNVERIFIED");
  assert.equal((await f.watchdog.tick()).state, "LOCAL_PROBE_UNVERIFIED");
  assert.equal(f.started.length, 0);
});

test("single reserved launch, grace, and no kill of an unhealthy owned child", async () => {
  const f = fixture();
  const launched = await f.watchdog.tick();
  assert.equal(launched.state, "OWNED_LAUNCH_REQUESTED");
  assert.equal(launched.processKillAuthorized, false);
  assert.deepEqual(f.reservations, [{ attempt: 1, at: 100_000 }]);
  assert.equal((await f.watchdog.tick()).state, "OWNED_LAUNCH_STARTING");
  f.setTime(125_000);
  assert.equal((await f.watchdog.tick()).state, "OWNED_PROCESS_UNHEALTHY_NO_KILL");
  assert.equal(f.started.length, 1);
});

test("exited owned child has bounded backoff, finite retries and no unowned kill", async () => {
  const children = [];
  const f = fixture({ startOwned: async () => { const p = child(); children.push(p); return p; } });
  assert.equal((await f.watchdog.tick()).state, "OWNED_LAUNCH_REQUESTED");
  let time = 100_000;
  for (let i = 0; i < WATCHDOG_RETRY_DELAYS_MS.length; i++) {
    children.at(-1).exitCode = 1;
    assert.equal((await f.watchdog.tick()).state, i === 2 ? "RESTART_BUDGET_EXHAUSTED" : "RESTART_BACKOFF");
    if (i === 2) break;
    time += WATCHDOG_RETRY_DELAYS_MS[i];
    f.setTime(time);
    assert.equal((await f.watchdog.tick()).state, "OWNED_LAUNCH_REQUESTED");
  }
  assert.equal(children.length, 3);
  assert.equal((await f.watchdog.tick()).state, "RESTART_BUDGET_EXHAUSTED");
});

test("missing durable reservation or uncertain spawn cannot be replayed", async () => {
  const noReservation = fixture({ reserveLaunch: async () => false });
  assert.equal((await noReservation.watchdog.tick()).state, "LAUNCH_RESERVATION_UNVERIFIED");
  assert.equal(noReservation.started.length, 0);
  let called = 0;
  const uncertain = fixture({ startOwned: async () => { called++; throw Error("uncertain"); } });
  assert.equal((await uncertain.watchdog.tick()).state, "LAUNCH_OUTCOME_UNVERIFIED");
  assert.equal((await uncertain.watchdog.tick()).state, "RESTART_BUDGET_EXHAUSTED");
  assert.equal(called, 1);
  let invalidCalls = 0;
  const invalid = fixture({ startOwned: async () => { invalidCalls++; return { pid: 0 }; } });
  assert.equal((await invalid.watchdog.tick()).state, "LAUNCH_OUTCOME_UNVERIFIED");
  assert.equal((await invalid.watchdog.tick()).state, "RESTART_BUDGET_EXHAUSTED");
  assert.equal(invalidCalls, 1);
});

test("non-Windows and unverifiable owner authority fail closed", async () => {
  const linux = fixture({ platform: "linux" });
  assert.equal((await linux.watchdog.tick()).state, "WINDOWS_ONLY");
  assert.equal(linux.started.length, 0);
  const unverified = fixture({ ownerEnabled: async () => { throw Error("private token"); } });
  const result = await unverified.watchdog.tick();
  assert.equal(result.state, "OWNER_AUTHORITY_UNVERIFIED");
  assert.doesNotMatch(JSON.stringify(result), /private token/);
});
