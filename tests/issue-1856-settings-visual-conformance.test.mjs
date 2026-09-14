import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { WEBMCP_ALLOWED_TARGETS } from "../lib/verification/webmcp-surface-visual-audit.mjs";
import {
  WEBMCP_STANDARD_SURFACE_REGISTRY,
  WEBMCP_STANDARD_SURFACE_TARGETS,
} from "../lib/verification/webmcp-surface-capture-registry.mjs";
import { visualBaselineApprovalLines } from "../scripts/run-webmcp-startup-uat.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

const audit = read("lib/verification/webmcp-surface-visual-audit.mjs");
const catalogue = read("lib/verification/webmcp-standard-surface-catalogue.mjs");
const dashboard = read("app/skin-v1/dashboard-bbs-panel.tsx");
const manifest = JSON.parse(read("tests/visual-baselines/skin-v1/manifest.json"));

test("#1856 keeps the original four-surface conformance audit while #2030 adds the full standard catalogue", () => {
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
  assert.match(catalogue, /runWebMcpStandardSurfaceCatalogue/u);
});

test("#2030 registers every currently reachable Human-approved standard surface", () => {
  assert.deepEqual(WEBMCP_STANDARD_SURFACE_TARGETS, [
    "dashboard",
    "community",
    "writers-craft",
    "profile",
    "settings",
    "general",
    "local-ai",
    "cloud-story-mode",
    "node",
    "agents",
    "issue-log",
    "licensing",
  ]);
  assert.equal(Object.keys(manifest.surfaces).length, WEBMCP_STANDARD_SURFACE_TARGETS.length);
  for (const surface of WEBMCP_STANDARD_SURFACE_TARGETS) {
    const contract = WEBMCP_STANDARD_SURFACE_REGISTRY[surface];
    const entry = manifest.surfaces[surface];
    assert.ok(entry, `${surface} missing from visual manifest`);
    assert.equal(entry.status, "candidate");
    assert.equal(entry.selector, contract.rootSelector);
    assert.equal(entry.candidate, contract.candidate);
    assert.equal(entry.baseline, contract.baseline);
    assert.ok(contract.approval.startsWith("#"), `${surface} must retain Human-approval provenance`);
    assert.ok(Array.isArray(contract.navigation), `${surface} must have deterministic navigation metadata`);
    assert.ok(Array.isArray(contract.viewports) && contract.viewports.length >= 1, `${surface} must declare capture viewport requirements`);
  }
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY.settings.navigation[0].shortcut, "M");
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY.profile.navigation[0].shortcut, "I");
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY["issue-log"].navigation[0].shortcut, "B");
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY.licensing.navigation[0].shortcut, "N");
  assert.ok(!WEBMCP_STANDARD_SURFACE_TARGETS.includes("library"), "Library must remain outside the capture registry while its Dashboard row is unwired");
  assert.ok(!WEBMCP_STANDARD_SURFACE_TARGETS.includes("advanced"), "Advanced must not return as a fake destination after its content moved into General");
});

test("#2030 startup output exposes all twelve candidates without auto-approval", () => {
  const output = visualBaselineApprovalLines().join("\n");
  assert.match(output, /^Captured 12 surfaces:/);
  for (const surface of WEBMCP_STANDARD_SURFACE_TARGETS) {
    assert.match(output, new RegExp(`node scripts/lock-skin-visual-baseline\\.mjs ${surface}`, "u"));
  }
  assert.match(output, /writers-craft \(Writer's Craft\)/u);
  assert.match(output, /profile \(Identity\)/u);
  assert.match(output, /settings \(Manage\)/u);
  assert.match(output, /issue-log \(Bug Report\)/u);
  assert.match(output, /licensing \(Notices\)/u);
  assert.match(output, /none of the screenshots are automatically declared "locked\."/u);
});
