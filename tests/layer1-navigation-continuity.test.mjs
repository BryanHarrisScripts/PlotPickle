import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WEBMCP_STANDARD_SURFACE_TARGETS } from "../lib/verification/webmcp-canonical-surface-registry.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Layer 1 canonical navigation keeps the frozen seven-group Dashboard authority", async () => {
  const menu = await read("app/skin-v1/dashboard-menu-registry.ts");
  const rows = [...menu.matchAll(/\{ id: "([^"]+)", shortcut: "([^"]+)", label: "([^"]+)", description: "([^"]+)", group: "([^"]+)" \}/gu)]
    .map((match) => match.slice(1));

  assert.deepEqual(rows, [
    ["learn", "1", "Learn", "Learn Story Craft", "EXPLORE"],
    ["community", "C", "Community", "Share and Collaborate", "EXPLORE"],
    ["library", "L", "Library", "Load Your Stories", "EXPLORE"],
    ["discovery", "G", "MindMap", "Capture and Map New Story Material", "DEVELOP"],
    ["story-bible", "V", "Story", "Story, Logline, Theme and Visual Reference", "DEVELOP"],
    ["write", "W", "Write", "Write Scenes, Dialogue and Action Blocks", "DEVELOP"],
    ["edit", "E", "Edit", "Review and Improve Screenplay Flow", "DEVELOP"],
    ["plan", "O", "Outline", "Visualize Story Structure", "VISUALIZE"],
    ["storyboard", "S", "Storyboard", "Visualize Scenes Before You Write", "VISUALIZE"],
    ["previs", "P", "Previs", "Preview Shots, Timing and Camera Motion", "VISUALIZE"],
    ["timeline", "T", "Timeline", "Synchronize Script, Shots, Timing and Audio", "VISUALIZE"],
    ["production", "D", "Production", "Review Production Intent and Handoff Readiness", "VISUALIZE"],
    ["feedback", "F", "Feedback", "Gather Reader Notes and Reactions", "REVIEW"],
    ["refine", "R", "Refine", "Polish Dialogue and Story Choices", "REVIEW"],
    ["reports", "A", "Reports", "Review Story Health and Coverage Reports", "REVIEW"],
    ["pitch-package", "4", "Package", "Develop the Pitch Package and Presentation Materials", "PITCH"],
    ["pitch-deck", "5", "Deck", "Generate and Review the Visual Pitch Deck", "PITCH"],
    ["profile", "I", "Identity", "Manage User Profile", "PLAY"],
    ["wyrmwood", "2", "Wyrmwood", "Practice Narrative Craft", "PLAY"],
    ["story", "3", "Written", "Story Game Engine", "PLAY"],
    ["settings", "M", "Settings", "Configure PlotPickle", "SYSTEM"],
    ["help", "B", "Service", "Prepare a PlotPickle Issue", "SYSTEM"],
    ["open-source", "N", "Legal", "Open Source Licensing and Attribution", "SYSTEM"],
    ["logout", "X", "Log Off", "End This Session", "SYSTEM"],
    ["shutdown", "Q", "Shut Down", "Safely Close PlotPickle and Local Services", "SYSTEM"],
  ]);

  const shortcuts = rows.map(([, shortcut]) => shortcut);
  assert.equal(new Set(shortcuts).size, shortcuts.length);
  assert.deepEqual([...new Set(rows.map((row) => row[4]))], [
    "EXPLORE", "DEVELOP", "VISUALIZE", "REVIEW", "PITCH", "PLAY", "SYSTEM",
  ]);

  const connected = menu.slice(menu.indexOf("export const CONNECTED_DASHBOARD_ITEM_IDS"), menu.indexOf("export const DASHBOARD_STARTUP_CHOICES"));
  assert.match(connected, /"pitch-package"/u);
  assert.doesNotMatch(connected, /"pitch-deck"/u);
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
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("storyboard"));
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("previs"));
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("scene-timeline"));
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.includes("startup-initializing"), false);
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.includes("profile-locked"), false);
});
