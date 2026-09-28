import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2527 World Map uses six one-word sections in the requested left-to-right order", async () => {
  const source = await read("app/skin-v1/story-bible-surface.tsx");
  const labels = [...source.matchAll(/\{ id: "(story|structure|character|foundations|world|provenance)", label: "([^"]+)" \}/gu)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(labels, [
    ["story", "Story"],
    ["structure", "Structure"],
    ["character", "Character"],
    ["foundations", "Foundations"],
    ["world", "World"],
    ["provenance", "Provenance"],
  ]);
  assert.match(source, /useState<WorldMapSectionId>\("story"\)/u);
  assert.match(source, /aria-label="World Map sections"/u);
  assert.match(source, /role="tablist"/u);
  assert.match(source, /role="tab"/u);
  assert.match(source, /ArrowLeft/u);
  assert.match(source, /ArrowRight/u);
});

test("#2527 renders one active World Map tool panel instead of the previous long-scroll stack", async () => {
  const source = await read("app/skin-v1/story-bible-surface.tsx");
  for (const id of ["story", "structure", "character", "foundations", "world", "provenance"]) {
    assert.match(source, new RegExp(`activeSection === "${id}"`, "u"));
    assert.match(source, new RegExp(`id="world-map-panel-${id}"`, "u"));
  }
  assert.match(source, /data-world-map-active-section=\{activeSection\}/u);
  assert.match(source, /aria-controls=\{\`world-map-panel-\$\{section\.id\}\`\}/u);
});

test("#2527 Story owns poster/project identity plus the former bottom story-reference material", async () => {
  const source = await read("app/skin-v1/story-bible-surface.tsx");
  const storyStart = source.indexOf('activeSection === "story"');
  const structureStart = source.indexOf('activeSection === "structure"');
  const story = source.slice(storyStart, structureStart);
  assert.match(story, /Generate Poster Visual/u);
  assert.match(story, /Saved locally/u);
  assert.match(story, />Locked<\/span>/u);
  assert.match(story, /WORLDMAP · STORY · HUMAN-REVIEWED DEVELOPMENT/u);
  assert.match(story, /STORY REFERENCE/u);
  assert.match(story, /What belongs in the living story reference/u);
  assert.doesNotMatch(story, /Story Bible|STORY BIBLE/u);
});

test("#2527 preserves tool-specific behaviour under the shared navigation shell", async () => {
  const source = await read("app/skin-v1/story-bible-surface.tsx");
  const characterStart = source.indexOf('activeSection === "character"');
  const foundationsStart = source.indexOf('activeSection === "foundations"');
  const character = source.slice(characterStart, foundationsStart);
  assert.match(character, /CharacterVisualSheet/u);

  assert.match(source, /function CharacterVisualSheet/u);
  assert.match(source, /Previous saved version/u);
  assert.match(source, /Next saved version/u);
  assert.match(source, />Save<\/button>/u);
  assert.match(source, />Lock<\/button>/u);
  assert.match(source, /data-world-agent-review-actions="three-decision"/u);
  assert.match(source, />Redo<\/button>/u);
  assert.match(source, />Discard<\/button>/u);
});

test("#2527 removes visible Bible wording from the World Map surface while preserving internal compatibility names", async () => {
  const source = await read("app/skin-v1/story-bible-surface.tsx");
  assert.doesNotMatch(source, /Story Bible|STORY BIBLE/u);
  assert.match(source, /projectStoryBible/u);
  assert.match(source, /data-story-bible-surface="canonical"/u);
});
