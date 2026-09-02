import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import process from "node:process";

export const processIdleWindowMs = 5_000;
export const processIdleSettleMs = 1_000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const snapshotScript = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$rootPid = [int]$env:PLOTPICKLE_BENCHMARK_ROOT_PID
$all = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine, WorkingSetSize, KernelModeTime, UserModeTime)
$owned = [System.Collections.Generic.HashSet[int]]::new()
[void]$owned.Add($rootPid)
$changed = $true
while ($changed) {
  $changed = $false
  foreach ($item in $all) {
    $parentPid = [int]$item.ParentProcessId
    $processId = [int]$item.ProcessId
    if ($owned.Contains($parentPid) -and $owned.Add($processId)) { $changed = $true }
  }
}
$selected = @($all | Where-Object { $owned.Contains([int]$_.ProcessId) } | ForEach-Object {
  [pscustomobject]@{
    pid = [int]$_.ProcessId
    parentPid = [int]$_.ParentProcessId
    name = [string]$_.Name
    commandLine = [string]$_.CommandLine
    workingSetBytes = [int64]$_.WorkingSetSize
    kernelTime100ns = [int64]$_.KernelModeTime
    userTime100ns = [int64]$_.UserModeTime
  }
})
ConvertTo-Json -Compress -Depth 4 -InputObject $selected
`;

function runPowerShellSnapshot(rootPid) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", snapshotScript], {
      env: { ...process.env, PLOTPICKLE_BENCHMARK_ROOT_PID: String(rootPid) },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`#1411 Windows process snapshot exited ${code}: ${stderr.trim() || "no diagnostic output"}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim() || "[]");
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (error) {
        reject(new Error(`#1411 Windows process snapshot returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  });
}

function totalCpu100ns(entry) {
  return Number(entry.kernelTime100ns || 0) + Number(entry.userTime100ns || 0);
}

function classifyOwnedProcess(entry) {
  const identity = `${entry.name || ""} ${entry.commandLine || ""}`.toLowerCase();
  if (/ollama|comfyui|full-story-builder-agent|ui-continuity-agent|creative-writer-uat/.test(identity)) return "explicit-agent-or-model";
  if (/vite|vinext/.test(identity)) return "core-server";
  if ((entry.name || "").toLowerCase() === "cmd.exe") return "launcher-shell";
  if ((entry.name || "").toLowerCase().includes("node")) return "node-runtime";
  return "launcher-descendant";
}

export function summarizeProcessIdleSnapshots(before, after, observedWindowMs, rootPid) {
  const beforeByPid = new Map(before.map((entry) => [Number(entry.pid), entry]));
  const afterByPid = new Map(after.map((entry) => [Number(entry.pid), entry]));
  const stable = [];
  for (const entry of after) {
    const prior = beforeByPid.get(Number(entry.pid));
    if (!prior) continue;
    const cpuTimeDeltaMs = Math.max(0, (totalCpu100ns(entry) - totalCpu100ns(prior)) / 10_000);
    const workingSetDeltaBytes = Number(entry.workingSetBytes || 0) - Number(prior.workingSetBytes || 0);
    stable.push({
      pid: Number(entry.pid),
      parentPid: Number(entry.parentPid),
      name: String(entry.name || "unknown"),
      role: classifyOwnedProcess(entry),
      cpuTimeDeltaMs: Number(cpuTimeDeltaMs.toFixed(2)),
      workingSetAfterBytes: Number(entry.workingSetBytes || 0),
      workingSetDeltaBytes,
    });
  }
  const appeared = after.filter((entry) => !beforeByPid.has(Number(entry.pid)));
  const disappeared = before.filter((entry) => !afterByPid.has(Number(entry.pid)));
  const workingSetBeforeBytes = before.reduce((sum, entry) => sum + Number(entry.workingSetBytes || 0), 0);
  const workingSetAfterBytes = after.reduce((sum, entry) => sum + Number(entry.workingSetBytes || 0), 0);
  const cpuTimeDeltaMs = stable.reduce((sum, entry) => sum + entry.cpuTimeDeltaMs, 0);
  const explicitAgentOrModelProcessCount = after.filter((entry) => classifyOwnedProcess(entry) === "explicit-agent-or-model").length;
  return {
    reliability: "windows-cim-launcher-owned-process-tree",
    requestedWindowMs: processIdleWindowMs,
    observedWindowMs: Number(observedWindowMs.toFixed(2)),
    rootPid,
    observerIncludedInOwnedTree: false,
    processCountBefore: before.length,
    processCountAfter: after.length,
    stableProcessCount: stable.length,
    appearedProcessCount: appeared.length,
    disappearedProcessCount: disappeared.length,
    activeProcessCount: stable.filter((entry) => entry.cpuTimeDeltaMs > 0).length,
    cpuTimeDeltaMs: Number(cpuTimeDeltaMs.toFixed(2)),
    workingSetBeforeBytes,
    workingSetAfterBytes,
    workingSetDeltaBytes: workingSetAfterBytes - workingSetBeforeBytes,
    rootObservedBefore: beforeByPid.has(Number(rootPid)),
    rootObservedAfter: afterByPid.has(Number(rootPid)),
    explicitAgentOrModelProcessCount,
    explicitAgentOrModelIdentityReliability: "launcher-owned process name and command-line classification only; work multiplexed inside the core server cannot be separated from server CPU time.",
    processes: stable.sort((left, right) => left.pid - right.pid),
    appearedProcesses: appeared.map((entry) => ({ pid: Number(entry.pid), name: String(entry.name || "unknown"), role: classifyOwnedProcess(entry) })),
    disappearedProcesses: disappeared.map((entry) => ({ pid: Number(entry.pid), name: String(entry.name || "unknown"), role: classifyOwnedProcess(entry) })),
    wholeMachineCpu: { value: null, reliability: "not-measured-by-launcher-owned-process-tree" },
    gpuUsage: { value: null, reliability: "not-measured-by-windows-cim-process-snapshot" },
  };
}

export async function measureWindowsProcessIdle({ rootPid }) {
  if (process.platform !== "win32") throw new Error("#1411 launcher-owned process idle evidence must run on Windows.");
  if (!Number.isInteger(rootPid) || rootPid <= 0) throw new Error("#1411 launcher-owned process idle evidence requires the real launcher PID.");
  await delay(processIdleSettleMs);
  const before = await runPowerShellSnapshot(rootPid);
  const started = performance.now();
  await delay(processIdleWindowMs);
  const after = await runPowerShellSnapshot(rootPid);
  return summarizeProcessIdleSnapshots(before, after, performance.now() - started, rootPid);
}
