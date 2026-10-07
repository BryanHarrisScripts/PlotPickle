import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2432/#2570 keeps example recovery behind Examples while LOAD also exposes saved Human stories", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const loadSurface = source.slice(source.indexOf('if (destination === "load")'), source.indexOf('if (destination === "examples"'));

  assert.match(loadSurface, /<ExampleGatewayCard/u);
  assert.match(loadSurface, /setDestination\("examples"\)/u);
  assert.doesNotMatch(loadSurface, /kind: "catalog"|Resume Saved Story/u);
  assert.match(loadSurface, /<SavedStoryLoadCard/u);
  assert.match(loadSurface, /setPending\(\{ kind: "story", item: entry\.item \}\)/u);
  assert.match(source, /async function loadPackagedExample\(item: LibraryCatalogItem, mode: "defaults" \| "restore"\)/u);
  assert.match(source, /createLibraryLoadSessionBaseline\(openedProject/u);
  assert.match(source, /persistLoadSessionBaseline\(baseline\)/u);
  assert.match(source, /if \(mode === "defaults"\)[\s\S]*await openActiveProject\(\)[\s\S]*return;/u);
  assert.match(source, /inventory = await scanLocalResources\(openedProject\)/u);
  assert.match(source, /fetch\("\/api\/local-ai\/assets"/u);
  assert.match(source, /inventoryLocalResources\(openedProject/u);
});

test("#2432/#2823 keeps clean example and saved-state resume as separate Human choices", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  assert.match(source, />Open Example<\/button>/u);
  assert.match(source, />Open Example with Your Changes<\/button>/u);
  assert.match(source, /Resume Saved Afterglow/u);
  assert.doesNotMatch(source, />Select All<\/button>|requires your explicit selection|selectedRecoveryOrigins/u);
  assert.match(source, /function expectedLocalAssetUrls/u);
  assert.match(source, /function resumeInventoryResources/u);
  assert.match(source, /expected\.has\(resource\.assetUrl\)/u);
  assert.match(source, /async function continueSavedStoryResume/u);
  assert.match(source, /restoreLocalStoryboardResources\(current, storyboardResources, storyboardSourceProjects\)/u);
  assert.match(source, /restoreLocalWorldMapPosterResources\(storyboardResult\.project, posterResources\)/u);
  assert.match(source, /restoreLocalWorldMapCharacterResources\(posterResult\.project, characterResources\)/u);
  assert.match(source, /saveActiveLibraryProject\(characterResult\.project\)/u);
  assert.match(source, /Settings → Data Recovery/u);
});

test("#2432/#2570 restores saved-story selection to LOAD without bypassing example recovery authority", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const loadSurface = source.slice(source.indexOf('if (destination === "load")'), source.indexOf('if (destination === "examples"'));

  assert.doesNotMatch(loadSurface, /Resume Saved Story/u);
  assert.match(loadSurface, /<SavedStoryLoadCard/u);
  assert.match(loadSurface, /setPending\(\{ kind: "story", item: entry\.item \}\)/u);
  assert.match(source, />Open Example with Your Changes<\/button>/u);
  assert.match(source, /const openedProject = loadLibraryProjectSnapshot\(afterglowLocalState\.id\)/u);
  assert.match(source, /setRecovery\(\{ project: openedProject, baseline, inventory, scanError \}\)/u);
  assert.match(source, /async function continueSavedStoryResume[\s\S]*switchActiveLibraryProject\(recovery\.project\.id\)/u);
});
