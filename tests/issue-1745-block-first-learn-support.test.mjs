import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#1745 root and Library no longer make LEARN the story-entry gate", async () => {
  const [home, library] = await Promise.all([
    source("app/page.tsx"),
    source("modules/library/ui/library-workspace.tsx"),
  ]);

  assert.match(home, /typeof window === "undefined"\) return "library"/u);
  assert.match(home, /requested === "learn"\) return "learn"/u);
  assert.match(home, /useState<Workspace>\("library"\)/u);

  assert.match(library, /window\.location\.assign\("\/story-map"\)/u);
  assert.match(library, /move straight into Block 01/u);
  assert.doesNotMatch(library, /workspace=learn/u);
});

test("#1745 global navigation makes Story Map primary Create and keeps LEARN beside Settings", async () => {
  const shortcuts = await source("app/navigation/global-shortcuts.ts");

  assert.match(shortcuts, /id: "create", label: "Create", detail: "Story Map, plan, build"/u);
  assert.match(shortcuts, /id: "story-map"[\s\S]*label: "Story Map"[\s\S]*area: "create"[\s\S]*href: "\/story-map"/u);
  assert.match(shortcuts, /id: "settings", label: "Settings", detail: "Settings and guides"/u);
  assert.match(shortcuts, /id: "learn"[\s\S]*label: "Learn"[\s\S]*area: "settings"[\s\S]*workspace: "learn"/u);

  const storyMapIndex = shortcuts.indexOf('id: "story-map"');
  const planIndex = shortcuts.indexOf('id: "plan"');
  const buildIndex = shortcuts.indexOf('id: "build"');
  const settingsIndex = shortcuts.indexOf('id: "settings"');
  const learnIndex = shortcuts.indexOf('id: "learn"');
  assert.ok(storyMapIndex < planIndex && planIndex < buildIndex, "Create order must remain Story Map → Plan → Build");
  assert.ok(settingsIndex < learnIndex, "Settings remains the primary utility destination while LEARN stays beside it");
});

test("#1745 Story Map starts at canonical Block 01 and four mini-block anchors without shadow storage", async () => {
  const [page, workspace] = await Promise.all([
    source("app/story-map/page.tsx"),
    source("app/story-map/story-map-workspace.tsx"),
  ]);

  assert.match(page, /activeShortcutId="story-map"/u);
  assert.match(page, /4 Acts · 24 Blocks · 96 Mini-Blocks/u);

  assert.match(workspace, /loadActiveLibraryProject/u);
  assert.match(workspace, /saveActiveLibraryProject/u);
  assert.match(workspace, /storyBlockState/u);
  assert.match(workspace, /storyMiniBlockState/u);
  assert.match(workspace, /"Awakening"/u);
  assert.match(workspace, /ACT_NUMBERS = \[1, 2, 3, 4\]/u);
  assert.match(workspace, /<dt>Blocks<\/dt><dd>24<\/dd>/u);
  assert.match(workspace, /<dt>Mini-Blocks<\/dt><dd>96<\/dd>/u);
  assert.match(workspace, /PLAN → BUILD → STORYBOARD/u);
  assert.match(workspace, /MINI-BLOCK ANCHOR/u);
  assert.match(workspace, /\{activeBlock\.number\}\.\{mini\.ordinal\}/u);
  assert.doesNotMatch(workspace, /localStorage/u);
  assert.doesNotMatch(workspace, /plotpickle\.project\.v1/u);
  assert.doesNotMatch(workspace, /WRITE/u);
});
