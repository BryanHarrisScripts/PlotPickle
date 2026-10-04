import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2730 Settings groups the approved destinations under System, Compute and Operations", async () => {
  const [dashboard, webmcpAudit] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("lib/verification/webmcp-surface-visual-audit.mjs"),
  ]);
  const start = dashboard.indexOf("const SETTINGS_MENU = [");
  const end = dashboard.indexOf("] as const;", start);
  assert.ok(start >= 0 && end > start, "SETTINGS_MENU must remain explicit and testable");
  const menu = dashboard.slice(start, end);

  const expected = [
    ["general", "G", "General", "SYSTEM", "Language, startup, interface reference and project data."],
    ["node-info", "I", "Node Info", "SYSTEM", "PlotPickle Node identity, lifecycle, readiness and current project."],
    ["command", "M", "Command", "SYSTEM", "Comments, requests, evidence and proposed-change review."],
    ["local", "L", "Local", "COMPUTE", "Local writing, images, video and Agent compute."],
    ["cloud", "C", "Cloud", "COMPUTE", "Explicit cloud providers and paid capability routes."],
    ["hybrid", "H", "Hybrid", "COMPUTE", "Route capabilities across Local and Cloud."],
    ["agents", "A", "Agents", "OPERATIONS", "Assign compute to PlotPickle Agents."],
    ["ai-routing", "R", "AI Routing", "OPERATIONS", "Review capability routes and provider selection."],
    ["buzz-settings", "B", "BUZZ Settings", "OPERATIONS", "Configure BUZZ identity, presence and runtime settings."],
  ];

  let previousIndex = -1;
  for (const [id, shortcut, label, group, description] of expected) {
    const index = menu.indexOf(`id: "${id}"`);
    assert.ok(index > previousIndex, `${id} must appear in the approved Settings order`);
    previousIndex = index;

    const rowEnd = menu.indexOf("\n", index);
    const row = menu.slice(index, rowEnd >= 0 ? rowEnd : undefined);
    const shortcutSource = id.includes("-")
      ? `SETTINGS_SHORTCUTS["${id}"]`
      : `SETTINGS_SHORTCUTS.${id}`;

    assert.ok(row.includes(`shortcut: ${shortcutSource}`), `${id} shortcut source`);
    assert.equal(shortcuts[id], shortcut, `${id} shortcut value`);
    assert.ok(row.includes(`label: "${label}"`), `${id} label`);
    assert.ok(row.includes(`group: "${group}"`), `${id} group`);
    assert.ok(row.includes(`description: "${description}"`), `${id} description`);
  }

  assert.match(dashboard, /const showGroup = index === 0 \|\| SETTINGS_MENU\[index - 1\]\?\.group !== item\.group/u);
  assert.match(dashboard, />-- \{item\.group\} --<\/div>/u);
});

const shortcuts = {
  general: "G",
  "node-info": "I",
  command: "M",
  local: "L",
  cloud: "C",
  hybrid: "H",
  agents: "A",
  "ai-routing": "R",
  "buzz-settings": "B",
};
