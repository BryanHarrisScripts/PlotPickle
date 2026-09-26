import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2456 Dashboard Previs uses Act-first navigation and the canonical 24/96 map", async () => {
  const [host, surfaces, map] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
    read("modules/build/ui/progressive-story-map.tsx"),
  ]);

  const start = host.indexOf("if (previsOpen)");
  const end = host.indexOf("if (timelineOpen)", start);
  const previs = host.slice(start, end);
  assert.match(previs, /<StoryActRail activeAct=/u);
  assert.match(previs, /<SkinV1PrevisStoryMap/u);
  assert.doesNotMatch(previs, /PreproductionStageRail active="previs"/u);
  assert.doesNotMatch(previs, /BlockVisualJourneyWorkspace/u);

  assert.match(surfaces, /export function SkinV1PrevisStoryMap/u);
  assert.match(surfaces, /surfaceLabel="Previs"/u);
  assert.match(map, /surfaceLabel === "Previs" \? "Previs" : "The story is the navigation\."/u);
  assert.match(surfaces, /<PrevisReadinessWorkspace[\s\S]*embeddedNavigation/u);
  assert.match(map, /missing: "AVAILABLE"/u);
  assert.match(map, /locked: "BLOCKED"/u);
  assert.match(map, /surfaceLabel\?: "Outline" \| "Storyboard" \| "Previs"/u);
});

test("#2456 Previs Flip Book exposes 25 positions but only locked Storyboard frames are authoritative", async () => {
  const [workspace, css] = await Promise.all([
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("app/_components/previs/previs-readiness-workspace.module.css"),
  ]);

  assert.match(workspace, /data-previs-flipbook="25-positions"/u);
  assert.match(workspace, /Array\.from\(\{ length: 25 \}/u);
  assert.match(workspace, /artifact\.workflow === "storyboard-frame-webp-v2"/u);
  assert.match(workspace, /acceptedVisualIds\.has\(artifact\.id\) && artifact\.reviewState === "accepted"/u);
  assert.match(workspace, /Only Keep \/ Lock frames are authoritative Previs inputs/u);
  assert.match(workspace, /Play Flip Book/u);
  assert.match(workspace, /Scene/u);
  assert.match(workspace, /Beat Detail/u);
  assert.match(workspace, /Shot/u);
  assert.match(workspace, /Frame/u);
  assert.match(workspace, /does not create a canonical Beat/u);
  assert.match(css, /\.flipBookStrip/u);
  assert.match(css, /grid-template-columns: repeat\(25/u);
});

test("#2456 standalone Previs also groups navigation by four Acts and six Blocks", async () => {
  const [workspace, css] = await Promise.all([
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("app/_components/previs/previs-readiness-workspace.module.css"),
  ]);

  assert.match(workspace, /aria-label="Previs Acts"/u);
  assert.match(workspace, /\[1, 2, 3, 4\]\.map/u);
  assert.match(workspace, /const actBlocks = projection\.blocks\.filter/u);
  assert.match(workspace, /missing: "AVAILABLE"/u);
  assert.match(workspace, /locked: "BLOCKED"/u);
  assert.match(css, /\.actRail/u);
  assert.match(css, /grid-template-columns: repeat\(4/u);
  assert.match(css, /\.tabRail[\s\S]*grid-template-columns: repeat\(6/u);
});
