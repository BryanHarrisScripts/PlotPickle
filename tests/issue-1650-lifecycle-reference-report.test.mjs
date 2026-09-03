import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1650 existing autonomous reference status surface renders only the canonical lifecycle presentation", async () => {
  const source = await read("scripts/creative-uat/autonomous/run-autonomous-story-reference.mjs");

  assert.match(source, /import \{ presentLifecycleProof \} from "\.\.\/\.\.\/\.\.\/core\/lifecycle\/lifecycle-presentation\.mjs"/);
  assert.match(source, /const lifecyclePresentation = lifecycleProof \? presentLifecycleProof\(lifecycleProof\) : null/);
  assert.match(source, /lifecyclePresentation,/);
  assert.match(source, /schemaVersion: 7/);
  assert.match(source, /const lifecycle = machine\.lifecyclePresentation\?\.current \|\| null/);
  assert.match(source, /Status: \$\{lifecycle\?\.stateLabel/);
  assert.match(source, /Stage: \$\{lifecycle\?\.stageLabel/);
  assert.match(source, /Active authority: \$\{lifecycle\?\.authorityLabel/);
  assert.match(source, /Validation: \$\{lifecycle\?\.validationLabel/);
  assert.match(source, /Persistence: \$\{lifecycle\?\.persistenceLabel/);
  assert.match(source, /Stop reason: \$\{lifecycle\?\.stopReason/);
  assert.match(source, /Next action: \$\{lifecycle\?\.nextActionLabel/);
  assert.match(source, /Human approval claimed:/);
  assert.doesNotMatch(source, /workspace.*stage.*=|activeWorkspace.*lifecycle|provider.*stage.*=/i);
});
