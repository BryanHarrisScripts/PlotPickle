import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2432/#2559 keeps local-resource recovery behind Restore Your Changes while LOAD points to Examples", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const loadSurface = source.slice(source.indexOf('if (destination === "load")'), source.indexOf('if (destination === "examples"'));

  assert.match(loadSurface, /<ExampleGatewayCard/u);
  assert.match(loadSurface, /setDestination\("examples"\)/u);
  assert.doesNotMatch(loadSurface, /kind: "catalog"|StoryCard|Open Saved Story|Resume Saved Story/u);
  assert.match(source, /async function loadPackagedExample\(item: LibraryCatalogItem, mode: "defaults" \| "restore"\)/u);
  assert.match(source, /createLibraryLoadSessionBaseline\(openedProject/u);
  assert.match(source, /persistLoadSessionBaseline\(baseline\)/u);
  assert.match(source, /if \(mode === "defaults"\)[\s\S]*await openActiveProject\(\)[\s\S]*return;/u);
  assert.match(source, /inventory = await scanLocalResources\(openedProject\)/u);
  assert.match(source, /fetch\("\/api\/local-ai\/assets"/u);
  assert.match(source, /inventoryLocalResources\(openedProject/u);
});

test("#2432/#2559 keeps project defaults and local change restore as separate Human choices", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  assert.match(source, />Project Defaults<\/button>/u);
  assert.match(source, />Restore Your Changes<\/button>/u);
  assert.match(source, />Continue Without Local Media<\/button>/u);
  assert.doesNotMatch(source, />Use Project Defaults<\/button>/u);
  assert.match(source, />\{restoringResources \? "Restoring…" : "Restore Selected Changes"\}<\/button>/u);
  assert.match(source, />\{restoringResources \? "Restoring All…" : "Load All"\}<\/button>/u);
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

test("#2432/#2559 removes saved-story Resume from LOAD without bypassing recovery authority", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const loadSurface = source.slice(source.indexOf('if (destination === "load")'), source.indexOf('if (destination === "examples"'));

  assert.doesNotMatch(loadSurface, /Resume Saved Story|Open Saved Story|onClick=\{onOpen\}/u);
  assert.match(source, />Restore Your Changes<\/button>/u);
  assert.match(source, /const openedProject = switchActiveLibraryProject\(afterglowLocalState\.id\)/u);
  assert.match(source, /setRecovery\(\{ project: openedProject, baseline, inventory, scanError \}\)/u);
});
