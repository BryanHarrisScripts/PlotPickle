import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2659/#2667 keeps one canonical Act shortcut source while separating the Mind/World family from preproduction", async () => {
  const [rail, shared, mindMap, worldMap, host] = await Promise.all([
    read("app/skin-v1/story-act-rail.tsx"),
    read("app/skin-v1/story-development-surface-header.tsx"),
    read("app/skin-v1/discovery-surface.tsx"),
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);

  assert.match(rail, /export const STORY_ACTS: readonly StoryAct\[\] = \[1, 2, 3, 4\]/u);
  assert.match(rail, /handleStoryActShortcut/u);
  assert.match(rail, /closest\("input, textarea, select, \[contenteditable=/u);

  assert.match(shared, /import \{ STORY_ACTS, type StoryAct \} from "\.\/story-act-rail"/u);
  assert.match(shared, /data-story-development-family="mind-world"/u);
  assert.match(shared, /data-story-development-act-rail="shared"/u);
  assert.match(shared, /aria-keyshortcuts=\{String\(act\)\}/u);

  assert.match(mindMap, /<StoryDevelopmentSurfaceHeader/u);
  assert.match(mindMap, /surfaceId="mind-map"/u);
  assert.match(mindMap, /onKeyDown=\{\(event\) => handleStoryActShortcut\(event, changeAct\)\}/u);
  assert.match(worldMap, /<StoryDevelopmentSurfaceHeader/u);
  assert.match(worldMap, /surfaceId="world-map"/u);
  assert.match(worldMap, /onKeyDown=\{\(event\) => handleStoryActShortcut\(event, setSelectedAct\)\}/u);

  // Outline remains on the preproduction StoryActRail rather than joining the Mind/World surface family.
  assert.match(host, /import \{ StoryActRail \} from "\.\/story-act-rail"/u);
  const outline = host.slice(host.indexOf("if (outlineOpen)"), host.indexOf("if (buildOpen)"));
  assert.ok(outline.indexOf("<StoryActRail") >= 0);
  assert.doesNotMatch(outline, /StoryDevelopmentSurfaceHeader/u);
});

test("#2659/#2667 shared Mind/World header is first-level navigation before each compact work region", async () => {
  const [mindMap, worldMap] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("app/skin-v1/story-bible-surface.tsx"),
  ]);

  assert.ok(mindMap.indexOf("<StoryDevelopmentSurfaceHeader") < mindMap.indexOf('data-story-development-work-region="mind-map"'));
  assert.ok(worldMap.indexOf("<StoryDevelopmentSurfaceHeader") < worldMap.indexOf('data-story-development-work-region="world-map"'));
});

test("#2659/#2667 Library remains outside the shared Mind/World family", async () => {
  const [sharedStyles, mindCss, worldCss, libraryCss, library] = await Promise.all([
    read("app/skin-v1/story-development-surface-header.module.css"),
    read("app/skin-v1/discovery-surface.module.css"),
    read("app/skin-v1/story-bible-surface.module.css"),
    read("modules/library/ui/library-workspace.module.css"),
    read("modules/library/ui/library-workspace.tsx"),
  ]);

  assert.match(sharedStyles, /\.actRail \{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/u);
  assert.match(sharedStyles, /\.topicRail \{[\s\S]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/u);
  assert.match(mindCss, /\.workRegion \{/u);
  assert.match(worldCss, /\.workRegion \{/u);
  assert.match(libraryCss, /padding: var\(--pp-skin-space-4\) var\(--pp-skin-space-4\) var\(--pp-skin-space-6\)/u);
  assert.doesNotMatch(library, /StoryDevelopmentSurfaceHeader|data-story-development-family/u);
});
