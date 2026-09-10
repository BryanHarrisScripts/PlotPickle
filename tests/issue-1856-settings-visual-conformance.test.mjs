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

test("#1856 adds Settings and its connected sub-surfaces to the same WebMCP conformance registry", () => {
  assert.deepEqual(WEBMCP_ALLOWED_TARGETS, [
    "dashboard",
    "community",
    "settings",
    "cloud-story-mode",
    "agents",
    "profile",
    "local-ai",
    "node",
  ]);
  assert.match(dashboard, /data-dashboard-menu-item=\{item\.id\}/);
  assert.match(dashboard, /data-settings-secondary-item=\{item\.id\}/);
  assert.match(dashboard, /data-settings-secondary-connected=\{connected \? "true" : "false"\}/);
  assert.match(audit, /section\[aria-label='Settings menu'\]/);
  assert.match(audit, /section\[aria-label='Cloud Story Mode setup'\]/);
  assert.match(audit, /section\[aria-label='PlotPickle Agents setup'\]/);
  assert.match(audit, /\[data-settings-secondary-item='cloud'\]/);
  assert.match(audit, /\[data-settings-secondary-item='agents'\]/);
});

test("#1856 captures candidate evidence and semantic conformance for all eight surfaces", () => {
  assert.equal(Object.keys(manifest.surfaces).length, 8);
  for (const surface of WEBMCP_ALLOWED_TARGETS) {
    assert.ok(manifest.surfaces[surface], `${surface} missing from visual manifest`);
    assert.equal(manifest.surfaces[surface].status, "candidate");
    assert.match(audit, new RegExp(`inspectCurrent\\("${surface}"\\)`));
    if (surface !== "dashboard") {
      assert.match(audit, new RegExp(`captureSurfaceCandidate\\(page, manifest, "${surface}"`));
    }
  }
  assert.match(audit, /captureSurfaceCandidate\(page, manifest, "dashboard"/);
});

test("#1856 startup output exposes all eight baselines without auto-approval", () => {
  const output = visualBaselineApprovalLines().join("\n");
  assert.match(output, /^Captured 8 surfaces:/);
  assert.match(output, /settings \(Settings\)/);
  assert.match(output, /cloud-story-mode \(Cloud Story Mode\)/);
  assert.match(output, /agents \(PlotPickle Agents\)/);
  assert.match(output, /local-ai \(Local Story Mode\)/);
  assert.match(output, /none of the screenshots are automatically declared "locked\."/);
});
