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
    ["library", "2", "Library", "Load Your Stories", "EXPLORE"],
    ["community", "3", "Community", "Share and Collaborate", "EXPLORE"],
    ["screening", "4", "Screening", "Screen Stories and Gather Reactions", "EXPLORE"],
    ["reports", "5", "Reports", "Review Story Health and Coverage Reports", "EXPLORE"],
    ["discovery", "M", "MindMap", "Capture and Map New Story Material", "DEVELOP"],
    ["story-bible", "W", "WorldMap", "Map the Story World", "DEVELOP"],
    ["write", "D", "Write", "Write Scenes, Dialogue and Action Blocks", "DEVELOP"],
    ["edit", "E", "Edit", "Review and Improve Screenplay Flow", "DEVELOP"],
    ["refine", "R", "Refine", "Polish Dialogue and Story Choices", "DEVELOP"],
    ["plan", "O", "Outline", "Visualize Story Structure", "VISUALIZE"],
    ["storyboard", "S", "Storyboard", "Visualize Scenes Before You Write", "VISUALIZE"],
    ["previs", "P", "Previs", "Preview Shots, Timing and Camera Motion", "VISUALIZE"],
    ["timeline", "T", "Timeline", "Synchronize Script, Shots, Timing and Audio", "VISUALIZE"],
    ["production", "C", "Rough Cut", "Review Production Intent and Handoff Readiness", "VISUALIZE"],
    ["sound-foley", "F", "Foley", "Develop Foley, Room Tone and Environmental Sound", "SOUND"],
    ["sound-narration", "N", "Narration", "Develop Narration, Voice-Over and Spoken Story", "SOUND"],
    ["sound-music", "A", "Music", "Develop Score, Music and Ambient Cues", "SOUND"],
    ["pitch-deck", "K", "Deck", "Generate and Review the Visual Pitch Deck", "PITCH"],
    ["pitch-package", "G", "Package", "Develop the Pitch Package and Presentation Materials", "PITCH"],
    ["feedback", "B", "Feedback", "Gather Reader Notes and Reactions", "PITCH"],
    ["profile", "I", "Identity", "Manage User Profile", "PLAY"],
    ["wyrmwood", "Y", "Wyrmwood", "Practice Narrative Craft", "PLAY"],
    ["story", "U", "The Unwritten", "Story Game Engine", "PLAY"],
    ["settings", "6", "Settings", "Configure PlotPickle", "SYSTEM"],
    ["help", "7", "Service", "Prepare a PlotPickle Issue", "SYSTEM"],
    ["open-source", "8", "Legal", "Open Source Licensing and Attribution", "SYSTEM"],
    ["logout", "9", "Log Off", "End This Session", "SYSTEM"],
    ["shutdown", "0", "Shut Down", "Safely Close PlotPickle and Local Services", "SYSTEM"],
  ]);

  const shortcuts = rows.map(([, shortcut]) => shortcut);
  assert.equal(new Set(shortcuts).size, shortcuts.length);
  assert.deepEqual([...new Set(rows.map((row) => row[4]))], [
    "EXPLORE", "DEVELOP", "VISUALIZE", "SOUND", "PITCH", "PLAY", "SYSTEM",
  ]);

  const connected = menu.slice(menu.indexOf("export const CONNECTED_DASHBOARD_ITEM_IDS"), menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"));
  assert.match(connected, /"pitch-package"/u);
  assert.match(connected, /"pitch-deck"/u);
  assert.match(menu, /DASHBOARD_REVIEW_ITEM_IDS/u);
  assert.match(menu, /DASHBOARD_UNAVAILABLE_ITEM_IDS/u);
});

test("Layer 1 canonical navigation protects nested Library return continuity", async () => {
  const [library, orchestrator, audit] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("app/skin-v1/surface-orchestrator.tsx"),
    read("lib/verification/skin-v1-menu-contract-audit.mjs"),
  ]);

  assert.match(library, /data-skin-v1-local-return="true"[\s\S]*onClick=\{\(\) => void openActiveProject\(\)\.catch\([\s\S]*Back to Dashboard/u);
  assert.doesNotMatch(library, /data-library-back="directory"/u);
  assert.match(orchestrator, /activateExistingReturn\(active\)/u);
  assert.match(audit, /dashboard-discovery/u);
  assert.doesNotMatch(audit, /clickSurfaceReturn\(page, "Back to Library"\)/u);
  assert.match(audit, /clickSurfaceReturn\(page, "Back to Dashboard"\)/u);
});

test("Layer 1 canonical navigation keeps startup evidence separate from the 32 authenticated surfaces", () => {
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.length, 32);
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("dashboard"));
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("storyboard"));
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("previs"));
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("scene-timeline"));
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.includes("startup-initializing"), false);
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.includes("profile-locked"), false);
});
