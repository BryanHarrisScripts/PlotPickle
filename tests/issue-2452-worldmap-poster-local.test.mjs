import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2452 uses WorldMap as one word and graduates the connected Dashboard row to green", async () => {
  const [menu, host, registryText, surface] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("config/skin-v1-surface-registry.json"),
    read("app/skin-v1/story-bible-surface.tsx"),
  ]);
  const registry = JSON.parse(registryText);
  const storyBible = registry.surfaces.find((item) => item.id === "story-bible");
  const review = menu.slice(
    menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"),
    menu.indexOf("export const DASHBOARD_UNAVAILABLE_ITEM_IDS"),
  );
  const connected = menu.slice(
    menu.indexOf("export const CONNECTED_DASHBOARD_ITEM_IDS"),
    menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"),
  );

  assert.match(menu, /label: "WorldMap"/u);
  assert.match(connected, /"story-bible"/u);
  assert.doesNotMatch(review, /"story-bible"/u);
  assert.match(host, /onSurfaceNameChange\("WORLDMAP"\)/u);
  assert.equal(storyBible?.label, "WorldMap");
  assert.equal(storyBible?.navigationPath?.[0]?.label, "WorldMap");
  assert.match(surface, /WORLDMAP · STORY BIBLE · HUMAN-REVIEWED DEVELOPMENT/u);
});

test("#2452 exposes a truthful, explicit Generate Poster Visual action and saves only durable local output", async () => {
  const [surface, styles] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/story-bible-surface.module.css"),
  ]);

  assert.match(surface, /Generate Poster Visual/u);
  assert.match(surface, /worldMapPosterPrompt/u);
  assert.match(surface, /title: bible\.title/u);
  assert.match(surface, /logline: bible\.logline\.value/u);
  assert.match(surface, /FEATURED CHARACTERS:/u);
  assert.match(surface, /ACTOR CAST: TBD/u);
  assert.match(surface, /DIRECTED BY TBD/u);
  assert.match(surface, /PRODUCED BY TBD/u);
  assert.match(surface, /MUSICAL SCORE BY TBD/u);
  assert.match(surface, /Do not invent actor identities, director names, producer names, composer names/u);
  assert.match(surface, /fetch\("\/api\/local-ai\/generate\/image"/u);
  assert.match(surface, /assetId: `worldmap-poster-\$\{project\.id\}`/u);
  assert.match(surface, /result\.assetUrl\.startsWith\("\/api\/local-ai\/assets\/"\)/u);
  assert.match(surface, /createFirstMarketingReferenceArtifact/u);
  assert.match(surface, /type: "foundations\.visual\.store"/u);
  assert.match(surface, /saveActiveLibraryProject\(next\)/u);
  assert.match(surface, /className=\{styles\.primaryAction\}[^>]*Generate/u);
  assert.match(surface, /Generate Character Visual/u);
  assert.match(styles, /\.primaryAction/u);
  assert.match(styles, /--pp-skin-accent-bright/u);
  assert.match(styles, /cursor: pointer/u);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b|rgba?\(/iu);
});

test("#2452 inventories and restores project-addressed WorldMap poster assets without promoting story canon", async () => {
  const [recovery, library] = await Promise.all([
    read("modules/library/local-resource-recovery.ts"),
    read("modules/library/ui/library-workspace.tsx"),
  ]);

  assert.match(recovery, /const WORLDMAP_POSTER_FILE/u);
  assert.match(recovery, /parseRecoverableWorldMapPosterAsset/u);
  assert.match(recovery, /kind: "worldmap-poster"/u);
  assert.match(recovery, /posterResources/u);
  assert.match(recovery, /restoreLocalWorldMapPosterResources/u);
  assert.match(recovery, /FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW/u);
  assert.match(recovery, /reviewState: "draft"/u);
  assert.match(recovery, /provider: "local recovery"/u);
  assert.match(recovery, /recovery-origin-project:/u);
  assert.doesNotMatch(recovery, /foundations\.visual\.accept/u);

  assert.match(library, /restoreLocalWorldMapPosterResources\(storyboardResult\.project, posterResources\)/u);
  assert.match(library, /recoverable WorldMap poster/u);
  assert.match(library, /promote story canon/u);
  assert.match(library, /requires your explicit selection/u);
});

test("#2452 keeps the issue brief in-repo for implementation and acceptance evidence", async () => {
  const brief = await read("docs/developer-briefs/2452-worldmap-poster-local.md");
  assert.match(brief, /Issue: #2452/u);
  assert.match(brief, /persistentHome\(\)\/assets/u);
  assert.match(brief, /Resuming the saved Afterglow working story restores the persisted Marketing Reference directly/u);
  assert.match(brief, /merge when all required checks are green/u);
});
