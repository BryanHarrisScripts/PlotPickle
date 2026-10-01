import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contract = await readFile(new URL("../core/media/media-engine-contract.ts", import.meta.url), "utf8");
const adapter = await readFile(new URL("../core/media/fframes-local-media-engine.ts", import.meta.url), "utf8");
const cargo = await readFile(new URL("../tools/fframes-bridge/Cargo.toml", import.meta.url), "utf8");
const bridge = await readFile(new URL("../tools/fframes-bridge/src/main.rs", import.meta.url), "utf8");

test("#2663 owns a provider-neutral media-engine contract", () => {
  assert.match(contract, /interface PlotPickleMediaEngine/);
  assert.match(contract, /authoritative: true/);
  assert.match(contract, /frames\.length > 25/);
  assert.doesNotMatch(contract, /fframes/i);
});

test("#2663 pins FFrames and keeps it behind an adapter", () => {
  assert.match(cargo, /fframes = \{ version = "=1\.1\.0"/);
  assert.match(adapter, /class FFramesLocalMediaEngine implements PlotPickleMediaEngine/);
  assert.match(adapter, /automaticInstall: false/);
  assert.match(adapter, /cloudFallback: false/);
  assert.match(adapter, /state: ready \? "ready" : "unavailable"/);
});

test("#2663 bounds execution, cancellation, temp cleanup and evidence", () => {
  assert.match(adapter, /DEFAULT_TIMEOUT_MS/);
  assert.match(adapter, /options\.signal/);
  assert.match(adapter, /mkdtemp/);
  assert.match(adapter, /rm\(root, \{ recursive: true, force: true \}\)/);
  assert.match(adapter, /sha256/);
  assert.match(adapter, /fframes-evidence\.json/);
  assert.match(adapter, /windowsHide: true/);
  assert.match(adapter, /shell: false/);
});

test("#2663 bridge consumes staged assets and cannot mutate PlotPickle canon", () => {
  assert.match(bridge, /MediaDirectory::read_folder\("assets"\)/);
  assert.match(bridge, /plotpickle-request\.json/);
  assert.doesNotMatch(bridge, /ppf|canon|projects\//i);
});
