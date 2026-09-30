import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

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

test("#2602 audit map covers the complete canonical twelve-topic Learn spine without drift", async () => {
  const [audit, spine] = await Promise.all([
    readJson("config/story-learning-surface-parity.json"),
    read("modules/learn/model/story-learning-context.ts"),
  ]);

  assert.equal(audit.issue, 2602);
  assert.equal(audit.parentIssue, 2601);
  assert.equal(audit.status, "audit-baseline");
  assert.deepEqual(audit.canonicalTopicOrder, EXPECTED_TOPICS.map(([id]) => id));
  assert.equal(new Set(audit.topics.map((topic) => topic.id)).size, 12);

  for (const [id, label, learnTopicId] of EXPECTED_TOPICS) {
    const topic = audit.topics.find((candidate) => candidate.id === id);
    assert.ok(topic, `missing audit topic ${id}`);
    assert.equal(topic.learnTopicId, learnTopicId);
    const learn = await readJson(topic.learnFile);
    assert.equal(learn.topic.id, learnTopicId);
    assert.equal(learn.lessons.length, topic.lessonCount);
    assert.deepEqual(learn.lessons.map((lesson) => lesson.id), topic.lessonIds);
    assert.match(spine, new RegExp(`id: "${id}", label: "${label}", learnTopicId: "${learnTopicId}"`, "u"));
  }
});

test("#2602 Mind Map lane inventory is exact and every lane belongs to one audited topic", async () => {
  const [audit, discovery] = await Promise.all([
    readJson("config/story-learning-surface-parity.json"),
    read("core/contracts/discovery/index.ts"),
  ]);

  const sourceLanes = [...discovery.matchAll(/\{ id: "([^"]+)", label: "[^"]+", topic: "([^"]+)" \}/gu)]
    .map((match) => ({ id: match[1], topic: match[2] }));
  const auditedLanes = audit.topics.flatMap((topic) => topic.mindMap.lanes.map((id) => ({ id, topic: topic.id })));

  const byLaneId = (left, right) => left.id.localeCompare(right.id);
  assert.deepEqual(auditedLanes.slice().sort(byLaneId), sourceLanes.slice().sort(byLaneId));
  assert.equal(new Set(auditedLanes.map((lane) => lane.id)).size, auditedLanes.length);
  assert.ok(audit.topics.every((topic) => topic.mindMap.agentAction === "generic Develop Agent Proposals"));
});

test("#2602 audit preserves the pre-migration baseline while #2605 removes those World Map authoring gaps", async () => {
  const [audit, surface] = await Promise.all([
    readJson("config/story-learning-surface-parity.json"),
    read("app/skin-v1/story-bible-surface.tsx"),
  ]);

  const byId = Object.fromEntries(audit.topics.map((topic) => [topic.id, topic]));
  assert.deepEqual(byId.world.worldMap.authoringActions, ["Ask World Agent", "Save", "Redo", "Discard"]);
  assert.deepEqual(byId.character.worldMap.authoringActions, ["Generate Character Visual", "Generate Missing Views", "Save", "Lock"]);
  assert.deepEqual(byId.previs.worldMap.authoringActions, ["Generate Poster Visual", "Save", "Lock"]);
  assert.equal(audit.status, "audit-baseline");

  for (const phrase of ["Ask World Agent", "Generate Character Visual", "Generate Poster Visual"]) {
    assert.doesNotMatch(surface, new RegExp(phrase, "u"));
  }
  assert.match(surface, /buildStoryDevelopmentFields\(plotPickleCurriculum\)/u);
  assert.match(surface, /data-world-map-canonical-field=\{field\.canonicalId\}/u);
  assert.match(surface, /data-story-bible-read-only="true"/u);
});

test("#2602 stable field identity policy matches existing Foundations and World projection keys", async () => {
  const [audit, projection] = await Promise.all([
    readJson("config/story-learning-surface-parity.json"),
    read("core/project/story-bible-projection.ts"),
  ]);

  assert.equal(audit.canonicalFieldIdentity.learnBackedField, "<topic>:<lessonId>:<fieldId>");
  assert.equal(audit.canonicalFieldIdentity.projectArtifact, "<topic>:artifact:<artifactId>");
  assert.match(projection, /id: `foundations:\$\{lesson\.id\}:\$\{field\.id\}`/u);
  assert.match(projection, /id: `world:\$\{lesson\.id\}:\$\{field\.id\}`/u);

  const canonicalLessonKeys = audit.topics.flatMap((topic) => topic.lessonIds.map((lessonId) => `${topic.id}:${lessonId}`));
  assert.equal(new Set(canonicalLessonKeys).size, canonicalLessonKeys.length);
});

test("#2602 blank factory remains empty while observed Afterglow content is tracked for Phase 2 rather than deleted", async () => {
  const [audit, project, browser] = await Promise.all([
    readJson("config/story-learning-surface-parity.json"),
    read("core/project/project.ts"),
    read("core/storage/project-library-browser.ts"),
  ]);

  assert.equal(audit.blankStartupAudit.factoryStatus, "empty-by-construction");
  for (const constructor of [
    "createEmptyFoundationPlanState()",
    "createEmptyWorldPlanState()",
    "createEmptyBuildProgressState()",
    "createEmptyPrevisProductionState()",
  ]) {
    assert.ok(project.includes(constructor), `missing blank constructor ${constructor}`);
  }
  assert.match(browser, /createEmptyLibraryProject[\s\S]*createEmptyProject/u);
  assert.match(browser, /placeholderProject \?\? createEmptyLibraryProject/u);

  const observed = Object.fromEntries(audit.blankStartupAudit.runtimeObservationToMigrate.map((item) => [item.topic, item]));
  assert.deepEqual(observed.character.observedExampleContent, ["Ren", "Amy", "Summer / Isobel"]);
  assert.ok(observed.foundations.observedExampleContent.includes("logline"));
  assert.ok(observed.theme.observedExampleContent.includes("mood"));

  const migrationPaths = new Set(audit.afterglowMigrationCandidates.map((item) => item.storagePath));
  for (const path of [
    "foundations.lessons.*.answers",
    "world.lessons.*.answers",
    "sourceEvidence.characterTruth",
    "structure.blocks",
    "writing.entries",
    "discovery.cards",
    "build.foundations.visualArtifacts",
    "worldMap.characterVisuals",
  ]) {
    assert.ok(migrationPaths.has(path), `missing migration candidate ${path}`);
  }
});

test("#2602 audit explicitly keeps instructional Learn material from becoming invented project canon", async () => {
  const audit = await readJson("config/story-learning-surface-parity.json");
  const primarilyInstructional = ["responsible-ai", "industry", "collaboration"];
  for (const id of primarilyInstructional) {
    const topic = audit.topics.find((candidate) => candidate.id === id);
    assert.ok(topic.target.learnRole.includes("instructional"));
  }
  assert.ok(audit.canonicalFieldIdentity.rules.some((rule) => rule.includes("instructional-only")));
  assert.ok(audit.phase2Preconditions.some((rule) => rule.includes("Do not delete")));
  assert.ok(audit.phase2Preconditions.some((rule) => rule.includes("Base64")));
});
