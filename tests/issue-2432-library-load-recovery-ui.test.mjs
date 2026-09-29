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

test("#2432/#2566 keeps clean example and local-change restore as separate Human choices", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  assert.match(source, />Open Example<\/button>/u);
  assert.match(source, />Open Example with Your Changes<\/button>/u);
  assert.match(source, />Select All<\/button>/u);
  assert.match(source, />\{restoringResources \? "Restoring…" : "Restore"\}<\/button>/u);
  assert.doesNotMatch(source, /Load All|Restore Selected Changes|Continue Without Local Media/u);
  assert.match(source, /group\.selectedByDefault/u);
  assert.match(source, /requires your explicit selection/u);
  assert.match(source, /selectedRecoveryOrigins\.includes\(group\.originProjectId\)/u);
  assert.match(source, /restoreLocalStoryboardResources\(current, storyboardResources, storyboardSourceProjects\)/u);
  assert.match(source, /does not copy World Agent answers, overwrite project defaults, invent approvals, promote story canon/u);
  assert.match(source, /restoreLocalWorldMapPosterResources\(storyboardResult\.project, posterResources\)/u);
  assert.match(source, /restoreLocalWorldMapCharacterResources\(posterResult\.project, characterResources\)/u);
  assert.match(source, /saveActiveLibraryProject\(characterResult\.project\)/u);
  assert.match(source, /Local media restore is additive/u);
  assert.match(source, /require reconciliation rather than last-write-wins/u);
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
  assert.match(source, /function restoreLocalResources[\s\S]*switchActiveLibraryProject\(recovery\.project\.id\)/u);
});
