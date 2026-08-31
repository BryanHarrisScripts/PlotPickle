import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1553 lifecycle reference documentation names the executable proof and closure boundary", async () => {
  const document = await read("docs/developer/AUTONOMOUS-APPLICATION-LIFECYCLE-REFERENCE.md");
  assert.match(document, /run-autonomous-story-reference\.mjs/);
  assert.match(document, /managed-plotpickle-application-process-plus-fresh-playwright-mcp/);
  assert.match(document, /deterministic Afterglow working-copy inputs/);
  assert.match(document, /contract-only pass must not be presented as a completed story reference run/i);
});
