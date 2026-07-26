import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #111 records the required reuse-audit outputs", async () => {
  const audit = await source("docs/ISSUE-111-REUSE-AUDIT.md");
  for (const heading of [
    "Current information architecture",
    "Proposed information architecture",
    "Component reuse matrix",
    "Duplicated or competing patterns",
    "Hidden or hard-to-find capabilities",
    "Cross-workspace redirects and context loss",
    "Build reuse candidates",
    "Feedback reuse candidates",
    "Reports reuse candidates",
    "Data-model and migration risks",
  ]) {
    assert.match(audit, new RegExp(`## ${heading}`));
  }
});

test("issue #111 preserves the reuse-first and canonical-data boundaries", async () => {
  const audit = await source("docs/ISSUE-111-REUSE-AUDIT.md");
  assert.match(audit, /reuse first/i);
  assert.match(audit, /No major existing workspace is approved for wholesale replacement/i);
  assert.match(audit, /canonical schema/i);
  assert.match(audit, /stable IDs/i);
  assert.match(audit, /must not create a Build-only copy/i);
  assert.match(audit, /extend the review model rather than create disconnected/i);
});

test("issue #111 identifies current context-loss mechanisms", async () => {
  const audit = await source("docs/ISSUE-111-REUSE-AUDIT.md");
  assert.match(audit, /window\.location\.assign/);
  assert.match(audit, /query the DOM and click named buttons/);
  assert.match(audit, /Standalone specialist routes/);
  assert.match(audit, /shared project session\/provider/);
});
