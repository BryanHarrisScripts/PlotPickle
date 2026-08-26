import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = () => readFile(new URL("../.github/workflows/repomix-diagnostics.yml", import.meta.url), "utf8");

test("#1446 keeps Repomix outside ordinary pull-request execution", async () => {
  const source = await workflow();
  assert.match(source, /^  push:\n    branches: \[main\]/m);
  assert.match(source, /^  workflow_dispatch:/m);
  assert.doesNotMatch(source, /^  pull_request:/m);
  assert.match(source, /^permissions:\n  contents: read$/m);
});

test("#1446 pins Repomix and keeps repository diagnostics bounded", async () => {
  const source = await workflow();
  assert.match(source, /repomix@1\.18\.0/);
  assert.match(source, /--output repomix-output\.xml/);
  assert.match(source, /\.env,\.env\.\*/);
  assert.match(source, /\*\*\/credentials\.json/);
  assert.match(source, /\*\*\/secrets\.json/);
  assert.match(source, /\.artifacts\/\*\*/);
  assert.match(source, /repomix-output\.\*/);
  assert.match(source, /sha256sum repomix-output\.xml/);
  assert.match(source, /retention-days: 7/);
});
