/**
 * #3142 green-only release eligibility. READ-ONLY.
 * A coding receipt, green hosted CI or owner-written JSON alone never
 * authorizes a merge. This module cannot mutate GitHub or start a dispatcher.
 * Caller must use an independently protected/pinned public trust root, never
 * a signing key supplied by the coding worker or the PR.
 */
import { verify } from 'node:crypto';

const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const ID=/^[a-f0-9]{32}$/;
const requiredLayers=[
  'Layer 1 Experience Skins','Layer 2 Experience Contract',
  'Layer 3 Production Orchestration','Layer 4 Agent & Skill Mesh',
  'Layer 5 Story / Canon / Evidence','Layer 6 Provider Runtime',
  'Layer 7 Validation & Operations',
  'Windows owned verifier STOP and sentinel proof',
];
const denied=(code)=>Object.freeze({state:'BLOCKED',code,maySubmitMerge:false,
  automaticMergeEnabled:false,mergeExecuted:false,replayAuthorized:false});
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const releaseFields=['schemaVersion','kind','consent','prNumber','baseHead',
  'candidateHead','verifierReceiptId','ownerWindowsProofDigest','nonce',
  'observedAt','expiresAt'];
export function ownerReleasePayload(a){
  if(!plain(a)||!releaseFields.every(k=>Object.hasOwn(a,k)))return null;
  return JSON.stringify(Object.fromEntries(releaseFields.map(k=>[k,a[k]])));
}
export function assessSignedGreenRelease({
  pr,mainHead,workflow,jobs,supervisor,
  engineering,verifier,ownerWindows,
  signedOwnerRelease,pinnedPublicKey,now=Date.now(),
}={}){
  if(!SHA.test(mainHead||'')||!plain(pr)||pr.state!=='open'||
     pr.draft!==false||pr.mergeable!==true||pr.base?.ref!=='main'||
     pr.base?.sha!==mainHead||!SHA.test(pr.head?.sha||'')||
     !Number.isSafeInteger(pr.number)||pr.number<1)
    return denied('EXACT_OPEN_PR_AND_MAIN_REQUIRED');
  const head=pr.head.sha;
  if(!plain(supervisor)||supervisor.state!=='RUNNING'||
     supervisor.exactSha!==mainHead||supervisor.pauseAcknowledged===true||
     supervisor.stopRequested===true||supervisor.heartbeatFresh!==true)
    return denied('OWNER_STOP_PAUSE_OR_SUPERVISOR_UNVERIFIED');
  if(!plain(engineering)||engineering.state!=='SOURCE_COMMITTED_AND_PR_PUBLISHED'||
     engineering.issueNumber!==3142||engineering.prNumber!==pr.number||
     engineering.sourceHead!==mainHead||engineering.candidateHead!==head||
     !DIGEST.test(engineering.receiptId||'')||
     engineering.independentlyVerified!==false||
     engineering.automaticMergeAuthorized!==false)
    return denied('ENGINEERING_RECEIPT_EXACT_HEAD_UNVERIFIED');
  if(!plain(verifier)||verifier.kind!=='independent-verifier'||
     verifier.state!=='INDEPENDENTLY_VERIFIED'||
     verifier.independentlyVerified!==true||
     verifier.automaticMergeAuthorized!==false||
     verifier.candidateHead!==head||verifier.sourceHead!==mainHead||
     verifier.prNumber!==pr.number||
     !DIGEST.test(verifier.receiptId||'')||
     verifier.engineeringReceiptId!==engineering.receiptId)
    return denied('INDEPENDENT_VERIFIER_RECEIPT_REQUIRED');
  if(!plain(ownerWindows)||ownerWindows.state!=='PASS'||
     ownerWindows.sourceHead!==mainHead||
     ownerWindows.candidateHead!==head||
     ownerWindows.prNumber!==pr.number||
     !DIGEST.test(ownerWindows.proofDigest||'')||
     ownerWindows.independentEvidence!==true)
    return denied('OWNER_WINDOWS_PRODUCT_ACCEPTANCE_REQUIRED');
  if(!plain(workflow)||workflow.name!=='Architecture Verification'||
     workflow.status!=='completed'||workflow.conclusion!=='success'||
     workflow.head_sha!==head||!Number.isSafeInteger(workflow.id)||
     workflow.id<=0||!Array.isArray(jobs))
    return denied('EXACT_HEAD_ARCHITECTURE_RUN_REQUIRED');
  for(const name of requiredLayers){
    const match=jobs.filter(j=>j.name===name);
    if(match.length!==1||match[0].status!=='completed'||match[0].conclusion!=='success')
      return denied('REQUIRED_CI_LAYER_MISSING_OR_NOT_GREEN');
  }
  if(jobs.some(j=>j.conclusion==='failure'||j.conclusion==='cancelled'||
    j.conclusion==='timed_out'||j.status!=='completed'))
    return denied('ADDITIONAL_CI_JOB_NOT_GREEN');
  const approval=signedOwnerRelease;
  const payload=ownerReleasePayload(approval);
  if(!payload||!plain(approval)||Object.keys(approval).length!==releaseFields.length+1||
     approval.schemaVersion!==1||approval.kind!=='owner-exact-green-merge-release'||
     approval.consent!=='MERGE_EXACT_HEAD_GREEN_ONLY'||
     approval.prNumber!==pr.number||approval.baseHead!==mainHead||
     approval.candidateHead!==head||
     approval.verifierReceiptId!==verifier.receiptId||
     approval.ownerWindowsProofDigest!==ownerWindows.proofDigest||
     !ID.test(approval.nonce||'')||
     !Number.isSafeInteger(now)||
     !Number.isSafeInteger(approval.observedAt)||
     !Number.isSafeInteger(approval.expiresAt)||
     approval.expiresAt<=now||approval.expiresAt>now+3600000||
     approval.observedAt>now+60000||now-approval.observedAt>3600000||
     typeof approval.signature!=='string'||
     !/^[A-Za-z0-9+/]{80,100}={0,2}$/.test(approval.signature)||
     typeof pinnedPublicKey!=='string'||!pinnedPublicKey.includes('BEGIN PUBLIC KEY'))
    return denied('SIGNED_OWNER_EXACT_HEAD_RELEASE_REQUIRED');
  let valid=false;
  try{valid=verify(null,Buffer.from(payload,'utf8'),pinnedPublicKey,
    Buffer.from(approval.signature,'base64'))===true;}catch{return denied('RELEASE_SIGNATURE_UNVERIFIABLE');}
  if(!valid)return denied('OWNER_RELEASE_SIGNATURE_INVALID');
  // Even a valid read-only assessment is not a merge. The future publisher
  // must atomically claim the nonce and reread GitHub CI, STOP and exact HEAD.
  return Object.freeze({state:'ELIGIBLE_FOR_SEPARATE_MERGE_SUBMISSION',
    prNumber:pr.number,baseHead:mainHead,candidateHead:head,
    verifiedRunId:workflow.id,ownerReleaseNonce:approval.nonce,
    maySubmitMerge:true,automaticMergeEnabled:false,
    mergeExecuted:false,replayAuthorized:false});
}
