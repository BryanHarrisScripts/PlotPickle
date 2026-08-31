import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createManagedPlotPickleLifecycle } from "../scripts/creative-uat/autonomous/application-lifecycle.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

test("#1569 scheduler recovers and reconciles durable state before Mastra workers can fire", async () => {
  const source = await read("build/autonomous-guest/mastra-wake-runtime.ts");
  const recoverIndex = source.indexOf("recoverAndReconcileAutonomousGuestSchedulerAfterRestart");
  const workerIndex = source.indexOf("await runtime.mastra.startWorkers()");
  assert.ok(recoverIndex >= 0, "restart recovery must be present");
  assert.ok(workerIndex > recoverIndex, "restart recovery must complete before workers start");
  assert.match(source, /restartRecovery/);
});

test("#1569 restart reconciliation removes terminal or orphaned schedules without executing work", async () => {
  const source = await read("build/autonomous-guest/recovery/schedule-reconciliation.ts");
  assert.match(source, /TERMINAL_STATES/);
  assert.match(source, /!task \|\| TERMINAL_STATES\.has\(task\.state\)/);
  assert.match(source, /deleteSchedule\(schedule\.id\)/);
  assert.match(source, /preservedScheduleIds\.push\(schedule\.id\)/);
  assert.match(source, /recoverAutonomousGuestSchedulerAfterRestart/);
  assert.doesNotMatch(source, /acquireAutonomousGuestTaskLease|completeAutonomousGuestTask|executeRoute|playwright|fetch\(|applyStory|writeProject|ppf|canonStore/i);
});

test("#1569 real PlotPickle application process exits and restarts on the same loopback endpoint", { timeout: 120_000 }, async () => {
  const repoRoot = path.resolve(new URL("../", import.meta.url).pathname);
  const temp = await mkdtemp(path.join(os.tmpdir(), "plotpickle-guest-restart-"));
  const port = await freePort();
  const lifecycle = createManagedPlotPickleLifecycle({
    repoRoot,
    baseUrl: `http://127.0.0.1:${port}/`,
    startupTimeoutMs: 90_000,
    shutdownTimeoutMs: 15_000,
    probeTimeoutMs: 2_000,
    env: {
      PLOTPICKLE_HOME: path.join(temp, "home"),
      PLOTPICKLE_AUTONOMOUS_GUEST_ENABLED: "true",
      PLOTPICKLE_AUTONOMOUS_RUN_ID: "scheduler-restart-proof",
      PLOTPICKLE_AUTONOMOUS_OPERATOR_ID: "plotpickle-scheduler-proof",
    },
  });

  try {
    const first = await lifecycle.start();
    assert.equal(first.started, true);
    const restart = await lifecycle.restart();
    assert.equal(restart.restarted, true);
    assert.equal(restart.stopped.stopped, true);
    assert.equal(restart.stopped.endpointUnavailable, true);
    assert.equal(restart.newProcessIdentity, true);
    assert.notEqual(restart.previousProcess.processIdentity, restart.currentProcess.processIdentity);
    assert.equal(restart.previousProcess.pid === restart.currentProcess.pid && restart.previousProcess.generation === restart.currentProcess.generation, false);
  } finally {
    const stopped = await lifecycle.stop();
    assert.equal(stopped.stopped, true);
    assert.equal(stopped.endpointUnavailable, true);
    await rm(temp, { recursive: true, force: true });
  }
});
