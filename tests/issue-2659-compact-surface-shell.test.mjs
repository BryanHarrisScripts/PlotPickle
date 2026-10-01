import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2659 Mind Map and World Map expose safe 1-4 Act shortcuts", async () => {
  const [mindMap, worldMap] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("app/skin-v1/story-bible-surface.tsx"),
  ]);

  for (const source of [mindMap, worldMap]) {
    assert.match(source, /isEditableActShortcutTarget/u);
    assert.match(source, /closest\("input, textarea, select, \[contenteditable=/u);
    assert.match(source, /aria-keyshortcuts=\{String\(act\)\}/u);
    assert.match(source, /Number\(event\.key\)/u);
  }
  assert.match(mindMap, /MIND_MAP_ACTS\.includes\(act\)/u);
  assert.match(worldMap, /WORLD_MAP_ACTS\.includes\(act\)/u);
});

test("#2659 shared Outline Act rail does not hijack editable controls", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");
  assert.match(host, /function StoryActRail/u);
  assert.match(host, /data-story-act-rail="four-acts"/u);
  assert.match(host, /aria-keyshortcuts=\{String\(act\)\}/u);
  assert.match(host, /closest\("input, textarea, select, \[contenteditable=/u);
  assert.match(host, /<StoryActRail activeAct=\{Math\.floor\(\(reviewAddress\.blockNumber - 1\) \/ 6\) \+ 1\}/u);
});

test("#2659 compact density stays token-driven and Library gets no Act rail", async () => {
  const [mindCss, worldCss, libraryCss, library] = await Promise.all([
    read("app/skin-v1/discovery-surface.module.css"),
    read("app/skin-v1/story-bible-surface.module.css"),
    read("modules/library/ui/library-workspace.module.css"),
    read("modules/library/ui/library-workspace.tsx"),
  ]);

  assert.match(mindCss, /\.surface \{[\s\S]*gap: var\(--pp-skin-space-3\)/u);
  assert.match(worldCss, /padding: var\(--pp-skin-space-3\) 0 var\(--pp-skin-space-6\)/u);
  assert.match(libraryCss, /padding: var\(--pp-skin-space-4\) var\(--pp-skin-space-4\) var\(--pp-skin-space-6\)/u);
  assert.doesNotMatch(library, /StoryActRail|data-story-act-rail|aria-label="Library acts"/u);
});
