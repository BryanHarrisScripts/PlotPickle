import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const readJson = async (file) => JSON.parse(await read(file));

test("#1709 evaluates Pi 0.85.1 without moving the authoritative 0.84.4 pin before Windows proof", async () => {
  const [evaluation, managed, stack] = await Promise.all([
    readJson("config/pi-managed-upgrade-evaluation.json"),
    read("scripts/pi-managed-install.mjs"),
    readJson("config/developer-agent-stack.json"),
  ]);

  assert.equal(evaluation.currentManagedVersion, "0.84.4");
  assert.equal(evaluation.candidateVersion, "0.85.1");
  assert.equal(evaluation.decision, "candidate-probe");
  assert.match(managed, /PLOTPICKLE_MANAGED_PI_VERSION = "0\.84\.4"/u);
  assert.equal(stack.piRuntime.managedVersion, "0.84.4");
  assert.deepEqual(evaluation.requiredExtensions, stack.piPackages);
  assert.match(evaluation.promotionPolicy, /only after the isolated Windows candidate probe/u);
});

test("#1709 candidate probe is isolated, exact-versioned and exercises supported SDK plus direct Node stdio RPC", async () => {
  const source = await read("scripts/evaluate-pi-managed-upgrade.mjs");

  assert.match(source, /mkdtemp\(path\.join\(os\.tmpdir\(\), "plotpickle-pi-1709-"\)\)/u);
  assert.match(source, /"install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact"/u);
  assert.match(source, /DefaultResourceLoader, SettingsManager/u);
  assert.match(source, /additionalExtensionPaths: roots/u);
  assert.match(source, /loader\.getExtensions\(\)/u);
  assert.match(source, /spawn\(process\.execPath, args/u);
  assert.match(source, /"--mode", "rpc"/u);
  assert.match(source, /type: "get_state", id: "plotpickle-1709-rpc"/u);
  assert.match(source, /shell: false/u);
  assert.match(source, /PLOTPICKLE_PI_1709_STATUS=passed/u);
  assert.match(source, /decision = "do-not-promote"/u);
  assert.doesNotMatch(source, /npm install -g/u);
});

test("#1709 keeps GPT-6 Astra optional and confined to already-authorized OpenAI routes", async () => {
  const evaluation = await readJson("config/pi-managed-upgrade-evaluation.json");
  const astra = evaluation.optionalModels.find((model) => model.id === "gpt-6-astra");
  assert.ok(astra);
  assert.equal(astra.provider, "openai");
  assert.deepEqual(astra.authorizedRoutes, ["api-key", "openai-codex"]);
  assert.equal(astra.required, false);
  assert.equal(astra.fallback, false);
});

test("#1709 does not adopt Pi source-only experimental subpaths or change the Developer Workbench launcher boundary", async () => {
  const [evaluation, workbench, runtime] = await Promise.all([
    readJson("config/pi-managed-upgrade-evaluation.json"),
    read("Utilities/DeveloperWorkbench/pi-managed-node-launch.mjs"),
    read("scripts/pi-worker-runtime.mjs"),
  ]);

  assert.deepEqual(evaluation.forbiddenPlotPickleImports, [
    "@earendil-works/pi-coding-agent/client",
    "@earendil-works/pi-coding-agent/experimental/plugin",
  ]);
  assert.match(workbench, /spawn\(process\.execPath, args/u);
  assert.match(workbench, /shell: false/u);
  assert.match(workbench, /PI_PACKAGE_PATH = \["node_modules", "@earendil-works", "pi-coding-agent"\]/u);
  assert.match(runtime, /PI_CODING_AGENT_PACKAGE = "@earendil-works\/pi-coding-agent"/u);
  assert.doesNotMatch(`${workbench}\n${runtime}`, /pi-coding-agent\/(?:client|experimental\/plugin)/u);
});
