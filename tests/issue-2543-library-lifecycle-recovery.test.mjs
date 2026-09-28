import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2543 makes Load All perform the restore instead of only selecting groups", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const loadAllStart = source.indexOf("function loadAllLocalResources()");
  const loadAllEnd = source.indexOf("function restoreSelectedLocalResources()", loadAllStart);
  const loadAll = source.slice(loadAllStart, loadAllEnd);

  assert.match(loadAll, /const allOrigins = recovery\.inventory\.groups\.map\(\(group\) => group\.originProjectId\)/u);
  assert.match(loadAll, /setSelectedRecoveryOrigins\(allOrigins\)/u);
  assert.match(loadAll, /restoreLocalResources\(allOrigins\)/u);
  assert.match(source, />\{restoringResources \? "Restoring All…" : "Load All"\}<\/button>/u);
});

test("#2543 keeps recovery failures actionable and never strands the loaded story", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");

  assert.match(source, /const LOCAL_RESOURCE_SCAN_TIMEOUT_MS = 8_000/u);
  assert.match(source, /const controller = new AbortController\(\)/u);
  assert.match(source, /window\.setTimeout\(\(\) => controller\.abort\(\), LOCAL_RESOURCE_SCAN_TIMEOUT_MS\)/u);
  assert.match(source, /signal: controller\.signal/u);
  assert.match(source, /Local resource scan timed out\. The story is still loaded; retry the scan or continue with project defaults\./u);
  assert.match(source, /async function retryLocalResourceScan\(\)/u);
  assert.match(source, />\{rescanningResources \? "Scanning Again…" : "Retry Resource Scan"\}<\/button>/u);
  assert.match(source, /function useProjectDefaults\(\)[\s\S]*setRecovery\(null\)[\s\S]*openActiveProject\(\)/u);
  assert.match(source, /finally \{[\s\S]*setRestoringResources\(false\)[\s\S]*\}/u);
});

test("#2543 keeps saved-project identity stable while LOAD becomes an Examples gateway", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const confirmStart = source.indexOf("async function confirmLoad()");
  const confirmEnd = source.indexOf("function useProjectDefaults()", confirmStart);
  const confirmLoad = source.slice(confirmStart, confirmEnd);
  const loadSurfaceStart = source.indexOf('if (destination === "load")');
  const loadSurfaceEnd = source.indexOf('if (destination === "examples"', loadSurfaceStart);
  const loadSurface = source.slice(loadSurfaceStart, loadSurfaceEnd);

  assert.match(confirmLoad, /if \(pending\.kind === "story"\) \{[\s\S]*openedProject = switchActiveLibraryProject\(pending\.item\.id\)/u);
  assert.match(confirmLoad, /else \{[\s\S]*openedProject = createLibraryWorkingCopy\(/u);
  assert.match(confirmLoad, /markCurrentSessionLibraryProject\(openedProject\.id\)/u);
  assert.match(loadSurface, /<ExampleGatewayCard/u);
  assert.match(loadSurface, /setDestination\("examples"\)/u);
  assert.match(source, />Open Example<\/button>/u);
  assert.doesNotMatch(loadSurface, /StoryCard|Archive story|Open Saved Story|Start Fresh Afterglow Copy/u);
});

test("#2543 restores only into the active recovery project and keeps controls retryable on failure", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const restoreStart = source.indexOf("function restoreLocalResources(");
  const restoreEnd = source.indexOf("function loadAllLocalResources()", restoreStart);
  const restore = source.slice(restoreStart, restoreEnd);

  assert.match(restore, /if \(!current \|\| current\.id !== recovery\.project\.id\)/u);
  assert.match(restore, /throw new Error\("The active story changed before local resources were restored\."\)/u);
  assert.match(restore, /saveActiveLibraryProject\(characterResult\.project\)/u);
  assert.match(restore, /catch \(error\)[\s\S]*setNotice/u);
  assert.match(restore, /finally \{[\s\S]*setRestoringResources\(false\)/u);
});
