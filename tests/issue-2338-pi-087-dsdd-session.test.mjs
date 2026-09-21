import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const readJson = async (file) => JSON.parse(await read(file));

test("#2338 defines Pi 0.87 as a candidate without moving the authoritative managed pin before Windows proof", async () => {
  const [contract, managed, stack, brief] = await Promise.all([
    readJson("config/pi-087-dsdd-session-evaluation.json"),
    read("scripts/pi-managed-install.mjs"),
    readJson("config/developer-agent-stack.json"),
    read("docs/developer-briefs/2338-dsdd-pi-087-persistent-session.md"),
  ]);

  assert.equal(contract.issue, 2338);
  assert.equal(contract.currentManagedVersion, "0.84.4");
  assert.equal(contract.candidateVersion, "0.87.0");
  assert.equal(contract.decision, "candidate-probe");
  assert.equal(contract.requiredCapabilities.contextEditEntry, true);
  assert.equal(contract.requiredCapabilities.contextWithSystemExtensionEvent, true);
  assert.deepEqual(contract.requiredExtensions, stack.piPackages);
  assert.match(managed, /PLOTPICKLE_MANAGED_PI_VERSION = "0\.84\.4"/u);
  assert.equal(stack.piRuntime.managedVersion, "0.84.4");
  assert.match(brief, /TALK[\s\S]*CONFIRM[\s\S]*BUILD[\s\S]*PROVE/u);
  assert.match(brief, /Original Human language remains immutable provenance/u);
});

test("#2338 candidate proof exercises Pi 0.87 append-only context editing and full-transcript extension registration", async () => {
  const source = await read("scripts/evaluate-pi-087-dsdd-session.mjs");

  assert.match(source, /"@earendil-works\/pi-coding-agent"/u);
  assert.match(source, /"install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact"/u);
  assert.match(source, /SessionManager/u);
  assert.match(source, /SessionManager\.inMemory/u);
  assert.match(source, /appendMessage/u);
  assert.match(source, /appendContextEdit/u);
  assert.match(source, /buildSessionProjection/u);
  assert.match(source, /rawHistoryPreserved/u);
  assert.match(source, /projectionChanged/u);
  assert.match(source, /context_with_system/u);
  assert.match(source, /DefaultResourceLoader, SettingsManager/u);
  assert.match(source, /"--mode", "rpc"/u);
  assert.match(source, /type: "get_state", id: "plotpickle-2338-rpc"/u);
  assert.match(source, /PLOTPICKLE_PI_2338_STATUS=passed/u);
  assert.match(source, /decision = "do-not-promote"/u);
  assert.doesNotMatch(source, /npm install -g/u);
});

test("#2338 keeps unsupported Pi source-only subpaths outside PlotPickle", async () => {
  const contract = await readJson("config/pi-087-dsdd-session-evaluation.json");
  assert.deepEqual(contract.forbiddenPlotPickleImports, [
    "@earendil-works/pi-coding-agent/client",
    "@earendil-works/pi-coding-agent/experimental/plugin",
  ]);
});

test("#2338 requires Windows Product Gate proof before Pi 0.87 promotion", async () => {
  const [productGate, prGate] = await Promise.all([
    read(".github/workflows/product-gate.yml"),
    read(".github/workflows/pr-gate.yml"),
  ]);
  assert.match(productGate, /Evaluate Pi 0\.87 DSDD session compatibility/u);
  assert.match(productGate, /node scripts\/evaluate-pi-087-dsdd-session\.mjs/u);
  assert.match(prGate, /Validate Pi 0\.87 DSDD session contract/u);
  assert.match(prGate, /tests\/issue-2338-pi-087-dsdd-session\.test\.mjs/u);
});
