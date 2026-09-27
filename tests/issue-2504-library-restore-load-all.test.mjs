import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2504 Restore Local Resources exposes a dynamic Load All action", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");

  assert.match(source, /function loadAllLocalResources\(\)/u);
  assert.match(source, /recovery\.inventory\.groups\.map\(\(group\) => group\.originProjectId\)/u);
  assert.match(source, /onClick=\{loadAllLocalResources\}/u);
  assert.match(source, />Load All<\/button>/u);
  assert.match(source, /selectedRecoveryOrigins\.length === recovery\.inventory\.groups\.length/u);
});

test("#2504 labels unmatched restore groups as Legacy while preserving individual selection", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");

  assert.match(source, /group\.exactProject \? "Current project resources" : "Legacy"/u);
  assert.doesNotMatch(source, /Legacy \/ unmatched resources/u);
  assert.match(source, /checked=\{selectedRecoveryOrigins\.includes\(group\.originProjectId\)\}/u);
  assert.match(source, /onChange=\{\(\) => toggleRecoveryOrigin\(group\.originProjectId\)\}/u);
  assert.match(source, /Restore Local Resources/u);
});
