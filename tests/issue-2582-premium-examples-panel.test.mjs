import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2582 keeps the Afterglow poster treatment as the visual anchor", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");

  assert.match(source, /className=\{styles\.examplePoster\}/u);
  assert.match(source, /data-example-poster-count=\{examplePosters\.length\}/u);
  assert.match(source, /Previous Afterglow poster/u);
  assert.match(source, /Next Afterglow poster/u);
  assert.match(source, /sizes="\(max-width: 760px\) 100vw, 42vw"/u);
});

test("#2582 gives the right-hand example panel a cinematic editorial hierarchy", async () => {
  const [source, css] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/ui/library-workspace.module.css"),
  ]);

  for (const token of [
    "Packaged Reference Story",
    "Canonical package",
    "Logline",
    "What’s included",
    "Complete v9 screenplay",
    "storyboard visuals",
    "character references",
    "poster versions",
  ]) assert.ok(source.includes(token), `Missing Examples editorial element: ${token}`);

  for (const selector of [
    ".exampleDetails",
    ".exampleEyebrow",
    ".exampleTitle",
    ".exampleMetaLine",
    ".exampleDescriptor",
    ".exampleLogline",
    ".exampleIncluded",
    ".exampleActionArea",
    ".exampleActionHelp",
  ]) assert.ok(css.includes(selector), `Missing premium Examples selector: ${selector}`);

  assert.match(css, /\.exampleLogline \{[\s\S]*border-top:[\s\S]*border-bottom:/u);
  assert.doesNotMatch(css, /\.exampleLogline \{[\s\S]*background: var\(--pp-skin-surface-0\)/u);
});

test("#2582 derives included visual counts from the canonical packaged manifest", async () => {
  const [source, manifestText] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("data/afterglow-packaged-current/manifest.json"),
  ]);
  const manifest = JSON.parse(manifestText);
  const storyboard = manifest.assets.filter((asset) => asset.publicUrl.includes("/storyboard-")).length;
  const characters = manifest.assets.filter((asset) => asset.publicUrl.includes("/world-map-character-")).length;
  const posters = manifest.featuredPosterUrls.length;

  assert.ok(storyboard > 0);
  assert.ok(characters > 0);
  assert.ok(posters > 0);
  assert.match(source, /AFTERGLOW_PACKAGED_ASSET_COUNTS/u);
  assert.match(source, /packagedAfterglowManifest\.assets\.filter\(\(asset\) => asset\.publicUrl\.includes\("\/storyboard-"\)\)\.length/u);
  assert.match(source, /packagedAfterglowManifest\.assets\.filter\(\(asset\) => asset\.publicUrl\.includes\("\/world-map-character-"\)\)\.length/u);
  assert.match(source, /packagedAfterglowManifest\.featuredPosterUrls\.length/u);
});

test("#2582 preserves #2581 load semantics while correcting action emphasis", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");

  assert.match(source, /className=\{styles\.primaryButton\}[\s\S]*onLoad\("defaults"\)[\s\S]*>Open Example<\/button>/u);
  assert.match(source, /className=\{styles\.secondaryButton\}[\s\S]*onLoad\("restore"\)[\s\S]*>Open Example with Your Changes<\/button>/u);
  assert.match(source, /loadPackagedExample\(item, mode \?\? "defaults"\)/u);
  assert.match(source, /mode === "defaults"/u);
  assert.match(source, /AFTERGLOW_EXAMPLE_DEFAULTS_SOURCE_ID/u);
  assert.match(source, /Open Example starts from the canonical packaged reference/u);
  assert.match(source, /profile-local Afterglow overlay only when you choose it/u);
});

test("#2582 leads Examples with project value instead of loading mechanics", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");

  assert.match(source, /Explore Afterglow as PlotPickle’s complete packaged reference story/u);
  assert.doesNotMatch(source, /This is the complete Afterglow reference story packaged with PlotPickle\. The packaged source never changes\. Open Example starts/u);
});
