import assert from 'node:assert/strict';
import test from 'node:test';
import { unchangedLineAfterPatch, lineShiftPreservesExistingFinding } from '../scripts/run-ben-code-quality.mjs';
const patch = '@@ -0,0 +1 @@\n+import x from "x";\n@@ -20,2 +21,3 @@\n';
function fixture() {
  const base = { primaryLocation: {line: 10, column:1}, score:2, severity:'strong', message:'wrapper', evidence:['helper at line 10 -> trim'] };
  const head = {...base, primaryLocation:{line:11,column:1}, evidence:['helper at line 11 -> trim']};
  return { report: {changes:[{status:'resolved',ruleId:'wrapper',base}]}, change:{status:'added',ruleId:'wrapper',head} };
}
test('#2697 BEN maps only untouched lines through insertions and replacements', () => {
  assert.equal(unchangedLineAfterPatch(10,patch),11);
  assert.equal(unchangedLineAfterPatch(20,patch),null);
  assert.equal(unchangedLineAfterPatch(25,patch),27);
});
test('#2697 BEN preserves unchanged findings shifted by an unrelated import', () => {
  const {report,change}=fixture();
  assert.equal(lineShiftPreservesExistingFinding(report,change,patch),true);
});
test('#2697 BEN still blocks changed evidence, severity, score and edited finding lines', () => {
  for (const field of ['evidence','severity','score']) {
    const {report,change}=fixture();
    change.head[field]=field==='score'?3:field==='evidence'?['helper at line 11 -> unsafe']: 'critical';
    assert.equal(lineShiftPreservesExistingFinding(report,change,patch),false);
  }
  const {report,change}=fixture();
  assert.equal(lineShiftPreservesExistingFinding(report,change,'@@ -10 +10 @@'),false);
  assert.equal(lineShiftPreservesExistingFinding({changes:[]},change,patch),false);
});
