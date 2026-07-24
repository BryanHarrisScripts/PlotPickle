import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const legacySources = [
  "Different Genres",
  "Conflict",
  "Balancing Action",
  "Distinctive Voices",
  "Realistic Dialogue",
  "Dialogue Pitfalls",
  "Tags and Beats",
  "Subtext",
  "Reveal Character",
  "Refining Dialogue",
  "Art of Silence",
];

const lessons = [
  "Dialogue Is Action",
  "Build a Playable Voiceprint",
  "Write Subtext and Withheld Information",
  "Create Conflict Without Constant Arguments",
  "Balance Speech, Silence and Physical Action",
  "Handle Exposition, World and Genre",
  "Shape the Exchange and Scene Turn",
  "Revise for Voice, Purpose and Performance",
];

test("all eleven Dialogue sources map into eight PlotPickled lessons", async () => {
  const learning = await source("app/learning-dialogue-in-motion.ts");
  for (const title of legacySources) assert.ok(learning.includes(`source: "${title}"`), `Missing source map: ${title}`);
  for (const title of lessons) assert.ok(learning.includes(`title: "${title}"`), `Missing lesson: ${title}`);
  assert.match(learning, /dialogueLegacySourceMap/);
  assert.equal((learning.match(/collection: "Dialogue in Motion"/g) ?? []).length, 1);
  assert.equal((learning.match(/lesson\(\{/g) ?? []).length, 8);
});

test("legacy titles and major dialogue terms remain searchable", async () => {
  const learning = await source("app/learning-dialogue-in-motion.ts");
  for (const term of [
    "natural dialogue",
    "dialogue conflict",
    "distinctive voices",
    "on-the-nose",
    "exposition dump",
    "dialogue tags",
    "action beats",
    "subtext",
    "silence",
    "read aloud",
    "refining dialogue",
  ]) assert.ok(learning.toLowerCase().includes(term), `Missing search alias: ${term}`);
  assert.match(learning, /dialogueLessonSearchText/);
});

test("dialogue is taught as playable action with a complete Blueprint", async () => {
  const learning = await source("app/learning-dialogue-in-motion.ts");
  const workspace = await source("app/dialogue-in-motion/page.tsx");
  for (const field of [
    "participants",
    "relationship state",
    "each objective",
    "each tactic",
    "public topic",
    "private subject",
    "information imbalance",
    "status at entry",
    "intended turn",
    "exit condition",
    "required continuity facts",
    "locked lines or facts",
  ]) assert.ok(learning.includes(`"${field}"`), `Missing blueprint field: ${field}`);
  for (const feature of ["Dialogue Blueprint", "What A believes B wants", "Information held or withheld by A", "Status and leverage at entry", "Changed exit condition"]) {
    assert.ok(workspace.includes(feature), `Missing blueprint feature: ${feature}`);
  }
  assert.match(workspace, /PLOTPICKLE_DIALOGUE_RECORD/);
});

test("contextual guidance uses character, relationship, scene, Block, mini-block, genre and world evidence", async () => {
  const learning = await source("app/learning-dialogue-in-motion.ts");
  for (const phrase of [
    "dialogueQuestionsForContext",
    "Block ${context.blockNumber}.${context.miniBlockNumber}",
    "sceneObjective",
    "sceneOpposition",
    "sceneTurn",
    "relationshipLabel",
    "genre",
    "worldRules",
    "status, stress, intimacy, deception or growth",
  ]) assert.ok(learning.includes(phrase), `Missing contextual guidance: ${phrase}`);
});

test("screenplay-specific formatting distinctions are explicit", async () => {
  const learning = await source("app/learning-dialogue-in-motion.ts");
  for (const phrase of [
    "Character cues identify the speaker",
    "Dialogue contains spoken text",
    "Action lines carry visible behaviour",
    "Parentheticals are brief and necessary",
    "Extensions clarify off-screen or voice-over delivery",
    "Dual dialogue indicates simultaneous speech",
    "he said or she asked are generally not screenplay dialogue formatting",
  ]) assert.ok(learning.includes(phrase), `Missing screenplay distinction: ${phrase}`);
});

test("voice variation, accents, dialects and genre are handled with evidence and care", async () => {
  const combined = `${await source("app/learning-dialogue-in-motion.ts")}\n${await source("app/dialogue-in-motion/page.tsx")}`;
  for (const phrase of [
    "Consistency does not mean sameness",
    "relationship, status, stress, intimacy, deception or growth",
    "Do not use phonetic spelling or demographic shorthand",
    "informed human review",
    "Genre does not dictate one dialogue style",
    "does not imitate a real performer",
  ]) assert.ok(combined.includes(phrase), `Missing voice or care boundary: ${phrase}`);
});

test("Dialogue workspace connects planning claims to screenplay evidence and read-aloud review", async () => {
  const workspace = await source("app/dialogue-in-motion/page.tsx");
  for (const feature of [
    "Two-sided intention and voice comparison",
    "Dialogue proof dashboard",
    "Voiceprint versus actual lines",
    "Relationship and objective evidence",
    "Exposition and repetition questions",
    "Dialogue purpose labels",
    "Read-aloud and table-read mode",
    "Save anchored table-read observation",
    "speeches of 70+ words",
    "repeated 3+ word speeches",
  ]) assert.ok(workspace.includes(feature), `Missing evidence feature: ${feature}`);
  assert.match(workspace, /Counts and comparisons surface questions; they are not grades/);
});

test("guided Dialogue Lab passes remain bounded, optional and approval-safe", async () => {
  const learning = await source("app/learning-dialogue-in-motion.ts");
  const labs = await source("app/specialist-labs.tsx");
  for (const pass of [
    "Critique only",
    "Voice separation",
    "Objective and tactic",
    "Subtext",
    "Status and leverage",
    "Conflict escalation",
    "Exposition reduction",
    "Action and silence alternatives",
    "Rhythm and concision",
    "Genre expectation",
    "Continuity and arc consistency",
    "Compare two approaches",
  ]) assert.ok(learning.includes(`label: "${pass}"`), `Missing guided pass: ${pass}`);
  for (const boundary of [
    "dialogueGuidedPasses",
    "Guided dialogue pass",
    "Free-form writer direction",
    "Nothing changes until you approve this suggestion",
    "Discard suggestion",
  ]) assert.ok(labs.includes(boundary), `Missing Dialogue Lab boundary: ${boundary}`);
});

test("Read and Learn exposes Dialogue in Motion with direct workspace routing", async () => {
  const studio = await source("app/learning-studio.tsx");
  for (const integration of [
    "dialogueLessons",
    "dialogueLessonSearchText",
    "Dialogue in Motion",
    "dialogue-action",
    "dialogue-voiceprint",
    "dialogue-subtext",
    "dialogue-conflict",
    "dialogue-revision",
    "/dialogue-in-motion",
  ]) assert.ok(studio.includes(integration), `Missing learning integration: ${integration}`);
});

test("every dialogue lesson contains example, mistakes, exercise and direct workspace section", async () => {
  const learning = await source("app/learning-dialogue-in-motion.ts");
  assert.equal((learning.match(/example: \{/g) ?? []).length, 8);
  assert.equal((learning.match(/mistakes: \[/g) ?? []).length, 8);
  assert.equal((learning.match(/exercise: "/g) ?? []).length, 8);
  assert.equal((learning.match(/workspaceSection:/g) ?? []).length, 8);
});
