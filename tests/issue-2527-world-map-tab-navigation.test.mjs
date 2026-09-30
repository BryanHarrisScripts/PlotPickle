import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2527/#2605 World Map uses the shared twelve-topic spine", async () => {
  const source = await read("app/skin-v1/story-bible-surface.tsx");
  assert.match(source, /LEARN_TOPIC_SPINE\.map\(\(topic, index\)/u);
  assert.match(source, /useState<LearnTopicSpineId>\("foundations"\)/u);
  assert.match(source, /aria-label="World Map Learn topics"/u);
  assert.match(source, /role="tablist"/u);
  assert.match(source, /role="tab"/u);
  assert.match(source, /ArrowLeft/u);
  assert.match(source, /ArrowRight/u);
});

test("#2527/#2605 renders one active canonical topic panel instead of a separate World Map field model", async () => {
  const source = await read("app/skin-v1/story-bible-surface.tsx");
  assert.match(source, /data-world-map-canonical-topic=\{activeTopic\}/u);
  assert.match(source, /world-map-panel-/u);
  assert.match(source, /buildStoryDevelopmentFields\(plotPickleCurriculum\)/u);
  assert.match(source, /topicFields = canonicalFields\.filter\(\(field\) => field\.topicId === activeTopic\)/u);
  assert.match(source, /data-world-map-canonical-field=\{field\.canonicalId\}/u);
});

test("#2527/#2605 Previs owns only a read-only current marketing reference inside World Map", async () => {
  const source = await read("app/skin-v1/story-bible-surface.tsx");
  assert.match(source, /activeTopic === "previs"/u);
  assert.match(source, /Current approved marketing reference/u);
  assert.match(source, /bible\.posterUrl/u);
  assert.match(source, /bible\.posterLabel/u);
  assert.doesNotMatch(source, /Generate Poster Visual|savePosterVersion|lockPosterVersion/u);
});

test("#2527/#2605 tool-specific review context stays under the shared canonical navigation shell", async () => {
  const source = await read("app/skin-v1/story-bible-surface.tsx");
  assert.match(source, /activeTopic === "character"/u);
  assert.match(source, /function CharacterReview/u);
  assert.match(source, /activeTopic === "structure"/u);
  assert.match(source, /activeTopic === "drafting"/u);
  assert.match(source, /activeTopic === "responsible-ai"/u);
  assert.doesNotMatch(source, /WorldFactEditor|CharacterVisualSheet/u);
});

test("#2527 keeps visible Bible wording out of the World Map surface while preserving internal compatibility names", async () => {
  const source = await read("app/skin-v1/story-bible-surface.tsx");
  assert.doesNotMatch(source, /Story Bible|STORY BIBLE/u);
  assert.match(source, /projectStoryBible/u);
  assert.match(source, /data-story-bible-surface="canonical"/u);
});
