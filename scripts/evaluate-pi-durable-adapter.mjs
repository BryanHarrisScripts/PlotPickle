#!/usr/bin/env node

import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveActiveNpmCommand, runPortableCommand } from "./pi-worker-runtime.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(await readFile(path.join(repoRoot, "config", "pi-durable-adapter.json"), "utf8"));
const artifactDir = path.join(repoRoot, ".artifacts", "pi-durable-2672");
const artifactPath = path.join(artifactDir, "evaluation.json");

async function main() {
  await mkdir(artifactDir, { recursive: true });
  const report = {
    schemaVersion: 1,
    issue: 2672,
    package: contract.package,
    candidateVersion: contract.candidateVersion,
    platform: process.platform,
    node: process.versions.node,
    status: "failed",
    checks: {},
  };
  let candidateRoot = "";
  try {
    candidateRoot = await mkdtemp(path.join(os.tmpdir(), "plotpickle-pi-durable-2672-"));
    await writeFile(path.join(candidateRoot, "package.json"), JSON.stringify({
      private: true,
      type: "module",
      dependencies: { [contract.package]: contract.candidateVersion },
    }, null, 2) + "\n", "utf8");

    await runPortableCommand(resolveActiveNpmCommand(), [
      "install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact",
    ], { cwd: candidateRoot, timeout: 8 * 60_000 });
    report.checks.install = { passed: true, package: `${contract.package}@${contract.candidateVersion}` };

    const manifest = JSON.parse(await readFile(path.join(candidateRoot, "node_modules", "@earendil-works", "pi-durable", "package.json"), "utf8"));
    if (manifest.version !== contract.candidateVersion) throw new Error(`Pi Durable version mismatch: ${manifest.version}`);
    if (manifest.engines?.node !== ">=22.19.0") throw new Error(`Unexpected Pi Durable Node engine: ${manifest.engines?.node}`);
    report.checks.manifest = { passed: true, version: manifest.version, nodeEngine: manifest.engines.node };

    if (contract.migrationFromVersion) {
      const previousRoot = path.join(candidateRoot, "previous-runtime");
      await mkdir(previousRoot, { recursive: true });
      await writeFile(path.join(previousRoot, "package.json"), JSON.stringify({
        private: true, type: "module", dependencies: { [contract.package]: contract.migrationFromVersion },
      }), "utf8");
      await runPortableCommand(resolveActiveNpmCommand(), [
        "install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact",
      ], { cwd: previousRoot, timeout: 8 * 60_000 });
      const previousManifest = JSON.parse(await readFile(path.join(previousRoot, "node_modules", "@earendil-works", "pi-durable", "package.json"), "utf8"));
      if (previousManifest.version !== contract.migrationFromVersion) throw new Error("Pi Durable previous-version migration fixture mismatch.");
      await writeFile(path.join(previousRoot, "plotpickle-previous-runtime.mjs"), [
        'export { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";',
        'export { createModels } from "@earendil-works/pi-ai/models";',
        'export { createRegistry, defineExtension, defineTask, Harness } from "@earendil-works/pi-durable";',
        'export { openNodeJsonlStorage } from "@earendil-works/pi-durable/storage/jsonl/node";',
      ].join("\n"), "utf8");
      report.checks.previousVersion = { passed: true, version: previousManifest.version, scope: "Fresh isolated package; not the historical installed dependency graph." };
    }

    const probePath = path.join(candidateRoot, "plotpickle-durable-probe.mjs");
    await writeFile(probePath, `
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { createRegistry, defineExtension, defineTask, Harness } from "@earendil-works/pi-durable";
import { openNodeJsonlStorage } from "@earendil-works/pi-durable/storage/jsonl/node";

const context = BACKGROUND_CONTEXT;
globalThis.fetch = async () => { throw new Error("Pi Durable compatibility probe must not call a provider."); };
const directory = await mkdtemp(path.join(os.tmpdir(), "plotpickle-pi-durable-runtime-"));
const storageDir = path.join(directory, "session");
let reached = 0;

const RecoveryTask = defineTask({
  name: "plotpickle.recovery-probe",
  version: 1,
  initial: () => ({ phase: "tick", n: 1 }),
  phases: {
    tick: async (task, runtime, taskContext) => {
      const n = task.state.checkpoint.n;
      reached = Math.max(reached, n);
      await runtime.commit(() => n >= 3
        ? { status: "terminal", outcome: { status: "completed", result: "recovered-to-3" } }
        : { status: "running", checkpoint: { phase: "tick", n: n + 1 } }, taskContext);
      if (n < 3) await runtime.sleep(Date.now() + 250, taskContext);
    },
  },
  abort: async (_task, runtime, taskContext) => {
    await runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), taskContext);
  },
});

const LabelTask = defineTask({
  name: "plotpickle.label-probe",
  version: 1,
  initial: () => ({ phase: "finish" }),
  phases: {
    finish: async (task, runtime, taskContext) => {
      await runtime.commit(() => ({ status: "terminal", outcome: { status: "completed", result: task.input.label } }), taskContext);
    },
  },
});

const registry = createRegistry();
registry.install(defineExtension({ name: "plotpickle-probe", tasks: [RecoveryTask, LabelTask] }));
let upgrade = null;
if (process.env.PLOTPICKLE_PI_DURABLE_PREVIOUS_RUNTIME === "1") {
  const previous = await import(pathToFileURL(path.join(process.cwd(), "previous-runtime", "plotpickle-previous-runtime.mjs")).href);
  const oldContext = previous.BACKGROUND_CONTEXT;
  const previousTask = previous.defineTask({ name: "plotpickle.label-probe", version: 1, initial: () => ({ phase: "finish" }), phases: {
    finish: async (task, runtime, taskContext) => runtime.commit(() => ({ status: "terminal", outcome: { status: "completed", result: task.input.label } }), taskContext),
  } });
  const oldRegistry = previous.createRegistry();
  oldRegistry.install(previous.defineExtension({ name: "plotpickle-probe", tasks: [previousTask] }));
  const upgradeStorage = path.join(directory, "upgrade-session");
  const old = await previous.Harness.open(await previous.openNodeJsonlStorage(upgradeStorage, oldContext), { models: previous.createModels(), registry: oldRegistry }, oldContext);
  const oldRoot = await old.root(oldContext);
  const taskId = await oldRoot.commit(tx => tx.createTask(previousTask, { label: "from-previous-version" }, { ownership: { kind: "conversation" } }), oldContext);
  old.resume();
  await old.waitForTask(taskId, oldContext);
  const oldRootId = oldRoot.id;
  await old.close(oldContext);
  const next = await Harness.open(await openNodeJsonlStorage(upgradeStorage, context), { models: createModels(), registry }, context);
  const nextRoot = await next.root(context);
  const retained = await next.getTask(taskId, context);
  if (nextRoot.id !== oldRootId || retained?.state?.outcome?.result !== "from-previous-version") throw new Error("Pi Durable upgrade did not preserve the previous JSONL root and completed task.");
  const nextTaskId = await nextRoot.commit(tx => tx.createTask(LabelTask, { label: "after-upgrade" }, { ownership: { kind: "conversation" } }), context);
  next.resume();
  const nextTask = await next.waitForTask(nextTaskId, context);
  if (nextTask.state.outcome?.result !== "after-upgrade") throw new Error("Pi Durable upgraded JSONL root did not accept new work.");
  await next.close(context);
  upgrade = { passed: true, rootPreserved: true, completedTaskPreserved: true, newTaskCompleted: true, scope: "Synthetic previous-version JSONL only; no user storage." };
}
const open = async () => Harness.open(await openNodeJsonlStorage(storageDir, context), { models: createModels(), registry }, context);

let first = await open();
let root = await first.root(context);
const recoveryTaskId = await root.commit(
  (tx) => tx.createTask(RecoveryTask, {}, { ownership: { kind: "conversation" } }),
  context,
);
first.resume();
for (let attempt = 0; attempt < 100; attempt += 1) {
  const task = await first.getTask(recoveryTaskId, context);
  if (task?.state?.status === "running" && task.state.checkpoint?.n >= 2) break;
  await new Promise((resolve) => setTimeout(resolve, 20));
}
const beforeClose = await first.getTask(recoveryTaskId, context);
if (!beforeClose || beforeClose.state.status === "terminal") throw new Error("Recovery probe completed before controlled restart boundary.");
await first.close(context);

const second = await open();
const recovered = await second.waitForTask(recoveryTaskId, context);
if (recovered.state.outcome?.status !== "completed" || recovered.state.outcome?.result !== "recovered-to-3") {
  throw new Error("Durable task did not resume from persisted JSONL state.");
}
root = await second.root(context);
const other = await second.createConversation({ ownership: { kind: "ownerless" } }, context);
const alpha = await root.commit((tx) => tx.createTask(LabelTask, { label: "alpha" }, { ownership: { kind: "conversation" } }), context);
const beta = await other.commit((tx) => tx.createTask(LabelTask, { label: "beta" }, { ownership: { kind: "conversation" } }), context);
second.resume();
const [alphaResult, betaResult] = await Promise.all([
  second.waitForTask(alpha, context),
  second.waitForTask(beta, context),
]);
if (alphaResult.state.outcome?.result !== "alpha" || betaResult.state.outcome?.result !== "beta" || root.id === other.id) {
  throw new Error("Concurrent durable task/conversation isolation probe failed.");
}
await second.close(context);
await rm(directory, { recursive: true, force: true });

process.stdout.write(JSON.stringify({
  upgrade,
  recovery: {
    passed: true,
    checkpointBeforeRestart: beforeClose.state.checkpoint,
    outcome: recovered.state.outcome,
  },
  isolation: {
    passed: true,
    conversationsDistinct: root.id !== other.id,
    results: [alphaResult.state.outcome?.result, betaResult.state.outcome?.result],
  },
}));
`, "utf8");

    const probe = await runPortableCommand(process.execPath, [probePath], {
      cwd: candidateRoot,
      timeout: 90_000,
      env: { PLOTPICKLE_PI_DURABLE_PREVIOUS_RUNTIME: contract.migrationFromVersion ? "1" : "0" },
    });
    const runtime = JSON.parse(probe.stdout);
    if (!runtime.recovery?.passed || !runtime.isolation?.passed) throw new Error("Pi Durable runtime probe did not prove recovery and isolation.");
    if (contract.migrationFromVersion && !runtime.upgrade?.passed) throw new Error("Pi Durable previous-version JSONL upgrade proof is missing.");
    report.checks.runtime = runtime;

    const adapterSource = await readFile(path.join(repoRoot, "core", "sidecars", "pi-durable-adapter.mjs"), "utf8");
    const contractSource = await readFile(path.join(repoRoot, "core", "sidecars", "durable-execution-contract.mjs"), "utf8");
    if (/CodingTools|createBashTool|NodeExecutionEnv/u.test(adapterSource)) throw new Error("Pi Durable adapter exposes an unrestricted execution helper.");
    if (!/canMergeCode:\s*false/u.test(contractSource) || !/canApproveCanon:\s*false/u.test(contractSource)) {
      throw new Error("Pi Durable authority envelope no longer preserves DSDD/canon boundaries.");
    }
    report.checks.securityBoundary = {
      passed: true,
      unrestrictedExecutionHelper: false,
      governanceAuthority: "dsdd",
    };

    const serviceSource = await readFile(path.join(repoRoot, "scripts", "sidecars", "pi-durable-service.mjs"), "utf8");
    if (contract.defaultEnabled !== true || contract.decision !== "active-by-default-supported-host-with-degraded-fallback") {
      throw new Error("Pi Durable is not configured as the reviewed active-default runtime.");
    }
    if (/resolvePiLocalRuntime|PLOTPICKLE_REPAIR_ENDPOINT|\/chat\/completions|\/responses/u.test(serviceSource)) {
      throw new Error("Pi Durable startup service appears to select or invoke a model/provider during startup.");
    }
    report.checks.defaultActivation = {
      passed: true,
      defaultEnabled: true,
      managedPackage: `${contract.package}@${contract.candidateVersion}`,
      startupProviderCalls: false,
    };

    report.status = "passed";
    report.decision = contract.decision;
    await writeFile(artifactPath, JSON.stringify(report, null, 2) + "\n", "utf8");
    process.stdout.write(`PLOTPICKLE_PI_DURABLE_2672_STATUS=passed version=${contract.candidateVersion} platform=${process.platform}\n`);
    process.stdout.write(`Evidence: ${artifactPath}\n`);
  } catch (error) {
    report.error = error instanceof Error ? error.stack || error.message : String(error);
    report.decision = "do-not-enable";
    await writeFile(artifactPath, JSON.stringify(report, null, 2) + "\n", "utf8");
    throw error;
  } finally {
    if (candidateRoot) await rm(candidateRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
