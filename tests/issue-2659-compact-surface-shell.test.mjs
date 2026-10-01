import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2659 Mind Map, World Map, and Outline consume one shared Story Act rail", async () => {
  const [rail, mindMap, worldMap, host] = await Promise.all([
    read("app/skin-v1/story-act-rail.tsx"),
    read("app/skin-v1/discovery-surface.tsx"),
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);

  assert.match(rail, /export const STORY_ACTS: readonly StoryAct\[\] = \[1, 2, 3, 4\]/u);
  assert.match(rail, /data-shared-story-act-rail="true"/u);
  assert.match(rail, /data-story-act-rail="four-acts"/u);
  assert.match(rail, /aria-keyshortcuts=\{String\(act\)\}/u);
  assert.match(rail, /closest\("input, textarea, select, \[contenteditable=/u);
  assert.match(rail, /handleStoryActShortcut/u);

  assert.match(mindMap, /import \{ handleStoryActShortcut, STORY_ACTS, StoryActRail \} from "\.\/story-act-rail"/u);
  assert.match(mindMap, /<StoryActRail activeAct=\{selectedAct\} ariaLabel="MindMap acts" choiceDataAttribute="data-mind-map-act-choice" onOpen=\{changeAct\} \/>/u);
  assert.match(mindMap, /onKeyDown=\{\(event\) => handleStoryActShortcut\(event, changeAct\)\}/u);
  assert.doesNotMatch(mindMap, /className=\{styles\.actRail\}/u);

  assert.match(worldMap, /import \{ handleStoryActShortcut, StoryActRail \} from "\.\/story-act-rail"/u);
  assert.match(worldMap, /<StoryActRail activeAct=\{selectedAct\} ariaLabel="World Map acts" choiceDataAttribute="data-world-map-act-choice" onOpen=\{setSelectedAct\} \/>/u);
  assert.match(worldMap, /onKeyDown=\{\(event\) => handleStoryActShortcut\(event, setSelectedAct\)\}/u);
  assert.doesNotMatch(worldMap, /className=\{styles\.actNav\}/u);

  assert.match(host, /import \{ StoryActRail \} from "\.\/story-act-rail"/u);
  assert.doesNotMatch(host, /function StoryActRail/u);

  const outline = host.slice(host.indexOf("if (outlineOpen)"), host.indexOf("if (buildOpen)"));
  assert.ok(outline.indexOf("<StoryActRail") >= 0);
  assert.ok(outline.indexOf("<StoryActRail") < outline.indexOf("<MatrixStoryMapSurface"));
});

test("#2659 shared rail is first-level navigation before surface-specific menus", async () => {
  const [mindMap, worldMap] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("app/skin-v1/story-bible-surface.tsx"),
  ]);

  assert.ok(mindMap.indexOf("<StoryActRail") < mindMap.indexOf('className={styles.summary}'));
  assert.ok(mindMap.indexOf("<StoryActRail") < mindMap.indexOf('className={styles.topicRail}'));
  assert.ok(worldMap.indexOf("<StoryActRail") < worldMap.indexOf('className={styles.sectionNav}'));
});

test("#2659 duplicate Act rail styling is removed and Library stays Act-free", async () => {
  const [mindCss, worldCss, libraryCss, library] = await Promise.all([
    read("app/skin-v1/discovery-surface.module.css"),
    read("app/skin-v1/story-bible-surface.module.css"),
    read("modules/library/ui/library-workspace.module.css"),
    read("modules/library/ui/library-workspace.tsx"),
  ]);

  assert.doesNotMatch(mindCss, /\.actRail/u);
  assert.doesNotMatch(worldCss, /\.actNav/u);
  assert.match(mindCss, /\.surface \{[\s\S]*gap: var\(--pp-skin-space-3\)/u);
  assert.match(worldCss, /padding: var\(--pp-skin-space-3\) 0 var\(--pp-skin-space-6\)/u);
  assert.match(libraryCss, /padding: var\(--pp-skin-space-4\) var\(--pp-skin-space-4\) var\(--pp-skin-space-6\)/u);
  assert.doesNotMatch(library, /StoryActRail|data-story-act-rail|aria-label="Library acts"/u);
});
