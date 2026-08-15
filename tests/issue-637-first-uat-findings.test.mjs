import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Sage keeps one visible personality while routing ordinary chat through a lightweight specialist", async () => {
  const [safeGuide, specialist, playbook] = await Promise.all([
    read("modules/creative-room/sage-safe-guide.ts"),
    read("modules/creative-room/sage-conversation-specialist.ts"),
    read("agents/sage-brinewick.md"),
  ]);

  assert.match(safeGuide, /answerAsSageConversationSpecialist/);
  assert.match(safeGuide, /isSageCraftQuestion\(request\.question\)/);
  assert.match(specialist, /SAGE CONVERSATION SPECIALIST/);
  assert.match(specialist, /capable, warm, lightly witty human collaborator who is ready to chat/);
  assert.match(specialist, /ordinary reasoning for casual, strange, humorous, meta, or general questions/);
  assert.match(playbook, /The writer always experiences one Sage/);
  assert.match(playbook, /Conversation specialist/);
  assert.match(playbook, /Curriculum mentor/);
  assert.match(playbook, /Story coach/);
  assert.match(playbook, /Response editor/);
});

test("obvious Sage help and shortening requests stay fast and deterministic", async () => {
  const safeGuide = await read("modules/creative-room/sage-safe-guide.ts");
  assert.match(safeGuide, /isSageHelpQuestion/);
  assert.match(safeGuide, /Yes — I can help/);
  assert.match(safeGuide, /isSageShortenRequest/);
  assert.match(safeGuide, /safeShorterAnswer\(request\.conversation\)/);
  assert.match(safeGuide, /reverse\(\)\.find\(\(item\) => item\.role === "guide"/);
  assert.match(safeGuide, /Sage response editor/);
});

test("Sage visible replies default to a few sentences and LEARN owns deeper teaching", async () => {
  const [safeGuide, playbook, workspace] = await Promise.all([
    read("modules/creative-room/sage-safe-guide.ts"),
    read("agents/sage-brinewick.md"),
    read("modules/learn/ui/learn-workspace.tsx"),
  ]);

  assert.match(safeGuide, /compactSentences\(result\.text, 4, 680\)/);
  assert.match(playbook, /Most replies should be \*\*2 to 4 sentences\*\*/);
  assert.match(playbook, /Default to 2–4 sentences/);
  assert.match(workspace, /aria-label="Related LEARN lessons"/);
  assert.match(workspace, /Learn more: <strong>\{lesson\.title\}<\/strong>/);
  assert.match(workspace, /onClick=\{\(\) => openLesson\(lesson\.id\)\}/);
  assert.doesNotMatch(workspace, />Curriculum: \{sourceTitles/);
  assert.doesNotMatch(workspace, />Lesson references: \{referenceTitles/);
});

test("Sage browser UAT waits for React state before clicking the send button", async () => {
  const runner = await read("scripts/run-sage-conversation-uat.mjs");
  const enter = runner.indexOf("setter?.call(textarea, question)");
  const ready = runner.indexOf("state.sendDisabled === false");
  const click = runner.indexOf("button.click()");
  assert.ok(enter >= 0 && ready > enter && click > ready, "UAT must enter text, wait for React state, then click");
  assert.match(runner, /Sage composer did not become ready after the question was entered/);
});

test("focused PLAN UAT mirrors structured retry and per-field recovery instead of one-shot JSON", async () => {
  const runner = await read("scripts/run-uat-autopilot.mjs");
  assert.match(runner, /function parsePlannerValues/);
  assert.match(runner, /FOCUSED UAT PLAN STRUCTURED RETRY/);
  assert.match(runner, /Quality retry/);
  assert.match(runner, /per-field recovery/);
  assert.match(runner, /plannerChat\(\[fieldId\]/);
  assert.match(runner, /after \$\{planner\.attempts\} recovery attempts/);
});

test("focused Startup, LEARN and PLAN UAT own the first closed-loop findings regression", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const testPath = "tests/issue-637-first-uat-findings.test.mjs";
  for (const areaId of ["startup", "foundations-learn", "plan"]) {
    const area = registry.areas.find((candidate) => candidate.id === areaId);
    assert.ok(area?.tests.includes(testPath), `${areaId} must own issue 637 regression`);
  }
});
