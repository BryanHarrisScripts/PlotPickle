import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Writer local recovery gives every Fast and Quality retry a fresh timeout signal", async () => {
  const recovery = await read("scripts/writer-in-residence-runtime-recovery.mjs");

  assert.match(recovery, /function writerAttemptSignal\(role\)/);
  assert.match(recovery, /AbortSignal\.timeout\(role === "quality" \? 65_000 : 40_000\)/);
  assert.match(recovery, /\.\.\.init,[\s\S]*signal: writerAttemptSignal\(role\),[\s\S]*provider: "local", modelRole: role/);
  assert.match(recovery, /an aborted Quality attempt must not poison the next Fast/);
  assert.doesNotMatch(recovery, /provider:\s*"openai"|provider:\s*"minimax"/i);
});

test("rendered visual review ignores controls hidden inside closed Settings disclosures", async () => {
  const observer = await read("scripts/writer-visual-observer-v3.mjs");

  assert.match(observer, /hiddenByClosedDetails/);
  assert.match(observer, /details:not\(\[open\]\)/);
  assert.match(observer, /:scope > summary/);
  assert.match(observer, /node !== summary && !summary\.contains\(node\)/);
  assert.match(observer, /visible\(node\)/);
});

test("rendered visual review does not call intentionally scrollable navigation controls clipped", async () => {
  const observer = await read("scripts/writer-visual-observer-v3.mjs");

  assert.match(observer, /horizontallyScrollable/);
  assert.match(observer, /overflowX === 'auto' \|\| style\.overflowX === 'scroll'/);
  assert.match(observer, /parent\.scrollWidth > parent\.clientWidth \+ 2/);
  assert.match(observer, /!horizontallyScrollable\(node\)/);
});
