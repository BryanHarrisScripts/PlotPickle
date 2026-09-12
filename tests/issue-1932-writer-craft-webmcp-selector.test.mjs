import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#1932 Writer's Craft WebMCP selector matches the same-element menu contract", async () => {
  const [audit, dashboard] = await Promise.all([
    read("lib/verification/skin-v1-menu-contract-audit.mjs"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
  ]);

  assert.match(
    dashboard,
    /aria-label="Writer's Craft menu"[\s\S]{0,160}data-skin-menu="writer-craft"/u,
    "Writer's Craft must keep its accessible label and menu identity on the same section",
  );

  const canonical = `section[aria-label=\\"Writer's Craft menu\\"][data-skin-menu='writer-craft']`;
  const staleDescendant = `section[aria-label=\\"Writer's Craft menu\\"] [data-skin-menu='writer-craft']`;

  assert.ok(audit.includes(canonical), "WebMCP must wait on the same-element Writer's Craft menu selector");
  assert.ok(!audit.includes(staleDescendant), "WebMCP must not require a nonexistent Writer's Craft descendant menu");
  assert.match(audit, /keyboard\.press\("1"\)/u, "Writer's Craft remains reachable through dashboard shortcut 1");
  assert.match(audit, /inspectMenu\(page, "writer-craft", failures\)/u, "Writer's Craft remains governed by the menu contract audit");
});
