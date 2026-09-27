import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2508 World Map poster uses Storyboard-style concise controls, chevrons, count and per-version badges", async () => {
  const [surface, css] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/story-bible-surface.module.css"),
  ]);
  const poster = surface.slice(surface.indexOf('<div className={styles.poster}>'), surface.indexOf('<div className={styles.identity}>'));
  assert.match(poster, /Previous saved version/u);
  assert.match(poster, /Next saved version/u);
  assert.match(poster, /safePosterIndex \+ 1/u);
  assert.match(poster, /posterVersions\.length/u);
  assert.match(poster, />Save<\/button>/u);
  assert.match(poster, />Lock<\/button>/u);
  assert.match(poster, />Saved locally<\/span>/u);
  assert.match(poster, />Locked<\/span>/u);
  assert.doesNotMatch(poster, /Save this Version|Lock this Version/u);
  assert.match(css, /\.posterFrame,[\s\S]*?\.referenceFrame \{[\s\S]*?position: relative/u);
  assert.match(css, /\.savedBadge \{ left: var\(--pp-skin-space-1\); \}/u);
  assert.match(css, /\.lockedBadge \{[\s\S]*?right: var\(--pp-skin-space-1\)/u);
});

test("#2508 character visual versions use the same concise version-review language and badges", async () => {
  const surface = await read("app/skin-v1/story-bible-surface.tsx");
  const start = surface.indexOf("function CharacterVisualSheet");
  const end = surface.indexOf("export default function StoryBibleSurface", start);
  const character = surface.slice(start, end);
  assert.match(character, /Previous saved version/u);
  assert.match(character, /Next saved version/u);
  assert.match(character, /safeVersionIndex \+ 1/u);
  assert.match(character, /versions\.length/u);
  assert.match(character, />Save<\/button>/u);
  assert.match(character, />Lock<\/button>/u);
  assert.match(character, />Saved locally<\/span>/u);
  assert.match(character, />Locked<\/span>/u);
  assert.match(character, /saveWorldMapCharacterVisualVersion/u);
  assert.match(character, /lockWorldMapCharacterVisualVersion/u);
  assert.doesNotMatch(character, /Save this Version|Lock this Version/u);
});

test("#2508 World Agent results always use one read-and-decide Save / Redo / Discard flow", async () => {
  const surface = await read("app/skin-v1/story-bible-surface.tsx");
  const start = surface.indexOf("function WorldFactEditor");
  const end = surface.indexOf("function WorldFactGroup", start);
  const editor = surface.slice(start, end);
  assert.match(editor, /Ask World Agent/u);
  assert.match(editor, /Agent proposal · edit before saving/u);
  assert.match(editor, /data-world-agent-review-actions="three-decision"/u);
  assert.match(editor, />Save<\/button>/u);
  assert.match(editor, />Redo<\/button>/u);
  assert.match(editor, />Discard<\/button>/u);
  assert.match(editor, /onClick=\{saveProposal\}/u);
  assert.match(editor, /void askWorldAgent\(\)/u);
  assert.match(editor, /Proposal discarded\. Canon was not changed\./u);
});

test("#2508 preserves durable World Map version authorities rather than adding UI-only state", async () => {
  const [surface, worldContract, library] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("core/contracts/world-map/index.ts"),
    read("core/storage/library-project.ts"),
  ]);
  assert.match(surface, /saveActiveLibraryProject/u);
  assert.match(surface, /foundations\.visual\.store/u);
  assert.match(surface, /foundations\.visual\.accept/u);
  assert.match(worldContract, /saveWorldMapCharacterVisualVersion/u);
  assert.match(worldContract, /lockWorldMapCharacterVisualVersion/u);
  assert.match(library, /normalizeWorldMapState\(source\.worldMap\)/u);
});
