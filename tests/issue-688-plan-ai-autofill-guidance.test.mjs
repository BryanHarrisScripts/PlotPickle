import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("each PLAN field exposes exactly three helper questions", async () => {
  const [contract, workspace] = await Promise.all([
    read("core/contracts/foundation-plan.ts"),
    read("modules/plan/ui/foundations-plan-workspace.tsx"),
  ]);

  assert.match(contract, /guidingQuestionsForFoundationField/);
  const functionStart = contract.indexOf("export function guidingQuestionsForFoundationField");
  const functionEnd = contract.indexOf("\n}\n", functionStart);
  const helper = contract.slice(functionStart, functionEnd);
  assert.equal((helper.match(/^\s*`|^\s*"/gm) ?? []).length, 3, "the guidance helper should return exactly three questions");
  assert.match(workspace, /guidingQuestionsForFoundationField\(field\)\.map/);
  assert.match(workspace, /Three questions to help you answer/);
});

test("selected PLAN AI drafts are inserted immediately without a second accept click", async () => {
  const workspace = await read("modules/plan/ui/foundations-plan-workspace.tsx");

  assert.match(workspace, /Use local AI to draft this answer/);
  assert.match(workspace, /const selectedFields = activeLesson\.fields\.filter/);
  assert.match(workspace, /function applyGeneratedDraft/);
  assert.match(workspace, /type: "foundations\.proposal\.store"/);
  assert.match(workspace, /type: "foundations\.proposal\.accept"/);
  assert.match(workspace, /applyGeneratedDraft\(lessonId, proposal\)/);
  assert.match(workspace, /setDraftFieldIds\(\[\]\)/);
  assert.match(workspace, /AI draft inserted into your editable fields/);
  assert.doesNotMatch(workspace, /Accept selected proposal into my fields/);
});

test("PLAN local generation targets two to four short paragraphs and hard-caps output at four", async () => {
  const drafter = await read("modules/plan/foundations-plan-drafter.ts");

  assert.match(drafter, /normalizeFoundationDraftParagraphs/);
  assert.match(drafter, /\.slice\(0, 4\)/);
  assert.match(drafter, /Aim for 2 short paragraphs per field/);
  assert.match(drafter, /Never exceed four paragraphs/);
  assert.match(drafter, /provider: "local"/);
  assert.doesNotMatch(drafter, /provider: "openai"|provider: "minimax"/);
});

test("PLAN still protects unselected fields by generating only selected IDs", async () => {
  const workspace = await read("modules/plan/ui/foundations-plan-workspace.tsx");
  assert.match(workspace, /fields: selectedFields/);
  assert.match(workspace, /Existing text in those selected fields will be replaced/);
  assert.match(workspace, /No answers selected for AI\. Manual writing remains unchanged/);
});
