import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Sage keeps one visible personality through one active guide path", async () => {
  const [page, unified, playbook] = await Promise.all([
    read("app/page.tsx"),
    read("modules/creative-room/sage-unified-guide.ts"),
    read("agents/sage-brinewick.md"),
  ]);

  assert.match(page, /sage-unified-guide/);
  assert.match(unified, /isSageCraftQuestion\(request\.question\)/);
  assert.match(unified, /This is ordinary conversation\. Respond naturally/);
  assert.match(unified, /Use the relevant PlotPickle curriculum below for craft teaching/);
  assert.doesNotMatch(unified, /answerAsSageConversationSpecialist/);
  assert.match(playbook, /The writer always experiences one Sage/);
  assert.match(playbook, /Do not simulate or expose separate personalities/);
  assert.match(playbook, /Normal conversation and odd questions/);
  assert.match(playbook, /Story and curriculum questions/);
});

test("obvious Sage help and shortening requests stay fast and deterministic", async () => {
  const unified = await read("modules/creative-room/sage-unified-guide.ts");
  assert.match(unified, /isHelpQuestion/);
  assert.match(unified, /how can you help\(\?: me\)\?/);
  assert.match(unified, /I can explain any PlotPickle lesson in plain language/);
  assert.match(unified, /isShortenRequest/);
  assert.match(unified, /reverse\(\)\.find\(\(item\) => item\.role === "guide"/);
  assert.match(unified, /Sage response editor/);
});

test("Sage visible replies default to a few sentences and LEARN owns deeper teaching", async () => {
  const [unified, playbook, workspace] = await Promise.all([
    read("modules/creative-room/sage-unified-guide.ts"),
    read("agents/sage-brinewick.md"),
    read("modules/learn/ui/learn-workspace.tsx"),
  ]);

  assert.match(unified, /compactSentences\(result\.text \|\| ""\)/);
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
