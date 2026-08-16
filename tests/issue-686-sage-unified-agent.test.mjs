import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("LEARN uses one unified Sage path instead of the layered conversation specialist", async () => {
  const [page, unified, playbook] = await Promise.all([
    read("app/page.tsx"),
    read("modules/creative-room/sage-unified-guide.ts"),
    read("agents/sage-brinewick.md"),
  ]);

  assert.match(page, /from "\.\.\/modules\/creative-room\/sage-unified-guide"/);
  assert.doesNotMatch(page, /sage-safe-guide/);
  assert.match(unified, /agentId: "curriculum-guide"/);
  assert.doesNotMatch(unified, /answerAsSageConversationSpecialist/);
  assert.doesNotMatch(unified, /from "\.\/sage-conversation-specialist"/);
  assert.match(playbook, /The writer always experiences one Sage/);
  assert.match(playbook, /Do not simulate or expose separate personalities/);
});

test("unified Sage keeps routing and recovery outside the persona prompt", async () => {
  const unified = await read("modules/creative-room/sage-unified-guide.ts");

  assert.match(unified, /isSageCraftQuestion/);
  assert.match(unified, /retrieveCurriculumContext/);
  assert.match(unified, /craft \? `Relevant PlotPickle curriculum/);
  assert.match(unified, /This is ordinary conversation\. Respond naturally/);
  assert.match(unified, /\{ role: "fast", repair: false \}/);
  assert.match(unified, /\{ role: "quality", repair: true \}/);
  assert.ok(unified.indexOf('{ role: "fast", repair: false }') < unified.indexOf('{ role: "quality", repair: true }'));
  assert.match(unified, /sageUnifiedAnswerUsable/);
  assert.match(unified, /hasRunawayRepetition/);
  assert.match(unified, /INTERNAL_MARKERS/);
  assert.match(unified, /Bounded local-only recovery/);
  assert.doesNotMatch(unified, /provider: "openai"|provider: "minimax"/);
});

test("simple Sage intents are deterministic while craft fallback remains curriculum grounded", async () => {
  const unified = await read("modules/creative-room/sage-unified-guide.ts");

  assert.match(unified, /I’m Sage Brinewick, PlotPickle’s Curriculum Guide/);
  assert.match(unified, /how can you help\(\?: me\)\?/);
  assert.match(unified, /I can explain any PlotPickle lesson in plain language/);
  assert.match(unified, /isShortenRequest/);
  assert.match(unified, /reverse\(\)\.find\(\(item\) => item\.role === "guide"/);
  assert.match(unified, /function craftFallback/);
  assert.match(unified, /lesson\.definitions/);
  assert.match(unified, /lesson\.overview/);
  assert.match(unified, /lesson\.apply/);
  assert.match(unified, /sourceLessonIds: craft \? retrieval\.lessonIds : \[\]/);
  assert.match(unified, /sourceReferenceIds: craft \? retrieval\.sourceIds : \[\]/);
});

test("the canonical Sage playbook is shorter and no longer describes a hidden specialist room", async () => {
  const playbook = await read("agents/sage-brinewick.md");
  assert.ok(playbook.length < 5000, `Sage playbook should stay compact; got ${playbook.length} characters`);
  assert.doesNotMatch(playbook, /## Hidden specialist room/);
  assert.match(playbook, /Answer first\. Be useful\. Keep the machinery out of the room\./);
  assert.match(playbook, /Normal conversation and odd questions/);
  assert.match(playbook, /Story and curriculum questions/);
});
