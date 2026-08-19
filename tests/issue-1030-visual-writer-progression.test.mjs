import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const parse = async (path) => JSON.parse(await read(path));

const EXPECTED_ORDER = [
  "foundations",
  "world",
  "character",
  "theme",
  "structure",
  "visual-storytelling",
  "drafting",
  "dialogue",
  "revision",
  "responsible-ai",
  "industry",
  "collaboration",
];

test("#1030 PR A preserves every bundled archived lesson while changing only progression metadata", async () => {
  const index = await parse("learn/index.json");
  assert.equal(index.lessonCount, 81);
  assert.equal(index.files.length, 12);
  assert.deepEqual(new Set(index.files.map((entry) => entry.topic)), new Set(EXPECTED_ORDER));

  let actualLessonCount = 0;
  for (const entry of index.files) {
    const topic = await parse(`learn/${entry.file}`);
    assert.equal(topic.topic, entry.topic, `${entry.file} should retain its topic identity`);
    assert.equal(topic.lessons.length, entry.lessonCount, `${entry.file} lesson count should match the bundled index`);
    actualLessonCount += topic.lessons.length;
  }
  assert.equal(actualLessonCount, 81);
});

test("#1030 PR A defines one canonical Visual Writer order with story-defining groups before execution and handoff", async () => {
  const source = await read("modules/dashboard/guided-progression.ts");
  const block = source.slice(source.indexOf("export const VISUAL_WRITER_GROUP_ORDER"), source.indexOf("] as const;") + 11);
  const positions = EXPECTED_ORDER.map((id) => block.indexOf(`"${id}"`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.ok(block.indexOf('"character"') < block.indexOf('"structure"'));
  assert.ok(block.indexOf('"theme"') < block.indexOf('"structure"'));
  assert.ok(block.indexOf('"visual-storytelling"') < block.indexOf('"drafting"'));
  assert.ok(block.indexOf('"responsible-ai"') < block.indexOf('"industry"'));
  assert.ok(block.indexOf('"industry"') < block.indexOf('"collaboration"'));
});

test("#1030 every group declares the output/frontier contract BUILD and future consumers need", async () => {
  const source = await read("modules/dashboard/guided-progression.ts");
  assert.match(source, /interface GuidedGroupOutputContract/);
  for (const field of [
    "prerequisiteGroupIds",
    "learned",
    "projectDecisionKinds",
    "affectsVisualGeneration",
    "buildCapability",
    "buildContextGroupIds",
    "artifactKinds",
    "approvalRequired",
    "classification",
  ]) assert.match(source, new RegExp(`readonly ${field}`));
  assert.match(source, /Visual Narrative Wireframe/);
  assert.match(source, /buildContextGroupIds: \["foundations"\]/);
  assert.match(source, /buildContextGroupIds: \["foundations", "world"\]/);
  assert.match(source, /generated image never becomes canon by generation alone/i);
  assert.doesNotMatch(source, /ComfyUI|127\.0\.0\.1:8188|api\/prompt/);
});

test("#1030 derives a lesson audit from real lesson content without duplicating or rewriting the curriculum", async () => {
  const source = await read("modules/dashboard/guided-progression.ts");
  assert.match(source, /export function deriveGuidedLessonOutputContracts/);
  assert.match(source, /\.filter\(\(lesson\) => lesson\.topic === definition\.id\)/);
  assert.match(source, /left\.number - right\.number/);
  assert.match(source, /lesson\.objectives\.length \? lesson\.objectives : \[lesson\.overview\]/);
  assert.match(source, /lesson\.apply\.trim\(\) \|\| lesson\.exercise\.trim\(\)/);
  assert.match(source, /prerequisiteLessonIds: previous \? \[previous\.id\] : \[\]/);
  assert.match(source, /mustPrecedeLessonIds: next \? \[next\.id\] : \[\]/);
  assert.match(source, /mustPrecedeGroupIds: next \? \[\] : dependentGroupIds/);
  assert.match(source, /lessonOutputContracts: deriveGuidedLessonOutputContracts\(curriculum\)/);
});

test("#1030 keeps PR A contracts-only and leaves Foundations as the sole implemented vertical slice", async () => {
  const [source, docs] = await Promise.all([
    read("modules/dashboard/guided-progression.ts"),
    read("docs/visual-writer-curriculum-audit.md"),
  ]);
  assert.match(source, /implemented: true/);
  assert.match(source, /GUIDED_CURRICULUM_GROUPS\.slice\(1\)/);
  assert.match(source, /implemented: false/);
  assert.match(docs, /audit\/contracts phase only/i);
  assert.match(docs, /does not generate new images/i);
  assert.match(docs, /all 81 archived lessons/i);
  assert.match(docs, /BUILD may use only the accepted project frontier/i);
  assert.match(docs, /Dashboard, Avery and Writer-in-Residence must consume this same progression\/output contract/i);
});
