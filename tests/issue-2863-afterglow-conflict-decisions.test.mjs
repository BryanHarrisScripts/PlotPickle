import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  planAfterglowConsolidation,
  reviewAfterglowConsolidationDecisions,
} from "../modules/library/afterglow-consolidation.mjs";

const baseline = () => ({
  format: "2.0-foundation", id: "original", title: "Afterglow", revision: 0,
  createdAt: "2026-09-01T00:00:00.000Z",updatedAt:"2026-09-01T00:00:00.000Z",
  sourceEvidence:{referenceFixture:{sourceId:"afterglow-v9-complete-baseline"}},
  storyDevelopment:{fields:{}},mindMapNotes:{fields:{}},world:{facts:{}},
});
const copy = (base,id,field,answer) => ({
  project: {
    ...structuredClone(base), id, updatedAt:"2026-10-08T12:00:00.000Z",
    storyDevelopment: {fields:{[field]:{value:answer}}},
  },
});
test("#2863 Phase 2B conflict decisions are exact, account-owned and never writable", () => {
  const b=baseline();
  const before=structuredClone(b);
  const a=copy(b,"working-a","theme","Amy confronts the past");
  const c=copy(b,"working-c","theme","Ren confronts the future");
  const plan=planAfterglowConsolidation({baseline:b,sources:[a,c]});
  assert.equal(plan.conflicts.length,1);
  const conflict=plan.conflicts[0];
  assert.deepEqual(conflict.optionSources,["working-a","working-c"]);
  assert.equal(reviewAfterglowConsolidationDecisions(plan,{}).unresolvedConflicts.length,1);
  const choice=reviewAfterglowConsolidationDecisions(plan,{[conflict.path]:1});
  assert.equal(choice.unresolvedConflicts.length,0);
  assert.equal(choice.candidate.storyDevelopment.fields.theme.value,"Ren confronts the future");
  assert.equal(choice.readyForHumanCommit,false);
  assert.equal(choice.packageModified,false);
  assert.deepEqual(b,before);
  assert.equal(plan.candidate.storyDevelopment.fields.theme,undefined);
});
test("#2863 Phase 2B UI shows all conflicts across pages, full values and no Save Master",async()=>{
  const content=await readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8");
  assert.match(content,/reviewAfterglowConsolidationDecisions\(preview\.plan, decisions, exclusions\)/u);
  assert.match(content,/conflicts: result\.conflicts,/u);
  assert.match(content,/preview\.conflicts\.slice\(conflictPage \* 10, \(conflictPage \+ 1\) \* 10\)/u);
  assert.match(content,/setConflictPage\(p => p \+ 1\)/u);
  assert.match(content,/setConflictPage\(p => Math\.max\(0, p - 1\)\)/u);
  assert.match(content,/item\.optionSources\?\.\[optionIndex\]/u);
  assert.match(content,/JSON\.stringify\(value, null, 2\)/u);
  assert.match(content,/Keep the provided baseline value/u);
  assert.match(content,/No project, approval, image, or provided example was changed/u);
  assert.match(content,/ready to save|not ready to save|not saved/iu);
  assert.doesNotMatch(content,/createLibraryWorkingCopy|saveActiveLibraryProject|archiveLibraryProject|persistActiveProfileProject/u);
});
