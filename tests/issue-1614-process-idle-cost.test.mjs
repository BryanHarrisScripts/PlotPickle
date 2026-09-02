import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { analyzeBaselines } from "../scripts/performance/analyze-real-machine-baselines.mjs";
import { processIdleWindowMs, summarizeProcessIdleSnapshots } from "../scripts/performance/measure-windows-process-idle.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#1411 Slice F summarizes only stable launcher-owned CPU deltas and reports process churn separately", () => {
  const before = [
    { pid: 100, parentPid: 1, name: "cmd.exe", commandLine: "cmd /c Start-PlotPickle.bat", workingSetBytes: 10_000, kernelTime100ns: 100_000, userTime100ns: 100_000 },
    { pid: 101, parentPid: 100, name: "node.exe", commandLine: "node vite.js", workingSetBytes: 100_000, kernelTime100ns: 200_000, userTime100ns: 300_000 },
    { pid: 102, parentPid: 100, name: "node.exe", commandLine: "node old-helper.mjs", workingSetBytes: 20_000, kernelTime100ns: 50_000, userTime100ns: 50_000 },
  ];
  const after = [
    { pid: 100, parentPid: 1, name: "cmd.exe", commandLine: "cmd /c Start-PlotPickle.bat", workingSetBytes: 11_000, kernelTime100ns: 110_000, userTime100ns: 110_000 },
    { pid: 101, parentPid: 100, name: "node.exe", commandLine: "node vite.js", workingSetBytes: 105_000, kernelTime100ns: 300_000, userTime100ns: 400_000 },
    { pid: 103, parentPid: 100, name: "node.exe", commandLine: "node full-story-builder-agent.mjs", workingSetBytes: 30_000, kernelTime100ns: 500_000, userTime100ns: 500_000 },
  ];

  const summary = summarizeProcessIdleSnapshots(before, after, 5_012.5, 100);
  assert.equal(processIdleWindowMs, 5_000);
  assert.equal(summary.reliability, "windows-cim-launcher-owned-process-tree");
  assert.equal(summary.rootObservedBefore, true);
  assert.equal(summary.rootObservedAfter, true);
  assert.equal(summary.stableProcessCount, 2);
  assert.equal(summary.appearedProcessCount, 1);
  assert.equal(summary.disappearedProcessCount, 1);
  assert.equal(summary.activeProcessCount, 2);
  assert.equal(summary.cpuTimeDeltaMs, 22);
  assert.equal(summary.workingSetBeforeBytes, 130_000);
  assert.equal(summary.workingSetAfterBytes, 146_000);
  assert.equal(summary.workingSetDeltaBytes, 16_000);
  assert.equal(summary.explicitAgentOrModelProcessCount, 1);
  assert.deepEqual(summary.appearedProcesses, [{ pid: 103, name: "node.exe", role: "explicit-agent-or-model" }]);
  assert.deepEqual(summary.disappearedProcesses, [{ pid: 102, name: "node.exe", role: "node-runtime" }]);
  assert.equal(summary.observerIncludedInOwnedTree, false);
  assert.equal(summary.gpuUsage.value, null);
});

test("#1411 Slice F keeps the CIM observer outside the owned tree and passes the launcher PID as data", async () => {
  const [observer, launcher] = await Promise.all([
    read("scripts/performance/measure-windows-process-idle.mjs"),
    read("scripts/performance/run-windows-startup-benchmark.mjs"),
  ]);
  assert.match(observer, /Get-CimInstance Win32_Process/);
  assert.match(observer, /PLOTPICKLE_BENCHMARK_ROOT_PID/);
  assert.match(observer, /spawn\("powershell\.exe"/);
  assert.match(observer, /observerIncludedInOwnedTree: false/);
  assert.match(observer, /not-measured-by-launcher-owned-process-tree/);
  assert.match(observer, /not-measured-by-windows-cim-process-snapshot/);
  assert.match(launcher, /measureWindowsProcessIdle\(\{ rootPid: child\.pid \}\)/);
  assert.match(launcher, /optionalCompanionMaintenanceSuppressed: true/);
});

test("#1411 baseline analyzer aggregates repeated launcher-owned idle process evidence without inventing GPU data", () => {
  const sample = (cpuTimeDeltaMs, workingSetAfterBytes, activeProcessCount) => ({
    benchmarkIssue: 1411,
    authoritative: true,
    mode: "warm-persistent-runtime",
    environment: {
      platform: "win32",
      arch: "x64",
      node: "v24.19.0",
      commit: "process-idle-head",
      plotpickleVersion: "1.0.0",
      afterglowFixture: "afterglow-v9",
      curriculumIdentity: "afterglow-v9-current-catalog",
      ppfStartingRevision: "9",
      buzzMode: "disabled",
      optionalIntegrations: [],
    },
    measurements: {
      navigation: [],
      memory: {},
      processIdle: {
        reliability: "windows-cim-launcher-owned-process-tree",
        observedWindowMs: 5_000,
        cpuTimeDeltaMs,
        workingSetAfterBytes,
        workingSetDeltaBytes: 1_000,
        activeProcessCount,
        processCountAfter: 3,
        appearedProcessCount: 0,
        disappearedProcessCount: 0,
        explicitAgentOrModelProcessCount: 0,
      },
    },
    result: { harnessHealthy: true, startupHealthy: true },
  });

  const report = analyzeBaselines([
    sample(10, 100_000, 1),
    sample(20, 110_000, 2),
    sample(30, 120_000, 3),
  ]);
  const idle = report.modes["warm-persistent-runtime"].processIdle;
  assert.equal(idle.samples, 3);
  assert.equal(idle.cpuTimeDeltaMs.mean, 20);
  assert.equal(idle.workingSetAfterBytes.mean, 110_000);
  assert.equal(idle.activeProcessCount.mean, 2);
  assert.equal(idle.explicitAgentOrModelProcessCount.mean, 0);
  assert.equal(idle.wholeMachineCpu.value, null);
  assert.equal(idle.gpuUsage.value, null);
});
