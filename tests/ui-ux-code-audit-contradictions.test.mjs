import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../scripts/ui-ux-code-audit.mjs", import.meta.url), "utf8");

test("UI audit recognizes existing image alternative text", () => {
  assert.match(source, /alt\|aria-/);
  assert.match(source, /An img with an explicit alt prop/);
});

test("UI audit rejects preference wording and preserves named navigation landmarks", () => {
  assert.match(source, /unnecessar\(\?:y\|ily\)/);
  assert.match(source, /finding\.criterion === 15 && \/<nav/);
  assert.match(source, /A named nav landmark is correct/);
});
