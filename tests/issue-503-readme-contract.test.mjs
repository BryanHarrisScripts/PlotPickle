import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const doc = await readFile(new URL("../docs/issue-503-windows-mcp-spawn.md", import.meta.url), "utf8");

test("issue 503 documents Windows ComSpec MCP launch and optional GitHub posting", () => {
  assert.match(doc, /Agent Plugins/);
  assert.match(doc, /ComSpec/);
  assert.match(doc, /cmd\.exe/);
  assert.match(doc, /GitHub CLI authentication is optional/);
});
