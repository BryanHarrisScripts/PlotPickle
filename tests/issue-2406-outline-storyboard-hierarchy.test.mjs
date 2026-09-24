import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2406 makes Outline teach canonical structure through Beat", async () => {
  const outline = await read("app/skin-v1/matrix-story-map-surface.tsx");

  assert.match(outline, /data-outline-hierarchy="story-through-beat"/u);
  assert.match(outline, /Sequence → Block → Mini-Block → Scene → Beat/u);
  assert.match(outline, /selectedStructureBlock\?\.sequenceNumber/u);
  assert.match(outline, /A Sequence pairs two Blocks/u);
  assert.match(outline, /Scene and Beat counts stay flexible/u);
});

test("#2406 makes Storyboard inherit story structure and add Shot and Frame", async () => {
  const storyboard = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");

  assert.match(storyboard, /Sequence → Block → Mini-Block → Scene → Beat → Shot → Frame/u);
  assert.match(storyboard, /Storyboard inherits Scene and Beat/u);
  assert.match(storyboard, /Shot is the director\/cinematographer view/u);
  assert.match(storyboard, /selectedStructureBlock\?\.sequenceNumber/u);
  assert.match(storyboard, /25 positions are available Shot\/Frame capacity, not 25 Beats/u);
});

test("#2406 treats the 25 rows as Shot Frame capacity rather than Beat ordinals", async () => {
  const storyboard = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");

  assert.match(storyboard, /Storyboard Positions 01–25 · Shot \/ Frame capacity/u);
  assert.match(storyboard, /25 storyboard Shot and Frame positions/u);
  assert.match(storyboard, /selectedVisualAnchor\?\.shots\.find\(\(candidate\) => candidate\.order === position\)/u);
  assert.match(storyboard, /shot\?\.frames\[0\]\?\.id/u);
  assert.match(storyboard, /Open Shot \/ Frame position/u);
  assert.match(storyboard, /Select Frame for Storyboard position/u);
  assert.doesNotMatch(storyboard, /const beat = blockBeats\[index\]/u);
  assert.doesNotMatch(storyboard, /Scene \/ Beat positions 01–25/u);
  assert.doesNotMatch(storyboard, /<strong>Scene \/ Beat \{String\(position\)/u);
});

test("#2406 preserves flexible Scene Beat Shot counts and the inline Storyboard boundary", async () => {
  const [storyboard, brief] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("docs/developer-briefs/2406-outline-storyboard-hierarchy.md"),
  ]);

  assert.match(storyboard, /<VisualStoryWorkspace[\s\S]*?embedded/u);
  assert.match(storyboard, /Scene, Beat and Shot counts remain flexible/u);
  assert.match(brief, /The scaffold is deterministic addressing and capacity\. It is not a creative quota\./u);
  assert.match(brief, /Current Shot contracts do not persist a canonical Beat ownership field/u);
});
