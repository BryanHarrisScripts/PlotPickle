/**
 * AEGIS — Autonomous Evidence Governance & Isolated Signing.
 * F00 cross-factory mathematical truth preflight only: no model, network,\n * filesystem, signer, source-write or merge privileges.
 * Reviewer-specific OS service + externally pinned policy + signed registrar
 * are separate prerequisites. A proposal is NEVER a signed authorization.
 */
import {createHash,createPublicKey,verify} from 'node:crypto';

const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const FACTORIES=Object.freeze(['PP-F01','PP-F02','PP-F03','PP-F04']);
export const reviewFactoring=Object.freeze({
  'PP-F01':'software', 'PP-F02':'learning', 'PP-F03':'story', 'PP-F04':'game'
});
const required=['WHITE-PAPER-V3/W8','WHITE-PAPER-V3/W9'];
const deny=(code)=>Object.freeze({schemaVersion:'PP-F00-CROSS-FACTORY-V1',
  status:'BLOCKED',disposition:'UNPROVEN',code,
  independentAuthority:false,maySign:false,mayAdmit:false,
  mayAdvance:false,mayEditCanon:false,mayMerge:false});
const known=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const equalSet=(a,b)=>Array.isArray(a)&&a.length===b.length&&
  new Set(a).size===a.length&&a.every(x=>b.includes(x));
const canonical=x=>JSON.stringify(x);
const sha256=x=>createHash('sha256').update(x).digest('hex');
const validEvidence=(records)=>Array.isArray(records)&&records.length>=1&&records.length<=48&&
  records.every(x=>known(x)&&/^[A-Za-z0-9][A-Za-z0-9_-]{2,79}$/.test(x.id||'')&&
    DIGEST.test(x.sha256||'')&&
    typeof x.kind==='string'&&x.kind.length>0&&x.kind.length<80)&&
  new Set(records.map(x=>x.id)).size===records.length;
const finiteInt=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const exactProof=(list,id,kind)=>list.some(e=>e.id===id&&e.kind===kind);
function mathFinding(factory,math,evidence){
  if(!known(math))return 'MATHEMATICS_OBSERVATIONS_MISSING';
  switch(factory){
    case 'PP-F01':{
      if(math.sourceEditScoped!==true||math.exactGitHeadVerified!==true||
         math.architectureLayersPassed!==7||math.windowsAcceptanceIndependent!==true)
        return 'SOFTWARE_SOURCE_CI_OR_WINDOWS_EVIDENCE_UNPROVEN';
      if(!exactProof(evidence,'github-ci','architecture')||
         !exactProof(evidence,'owner-windows','owner-windows'))
        return 'SOFTWARE_PROOF_DIGESTS_MISSING';
      return null;
    }
    case 'PP-F02':{
      if(!finiteInt(math.independentReproductions,2,20)||
         !DIGEST.test(math.firstResultDigest||'')||
         math.firstResultDigest!==math.secondResultDigest||
         math.skillsChangeOwnerApproved!==true)
        return 'LEARNING_REPRODUCIBILITY_OR_SKILL_AUTHORITY_UNPROVEN';
      if(!exactProof(evidence,'replication-a','reproduction')||
         !exactProof(evidence,'replication-b','reproduction'))
        return 'LEARNING_REPLICATION_EVIDENCE_MISSING';
      return null;
    }
    case 'PP-F03':{
      if(math.scope!=='full-feature'&&math.scope!=='mini-block')return 'STORY_SCOPE_UNKNOWN';
      if(math.scope==='full-feature'&&(
        math.acts!==4||math.sequences!==12||math.blocks!==24||
        math.miniBlocks!==96||math.shotsPerMiniBlock!==25||
        math.secondsPerShot!==3||
        math.renderSlots!==math.miniBlocks*math.shotsPerMiniBlock||
        math.runtimeSeconds!==math.renderSlots*math.secondsPerShot))
        return 'STORY_FEATURE_MATHEMATICAL_CONTRACT_MISMATCH';
      if(math.scope==='mini-block'&&(
        math.shotsPerMiniBlock!==25||math.secondsPerShot!==3||
        math.renderSlots!==25||math.runtimeSeconds!==75))
        return 'STORY_MINI_BLOCK_MATHEMATICAL_CONTRACT_MISMATCH';
      // A candidate can be assessed, but cannot lock/rewrite canon for a Human.
      if(math.canonMutationRequested===true||math.humanCanonOverride===true)
        return 'STORY_HUMAN_CANON_AUTHORITY_RESERVED';
      if(!exactProof(evidence,'canon','locked-human-canon')||
         !exactProof(evidence,'storyboard','shot-provenance'))
        return 'STORY_CANON_AND_SHOT_PROVENANCE_MISSING';
      return null;
    }
    case 'PP-F04':{
      if(!DIGEST.test(math.replayHashA||'')||
         math.replayHashA!==math.replayHashB||
         !finiteInt(math.seed,0,2147483647)||
         math.rulesChangedWithoutOwner===true)
        return 'GAME_DETERMINISM_OR_OWNER_RULE_AUTHORITY_UNPROVEN';
      if(!exactProof(evidence,'replay-a','deterministic-replay')||
         !exactProof(evidence,'replay-b','deterministic-replay'))
        return 'GAME_REPLAY_EVIDENCE_MISSING';
      return null;
    }
    default:return 'UNKNOWN_FACTORY';
  }
}

/**
 * Exact immutable reference inputs must be collected from separately verified
 * source/truth stores. Hash matches cannot prove semantic truth or provenance.
 */
export function inspectCrossFactoryTruth({
  job,proofs,truthPolicy,stopMarkerState,
}={}){
  if(stopMarkerState!=='ABSENT')
    return deny(stopMarkerState==='PRESENT'?'HUMAN_STOP':'STOP_PAUSE_UNVERIFIABLE');
  if(!known(job)||!FACTORIES.includes(job.factory)||
     job.schemaVersion!==1||!SHA.test(job.candidateHead||'')||
     !DIGEST.test(job.artifactDigest||'')||
     !DIGEST.test(job.truthDigest||'')||
     typeof job.authorPrincipal!=='string'||job.authorPrincipal.length<3||
     !equalSet(job.truthRefs,required))
    return deny('WORK_ORDER_OR_TRUTH_SCOPE_INVALID');
  if(!known(truthPolicy)||
     truthPolicy.origin!=='external-protected-authority'||
     truthPolicy.factory!==job.factory||
     truthPolicy.candidateHead!==job.candidateHead||
     truthPolicy.normativeDigest!==job.truthDigest||
     !DIGEST.test(truthPolicy.normativeDigest||'')||
     !equalSet(truthPolicy.truthRefs,required))
    return deny('EXTERNALLY_PINNED_TRUTH_MISMATCH');
  if(!known(proofs)||!validEvidence(proofs.evidence)||
     proofs.sourceHead!==job.candidateHead||
     proofs.artifactDigest!==job.artifactDigest)
    return deny('SOURCE_PROOF_EDITION_UNVERIFIABLE');
  const finding=mathFinding(job.factory,proofs.mathematics,proofs.evidence);
  const summary={schemaVersion:1,factory:job.factory,
    candidateHead:job.candidateHead,artifactDigest:job.artifactDigest,
    truthDigest:job.truthDigest,truthRefs:required,
    evidence:proofs.evidence.map(x=>({id:x.id,kind:x.kind,sha256:x.sha256}))
      .sort((a,b)=>a.id.localeCompare(b.id)),
    mathematics:proofs.mathematics};
  const proofDigest=sha256(canonical(summary));
  return Object.freeze({schemaVersion:'PP-F00-CROSS-FACTORY-V1',
    status:'REVIEW_PROPOSAL_ONLY',factory:job.factory,proofDigest,
    candidateHead:job.candidateHead,artifactDigest:job.artifactDigest,
    disposition:finding?'FIX':'UNPROVEN',
    code:finding||'MATHEMATICS_CONSISTENT_SEMANTIC_REVIEW_AND_ATTESTATION_REQUIRED',
    independentAuthority:false,needsIndependentSemanticReview:true,
    needsQualifiedReviewerSignature:true,needsRegistrarNonce:true,
    maySign:false,mayAdmit:false,mayAdvance:false,mayEditCanon:false,mayMerge:false});
}
const SIGN_FIELDS=['schemaVersion','kind','factory','candidateHead',
  'artifactDigest','truthDigest','proofDigest','decision','reviewerId',
  'reviewerKeyFingerprint','nonce','issuedAt','expiresAt'];
export function crossFactoryReceiptPayload(receipt){
  if(!known(receipt)||!SIGN_FIELDS.every(k=>Object.hasOwn(receipt,k)))return null;
  return canonical(Object.fromEntries(SIGN_FIELDS.map(k=>[k,receipt[k]])));
}
/** Cryptographic authenticity ONLY. Does not prove signer enrollment, nonce
 * consumption, semantic adequacy, protected ACLs, owner consent or authorize.
 */
export function checkCrossFactoryReceiptSignature({
  receipt,publicKeyPem,expected,now=Date.now(),
}={}){
  const denied=code=>Object.freeze({status:'BLOCKED',code,mayAuthorize:false});
  if(!known(expected)||!known(receipt)||!crossFactoryReceiptPayload(receipt)||
     Object.keys(receipt).length!==SIGN_FIELDS.length+1||
     receipt.schemaVersion!==1||receipt.kind!=='independent-factory-review'||
     !FACTORIES.includes(receipt.factory)||receipt.factory!==expected.factory||
     receipt.candidateHead!==expected.candidateHead||
     receipt.artifactDigest!==expected.artifactDigest||
     receipt.truthDigest!==expected.truthDigest||
     receipt.proofDigest!==expected.proofDigest||
     !SHA.test(receipt.candidateHead||'')||
     ![receipt.artifactDigest,receipt.truthDigest,receipt.proofDigest,
       receipt.reviewerKeyFingerprint].every(x=>DIGEST.test(x||''))||
     !['ADMIT','FIX','REJECT','UNPROVEN'].includes(receipt.decision)||
     !/^[A-Za-z0-9_-]{8,96}$/.test(receipt.reviewerId||'')||
     !/^[a-f0-9]{32}$/.test(receipt.nonce||'')||
     !Number.isSafeInteger(now)||!Number.isSafeInteger(receipt.issuedAt)||
     !Number.isSafeInteger(receipt.expiresAt)||
     receipt.issuedAt>now+60000||receipt.expiresAt<=now||
     receipt.expiresAt>receipt.issuedAt+3600000||
     typeof receipt.signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(receipt.signature)||
     typeof publicKeyPem!=='string')
    return denied('SIGNED_RECEIPT_IDENTITY_OR_SCOPE_MISMATCH');
  try{
    const key=createPublicKey(publicKeyPem);
    if(key.asymmetricKeyType!=='ed25519')return denied('ED25519_REQUIRED');
    const fingerprint=sha256(key.export({type:'spki',format:'der'}));
    if(fingerprint!==receipt.reviewerKeyFingerprint||
       fingerprint!==expected.independentlyPinnedReviewerFingerprint)
      return denied('EXTERNAL_REVIEWER_TRUST_ROOT_MISMATCH');
    if(!verify(null,Buffer.from(crossFactoryReceiptPayload(receipt),'utf8'),
       key,Buffer.from(receipt.signature,'base64')))
      return denied('REVIEW_SIGNATURE_INVALID');
  }catch{return denied('REVIEW_SIGNATURE_UNVERIFIABLE');}
  return Object.freeze({status:'CRYPTOGRAPHIC_SIGNATURE_VALID_ONLY',
    code:'REGISTRAR_QUALIFICATION_AND_NONCE_STILL_REQUIRED',
    factory:receipt.factory,candidateHead:receipt.candidateHead,
    decision:receipt.decision,proofDigest:receipt.proofDigest,
    mayAuthorize:false,mayMerge:false,mayAdvance:false});
}
