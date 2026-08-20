import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const occurrences = (source, pattern) => [...source.matchAll(pattern)].length;

test("#1121 relocates the one canonical What's New panel from Dashboard into Settings", async () => {
  const [dashboard, settings, panel] = await Promise.all([
    read("modules/dashboard/ui/dashboard-workspace.tsx"),
    read("app/sage-settings-workspace.tsx"),
    read("modules/dashboard/ui/release-history/index.tsx"),
  ]);

  assert.doesNotMatch(dashboard, /ReleaseHistoryPanel|What's New and Release History|What&apos;s New/);
  assert.match(settings, /id: "updates", label: "What’s New"/);
  assert.match(settings, /case "updates"/);
  assert.match(settings, /id="settings-updates"/);
  assert.equal(occurrences(settings, /<ReleaseHistoryPanel\s*\/>/g), 1);
  assert.match(panel, /config\/release-history\.json/);
  assert.match(panel, /What&apos;s New/);
  assert.match(panel, /PlotPickle Release History/);
});

test("#1121 keeps release updates bookmarkable, accessible, responsive, and in focused Settings UAT", async () => {
  const [settings, panel, panelCss, registryText] = await Promise.all([
    read("app/sage-settings-workspace.tsx"),
    read("modules/dashboard/ui/release-history/index.tsx"),
    read("modules/dashboard/ui/release-history/release-history.module.css"),
    read("config/uat-autopilot-registry.json"),
  ]);

  assert.match(settings, /"settings-updates": "updates"/);
  assert.match(settings, /url\.searchParams\.set\(SETTINGS_QUERY_KEY, section\)/);
  assert.match(settings, /aria-current=\{activeSection === item\.id \? "page" : undefined\}/);
  assert.match(panel, /aria-label="What's New and Release History"/);
  assert.match(panelCss, /@media \(max-width: 840px\)/);
  assert.match(panelCss, /grid-template-columns: 1fr/);
  assert.match(registryText, /tests\/issue-1121-whats-new-settings\.test\.mjs/);
});
