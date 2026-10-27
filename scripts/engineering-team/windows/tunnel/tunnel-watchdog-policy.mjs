/**
 * #3142: deterministic, owner-scoped tunnel watchdog admission policy.
 * This is a testable decision core, not an installed Windows service.
 * An unowned listener is never adopted or killed. A failed owned child may
 * be restarted only after bounded backoff; local STOP is always authoritative.
 * Port presence is not proof of authenticated MCP or ChatGPT reconnection.
 */
export const WATCHDOG_RETRY_DELAYS_MS = Object.freeze([5_000, 15_000, 45_000]);
export const WATCHDOG_START_GRACE_MS = 20_000;

const report = (state, extra = {}) => Object.freeze({
  state, localListenerObserved: false,
  remoteAuthenticated: false, pluginReconnected: false,
  independentVerification: false, processKillAuthorized: false, ...extra,
});

/**
 * Caller supplies only owner-verified fixed-path launch and process observation.
 * No paths, credentials, commands, tokens, or process identifiers come from a
 * remote request. The host must durably reserve launch before calling start.
 */
export function createTunnelWatchdogPolicy({
  platform = process.platform,
  ownerEnabled, ownerStopRequested, probeLocal, verifyOwnerLauncher,
  reserveLaunch, startOwned, now = Date.now,
} = {}) {
  if (![ownerEnabled, ownerStopRequested, probeLocal, verifyOwnerLauncher,
    reserveLaunch, startOwned].every(fn => typeof fn === "function"))
    throw new TypeError("WATCHDOG_HOST_ADAPTER_REQUIRED");
  let owned = null, failures = 0, nextStartAt = 0, startedAt = 0;
  let exhausted = false, tickInFlight = null;
  const alive = () => owned && owned.exitCode === null && owned.signalCode === null;
  const observe = () => Object.freeze({
    ownedProcessObserved: Boolean(alive()), restartAttempts: failures,
    retryAfter: nextStartAt || null, restartBudgetExhausted: exhausted,
  });
  async function tickOnce() {
    if (platform !== "win32") return report("WINDOWS_ONLY", observe());
    // STOP and disabled states precede all probes, launch and retries.
    try {
      if (await ownerStopRequested()) return report("OWNER_STOP_REQUESTED", observe());
      if (!await ownerEnabled()) return report("OWNER_DISABLED", observe());
    } catch { return report("OWNER_AUTHORITY_UNVERIFIED", observe()); }
    let port;
    try { port = await probeLocal(); }
    catch { return report("LOCAL_PROBE_UNVERIFIED", observe()); }
    if (!port || !["FREE", "LISTENING", "UNVERIFIED"].includes(port.state))
      return report("LOCAL_PROBE_UNVERIFIED", observe());
    if (port.state === "UNVERIFIED") return report("LOCAL_PROBE_UNVERIFIED", observe());
    if (port.state === "LISTENING") {
      // Even an owned child plus open socket does not establish MCP identity.
      return report(alive() ? "OWNED_LISTENER_OBSERVED" : "EXTERNAL_LISTENER_PRESENT",
        { ...observe(), localListenerObserved: true });
    }
    const time = now();
    if (!Number.isSafeInteger(time) || time < 0)
      return report("CLOCK_UNVERIFIED", observe());
    if (alive()) return report(time - startedAt < WATCHDOG_START_GRACE_MS
      ? "OWNED_LAUNCH_STARTING" : "OWNED_PROCESS_UNHEALTHY_NO_KILL", observe());
    if (owned) {
      owned = null;
      failures++;
      if (failures >= WATCHDOG_RETRY_DELAYS_MS.length) exhausted = true;
      else nextStartAt = time + WATCHDOG_RETRY_DELAYS_MS[failures - 1];
    }
    if (exhausted) return report("RESTART_BUDGET_EXHAUSTED", observe());
    if (time < nextStartAt) return report("RESTART_BACKOFF", observe());
    let launcher;
    try { launcher = await verifyOwnerLauncher(); }
    catch { return report("OWNER_LAUNCHER_UNVERIFIED", observe()); }
    if (typeof launcher !== "string" || launcher.length === 0)
      return report("OWNER_LAUNCHER_UNVERIFIED", observe());
    // A failed reservation must prevent launch; no uncertain request replay.
    try {
      if (await reserveLaunch({ attempt: failures + 1, at: time }) !== true) {
        exhausted = true;
        return report("LAUNCH_RESERVATION_UNVERIFIED", observe());
      }
    } catch {
      exhausted = true;
      return report("LAUNCH_RESERVATION_UNVERIFIED", observe());
    }
    // A one-use reservation can outlive the owner's consent. Re-read STOP and
    // enablement immediately before spawn; consume the reservation on any
    // denial or uncertain read rather than launching or replaying it later.
    try {
      if (await ownerStopRequested()) {
        exhausted = true;
        return report("OWNER_STOP_REQUESTED", observe());
      }
      if (!await ownerEnabled()) {
        exhausted = true;
        return report("OWNER_DISABLED", observe());
      }
    } catch {
      exhausted = true;
      return report("OWNER_AUTHORITY_UNVERIFIED", observe());
    }
    try {
      const child = await startOwned(launcher);
      if (!child || !Number.isSafeInteger(child.pid) || child.pid <= 0 ||
          child.exitCode !== null || child.signalCode !== null) {
        exhausted = true;
        return report("LAUNCH_OUTCOME_UNVERIFIED", observe());
      }
      owned = child;
      startedAt = time;
      nextStartAt = 0;
      return report("OWNED_LAUNCH_REQUESTED", observe());
    } catch {
      // Spawn may have happened despite a thrown acknowledgement. Never retry.
      exhausted = true;
      return report("LAUNCH_OUTCOME_UNVERIFIED", observe());
    }
  }
  // Concurrent scheduler/health callbacks must not reserve or spawn twice.
  // Share the one pending decision; a settled tick allows a later fresh probe.
  function tick() {
    if (tickInFlight) return tickInFlight;
    const pending = tickOnce();
    tickInFlight = pending;
    pending.then(
      () => { if (tickInFlight === pending) tickInFlight = null; },
      () => { if (tickInFlight === pending) tickInFlight = null; },
    );
    return pending;
  }
  return Object.freeze({ tick, observe });
}
