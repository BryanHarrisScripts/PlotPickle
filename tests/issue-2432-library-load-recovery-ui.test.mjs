import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2432 puts Afterglow and local-resource recovery under Library Load", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const loadSurface = source.slice(source.indexOf('if (destination === "load")'), source.indexOf('if (destination === "examples"'));

  assert.match(loadSurface, /Afterglow default/u);
  assert.match(loadSurface, />\s*Load Afterglow\s*</u);
  assert.match(loadSurface, /setPending\(\{ kind: "catalog", sourceKind: "example", item: afterglow \}\)/u);
  assert.match(source, /createLibraryLoadSessionBaseline\(openedProject/u);
  assert.match(source, /persistLoadSessionBaseline\(baseline\)/u);
  assert.match(source, /fetch\("\/api\/local-ai\/assets"/u);
  assert.match(source, /inventoryLocalResources\(openedProject/u);
});

test("#2432 keeps project defaults and local resource restore as separate Human choices", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  assert.match(source, />Use Project Defaults<\/button>/u);
  assert.match(source, />\{restoringResources \? "Restoring…" : "Restore Local Resources"\}<\/button>/u);
  assert.match(source, /group\.selectedByDefault/u);
  assert.match(source, /requires your explicit selection/u);
  assert.match(source, /selectedRecoveryOrigins\.includes\(group\.originProjectId\)/u);
  assert.match(source, /restoreLocalStoryboardResources\(current, selected\)/u);
  assert.match(source, /saveActiveLibraryProject\(result\.project\)/u);
  assert.match(source, /Local media restore is additive/u);
  assert.match(source, /require reconciliation rather than last-write-wins/u);
});

test("#2432 routes Resume through Load recovery instead of bypassing it", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const card = source.slice(source.indexOf("function StoryCard"), source.indexOf("function NewStoryCard"));
  assert.match(card, /onClick=\{onOpen\}/u);
  assert.doesNotMatch(card, /onClick=\{active \? openActiveProject : onOpen\}/u);
});
