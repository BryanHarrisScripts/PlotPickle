import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Issue 567 keeps the Learn three-column POC source present", async () => {
  const shell = await readFile("app/learn-three-column-shell.tsx", "utf8");
  assert.match(shell, /Story Navigator/);
  assert.match(shell, /Learn Creative Canvas/);
  assert.match(shell, /Creative Room/);
  assert.match(shell, /Creative Director/);
  assert.match(shell, /Creative Room tone/);
});
