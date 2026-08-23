import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const note = await readFile(new URL("../docs/acceptance/windows-mcp-launch.md", import.meta.url), "utf8");

test("Windows MCP acceptance note records the EINVAL prevention contract", () => {
  assert.match(note, /npx\.cmd/);
  assert.match(note, /cmd\.exe/);
  assert.match(note, /EINVAL/);
  assert.match(note, /JSON-RPC/);
});
