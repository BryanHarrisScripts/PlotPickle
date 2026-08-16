import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("PLAN lets the writer choose one, two, or all answers for local AI", async () => {
  const workspace = await read("modules/plan/ui/foundations-plan-workspace.tsx");

  assert.match(workspace, /const \[draftFieldIds, setDraftFieldIds\] = useState<readonly string\[]>\(\[\]\)/);
  assert.match(workspace, /Use local AI to draft this answer/);
  assert.match(workspace, /type="checkbox"/);
  assert.match(workspace, /checked=\{draftFieldIds\.includes\(field\.id\)\}/);
  assert.match(workspace, /toggleDraftField\(field\.id\)/);
  assert.match(workspace, /draftFieldIds\.length === 0/);
  assert.match(workspace, /No answers selected for AI\. Manual writing remains unchanged\./);
});

test("PLAN sends only selected fields to the local drafter", async () => {
  const [workspace, drafter] = await Promise.all([
    read("modules/plan/ui/foundations-plan-workspace.tsx"),
    read("modules/plan/foundations-plan-drafter.ts"),
  ]);

  assert.match(workspace, /const selectedFields = activeLesson\.fields\.filter\(\(field\) => draftFieldIds\.includes\(field\.id\)\)/);
  assert.match(workspace, /lesson: \{\s*\.\.\.activeLesson,\s*fields: selectedFields,/s);
  assert.match(workspace, /Choose one or more PLAN answers for local AI before drafting/);
  assert.match(drafter, /input\.lesson\.fields\.map\(\(field\) => \[field\.id, field\.prompt\]\)/);
  assert.match(drafter, /input\.lesson\.fields\.map\(\(field\) => field\.id\)/);
});

test("generated partial drafts auto-apply only the selected PLAN fields", async () => {
  const [reducer, workspace] = await Promise.all([
    read("core/project/apply-command.ts"),
    read("modules/plan/ui/foundations-plan-workspace.tsx"),
  ]);

  assert.match(reducer, /\.\.\.\(lesson\.proposal\?\.values \?\? \{\}\)/);
  assert.match(workspace, /function applyGeneratedDraft/);
  assert.match(workspace, /type: "foundations\.proposal\.store"/);
  assert.match(workspace, /type: "foundations\.proposal\.accept"/);
  assert.match(workspace, /applyGeneratedDraft\(lessonId, proposal\)/);
  assert.match(workspace, /AI draft inserted into your editable fields/);
  assert.match(workspace, /proposal\.values\[field\.id\]/);
  assert.doesNotMatch(workspace, /Accept selected proposal into my fields/);
});
