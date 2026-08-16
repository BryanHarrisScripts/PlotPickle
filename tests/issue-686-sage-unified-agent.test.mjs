import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("LEARN uses one unified Sage path with the Sage skill instead of a layered conversation specialist", async () => {
  const [page, unified, skill] = await Promise.all([
    read("app/page.tsx"),
    read("modules/creative-room/sage-unified-guide.ts"),
    read(".agents/skills/sage-brinewick/SKILL.md"),
  ]);

  assert.match(page, /from "\.\.\/modules\/creative-room\/sage-unified-guide"/);
  assert.doesNotMatch(page, /sage-safe-guide/);
  assert.match(unified, /agentId: "curriculum-guide"/);
  assert.doesNotMatch(unified, /answerAsSageConversationSpecialist/);
  assert.doesNotMatch(unified, /from "\.\/sage-conversation-specialist"/);
  assert.match(skill, /The writer always experiences one Sage/);
  assert.match(skill, /Do not simulate or expose separate personalities/);
});

test("unified Sage keeps routing and recovery outside the persona skill", async () => {
  const unified = await read("modules/creative-room/sage-unified-guide.ts");
  const skill = await read(".agents/skills/sage-brinewick/SKILL.md");

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
  assert.match(skill, /Model capability selection and bounded local recovery belong to the PlotPickle host/i);
  assert.doesNotMatch(skill, /requestGuideModel|prepareGuideQualityModel|\/api\/local-ai\/runtime/);
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

test("the canonical Sage skill is compact procedure and not a hidden curriculum copy", async () => {
  const skill = await read(".agents/skills/sage-brinewick/SKILL.md");
  assert.ok(skill.length < 7000, `Sage skill should stay compact; got ${skill.length} characters`);
  assert.doesNotMatch(skill, /## Hidden specialist room/);
  assert.match(skill, /Answer first\. Be useful\. Keep the machinery out of the room\./);
  assert.match(skill, /Normal conversation and odd questions/);
  assert.match(skill, /Story and curriculum questions/);
  assert.match(skill, /This skill is procedure, not curriculum/i);
  assert.match(skill, /retrieved\/injected curriculum is the source of truth/i);
  assert.doesNotMatch(skill, /Lesson 0[1-9]|Lesson 1[01]|24 Blocks|96 Mini-Blocks/);
});
