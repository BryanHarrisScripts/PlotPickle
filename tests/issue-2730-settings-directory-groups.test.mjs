import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2730 Settings groups the approved destinations under System, Compute and Operations", async () => {
  const [dashboard, webmcpAudit, menuContractAudit] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("lib/verification/webmcp-surface-visual-audit.mjs"),
    read("lib/verification/skin-v1-menu-contract-audit.mjs"),
  ]);
  const start = dashboard.indexOf("const SETTINGS_MENU = [");
  const end = dashboard.indexOf("] as const;", start);
  assert.ok(start >= 0 && end > start, "SETTINGS_MENU must remain explicit and testable");
  const menu = dashboard.slice(start, end);

  const expected = [
    ["general", "G", "General", "SYSTEM", "Language, startup, interface reference and system mathematics."],
    ["node-info", "I", "Node Info", "SYSTEM", "PlotPickle Node identity, lifecycle, readiness and current project."],
    ["command", "M", "Command", "SYSTEM", "Comments, requests, evidence and proposed-change review."],
    ["local", "L", "Local", "COMPUTE", "Local writing, images, video and Agent compute."],
    ["cloud", "C", "Cloud", "COMPUTE", "Explicit cloud providers and paid capability routes."],
    ["hybrid", "H", "Hybrid", "COMPUTE", "Route capabilities across Local and Cloud."],
    ["semantic-uat", "U", "Semantic UAT", "OPERATIONS", "Run and review the local semantic UAT evidence."],
    ["data-recovery", "D", "Data Recovery", "OPERATIONS", "Review project files and rolling recovery points."],
    ["afterglow-management", "V", "Afterglow Management", "OPERATIONS", "Review saved Afterglow versions and resolve story conflicts safely."],
    ["agents", "A", "Agents", "OPERATIONS", "Assign compute to PlotPickle Agents."],
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

  assert.doesNotMatch(menu, /id: "ai-routing"/u, "Legacy Operations AI Routing must stay retired from the current Settings directory.");
  assert.match(webmcpAudit, /general,node-info,command,local,cloud,hybrid,semantic-uat,data-recovery,afterglow-management,agents,buzz-settings/u, "WebMCP must verify the eleven current Settings destinations.");
  assert.doesNotMatch(webmcpAudit, /general,node-info,command,local,cloud,hybrid,semantic-uat,data-recovery,agents,ai-routing,buzz-settings/u, "WebMCP may not require retired AI Routing.");
  assert.match(menuContractAudit, /general,node-info,command,local,cloud,hybrid,semantic-uat,data-recovery,afterglow-management,agents,buzz-settings/u, "Governed keyboard audit must use eleven active Settings destinations.");
  assert.match(menuContractAudit, /G,I,M,L,C,H,U,D,V,A,B/u, "Governed keyboard audit must not require the retired R shortcut.");
  assert.doesNotMatch(menuContractAudit, /general,node-info,command,local,cloud,hybrid,semantic-uat,data-recovery,agents,ai-routing,buzz-settings/u);
  assert.match(dashboard, /const showGroup = index === 0 \|\| SETTINGS_MENU\[index - 1\]\?\.group !== item\.group/u);
  assert.match(dashboard, />-- \{item\.group\} --<\/div>/u);
});

const shortcuts = {
  general: "G",
  "semantic-uat": "U",
  "data-recovery": "D",
  "afterglow-management": "V",
  "node-info": "I",
  command: "M",
  local: "L",
  cloud: "C",
  hybrid: "H",
  agents: "A",
  "buzz-settings": "B",
};
