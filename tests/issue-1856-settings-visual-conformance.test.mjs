import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { WEBMCP_ALLOWED_TARGETS } from "../lib/verification/webmcp-surface-visual-audit.mjs";
import { visualBaselineApprovalLines } from "../scripts/run-webmcp-startup-uat.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

const audit = read("lib/verification/webmcp-surface-visual-audit.mjs");
const dashboard = read("app/skin-v1/dashboard-bbs-panel.tsx");
const manifest = JSON.parse(read("tests/visual-baselines/skin-v1/manifest.json"));

test("#1856/#2044 scopes live WebMCP conformance to Human-reachable Skin V1 destinations", () => {
  assert.deepEqual(WEBMCP_ALLOWED_TARGETS, [
    "dashboard",
    "community",
    "settings",
    "profile",
  ]);
  assert.match(dashboard, /data-dashboard-menu-item=\{item\.id\}/);
  assert.match(dashboard, /data-settings-secondary-item=\{item\.id\}/);
  assert.match(dashboard, /data-settings-secondary-connected=\{connected \? "true" : "false"\}/);
  assert.match(audit, /section\[aria-label='Settings menu'\]/);
  assert.match(audit, /general,appearance,accessibility,defaults,advanced/);
});

test("#1856 preserves historical candidates while live capture follows the reachable four-surface contract", () => {
  assert.equal(Object.keys(manifest.surfaces).length, 8);
  for (const surface of WEBMCP_ALLOWED_TARGETS) {
    assert.ok(manifest.surfaces[surface], `${surface} missing from visual manifest`);
    assert.equal(manifest.surfaces[surface].status, "candidate");
    assert.match(audit, new RegExp(`inspectCurrent\\("${surface}"\\)`));
    assert.match(audit, new RegExp(`captureSurfaceCandidate\\(page, manifest, "${surface}"`));
  }
  for (const historical of ["cloud-story-mode", "agents", "local-ai", "node"]) {
    assert.ok(manifest.surfaces[historical], `${historical} historical candidate missing from visual manifest`);
    assert.equal(manifest.surfaces[historical].status, "candidate");
  }
});

test("#1856 startup output exposes the four current baselines without auto-approval", () => {
  const output = visualBaselineApprovalLines().join("\n");
  assert.match(output, /^Captured 4 surfaces:/);
  assert.match(output, /settings \(Settings\)/);
  assert.match(output, /profile \(Profile\)/);
  assert.doesNotMatch(output, /cloud-story-mode \(Cloud Story Mode\)/);
  assert.doesNotMatch(output, /agents \(PlotPickle Agents\)/);
  assert.doesNotMatch(output, /local-ai \(Local Story Mode\)/);
  assert.doesNotMatch(output, /node \(Node\)/);
  assert.match(output, /none of the screenshots are automatically declared "locked\."/);
});
