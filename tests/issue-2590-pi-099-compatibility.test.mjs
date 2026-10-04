import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const json = async (file) => JSON.parse(await read(file));

test("#2590 retains the Pi 0.99.1 evaluation while the managed runtime advances without changing DSDD authority", async () => {
  const [contract, stack, installer, bridge, gateway, oss] = await Promise.all([
    json("config/pi-099-compatibility.json"),
    json("config/developer-agent-stack.json"),
    read("scripts/pi-managed-install.mjs"),
    read("scripts/dsdd-pi-session.mjs"),
    read("build/dsdd/dsdd-session-gateway.ts"),
    json("config/third-party-oss.json"),
  ]);
  assert.equal(contract.issue, 2590);
  assert.equal(contract.currentManagedVersion, "0.87.1");
  assert.equal(contract.candidateVersion, "0.99.1");
  assert.equal(stack.piRuntime.managedVersion, "1.0.1");
  assert.match(installer, /PLOTPICKLE_MANAGED_PI_VERSION = "1\.0\.1"/u);
  assert.match(bridge, /managed\.version !== "1\.0\.1"/u);
  assert.match(gateway, /piVersion: "1\.0\.1"/u);
  assert.equal(oss.systems.find((item) => item.id === "pi-coding-agent")?.version, "1.0.1");
  assert.equal(stack.piRuntime.localOnly, true);
  assert.equal(stack.piRuntime.cloudFallback, false);
});

test("#2590 isolated proof covers supported SDK, sessions, locked-intent event, RPC and --no-extensions semantics", async () => {
  const [contract, source, gate] = await Promise.all([
    json("config/pi-099-compatibility.json"),
    read("scripts/evaluate-pi-099-compatibility.mjs"),
    read(".github/workflows/product-gate.yml"),
  ]);
  assert.equal(contract.requiredCapabilities.supportedPackageRootSdk, true);
  assert.equal(contract.requiredCapabilities.contextEditEntry, true);
  assert.equal(contract.requiredCapabilities.contextWithSystemExtensionEvent, true);
  assert.equal(contract.requiredCapabilities.stdioRpc, true);
  assert.match(source, /SessionManager\.inMemory/u);
  assert.match(source, /appendContextEdit/u);
  assert.match(source, /DefaultResourceLoader, SettingsManager/u);
  assert.match(source, /context_with_system/u);
  assert.match(source, /"--no-extensions"/u);
  assert.match(source, /plotpickle-2590-rpc/u);
  assert.match(source, /REPLACE_WITH_PI_BUILT_IN_IN_PHASE_2/u);
  assert.match(source, /decision = "do-not-promote"/u);
  assert.match(gate, /Evaluate managed Pi compatibility/u);
  assert.match(gate, /node scripts\/evaluate-pi-099-compatibility\.mjs/u);
});

test("#2590 keeps historical candidate evidence without rewriting candidate history", async () => {
  const [old087, old085, current] = await Promise.all([
    json("config/pi-087-dsdd-session-evaluation.json"),
    json("config/pi-managed-upgrade-evaluation.json"),
    json("config/pi-099-compatibility.json"),
  ]);
  assert.equal(old087.candidateVersion, "0.87.0");
  assert.equal(old085.candidateVersion, "0.85.1");
  assert.equal(current.candidateVersion, "0.99.1");
});
