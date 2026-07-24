import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const legacySources = [
  "Character Guide",
  "Compelling Characters",
  "Character Archetypes",
  "Character Development",
  "Inner Journey",
  "Inner Journey — Four Acts",
  "Heart of Conflict",
  "Man vs Himself",
  "Dialectical Triad",
  "Questions — Act 1",
  "Questions — Act 2",
  "Questions — Act 3",
  "Questions — Act 4",
];

const lessons = [
  "Build the Character Engine",
  "Prove Character Through Choice",
  "Map the Inner Journey Without Forcing It",
  "Join Inner and Outer Conflict",
  "Build Opposition as a Competing Worldview",
  "Design Relationships That Change Both People",
  "Give Every Character a Playable Voice",
  "Design the Cast as a Dramatic System",
];

test("all thirteen Character sources map into eight PlotPickled lessons", async () => {
  const learning = await source("app/learning-characters-in-motion.ts");
  for (const title of legacySources) assert.ok(learning.includes(`source: "${title}"`), `Missing source map: ${title}`);
  for (const title of lessons) assert.ok(learning.includes(`title: "${title}"`), `Missing lesson: ${title}`);
  assert.match(learning, /characterLegacySourceMap/);
  assert.match(learning, /collection: "Characters in Motion"/);
});

test("legacy titles and modern character terms remain searchable", async () => {
  const learning = await source("app/learning-characters-in-motion.ts");
  for (const term of [
    "character journey",
    "inner journey",
    "compelling characters",
    "character archetypes",
    "heart of conflict",
    "dialectical triad",
    "act questions",
    "relationship matrix",
    "voiceprint",
    "cast economy",
  ]) assert.ok(learning.toLowerCase().includes(term), `Missing search alias: ${term}`);
  assert.match(learning, /characterMotionSearchText/);
});

test("arc shapes remain flexible across positive, flat, negative, tragic, ambiguous and ensemble stories", async () => {
  const learning = await source("app/learning-characters-in-motion.ts");
  for (const shape of [
    "Positive transformation",
    "Steadfast or flat",
    "Negative or corruption",
    "Disillusionment",
    "Tragic refusal",
    "Recovery or reconciliation",
    "Incomplete or ambiguous",
    "Ensemble or relationship",
    "Describe your own",
  ]) assert.ok(learning.includes(shape), `Missing arc shape: ${shape}`);
  assert.match(learning, /opening.*catalyst.*threshold.*midpoint.*crisis.*climax.*ending.*custom/s);
  assert.match(learning, /does not need to declare both sides equally moral/);
});

test("contextual questions adapt to act, Block, checkpoint, arc shape, relationship and dialogue evidence", async () => {
  const learning = await source("app/learning-characters-in-motion.ts");
  assert.match(learning, /characterQuestionsForContext/);
  for (const phrase of [
    "What current strategy protects this character",
    "What new pressure exposes the current strategy's limits",
    "Which consequences arise directly from earlier decisions",
    "What action proves change, steadfastness, corruption, refusal or ambiguity",
    "checkpointQuestions",
    "shapeQuestions",
    "hasRelationshipEvidence",
    "hasDialogueEvidence",
    "Block ${context.blockNumber}",
  ]) assert.ok(learning.includes(phrase), `Missing contextual guidance: ${phrase}`);
});

test("Read and Learn exposes the Characters in Motion collection and contextual recommendations", async () => {
  const studio = await source("app/learning-studio.tsx");
  for (const integration of [
    "characterMotionLessons",
    "characterMotionSearchText",
    "Characters in Motion",
    "characters-engine",
    "characters-choice-proof",
    "characters-inner-journey",
    "characters-conflict",
    "characters-voiceprint",
    "/characters-in-motion",
  ]) assert.ok(studio.includes(integration), `Missing learning integration: ${integration}`);
  assert.match(studio, /The active Block and mini-block travel into the character workspace/);
});

test("Character Proof connects profile claims to Blocks, scenes, mini-blocks, checkpoints and screenplay evidence", async () => {
  const workspace = await source("app/characters-in-motion/page.tsx");
  for (const evidence of [
    "Character proof dashboard",
    "planned claims",
    "linked Blocks",
    "linked scenes",
    "assigned mini-blocks",
    "checkpoints with linked evidence",
    "screenplay character cues",
    "dialogue elements in linked scenes",
    "Voiceprint dimensions",
    "Selected Block evidence",
    "Selected scene evidence",
  ]) assert.ok(workspace.includes(evidence), `Missing proof evidence: ${evidence}`);
  assert.match(workspace, /reports gaps and contradictions/);
});

test("relationship matrix compares both character perspectives and shared change evidence", async () => {
  const workspace = await source("app/characters-in-motion/page.tsx");
  for (const phrase of [
    "Relationship matrix",
    "Both directions, shared evidence",
    "'s perspective",
    "reciprocal relationship record",
    "shared scene",
    "linked change point",
    "trust, status, debt, access or dependence",
  ]) assert.ok(workspace.includes(phrase), `Missing relationship feature: ${phrase}`);
});

test("archetype, representation, profitability and AI guidance are modernized and approval-safe", async () => {
  const learning = await source("app/learning-characters-in-motion.ts");
  const workspace = await source("app/characters-in-motion/page.tsx");
  for (const phrase of [
    "Archetypes are optional lenses",
    "no character device guarantees profitability",
    "AI may surface questions but cannot certify authenticity",
    "informed human review",
    "never merges characters automatically",
    "never rewrites, merges or applies changes automatically",
    "approve every story change explicitly",
  ]) assert.ok(`${learning}\n${workspace}`.includes(phrase), `Missing correction or approval boundary: ${phrase}`);
});

test("every character lesson includes example, mistakes, exercise and direct workspace routing", async () => {
  const learning = await source("app/learning-characters-in-motion.ts");
  const lessonCount = (learning.match(/collection: "Characters in Motion"/g) ?? []).length;
  assert.equal(lessonCount, 8);
  assert.equal((learning.match(/example: \{/g) ?? []).length, 8);
  assert.equal((learning.match(/mistakes: \[/g) ?? []).length, 8);
  assert.equal((learning.match(/exercise: "/g) ?? []).length, 8);
  assert.equal((learning.match(/workspaceHref:/g) ?? []).length, 8);
});
