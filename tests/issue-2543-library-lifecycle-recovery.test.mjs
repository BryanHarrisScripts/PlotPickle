import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2543/#2566 Select All only selects groups and one Restore performs the load", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const selectAllStart = source.indexOf("function selectAllLocalResources()");
  const selectAllEnd = source.indexOf("function toggleRecoveryOrigin", selectAllStart);
  const selectAll = source.slice(selectAllStart, selectAllEnd);

  assert.match(selectAll, /recovery\.inventory\.groups\.map\(\(group\) => group\.originProjectId\)/u);
  assert.match(selectAll, /setSelectedRecoveryOrigins/u);
  assert.doesNotMatch(selectAll, /restoreLocalResources/u);
  assert.match(source, />Select All<\/button>/u);
  assert.match(source, />\{restoringResources \? "Restoring…" : "Restore"\}<\/button>/u);
  assert.doesNotMatch(source, /Load All|Restore Selected Changes|Continue Without Local Media/u);
});

test("#2543/#2566 keeps recovery failures actionable and cancellation non-destructive", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");

  assert.match(source, /const LOCAL_RESOURCE_SCAN_TIMEOUT_MS = 8_000/u);
  assert.match(source, /const controller = new AbortController\(\)/u);
  assert.match(source, /window\.setTimeout\(\(\) => controller\.abort\(\), LOCAL_RESOURCE_SCAN_TIMEOUT_MS\)/u);
  assert.match(source, /signal: controller\.signal/u);
  assert.match(source, /Local resource scan timed out\. Retry the scan before restoring local media\./u);
  assert.match(source, /async function retryLocalResourceScan\(\)/u);
  assert.match(source, />\{rescanningResources \? "Scanning Again…" : "Retry Resource Scan"\}<\/button>/u);
  assert.match(source, /function cancelRecovery\(\)[\s\S]*setRecovery\(null\)[\s\S]*setSelectedRecoveryOrigins\(\[\]\)/u);
  const cancel = source.slice(source.indexOf("function cancelRecovery()"), source.indexOf("function selectAllLocalResources()"));
  assert.doesNotMatch(cancel, /openActiveProject|switchActiveLibraryProject|restoreLocalResources/u);
  assert.match(source, /finally \{[\s\S]*setRestoringResources\(false\)[\s\S]*\}/u);
});

test("#2543/#2570 keeps saved-project identity stable while LOAD shows examples and Human stories", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const confirmStart = source.indexOf("async function confirmLoad()");
  const confirmEnd = source.indexOf("function cancelRecovery()", confirmStart);
  const confirmLoad = source.slice(confirmStart, confirmEnd);
  const loadSurfaceStart = source.indexOf('if (destination === "load")');
  const loadSurfaceEnd = source.indexOf('if (destination === "examples"', loadSurfaceStart);
  const loadSurface = source.slice(loadSurfaceStart, loadSurfaceEnd);

  assert.match(confirmLoad, /if \(pending\.kind === "story"\) \{[\s\S]*openedProject = switchActiveLibraryProject\(pending\.item\.id\)/u);
  assert.match(confirmLoad, /markCurrentSessionLibraryProject\(openedProject\.id\)/u);
  assert.match(loadSurface, /<ExampleGatewayCard/u);
  assert.match(loadSurface, /setDestination\("examples"\)/u);
  assert.match(loadSurface, /posterUrls=\{afterglowPosters\}/u);
  assert.match(loadSurface, /<SavedStoryLoadCard/u);
  assert.match(loadSurface, /setPending\(\{ kind: "story", item: entry\.item \}\)/u);
  assert.match(source, /className=\{styles\.loadPosterButton\}/u);
  assert.doesNotMatch(loadSurface, /Archive story|Start Fresh Afterglow Copy/u);
});
test("#2543/#2566 switches into the recovery project only when final Restore is chosen", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const restoreStart = source.indexOf("function restoreLocalResources(");
  const restoreEnd = source.indexOf("function restoreSelectedLocalResources()", restoreStart);
  const restore = source.slice(restoreStart, restoreEnd);

  assert.match(restore, /const current = switchActiveLibraryProject\(recovery\.project\.id\)/u);
  assert.match(restore, /markCurrentSessionLibraryProject\(current\.id\)/u);
  assert.match(restore, /persistLoadSessionBaseline\(recovery\.baseline\)/u);
  assert.match(restore, /saveActiveLibraryProject\(characterResult\.project\)/u);
  assert.match(restore, /catch \(error\)[\s\S]*setNotice/u);
  assert.match(restore, /finally \{[\s\S]*setRestoringResources\(false\)/u);
});
