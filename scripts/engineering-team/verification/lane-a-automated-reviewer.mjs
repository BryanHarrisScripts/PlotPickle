/**
 * #3302 — F00 Lane A automated independent reviewer: bounded, pure pre-admission
 * review. This function is safe to run without a signer and NEVER emits ADMIT.
 *
 * Trust boundaries:
 * - repository snapshots, submitted work orders, test bodies and attached CI
 *   observations are untrusted; do not execute tests under the reviewer's SID;
 * - the trusted truth policy, normative bytes and observation clock must be
 *   supplied from a separately pinned authority outside the author PR;
 * - a reviewer principal/OS credential, signed qualification, registrar nonce
 *   receipt and protected signer are NOT established by this function;
 * - only a separately permissioned catalogue-maintainer may edit the catalogue.
 */
import {createHash} from 'node:crypto';

const SHA1=/^[0-9a-f]{40}$/;
const SHA256=/^[0-9a-f]{64}$/;
const FILE=/^(?:tests|scripts|core|config|docs)\/[A-Za-z0-9._/-]{1,220}$/;
const REQUIRED_TRUTH=['WHITE-PAPER-V3/W8','WHITE-PAPER-V3/W9'];
const MAX_FILES=80;
const MAX_FILE_BYTES=512*1024;
const MAX_TOTAL_BYTES=2*1024*1024;

const deny=(code,findings=[])=>Object.freeze({
 schemaVersion:'PP-LANE-A-AUTOMATED-REVIEW-V1',
 status:'BLOCKED',disposition:'UNPROVEN',code,
 findings:Object.freeze(findings),
 automatedPreflight:false,independentlyVerified:false,
 maySign:false,mayAdmit:false,mayEditCatalogue:false,mayCode:false,mayMerge:false
});

const acceptableFile=(path)=>{
 if(typeof path!=='string'||!FILE.test(path)||path.includes('..')||
  path.includes('//')||path.endsWith('/')||path.startsWith('/')||
  path.split('/').some(x=>x==='.'||x===''))return false;
 return !/[\r\n\t\\:*?"<>|]/.test(path);
};
const fileDigest=bytes=>createHash('sha256').update(bytes).digest('hex');
const validDigestMap=(map)=>{
 if(!map||typeof map!=='object'||Array.isArray(map))return false;
 const entries=Object.entries(map);
 return entries.length>0&&entries.length<=MAX_FILES&&
  entries.every(([path,digest])=>acceptableFile(path)&&
   typeof digest==='string'&&SHA256.test(digest));
};
const report=(disposition,code,findings,digests)=>{
 return Object.freeze({
  schemaVersion:'PP-LANE-A-AUTOMATED-REVIEW-V1',
  status:'REVIEW_PROPOSAL_ONLY',disposition,code,
  findings:Object.freeze([...findings]),
  observedDigests:Object.freeze({...digests}),
  // This is only a deterministic candidate/evidence edition check. A separate
  // qualified F00 reviewer must inspect semantic W8/W9 adequacy and sign.
  automatedPreflight:true,independentlyVerified:false,
  requiresIndependentSemanticReview:true,
  requiresTrustedReviewerSigner:true,
  requiresSeparateCatalogueMaintainer:true,
  maySign:false,mayAdmit:false,mayEditCatalogue:false,mayCode:false,mayMerge:false
 });
};

/**
 * Inputs are already-fetched immutable blob BYTES supplied by a read-only
 * staging adapter, not path strings that this module opens or executes.
 * Caller must independently verify Git tree/head and prove blob provenance.
 * policy is an external immutable admission-policy edition, not from PR.
 */
export function inspectAutomatedLaneAReview({
 workOrder,sourceBlobs,independentlyPinnedPolicy,stopMarkerState
}={}){
 if(stopMarkerState!=='ABSENT')return deny(stopMarkerState==='PRESENT'?
  'INTENTIONAL_STOP':'STOP_UNVERIFIABLE');
 if(!independentlyPinnedPolicy||independentlyPinnedPolicy.schemaVersion!==1||
  independentlyPinnedPolicy.source!=='external-protected-authority'||
  !SHA256.test(independentlyPinnedPolicy.normativeDigest||'')||
  !SHA1.test(independentlyPinnedPolicy.sourceHead||'')||
  independentlyPinnedPolicy.allowAutomatedPreflight!==true||
  !Array.isArray(independentlyPinnedPolicy.requiredTruthRefs)||
  independentlyPinnedPolicy.requiredTruthRefs.length!==2||
  REQUIRED_TRUTH.some(x=>!independentlyPinnedPolicy.requiredTruthRefs.includes(x)))
  return deny('INDEPENDENT_TRUTH_POLICY_MISSING');
 if(!workOrder||workOrder.schemaVersion!=='PP-LANE-A-REVIEW-WORK-V1'||
  typeof workOrder.authorPrincipal!=='string'||
  workOrder.authorPrincipal.length<3||
  workOrder.candidateHead!==independentlyPinnedPolicy.sourceHead||
  !SHA1.test(workOrder.candidateHead||'')||
  !validDigestMap(workOrder.testDigests)||
  !validDigestMap(workOrder.inputDigests))
  return deny('EXACT_WORK_ORDER_INVALID');
 if(!Array.isArray(workOrder.truthRefs)||
  workOrder.truthRefs.length!==2||
  new Set(workOrder.truthRefs).size!==2||
  REQUIRED_TRUTH.some(x=>!workOrder.truthRefs.includes(x)))
  return deny('W8_W9_TRUTH_SCOPE_MISMATCH');
 if(Object.keys(workOrder.testDigests).some(x=>!x.startsWith('tests/'))||
  Object.keys(workOrder.inputDigests).some(x=>Object.hasOwn(workOrder.testDigests,x)))
  return deny('TEST_INPUT_PATH_SCOPE_INVALID');
 if(!sourceBlobs||typeof sourceBlobs!=='object'||Array.isArray(sourceBlobs))
  return deny('IMMUTABLE_SOURCE_BLOBS_MISSING');
 const requiredPaths=[...Object.keys(workOrder.testDigests),...Object.keys(workOrder.inputDigests)];
 if(requiredPaths.length>MAX_FILES)return deny('TOO_MANY_SOURCE_FILES');
 // No extra source files: a confused deputy must never interpret a submitted
 // file outside an exact, explicitly pinned edition.
 if(Object.keys(sourceBlobs).length!==requiredPaths.length||
    Object.keys(sourceBlobs).some(x=>!requiredPaths.includes(x)))
  return deny('UNPINNED_SOURCE_FILE');
 const results={},findings=[];
 let total=0;
 for(const path of requiredPaths){
  const bytes=sourceBlobs[path];
  if(!Buffer.isBuffer(bytes))return deny('NON_BINARY_SOURCE_BLOB');
  if(bytes.length===0||bytes.length>MAX_FILE_BYTES)return deny('SOURCE_BLOB_SIZE_INVALID');
  total+=bytes.length;
  if(total>MAX_TOTAL_BYTES)return deny('SOURCE_REVIEW_BUDGET_EXCEEDED');
  const actual=fileDigest(bytes);
  results[path]=actual;
  const expected=Object.hasOwn(workOrder.testDigests,path)?
   workOrder.testDigests[path]:workOrder.inputDigests[path];
  if(actual!==expected)findings.push('EDITION_MISMATCH:'+path);
 }
 // This comparison checks bytes, not semantic adequacy or provenance of the
 // claimed origin. The caller must separately prove commit-to-blob identity.
 const normativePath='docs/white-papers/AI_Programming_Evolution_White_Paper.md';
 if(!Object.hasOwn(workOrder.inputDigests,normativePath)||
  workOrder.inputDigests[normativePath]!==independentlyPinnedPolicy.normativeDigest)
  return deny('NORMATIVE_SOURCE_NOT_EXTERNALLY_PINNED');
 if(findings.length)return report('FIX','SOURCE_EDITION_MISMATCH',findings,results);
 return report('UNPROVEN','EDITION_PREFLIGHT_PASS_SEMANTIC_REVIEW_REQUIRED',
  ['Source bytes match declared SHA-256 editions; semantic W8/W9 review and independent Windows signer identity unproven.'],results);
}
