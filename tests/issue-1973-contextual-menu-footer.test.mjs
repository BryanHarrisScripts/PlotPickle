import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { changedFilesFromGit, runDevelopmentConvergence } from "../scripts/run-development-convergence.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1973 shares one explicit green-available gray-unavailable footer contract", async () => {
  const [footer, styles] = await Promise.all([
    read("app/skin-v1/menu-feedback-footer.tsx"),
    read("app/skin-v1/menu-feedback-footer.module.css"),
  ]);

  assert.match(footer, /GREEN = AVAILABLE/u);
  assert.match(footer, /GRAY = UNAVAILABLE/u);
  assert.match(footer, /available \? `ENTER → OPEN \$\{label\.toUpperCase\(\)\}`/u);
  assert.match(footer, /UNAVAILABLE/u);
  assert.match(footer, /role="status"/u);
  assert.match(footer, /aria-live="polite"/u);
  assert.match(footer, /aria-atomic="true"/u);
  assert.match(styles, /legendSquareAvailable/u);
  assert.match(styles, /var\(--pp-skin-accent-bright\)/u);
  assert.match(styles, /var\(--pp-skin-ink-muted\)/u);
});

test("#1973 Dashboard and Settings derive footer action from the selected row rather than generic copy", async () => {
  const dashboard = await read("app/skin-v1/dashboard-bbs-panel.tsx");

  assert.match(dashboard, /const selectedDashboardItem = items\[selectedIndex\]/u);
  assert.match(dashboard, /const selectedDashboardConnected = Boolean\(selectedDashboardItem && CONNECTED_DASHBOARD_ITEMS\.has\(selectedDashboardItem\.id\)\)/u);
  assert.match(dashboard, /const selectedSettingsItem = SETTINGS_MENU\[settingsSelectedIndex\]/u);
  assert.match(dashboard, /const selectedSettingsConnected = Boolean\(selectedSettingsItem && CONNECTED_SETTINGS_ITEMS\.has\(selectedSettingsItem\.id\)\)/u);
  assert.match(dashboard, /id="dashboard-menu-status"[\s\S]*label=\{selectedDashboardItem\?\.label/u);
  assert.match(dashboard, /available=\{selectedDashboardConnected\}/u);
  assert.match(dashboard, /id="settings-menu-status"[\s\S]*label=\{selectedSettingsItem\?\.label/u);
  assert.match(dashboard, /available=\{selectedSettingsConnected\}/u);
  assert.doesNotMatch(dashboard, /OTHER MENU ITEMS ARE NOT CONNECTED YET/u);
  assert.doesNotMatch(dashboard, /ENTER: OPEN CONNECTED DESTINATION/u);
  assert.doesNotMatch(dashboard, /settingsNotice/u);
});

test("#1973 Dashboard and Settings row semantics explicitly say available or unavailable", async () => {
  const dashboard = await read("app/skin-v1/dashboard-bbs-panel.tsx");
  const labels = dashboard.match(/aria-label=\{`\$\{item\.label\}: \$\{connected \? "available" : "unavailable"\}`\}/gu) ?? [];
  assert.equal(labels.length, 2);
  assert.match(dashboard, /data-skin-menu-connected=\{connected \? "true" : "false"\}/u);
  assert.match(dashboard, /data-skin-menu-indicator=\{connected \? "connected" : "unwired"\}/u);
});

test("#1973 Local and Cloud directories remain fully available instead of inventing gray states", async () => {
  const [local, cloud] = await Promise.all([
    read("app/skin-v1/local-ai-skin-host.tsx"),
    read("app/skin-v1/cloud-story-mode-host.tsx"),
  ]);

  for (const source of [local, cloud]) {
    assert.match(source, /data-skin-menu-connected="true"/u);
    assert.match(source, /pp-skin-v1-dashboard-status-box is-active/u);
    assert.match(source, /data-skin-menu-indicator=\{"connected"\}/u);
  }
});

test("#1973 LEARN keeps availability separate from advisory sequence", async () => {
  const learn = await read("app/skin-v1/learn-journey-preview.tsx");
  assert.match(learn, /data-skin-menu-connected=\{course\.contentAvailable \? "true" : "false"\}/u);
  assert.match(learn, /data-learn-course-content=\{course\.contentAvailable \? "available" : "unavailable"\}/u);
  assert.match(learn, /pp-skin-v1-dashboard-status-box\$\{course\.contentAvailable \? " is-active" : ""\}/u);
  assert.match(learn, /recommendedSequenceIsAccessControl: false/u);
  assert.match(learn, /humanMayLearnOutOfOrder: true/u);
});

test("#1973 canonical development convergence reports CONVERGED against the real diff", async (t) => {
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "main";
  const changedFiles = changedFilesFromGit({ root: process.cwd(), baseRef });
  if (!changedFiles.includes("config/development-convergence/1973.json")) {
    t.skip("#1973 issue-specific convergence only applies when its convergence manifest is part of the current diff.");
    return;
  }

  const result = await runDevelopmentConvergence([
    "--manifest",
    "config/development-convergence/1973.json",
    "--base-ref",
    baseRef,
    "--report-dir",
    ".artifacts/development-convergence",
  ]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].issue, 1973);
  assert.equal(result.reports[0].status, "CONVERGED");
  assert.deepEqual(result.reports[0].remaining, []);
});
