import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const legacySources = [
  "ChatGPT Tips",
  "Individual Critical",
  "Individual Intermediate",
  "Individual Fine-Tuning",
  "Critique and Pacing",
  "Copywriting and Marketing",
  "Redundancy and Streamlining",
  "Structure and Characters",
  "Suggested Additions",
  "Dialogue",
];

const passes = [
  "Diagnose without rewriting",
  "Structure and causality audit",
  "Character choice and arc audit",
  "Scene purpose and turn audit",
  "Conflict, stakes and escalation audit",
  "Dialogue and Voiceprint pass",
  "Subtext, status and silence pass",
  "Pacing and repetition pass",
  "Visual action and PageFlow pass",
  "Theme, motif and foreshadowing pass",
  "Genre, world and continuity pass",
  "Representation and research-question pass",
  "Formatting and readability pass",
  "Pitch, synopsis and audience-language pass",
];

test("all legacy prompt resources map into consolidated revision playbooks", async () => {
  const playbooks = await source("lib/ai-revision-playbooks.ts");
  for (const name of legacySources) assert.ok(playbooks.includes(`source: "${name}"`), `Missing source map: ${name}`);
  for (const title of passes) assert.ok(playbooks.includes(`title: "${title}"`), `Missing guided pass: ${title}`);
  assert.match(playbooks, /legacyPromptSourceMap/);
});

test("passes are grouped by Story First, Craft Layer and Polish Layer", async () => {
  const playbooks = await source("lib/ai-revision-playbooks.ts");
  for (const layer of ["Story First", "Craft Layer", "Polish Layer"]) assert.ok(playbooks.includes(`layer: "${layer}"`));
  for (const term of ["structure", "dialogue", "pacing", "redundancy", "visual writing", "theme", "world", "continuity", "formatting", "pitch"]) {
    assert.ok(playbooks.toLowerCase().includes(term), `Missing discoverable workflow: ${term}`);
  }
});

test("operation modes keep revision opt-in instead of default", async () => {
  const playbooks = await source("lib/ai-revision-playbooks.ts");
  for (const operation of [
    "Ask me focused questions",
    "Critique only",
    "Identify evidence and risks",
    "Suggest alternatives",
    "Compare two approaches",
    "Propose a revision for review",
    "Build a checklist",
    "Summarize findings",
  ]) assert.ok(playbooks.includes(operation), `Missing operation: ${operation}`);
  assert.ok(!playbooks.includes('defaultOperation: "Propose a revision for review"'), "Revision must never be the automatic default");
});

test("canonical scope selector supports project, structural, screenplay and pitch targets", async () => {
  const playbooks = await source("lib/ai-revision-playbooks.ts");
  for (const scope of [
    "Complete project",
    "Act or sequence",
    "Block",
    "Scene",
    "Mini-block",
    "Selected screenplay elements",
    "Character or relationship",
    "Story Thread",
    "Pitch or production material",
  ]) assert.ok(playbooks.includes(scope), `Missing canonical scope: ${scope}`);
});

test("generated prompts enforce the structured response and approval boundary", async () => {
  const playbooks = await source("lib/ai-revision-playbooks.ts");
  for (const section of [
    "Project evidence",
    "Diagnosis",
    "Unanswered questions",
    "Optional suggestions",
    "Continuity or canon risks",
    "Material requiring human verification",
    "Proposed changes only when requested",
  ]) assert.ok(playbooks.includes(section), `Missing response section: ${section}`);
  for (const phrase of [
    "preserve the original",
    "approval is required before application",
    "Never apply changes automatically",
    "manual-copy and no-AI use possible",
  ]) assert.ok(playbooks.includes(phrase), `Missing approval boundary: ${phrase}`);
});

test("marketing is routed outside screenplay editing", async () => {
  const playbooks = await source("lib/ai-revision-playbooks.ts");
  assert.match(playbooks, /destination: "Pitch & Review"/);
  assert.match(playbooks, /Route approved copy to Pitch & Review or Distribution, never into screenplay pages/);
});
