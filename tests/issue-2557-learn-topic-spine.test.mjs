import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const EXPECTED_TOPICS = [
  ["foundations", "Foundations", "foundations"],
  ["world", "World", "world"],
  ["character", "Character", "character"],
  ["theme", "Theme", "theme"],
  ["structure", "Structure", "structure"],
  ["previs", "PREVIS", "visual-storytelling"],
  ["drafting", "Drafting", "drafting"],
  ["dialogue", "Dialogue", "dialogue"],
  ["revision", "Revision", "revision"],
  ["responsible-ai", "Responsible AI", "responsible-ai"],
  ["industry", "Industry", "industry"],
  ["collaboration", "Collaboration", "collaboration"],
];

test("#2557 one shared twelve-topic spine drives creation and Learn routing", async () => {
  const [spine, learn] = await Promise.all([
    read("modules/learn/model/story-learning-context.ts"),
    read("modules/learn/ui/learn-workspace.tsx"),
  ]);
  let previous = -1;
  for (const [id, label, learnTopicId] of EXPECTED_TOPICS) {
    const pattern = `{ id: "${id}", label: "${label}", learnTopicId: "${learnTopicId}" }`;
    const position = spine.indexOf(pattern);
    assert.ok(position > previous, `missing or out-of-order topic ${id}`);
    previous = position;
  }
  assert.match(spine, /export type LearnTopicSpineId/u);
  assert.match(spine, /workspace=learn&topic=/u);
  assert.match(learn, /const requestedTopic = query\.get\("topic"\)/u);
  assert.match(learn, /curriculum\.find\(\(lesson\) => lesson\.topic === requestedTopic\)/u);
});

test("#2557 MindMap keeps legacy elements but groups them under selected Learn topics", async () => {
  const [surface, contract, styles] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("core/contracts/discovery/index.ts"),
    read("app/skin-v1/discovery-surface.module.css"),
  ]);

  for (const [lane, topic] of [
    ["story", "foundations"], ["plot", "foundations"], ["research", "foundations"],
    ["theme", "theme"], ["motif", "theme"], ["visual", "previs"], ["image", "previs"], ["scene", "drafting"],
  ]) {
    assert.match(contract, new RegExp(`id: "${lane}", label: "[^"]+", topic: "${topic}"`, "u"));
  }
  for (const lane of ["industry", "structure", "previs", "drafting", "revision", "responsible-ai", "collaboration"]) {
    assert.match(contract, new RegExp(`id: "${lane}"`, "u"));
  }

  assert.match(surface, /const \[selectedTopic, setSelectedTopic\] = useState<LearnTopicSpineId>\("foundations"\)/u);
  assert.match(surface, /aria-label="MindMap Learn topics"/u);
  assert.match(surface, /LEARN_TOPIC_SPINE\.map\(\(topic\)/u);
  assert.match(surface, /lane\.topic === selectedTopic/u);
  assert.match(surface, /selectedActTopicCards/u);
  assert.match(surface, /Open in Learn/u);
  assert.match(surface, /Build Topic/u);
  assert.match(surface, /12 LEARN TOPICS/u);
  assert.match(styles, /\.topicRail \{[\s\S]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/u);
});

test("#2557 WorldMap shares Act 1-4 and twelve-topic navigation while preserving existing tools", async () => {
  const [surface, styles] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/story-bible-surface.module.css"),
  ]);

  assert.match(surface, /const WORLD_MAP_ACTS: readonly WorldMapAct\[\] = \[1, 2, 3, 4\]/u);
  assert.match(surface, /aria-label="World Map acts"/u);
  assert.match(surface, /aria-label="World Map Learn topics"/u);
  assert.match(surface, /LEARN_TOPIC_SPINE\.map\(\(topic, index\)/u);
  assert.match(surface, /data-world-map-topic=\{activeTopic\}/u);
  assert.match(surface, /block\.actNumber === selectedAct/u);
  assert.match(surface, /activeTopic === "character"/u);
  assert.match(surface, /Generate Character Visual/u);
  assert.match(surface, /activeTopic === "world"/u);
  assert.match(surface, /Ask World Agent/u);
  assert.match(surface, /activeTopic === "structure"/u);
  assert.match(surface, /activeTopic === "previs"/u);
  assert.match(surface, /Generate Poster Visual/u);
  assert.match(surface, /activeTopic === "responsible-ai"/u);
  assert.match(surface, /No established \{activeTopicEntry\.label\} material is available in WorldMap yet/u);
  assert.match(surface, /Open in Learn/u);
  assert.match(styles, /\.sectionNav \{[\s\S]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/u);
});

test("#2557 discovery mapper schema includes every new topic element", async () => {
  const [runtime, skill] = await Promise.all([
    read("build/mastra-agent-runtime.ts"),
    read(".agents/skills/discovery-mapper/SKILL.md"),
  ]);
  for (const lane of ["industry", "structure", "previs", "drafting", "revision", "responsible-ai", "collaboration"]) {
    assert.match(runtime, new RegExp(`"${lane}"`, "u"));
    assert.match(skill, new RegExp(lane, "u"));
  }
});
