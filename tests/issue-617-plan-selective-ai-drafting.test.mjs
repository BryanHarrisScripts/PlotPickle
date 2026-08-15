import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("PLAN lets the writer choose one, two, or all fields for local AI", async () => {
  const workspace = await read("modules/plan/ui/foundations-plan-workspace.tsx");

  assert.match(workspace, /const \[draftFieldIds, setDraftFieldIds\] = useState<readonly string\[]>\(\[\]\)/);
  assert.match(workspace, /Choose one, two, or all fields/);
  assert.match(workspace, /type="checkbox"/);
  assert.match(workspace, /checked=\{draftFieldIds\.includes\(field\.id\)\}/);
  assert.match(workspace, /toggleDraftField\(field\.id\)/);
  assert.match(workspace, /draftFieldIds\.length === 0/);
  assert.match(workspace, /Nothing selected\. Your existing fields will not be sent for drafting until you choose\./);
});

test("PLAN sends only selected fields to the local drafter", async () => {
  const [workspace, drafter] = await Promise.all([
    read("modules/plan/ui/foundations-plan-workspace.tsx"),
    read("modules/plan/foundations-plan-drafter.ts"),
  ]);

  assert.match(workspace, /const selectedFields = activeLesson\.fields\.filter\(\(field\) => draftFieldIds\.includes\(field\.id\)\)/);
  assert.match(workspace, /lesson: \{\s*\.\.\.activeLesson,\s*fields: selectedFields,/s);
  assert.match(workspace, /Choose one or more PLAN fields for local AI before creating a proposal/);
  assert.match(drafter, /input\.lesson\.fields\.map\(\(field\) => \[field\.id, field\.prompt\]\)/);
  assert.match(drafter, /input\.lesson\.fields\.map\(\(field\) => field\.id\)/);
});

test("accepting a partial proposal cannot overwrite unselected PLAN fields", async () => {
  const reducer = await read("core/project/apply-command.ts");
  const workspace = await read("modules/plan/ui/foundations-plan-workspace.tsx");

  assert.match(reducer, /\.\.\.\(lesson\.proposal\?\.values \?\? \{\}\)/);
  assert.match(workspace, /Accept selected proposal into my fields/);
  assert.match(workspace, /proposal\.values\[field\.id\]/);
});
