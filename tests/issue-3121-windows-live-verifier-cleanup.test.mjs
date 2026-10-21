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

test("#3121 a previously exited parent cannot certify orphaned descendant STOP, even with a free port", async () => {
  const { child, calls, options } = fixture({ checks: [true] });
  child.exitCode = 0;
  const result = await stopAndCleanupLiveVerifier(options);
  assert.equal(result.status, "blocked");
  assert.ok(result.failureCodes.includes("OWNED_SERVER_ALREADY_EXITED_BEFORE_STOP"));
  assert.ok(result.failureCodes.includes("SYNTHETIC_HOME_RETAINED_UNTIL_OWNERSHIP_VERIFIED"));
  assert.equal(calls.includes("owned-stop"), false, "do not claim a STOP after the parent already exited");
  assert.equal(calls.includes("cleanup-home"), false, "preserve possible orphan-held files");
  assert.equal(calls.includes("close-log"), true);
});

test("#3121 refuses synthetic-home deletion when the server log cannot be closed", async () => {
  const { calls, options } = fixture();
  options.serverLogHandle.close = async () => {
    calls.push("close-log");
    throw new Error("synthetic log remains locked");
  };
  const result = await stopAndCleanupLiveVerifier(options);
  assert.equal(result.status, "blocked");
  assert.ok(result.failureCodes.includes("SERVER_LOG_CLOSE_FAILED"));
  assert.ok(result.failureCodes.includes("SYNTHETIC_HOME_RETAINED_UNTIL_LOG_CLOSED"));
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
  assert.match(source, /const viteCli = path\.join\(repoRoot, "node_modules", "vite", "bin", "vite\.js"\)/u);
  assert.match(source, /spawnCommand\(node, \[viteCli, "--host", "127\.0\.0\.1", "--port", "4173", "--strictPort"\]/u);
  assert.doesNotMatch(source, /spawnCommand\(npm, \["run", "dev:local"/u);

  assert.match(source, /await stopAndCleanupLiveVerifier\(\{ server, serverLogHandle, home, node, serverEnv \}\)/u);
  assert.match(source, /await writeSummary\("fail", \{ \.\.\.recordedDetails, cleanup \}\)/u);
  assert.match(source, /OWNED_SERVER_ALREADY_EXITED_BEFORE_STOP/u);
  assert.doesNotMatch(source, /await writeSummary\("pass", recordedDetails\)/u);
  assert.match(source, /await writeSummary\("pass", \{ \.\.\.recordedDetails, cleanup \}\)/u);
  assert.ok(
    source.indexOf('await writeSummary("pass", { ...recordedDetails, cleanup })') >
      source.indexOf("const cleanup = await stopAndCleanupLiveVerifier("),
    "PASS must be committed only after owned STOP and cleanup",
  );
  assert.match(source, /if \(cleanup\.status !== "pass"\)[\s\S]*?return 1;/u);
  assert.doesNotMatch(source, /server\.kill\("SIGTERM"\)/u);
});

test("#3121 read-only WebMCP acceptance blocks optional media engine spawning at both gateway and PowerShell launch", async () => {
  const gateway = await readFile(new URL("../build/ai/comfyui-onboarding-gateway.ts", import.meta.url), "utf8");
  const starter = await readFile(new URL("../scripts/start-comfyui-background.ps1", import.meta.url), "utf8");
  const verifier = await readFile(new URL("../scripts/verification-webmcp-live.mjs", import.meta.url), "utf8");
  const ownership = JSON.parse(await readFile(new URL("../config/verification/ownership-map.json", import.meta.url), "utf8"));
  const localAiRule = ownership.rules.find((rule) => rule.id === "local-ai-readiness-runtime");
  assert.equal(localAiRule?.ownerLayer, "provider-runtime");
  assert.ok(localAiRule.include.includes("scripts/start-comfyui-background.ps1"));


  assert.match(verifier, /PLOTPICKLE_STARTUP_TESTING_MODE: "webmcp"/u);
  assert.match(verifier, /PLOTPICKLE_ACCEPTANCE_MODE: "1"/u);
  const approvalAt = gateway.indexOf("if (body.approved !== true)");
  const gatewayGuard = gateway.indexOf('process.env.PLOTPICKLE_STARTUP_TESTING_MODE === "webmcp"');
  const managedStart = gateway.indexOf("rememberStart(await startComfyUi())");
  assert.ok(approvalAt >= 0 && gatewayGuard > approvalAt && managedStart > gatewayGuard);
  assert.match(gateway.slice(gatewayGuard, managedStart), /sendJson\(response, 409/u);
  assert.match(gateway.slice(gatewayGuard, managedStart), /state: "acceptance-read-only"/u);
  assert.doesNotMatch(gateway.slice(gatewayGuard, managedStart), /startComfyUi\(\)|launchComfyWithManagedCli\(\)/u);

  const statusFunction = starter.indexOf("function Write-Status(");
  const psGuard = starter.indexOf('$env:PLOTPICKLE_STARTUP_TESTING_MODE -eq "webmcp"');
  const firstProcessStart = starter.indexOf("Start-Process ");
  assert.ok(statusFunction >= 0 && psGuard > statusFunction && firstProcessStart > psGuard);
  assert.match(starter.slice(psGuard, firstProcessStart), /Write-Status "acceptance-read-only"/u);
  assert.match(starter.slice(psGuard, firstProcessStart), /exit 0/u);
  assert.match(starter.slice(psGuard, firstProcessStart), /PLOTPICKLE_ACCEPTANCE_MODE -eq "1"/u);
});
