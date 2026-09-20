import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WEBMCP_STANDARD_SURFACE_TARGETS } from "../lib/verification/webmcp-canonical-surface-registry.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Layer 1 canonical navigation keeps the current Dashboard story hierarchy", async () => {
  const menu = await read("app/skin-v1/dashboard-menu-registry.ts");
  const ordered = [
    'id: "community"',
    'id: "learn"',
    'id: "discovery"',
    'id: "library"',
    'id: "story-bible"',
    'id: "plan"',
    'id: "storyboard"',
    'id: "previs"',
    'id: "timeline"',
    'id: "production"',
  ];
  let previous = -1;
  for (const token of ordered) {
    const index = menu.indexOf(token);
    assert.ok(index > previous, `Expected current Dashboard order to contain ${token}`);
    previous = index;
  }
  assert.match(menu, /label: "Story Bible"/u);
});

test("Layer 1 canonical navigation protects nested Library return continuity", async () => {
  const [library, orchestrator, audit] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("app/skin-v1/surface-orchestrator.tsx"),
    read("lib/verification/skin-v1-menu-contract-audit.mjs"),
  ]);

  assert.match(library, /data-skin-v1-local-return="true"[\s\S]*onClick=\{returnToDirectory\}[\s\S]*Back to Library/u);
  assert.doesNotMatch(library, /data-library-back="directory"/u);
  assert.match(orchestrator, /activateExistingReturn\(active\)/u);
  assert.match(audit, /dashboard-discovery/u);
  assert.match(audit, /clickSurfaceReturn\(page, "Back to Library"\)/u);
  assert.match(audit, /clickSurfaceReturn\(page, "Back to Dashboard"\)/u);
});

test("Layer 1 canonical navigation keeps startup evidence separate from the 30 authenticated surfaces", () => {
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.length, 30);
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("dashboard"));
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("story-bible"));
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("storyboard"));
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("previs"));
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("scene-timeline"));
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.includes("startup-initializing"), false);
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.includes("profile-locked"), false);
});
