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

test("#2557/#2604/#2632 MindMap uses the shared Learn spine without rendering the retired discovery board", async () => {
  const [surface, contract, styles] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("core/contracts/discovery/index.ts"),
    read("app/skin-v1/discovery-surface.module.css"),
  ]);

  // Historical discovery lanes stay normalized for old saved projects.
  for (const [lane, topic] of [
    ["story", "foundations"], ["plot", "foundations"], ["research", "foundations"],
    ["theme", "theme"], ["motif", "theme"], ["visual", "previs"], ["image", "previs"], ["scene", "drafting"],
  ]) {
    assert.match(contract, new RegExp(`id: "${lane}", label: "[^"]+", topic: "${topic}"`, "u"));
  }

  assert.match(surface, /const \[selectedTopic, setSelectedTopic\] = useState<LearnTopicSpineId>\(initialTopic\)/u);
  assert.match(surface, /aria-label="MindMap Learn topics"/u);
  assert.match(surface, /LEARN_TOPIC_SPINE\.map\(\(topic\)/u);
  assert.match(surface, /Open in Learn/u);
  assert.match(surface, /buildStoryDevelopmentFields\(plotPickleCurriculum\)/u);
  assert.match(surface, /selectedField\.actionLabel/u);
  assert.match(surface, /Use Suggestion/u);
  assert.match(surface, /data-discovery-surface="canonical-authoring"/u);
  assert.match(surface, /data-mind-map-human-notes/u);
  assert.match(surface, /data-relevant-project-context/u);

  assert.doesNotMatch(surface, /DISCOVERY_LANES|selectedActTopicCards|selectedActUnsorted|Save Human Idea|Living MindMap|Unsorted Human Ideas/u);
  assert.doesNotMatch(surface, /project\.discovery\.cards|workingCards|DiscoveryCard/u);
  assert.doesNotMatch(styles, /\.composer\s*\{|\.board\s*\{|\.laneGrid\s*\{|\.inbox\s*\{|\.cardActions\s*\{/u);
  assert.match(styles, /\.topicRail \{[\s\S]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/u);
});

test("#2557/#2605 WorldMap shares Act 1-4 and twelve-topic read/review navigation", async () => {
  const [surface, styles] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/story-bible-surface.module.css"),
  ]);

  assert.match(surface, /<StoryActRail activeAct=\{selectedAct\} ariaLabel="World Map acts" choiceDataAttribute="data-world-map-act-choice" onOpen=\{setSelectedAct\} \/>/u);
  assert.match(surface, /aria-label="World Map Learn topics"/u);
  assert.match(surface, /LEARN_TOPIC_SPINE\.map\(\(topic, index\)/u);
  assert.match(surface, /data-world-map-topic=\{activeTopic\}/u);
  assert.match(surface, /data-world-map-canonical-topic=\{activeTopic\}/u);
  assert.match(surface, /buildStoryDevelopmentFields\(plotPickleCurriculum\)/u);
  assert.match(surface, /Edit in Mind Map/u);
  assert.match(surface, /Open Topic in Learn/u);
  assert.doesNotMatch(surface, /Ask World Agent|Generate Character Visual|Generate Poster Visual/u);
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
