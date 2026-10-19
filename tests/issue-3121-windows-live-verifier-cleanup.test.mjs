import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { stopAndCleanupLiveVerifier } from "../scripts/verification-webmcp-live.mjs";

function fixture({ checks = [true], cleanupFailures = 0, parentExits = true } = {}) {
  const calls = [];
  const child = { pid: 12345, exitCode: null, signalCode: null };
  let probes = 0;
  let cleanupAttempts = 0;
  const options = {
    server: child,
    serverLogHandle: { close: async () => { calls.push("close-log"); } },
    home: "disposable-synthetic-test-only",
    node: "node",
    serverEnv: {},
    stopTree: async (ownedChild) => {
      assert.equal(ownedChild, child, "only the spawned in-memory handle can be passed to STOP");
      calls.push("owned-stop");
      if (parentExits) child.exitCode = 0;
    },
    probePort: async () => {
      calls.push("probe-port");
      return checks[Math.min(probes++, checks.length - 1)];
    },
    cleanupHome: async () => {
      calls.push("cleanup-home");
      cleanupAttempts += 1;
      if (cleanupAttempts <= cleanupFailures) throw new Error("test-only locked synthetic file");
    },
    wait: async () => { calls.push("bounded-wait"); },
    maxPortChecks: 3,
  };
  return { child, calls, options };
}

test("#3121 stops only the owned test server and releases the port before deleting synthetic profile", async () => {
  const { calls, options } = fixture({ checks: [false, true] });
  const result = await stopAndCleanupLiveVerifier(options);
  assert.equal(result.status, "pass");
  assert.deepEqual(result.failureCodes, []);
  assert.equal(result.productionUatTreeTerminationProven, false);
  assert.deepEqual(calls, [
    "owned-stop", "probe-port", "bounded-wait", "probe-port", "close-log", "cleanup-home",
  ]);
});

test("#3121 will not delete the test home if the known parent cannot prove exit", async () => {
  const { calls, options } = fixture({ parentExits: false });
  const result = await stopAndCleanupLiveVerifier(options);
  assert.equal(result.status, "blocked");
  assert.ok(result.failureCodes.includes("OWNED_SERVER_PARENT_EXIT_UNCONFIRMED"));
  assert.ok(result.failureCodes.includes("SYNTHETIC_HOME_RETAINED_UNTIL_OWNERSHIP_VERIFIED"));
  assert.equal(calls.includes("cleanup-home"), false);
  assert.equal(calls.includes("close-log"), true);
});

test("#3121 occupied loopback port remains blocked; never guess the listener PID", async () => {
  const { calls, options } = fixture({ checks: [false] });
  const result = await stopAndCleanupLiveVerifier(options);
  assert.equal(result.status, "blocked");
  assert.ok(result.failureCodes.includes("VERIFIER_PORT_STILL_OCCUPIED"));
  assert.ok(result.failureCodes.includes("SYNTHETIC_HOME_RETAINED_UNTIL_OWNERSHIP_VERIFIED"));
  assert.equal(calls.filter((entry) => entry === "probe-port").length, 3);
  assert.equal(calls.includes("cleanup-home"), false);
});

test("#3121 an interrupted shutdown still closes the log and retains private synthetic home", async () => {
  const { calls, options } = fixture();
  options.stopTree = async () => { throw new Error("mock stop failure"); };
  const result = await stopAndCleanupLiveVerifier(options);
  assert.equal(result.status, "blocked");
  assert.ok(result.failureCodes.includes("OWNED_SERVER_STOP_UNVERIFIED"));
  assert.equal(calls.includes("close-log"), true);
  assert.equal(calls.includes("cleanup-home"), false);
});

test("#3121 cleanup retries only within verified disposable scope and fails closed after bounded attempts", async () => {
  const recovered = fixture({ cleanupFailures: 2 });
  const ok = await stopAndCleanupLiveVerifier(recovered.options);
  assert.equal(ok.status, "pass");
  assert.equal(recovered.calls.filter((item) => item === "cleanup-home").length, 3);

  const persistent = fixture({ cleanupFailures: 3 });
  const failed = await stopAndCleanupLiveVerifier(persistent.options);
  assert.equal(failed.status, "blocked");
  assert.deepEqual(failed.failureCodes, ["SYNTHETIC_HOME_CLEANUP_FAILED"]);
  assert.equal(persistent.calls.filter((item) => item === "cleanup-home").length, 3);
});

test("#3121 existing verifier keeps independent browser failure and cleanup failure red", async () => {
  const source = await readFile(new URL("../scripts/verification-webmcp-live.mjs", import.meta.url), "utf8");
  assert.match(source, /terminateVerificationProcessTree/u);
  assert.match(source, /Verification port 4173 is already occupied/u);
  assert.match(source, /await stopAndCleanupLiveVerifier\(\{ server, serverLogHandle, home, node, serverEnv \}\)/u);
  assert.match(source, /await writeSummary\("fail", \{ \.\.\.recordedDetails, cleanup \}\)/u);
  assert.match(source, /return 1;\s*\}\s*\}\s*\}/u);
  assert.doesNotMatch(source, /server\.kill\("SIGTERM"\)/u);
});
