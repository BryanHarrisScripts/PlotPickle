import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("issue 638 keeps identity replies ahead of all local model work", async () => {
  const safeGuide = await read("modules/creative-room/sage-safe-guide.ts");
  const identityGate = safeGuide.indexOf("if (isSageIdentityQuestion(request.question)) return safeIdentityAnswer()");
  const craftPath = safeGuide.indexOf("? await safeCraftAnswer(request)");
  const conversationPath = safeGuide.indexOf(": await answerAsSageConversationSpecialist(request)");

  assert.ok(identityGate >= 0, "Sage identity questions must have a deterministic safety response");
  assert.ok(craftPath > identityGate, "identity response must run before the craft model path");
  assert.ok(conversationPath > identityGate, "identity response must run before the conversation model path");
  assert.match(safeGuide, /what is your name\|whats your name/);
  assert.match(safeGuide, /I’m Sage Brinewick, PlotPickle’s Curriculum Guide/);
});

test("issue 639 bounds craft latency and falls back to the local curriculum instead of an error", async () => {
  const safeGuide = await read("modules/creative-room/sage-safe-guide.ts");

  assert.match(safeGuide, /SAGE_CRAFT_RESPONSE_DEADLINE_MS = 20_000/);
  assert.match(safeGuide, /Promise\.race\(/);
  assert.match(safeGuide, /safeCraftFallbackAnswer/);
  assert.match(safeGuide, /fallbackLessonForQuestion/);
  assert.match(safeGuide, /fallbackCurriculumPassages/);
  assert.match(safeGuide, /lesson\.definitions/);
  assert.match(safeGuide, /lesson\.sections/);
  assert.match(safeGuide, /lesson\.apply/);
  assert.match(safeGuide, /sourceLessonIds: \[lesson\.id\]/);
  assert.match(safeGuide, /sourceReferenceIds: lesson\.sources\.slice\(0, 2\)/);
  assert.match(safeGuide, /return safeCraftFallbackAnswer\(request\)/);
  assert.doesNotMatch(safeGuide, /stronger Fast or Quality model in Settings/);
  assert.doesNotMatch(safeGuide, /const (?:answerBank|fixedResponses|cannedResponses)/);
});

test("Sage browser UAT accepts a newly visible reply without assuming two new DOM messages", async () => {
  const runner = await read("scripts/run-sage-conversation-uat.mjs");
  assert.match(runner, /texts\.length > previousCount/);
  assert.doesNotMatch(runner, /texts\.length >= previousCount \+ 2/);
  assert.match(runner, /Timed out waiting for Sage's visible UI answer/);
});

test("focused Foundations and LEARN UAT owns the 638 and 639 regression", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const learn = registry.areas.find((area) => area.id === "foundations-learn");
  assert.ok(learn?.tests.includes("tests/issue-638-639-sage-visible-answer-recovery.test.mjs"));
});
