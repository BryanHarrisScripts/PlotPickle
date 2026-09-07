import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1745 active projects enter the Story Map while LEARN stays explicit support", async () => {
  const [page, workspace, dashboard, shell] = await Promise.all([
    read("app/page.tsx"),
    read("app/story-map-workspace.tsx"),
    read("modules/dashboard/ui/dashboard-workspace.tsx"),
    read("app/story-map-shell.tsx"),
  ]);

  assert.match(page, /hasActiveLibraryProject\(\) \? "dashboard" : "library"/);
  assert.match(page, /requested === "learn"/);
  assert.match(page, /<StoryMapShell onNavigate=\{navigateWorkspace\}>[\s\S]*<StoryMapWorkspace/);
  assert.match(workspace, /<ProgressiveStoryMap project=\{project\} \/>/);
  assert.match(workspace, /<DashboardWorkspace/);
  assert.match(dashboard, /Your whole story is the main menu\./);
  assert.doesNotMatch(dashboard, /modules\/build|\.\.\/\.\.\/build/);
  assert.match(shell, /aria-label="Story Map utilities"/);
  for (const utility of ["Projects", "Learn", "Community", "Settings", "Profile"]) assert.match(shell, new RegExp(`>${utility}<`));
  assert.doesNotMatch(shell, /NAVIGATION_AREAS|WORKFLOW_SHORTCUTS|Storyboard.*Write.*Edit/s);
});

test("#1745 Block 01 is available and later Blocks unlock from accepted Mini-Block visuals, never LEARN", async () => {
  const projection = await read("modules/build/progressive-story-map.ts");

  assert.match(projection, /const unlocked = number === 1 \|\| completedBlockIds\.has/);
  assert.match(projection, /acceptedMiniBlockCount === 4/);
  assert.match(projection, /storyboard-anchor:block:block-/);
  assert.match(projection, /This Block stays visible for orientation/);
  assert.doesNotMatch(projection, /completedLessonIds|project\.learning/);
});

test("#1745 Story Map keeps PLAN BUILD STORYBOARD local and visual collection additive", async () => {
  const map = await read("modules/build/ui/progressive-story-map.tsx");

  assert.match(map, /The story is the navigation\./);
  assert.match(map, /href=\{`\/\?workspace=plan&block=\$\{selected\.number\}&mini=\$\{selectedMini\.number\}`\}>PLAN/);
  assert.match(map, /href=\{`\/\?workspace=build&block=\$\{selected\.number\}&mini=\$\{selectedMini\.number\}`\}>BUILD/);
  assert.match(map, /href=\{`\/storyboard\?block=\$\{selected\.number\}&mini=\$\{selectedMini\.number\}`\}>STORYBOARD/);
  assert.match(map, /\/api\/local-ai\/generate\/image/);
  assert.match(map, /type: "foundations\.visual\.store"/);
  assert.match(map, /type: "foundations\.visual\.accept"/);
  assert.match(map, /type: "foundations\.visual\.unaccept"/);
  assert.match(map, /reviewState: "draft"/);
  assert.match(map, /Other candidates remain available/);
  assert.match(map, /Confirm paid image request/);
});

test("#1745 Storyboard restores the selected Block from Story Map context", async () => {
  const [page, workspace] = await Promise.all([
    read("app/storyboard/page.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
  ]);

  assert.match(page, /search\.get\("block"\)/);
  assert.match(page, /initialBlockNumber=\{initialBlockNumber\}/);
  assert.match(workspace, /readonly initialBlockNumber\?: number/);
  assert.match(workspace, /useState\(\(\) => boundedBlockNumber\(initialBlockNumber\)\)/);
});

test("#1745 new Story Map styling uses PlotPickle tokens rather than a second visual system", async () => {
  const [shellStyles, mapStyles, storyboardStyles] = await Promise.all([
    read("app/story-map-shell.module.css"),
    read("modules/build/ui/progressive-story-map-v2.module.css"),
    read("app/storyboard/storyboard-page.module.css"),
  ]);

  for (const source of [shellStyles, mapStyles, storyboardStyles]) {
    assert.match(source, /var\(--pp-/);
    assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b/i);
    assert.doesNotMatch(source, /rgba?\(/i);
  }
});
