import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectAutomatedLaneAReview} from '../scripts/engineering-team/verification/lane-a-automated-reviewer.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const HEAD='a'.repeat(40);
const normativePath='docs/white-papers/AI_Programming_Evolution_White_Paper.md';
const testPath='tests/issue-3302-fixture.test.mjs';
const implPath='scripts/engineering-team/verification/fixture.mjs';
const bytes={
 [normativePath]:Buffer.from('WHITE-PAPER-V3 obligations W8 W9','utf8'),
 [testPath]:Buffer.from("test('fixture',()=>{throw Error('NOT_EXECUTED')})",'utf8'),
 [implPath]:Buffer.from('export const fixture = true;','utf8')
};
const requiredTruth=['WHITE-PAPER-V3/W8','WHITE-PAPER-V3/W9'];
const workOrder={
 schemaVersion:'PP-LANE-A-REVIEW-WORK-V1',
 authorPrincipal:'coding-worker-01',
 candidateHead:HEAD,
 testDigests:{[testPath]:digest(bytes[testPath])},
 inputDigests:{
  [implPath]:digest(bytes[implPath]),
  [normativePath]:digest(bytes[normativePath])
 },
 truthRefs:requiredTruth
};
const policy={
 schemaVersion:1,source:'external-protected-authority',
 normativeDigest:digest(bytes[normativePath]),
 sourceHead:HEAD,
 allowAutomatedPreflight:true,
 requiredTruthRefs:requiredTruth
};
const check=(patch={},opts={})=>inspectAutomatedLaneAReview({
 workOrder,sourceBlobs:bytes,independentlyPinnedPolicy:policy,stopMarkerState:'ABSENT',
 ...patch,...opts
});

test('matching exact bytes produce only UNPROVEN proposal and no signer or admission permissions',()=>{
 const r=check();
 assert.equal(r.status,'REVIEW_PROPOSAL_ONLY');
 assert.equal(r.disposition,'UNPROVEN');
 assert.equal(r.code,'EDITION_PREFLIGHT_PASS_SEMANTIC_REVIEW_REQUIRED');
 assert.equal(r.independentlyVerified,false);
 for(const k of ['maySign','mayAdmit','mayEditCatalogue','mayCode','mayMerge'])assert.equal(r[k],false,k);
 assert.equal(r.requiresIndependentSemanticReview,true);
 assert.equal(r.observedDigests[testPath],workOrder.testDigests[testPath]);
});

test('test inputs are never executed as JavaScript by the reviewer',()=>{
 const evil=Buffer.from('process.exit(42); throw Error("unsafe");');
 const r=check({sourceBlobs:{...bytes,[testPath]:evil}});
 assert.equal(r.disposition,'FIX');
 assert.equal(r.code,'SOURCE_EDITION_MISMATCH');
 assert.ok(r.findings.some(x=>x.startsWith('EDITION_MISMATCH:')));
});

test('owner STOP always overrides otherwise valid input, including unreadable marker',()=>{
 assert.equal(check({stopMarkerState:'PRESENT'}).code,'INTENTIONAL_STOP');
 assert.equal(check({stopMarkerState:'UNKNOWN'}).code,'STOP_UNVERIFIABLE');
 assert.equal(check({stopMarkerState:undefined}).code,'STOP_UNVERIFIABLE');
});

test('truth trust root cannot come from candidate without external trusted policy',()=>{
 assert.equal(check({independentlyPinnedPolicy:null}).code,'INDEPENDENT_TRUTH_POLICY_MISSING');
 assert.equal(check({independentlyPinnedPolicy:{...policy,source:'pr-controlled'}}).code,'INDEPENDENT_TRUTH_POLICY_MISSING');
 assert.equal(check({independentlyPinnedPolicy:{...policy,allowAutomatedPreflight:false}}).code,'INDEPENDENT_TRUTH_POLICY_MISSING');
 assert.equal(check({independentlyPinnedPolicy:{...policy,requiredTruthRefs:['WHITE-PAPER-V3/W8']}}).code,'INDEPENDENT_TRUTH_POLICY_MISSING');
});

test('unmatched Git head or missing test/source digests cannot enter preflight',()=>{
 assert.equal(check({workOrder:{...workOrder,candidateHead:'b'.repeat(40)}}).code,'EXACT_WORK_ORDER_INVALID');
 assert.equal(check({workOrder:{...workOrder,testDigests:{}}}).code,'EXACT_WORK_ORDER_INVALID');
 assert.equal(check({workOrder:{...workOrder,inputDigests:{}}}).code,'EXACT_WORK_ORDER_INVALID');
});

test('scope must contain both and only W8 and W9',()=>{
 assert.equal(check({workOrder:{...workOrder,truthRefs:['WHITE-PAPER-V3/W8']}}).code,'W8_W9_TRUTH_SCOPE_MISMATCH');
 assert.equal(check({workOrder:{...workOrder,truthRefs:['WHITE-PAPER-V3/W8','WHITE-PAPER-V3/W8']}}).code,'W8_W9_TRUTH_SCOPE_MISMATCH');
 assert.equal(check({workOrder:{...workOrder,truthRefs:['WHITE-PAPER-V3/W8','unapproved']}}).code,'W8_W9_TRUTH_SCOPE_MISMATCH');
});

test('normative source digest must match independently pinned external policy',()=>{
 assert.equal(check({workOrder:{...workOrder,inputDigests:{[implPath]:digest(bytes[implPath])}},sourceBlobs:{[testPath]:bytes[testPath],[implPath]:bytes[implPath]}}).code,'NORMATIVE_SOURCE_NOT_EXTERNALLY_PINNED');
 assert.equal(check({independentlyPinnedPolicy:{...policy,normativeDigest:'a'.repeat(64)}}).code,'NORMATIVE_SOURCE_NOT_EXTERNALLY_PINNED');
});

test('missing, extra, or non-binary snapshot sources fail closed',()=>{
 const fewer={...bytes};delete fewer[implPath];
 assert.equal(check({sourceBlobs:fewer}).code,'UNPINNED_SOURCE_FILE');
 assert.equal(check({sourceBlobs:{...bytes,'src/malicious.mjs':Buffer.from('x')}}).code,'UNPINNED_SOURCE_FILE');
 assert.equal(check({sourceBlobs:{...bytes,[testPath]:"not a buffer"}}).code,'NON_BINARY_SOURCE_BLOB');
});

test('test paths cannot overlap implementation or escape permitted source roots',()=>{
 assert.equal(check({workOrder:{...workOrder,testDigests:{[implPath]:digest(bytes[implPath])}}}).code,'TEST_INPUT_PATH_SCOPE_INVALID');
 assert.equal(check({workOrder:{...workOrder,testDigests:{'tests/../private.js':'a'.repeat(64)}}}).code,'EXACT_WORK_ORDER_INVALID');
 assert.equal(check({workOrder:{...workOrder,testDigests:{'C:\\secrets':'a'.repeat(64)}}}).code,'EXACT_WORK_ORDER_INVALID');
});

test('tampered source bytes produce FIX only, not signed ADMIT',()=>{
 const bad=Buffer.from(bytes[implPath]);bad[0]^=1;
 const r=check({sourceBlobs:{...bytes,[implPath]:bad}});
 assert.equal(r.disposition,'FIX');
 assert.equal(r.maySign,false);
 assert.equal(r.mayAdmit,false);
 assert.equal(r.findings[0],'EDITION_MISMATCH:'+implPath);
});

test('oversized source and total budget cannot exhaust reviewer',()=>{
 assert.equal(check({sourceBlobs:{...bytes,[testPath]:Buffer.alloc(524289,42)}}).code,'SOURCE_BLOB_SIZE_INVALID');
 const large=Buffer.alloc(512*1024,42);
 const inputs={...workOrder.inputDigests};
 const blobs={...bytes};
 for(let i=0;i<5;i++){
  const p='scripts/engineering-team/verification/big-'+i+'.mjs';
  inputs[p]=digest(large);blobs[p]=large;
 }
 assert.equal(check({workOrder:{...workOrder,inputDigests:inputs},sourceBlobs:blobs}).code,'SOURCE_REVIEW_BUDGET_EXCEEDED');
});

test('reviewer enforces bounded file count, no arbitrary command execution',()=>{
 const t={...workOrder.testDigests};
 for(let i=0;i<81;i++)t['tests/test-'+i+'.mjs']='a'.repeat(64);
 assert.equal(check({workOrder:{...workOrder,testDigests:t}}).code,'EXACT_WORK_ORDER_INVALID');
});
