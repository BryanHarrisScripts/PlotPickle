import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2161 records the Human visual-story-building UAT contract", async () => {
  const brief = await read("docs/developer-briefs/2161-preproduction-visual-story-flow.md");
  for (const phrase of [
    "Outline → Storyboard → Visual Story → Previs",
    "Scene → Beat → Shot → Frame",
    "never manufactures canon",
    "Story Mode / image-route mismatch",
    "NO VISUAL YET",
    "exact-head Architecture Verification",
  ]) assert.match(brief, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
});

test("#2161 connects Storyboard and Previs as current Dashboard review surfaces", async () => {
  const [menu, host] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);
  const connected = menu.match(/CONNECTED_DASHBOARD_ITEM_IDS = new Set\(\[([\s\S]*?)\]\)/u)?.[1] ?? "";
  assert.match(connected, /"plan"/u);
  assert.match(connected, /"storyboard"/u);
  assert.match(connected, /"previs"/u);
  assert.match(host, /const \[reviewAddress, setReviewAddress\]/u);
  assert.match(host, /const \[buildOpen, setBuildOpen\]/u);
  assert.match(host, /const \[previsOpen, setPrevisOpen\]/u);
  assert.match(host, /data-dashboard-review-surface="storyboard"/u);
  assert.match(host, /data-dashboard-review-surface="previs"/u);
  assert.match(host, /data-dashboard-review-surface="build"/u);
  assert.match(host, /Continue to Previs/u);
});

test("#2161 reuses existing Storyboard, Previs and Build authorities inside Skin V1", async () => {
  const surfaces = await read("app/skin-v1/preproduction-review-surfaces.tsx");
  assert.match(surfaces, /import StoryboardReadinessWorkspace/u);
  assert.match(surfaces, /import PrevisReadinessWorkspace/u);
  assert.match(surfaces, /import FoundationsBuildWorkspace/u);
  assert.match(surfaces, /<StoryboardReadinessWorkspace/u);
  assert.match(surfaces, /<PrevisReadinessWorkspace/u);
  assert.match(surfaces, /<FoundationsBuildWorkspace/u);
  assert.doesNotMatch(surfaces, /applyStoryCommand|createEmpty|manufacture/u);
});

test("#2161 keeps Story Map PLAN BUILD STORYBOARD handoffs inside the current Skin V1 host", async () => {
  const surface = await read("app/skin-v1/matrix-story-map-surface.tsx");
  assert.match(surface, /destination\.pathname === "\/storyboard"/u);
  assert.match(surface, /workspace === "build"/u);
  assert.match(surface, /workspace === "plan"/u);
  assert.match(surface, /event\.preventDefault\(\)/u);
  assert.match(surface, /onOpenStage\(stage,/u);
  assert.doesNotMatch(surface, /window\.location\.assign/u);
});

test("#2161 makes Visual Story navigation visible without inventing missing story objects", async () => {
  const [surfaces, visualStory] = await Promise.all([
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
    read("app/_components/storyboard/visual-story-workspace.tsx"),
  ]);
  assert.match(surfaces, /Open Visual Story/u);
  assert.match(surfaces, /data-visual-story='scene-beat-shot-frame'/u);
  assert.match(surfaces, /scrollIntoView/u);
  assert.match(surfaces, /BLOCK \{String\(normalized\.blockNumber\)/u);
  assert.match(surfaces, /MINI-BLOCK \{normalized\.miniBlockNumber\}/u);
  assert.match(visualStory, /Visual Story does not manufacture a Scene to fill the surface/u);
  assert.match(visualStory, /Scene Timeline does not manufacture timing material to fill the surface/u);
});

test("#2161 replaces the dead plus presentation with an honest empty visual label", async () => {
  const css = await read("app/skin-v1/preproduction-review-flow.css");
  assert.match(css, /content: "NO VISUAL YET"/u);
  assert.match(css, /var\(--pp-skin-font-meta\)/u);
  assert.match(css, /var\(--pp-skin-tracking-label\)/u);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/iu);
  assert.doesNotMatch(css, /rgba?\(/iu);
});

test("#2161 routes Story Mode mismatch help to the existing Settings authority", async () => {
  const [host, map] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/matrix-story-map-surface.tsx"),
  ]);
  assert.match(map, /Story Mode and the selected image route remain governed by Manage → Story Mode/u);
  assert.match(map, /Open Story Mode Settings/u);
  assert.match(host, /\[data-dashboard-menu-item='settings'\]/u);
  assert.match(host, /\[data-settings-secondary-item='story-mode'\]/u);
  assert.doesNotMatch(map, /setPolicy|setProvider|imageRoute\s*=/u);
});

test("#2161 canonical census already includes Build Storyboard and Previs without expanding standard captures", async () => {
  const registry = JSON.parse(await read("config/skin-v1-surface-registry.json"));
  for (const id of ["build", "storyboard", "previs"]) {
    const surface = registry.surfaces.find((entry) => entry.id === id);
    assert.ok(surface, `Missing canonical census surface ${id}`);
    assert.equal(surface.capturePolicy, "census-only");
    assert.equal(surface.governance, "census");
  }
});
