import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LEARN_TOPIC_SPINE } from "../core/contracts/learn-topic-spine.ts";
import { DISCOVERY_LANES, discoveryTopicForLane } from "../core/contracts/discovery/index.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const EXPECTED_TOPICS = [
  ["foundations", "Foundations", "foundations"],
  ["industry", "Industry", "industry"],
  ["theme", "Theme", "theme"],
  ["character", "Character", "character"],
  ["world", "World", "world"],
  ["structure", "Structure", "structure"],
  ["dialogue", "Dialogue", "dialogue"],
  ["previs", "PREVIS", "visual-storytelling"],
  ["drafting", "Drafting", "drafting"],
  ["revision", "Revision", "revision"],
  ["responsible-ai", "Responsible AI", "responsible-ai"],
  ["collaboration", "Collaboration", "collaboration"],
];

test("#2557 one shared twelve-topic spine drives creation and Learn routing", async () => {
  assert.deepEqual(
    LEARN_TOPIC_SPINE.map((topic) => [topic.id, topic.label, topic.learnTopicId]),
    EXPECTED_TOPICS,
  );

  const learn = await read("modules/learn/ui/learn-workspace.tsx");
  assert.match(learn, /const requestedTopic = query\.get\("topic"\)/u);
  assert.match(learn, /curriculum\.find\(\(lesson\) => lesson\.topic === requestedTopic\)/u);
});

test("#2557 MindMap keeps legacy elements but groups them under selected Learn topics", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.equal(discoveryTopicForLane("story"), "foundations");
  assert.equal(discoveryTopicForLane("plot"), "foundations");
  assert.equal(discoveryTopicForLane("research"), "foundations");
  assert.equal(discoveryTopicForLane("theme"), "theme");
  assert.equal(discoveryTopicForLane("motif"), "theme");
  assert.equal(discoveryTopicForLane("visual"), "previs");
  assert.equal(discoveryTopicForLane("image"), "previs");
  assert.equal(discoveryTopicForLane("scene"), "drafting");

  for (const lane of ["industry", "structure", "previs", "drafting", "revision", "responsible-ai", "collaboration"]) {
    assert.ok(DISCOVERY_LANES.some((item) => item.id === lane), `missing ${lane} element`);
  }

  assert.match(surface, /const \[selectedTopic, setSelectedTopic\] = useState<LearnTopicSpineId>\("foundations"\)/u);
  assert.match(surface, /aria-label="MindMap Learn topics"/u);
  assert.match(surface, /LEARN_TOPIC_SPINE\.map\(\(topic\)/u);
  assert.match(surface, /lane\.topic === selectedTopic/u);
  assert.match(surface, /selectedActTopicCards/u);
  assert.match(surface, /Open in Learn/u);
  assert.match(surface, /Build Topic/u);
  assert.match(surface, /12 LEARN TOPICS/u);
});

test("#2557 WorldMap shares Act 1-4 and twelve-topic navigation while preserving existing tools", async () => {
  const surface = await read("app/skin-v1/story-bible-surface.tsx");

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
