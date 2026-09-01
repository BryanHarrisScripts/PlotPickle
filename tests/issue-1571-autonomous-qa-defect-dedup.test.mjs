import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1571 defect fingerprints are stable evidence hashes, not LLM judgments", async () => {
  const source = await read("build/autonomous-guest/qa/defect-fingerprint.ts");
  assert.ok(source.includes('createHash("sha256")'));
  assert.ok(source.includes("testerRole"));
  assert.ok(source.includes("routeId"));
  assert.ok(source.includes("assertionRef"));
  assert.ok(source.includes("expectedRef"));
  assert.ok(source.includes("actualRef"));
  assert.ok(source.includes("errorClass"));
  assert.doesNotMatch(source, /prompt|chat|completion|model verdict|chain-of-thought/i);
});

test("#1571 one observation remains flaky and cannot become a new defect issue", async () => {
  const source = await read("build/autonomous-guest/qa/defect-fingerprint.ts");
  assert.ok(source.includes("observations.length >= 2"));
  assert.ok(source.includes('severity = reproducible ? input.severity : "flaky"'));
  assert.ok(source.includes('disposition: "record-flaky"'));
});

test("#1571 reproduced matching fingerprints append existing issues before creating new ones", async () => {
  const source = await read("build/autonomous-guest/qa/defect-fingerprint.ts");
  assert.ok(source.includes("observations do not reproduce the same fingerprint"));
  assert.ok(source.includes('item.fingerprint === candidate.fingerprint && item.state === "open"'));
  assert.ok(source.includes('disposition: "append-existing"'));
  assert.ok(source.includes('disposition: "create-new"'));
});

test("#1571 defect evidence is bounded and contains references rather than story/source mutation", async () => {
  const source = await read("build/autonomous-guest/qa/defect-fingerprint.ts");
  assert.ok(source.includes("MAX_REFS = 64"));
  assert.ok(source.includes("MAX_OBSERVATIONS = 8"));
  assert.ok(source.includes("exact commit SHA"));
  assert.ok(source.includes("reproductionRefs"));
  assert.ok(source.includes("evidenceRefs"));
  assert.doesNotMatch(source, /writeFile|fetch\(|github|localStorage|indexedDB|applyStoryCommand|saveActiveLibraryProject|browser_navigate/i);
});
