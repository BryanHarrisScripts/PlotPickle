import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#2167 keeps editable screenplay text inside the profile-owned Library PPF", async () => {
  const [writing, library, importer] = await Promise.all([
    source("core/contracts/block-writing.ts"),
    source("core/storage/project-library-browser.ts"),
    source("modules/library/import/rich-ppf-to-library-project.ts"),
  ]);

  assert.match(writing, /BLOCK_WRITING_VERSION = 1/);
  assert.match(writing, /blockNumber: number/);
  assert.match(writing, /miniBlockNumber: number/);
  assert.match(writing, /updateBlockWritingEntry/);
  assert.match(library, /readonly writing: BlockWritingState/);
  assert.match(library, /normalizeBlockWritingState\(source\.writing\)/);
  assert.match(importer, /writing: createEmptyBlockWritingState\(\)/);
  assert.doesNotMatch(importer, /writing:\s*.*importedPassages/u, "Imported screenplay evidence must not silently become editable canon.");
});

test("#2167 restores Write as a current workspace rather than a PageFlow alias", async () => {
  const [navigation, page, write] = await Promise.all([
    source("app/navigation/global-shortcuts.ts"),
    source("app/page.tsx"),
    source("modules/write/ui/block-native-write-workspace.tsx"),
  ]);

  assert.match(navigation, /"plan" \| "write" \| "wyrmwood"/);
  assert.match(navigation, /id: "write".*kind: "workspace".*workspace: "write"/s);
  assert.match(page, /requested === "write"/);
  assert.match(page, /<BlockNativeWriteWorkspace \/>/);
  assert.match(page, /case "drafting":[\s\S]*case "dialogue":[\s\S]*navigateWorkspace\("write"\)/);
  assert.doesNotMatch(page, /case "drafting":[\s\S]*window\.location\.assign\("\/pageflow"\)/);
  assert.match(write, /IMMUTABLE SOURCE EVIDENCE/);
  assert.match(write, /WORKING SCREENPLAY TEXT/);
  assert.match(write, /Use source as an unsaved starting point/);
  assert.match(write, /Source evidence is never edited by this action/);
});

test("#2167 shares one contextual learning map across Outline, Write and LEARN", async () => {
  const [context, outline, write, learn, catalog] = await Promise.all([
    source("modules/learn/model/story-learning-context.ts"),
    source("app/skin-v1/matrix-story-map-surface.tsx"),
    source("modules/write/ui/block-native-write-workspace.tsx"),
    source("modules/learn/ui/learn-workspace.tsx"),
    source("adapters/curriculum/current-catalog-integrated.ts"),
  ]);

  for (const lessonId of [
    "24b-structure-guide",
    "24b-dramatic-question",
    "24b-structures-role",
    "24b-reflection",
    "24b-principle-three",
    "characters-engine",
    "characters-relationships",
    "characters-inner-journey",
    "characters-conflict",
    "characters-choice-proof",
  ]) {
    assert.ok(context.includes(lessonId), `Context map is missing ${lessonId}`);
    assert.ok(catalog.includes(lessonId), `Context map points to non-canonical lesson ${lessonId}`);
  }

  assert.match(context, /blockNumber === 12 \|\| blockNumber === 13/);
  assert.match(context, /not as a compulsory beat/);
  assert.match(context, /a checkpoint, not a required identical event/);
  assert.match(context, /without manufacturing filler/);
  assert.match(outline, /data-story-learning-context="true"/);
  assert.match(outline, /storyLearningHref\(reference, address\)/);
  assert.match(write, /storyLearningContext\(address\)/);
  assert.match(learn, /data-story-learning-context="true"/);
  assert.match(learn, /Back to Outline/);
  assert.match(learn, /Apply in Write at this position/);
});

test("#2167 preserves exact Block/Mini-Block coordinates through contextual learning", async () => {
  const [context, page, learn] = await Promise.all([
    source("modules/learn/model/story-learning-context.ts"),
    source("app/page.tsx"),
    source("modules/learn/ui/learn-workspace.tsx"),
  ]);

  assert.match(context, /workspace: "learn"/);
  assert.match(context, /lesson: reference\.lessonId/);
  assert.match(context, /block: String\(context\.address\.blockNumber\)/);
  assert.match(context, /mini: String\(context\.address\.miniBlockNumber\)/);
  assert.match(context, /workspace: "dashboard"/);
  assert.match(page, /if \(lessonId\) destination\.searchParams\.set\("lesson", lessonId\)/);
  assert.match(learn, /requestedLessonId/);
  assert.match(learn, /type: "lesson\.open"/);
  assert.match(learn, /storyLearningReturnHref\(storyContext\.address\)/);
});

test("#2167 does not manufacture story text from curriculum or imported evidence", async () => {
  const [writing, write, context] = await Promise.all([
    source("core/contracts/block-writing.ts"),
    source("modules/write/ui/block-native-write-workspace.tsx"),
    source("modules/learn/model/story-learning-context.ts"),
  ]);

  assert.match(writing, /entries: \[\]/);
  assert.match(write, /No imported screenplay passage is mapped to this Mini-Block\. PlotPickle will not fabricate one\./);
  assert.match(write, /Copying it into working text requires your action|Use source as an unsaved starting point/);
  assert.match(context, /Curriculum explains the craft lens; the screenplay decides the event/);
});
