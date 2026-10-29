/**
 * #3302: Pure F00 Lane A external trust-bootstrap CANDIDATE verifier.
 * No key generation, signing, OS inspection, nonce consumption, deployment
 * or ability to change the protected test catalogue.
 *
 * CRITICAL: The caller MUST obtain registrar public-key fingerprint, Windows
 * token+ACL witness digests, and durable nonce ledger from authorities outside
 * the coding PR/reviewer process. Strings supplied by a coder are NOT witnesses.
 * Even a valid Ed25519 chain here is INERT, never production admission.
 */
import {createHash,createPublicKey} from 'node:crypto';
import {verifyReviewerEnrollment} from './lane-a-reviewer-enrollment.mjs';

const HASH=/^[a-f0-9]{64}$/;
const SID=/^S-1-(?:[0-9]+-){2,}[0-9]+$/;
const deny=code=>Object.freeze({
 status:'BLOCKED',code,cryptographicCandidate:false,independentAttestation:false,
 productionActivated:false,mayEnroll:false,mayAdmit:false,
 mayEditCatalogue:false,mayCode:false,mayMerge:false
});

export const fingerprintEd25519PublicKey=pem=>{
 const key=createPublicKey(pem);
 if(key.asymmetricKeyType!=='ed25519')throw Error('ED25519_PUBLIC_KEY_REQUIRED');
 return createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');
};

export function inspectLaneAExternalTrustCandidate({
 enrollment,externalRegistrar,externallyPinnedRegistrarFingerprint,
 expectedHostId,expectedReviewerSid,expectedCodingSid,
 expectedReviewerPrincipal,expectedProcessEvidenceDigest,
 expectedKeyAclEvidenceDigest,expectedChallengeNonce,
 protectedNonceLedgerSnapshot,stopMarkerState,observedAtMs
}={}){
 if(stopMarkerState!=='ABSENT')return deny(stopMarkerState==='PRESENT'?
  'INTENTIONAL_STOP':'STOP_UNVERIFIABLE');
 if(!externalRegistrar||typeof externalRegistrar!=='object'||
  typeof externalRegistrar.id!=='string'||typeof externalRegistrar.principal!=='string'||
  typeof externalRegistrar.publicKeyPem!=='string'||externalRegistrar.revoked!==false||
  !HASH.test(externallyPinnedRegistrarFingerprint||''))return deny('EXTERNAL_REGISTRAR_TRUST_PIN_MISSING');
 let trustedFingerprint,reviewerFingerprint;
 try{
  trustedFingerprint=fingerprintEd25519PublicKey(externalRegistrar.publicKeyPem);
  reviewerFingerprint=fingerprintEd25519PublicKey(enrollment?.publicKeyPem);
 }catch{return deny('ED25519_PUBLIC_KEY_INVALID');}
 if(trustedFingerprint!==externallyPinnedRegistrarFingerprint)return deny('EXTERNAL_REGISTRAR_PIN_MISMATCH');
 if(reviewerFingerprint===trustedFingerprint)return deny('REVIEWER_REGISTRAR_SIGNING_KEY_COLLAPSE');
 if(!SID.test(expectedReviewerSid||'')||!SID.test(expectedCodingSid||'')||
  expectedReviewerSid===expectedCodingSid)return deny('EXTERNAL_WINDOWS_IDENTITY_EXPECTATIONS_MISSING');
 if(!HASH.test(expectedProcessEvidenceDigest||'')||
  !HASH.test(expectedKeyAclEvidenceDigest||'')||
  expectedProcessEvidenceDigest===expectedKeyAclEvidenceDigest)return deny('EXTERNAL_WITNESS_DIGESTS_MISSING');
 if(!enrollment||
  enrollment.processTokenEvidenceDigest!==expectedProcessEvidenceDigest||
  enrollment.privateKeyAclEvidenceDigest!==expectedKeyAclEvidenceDigest)return deny('EXTERNAL_WINDOWS_WITNESS_MISMATCH');
 // One read-only snapshot cannot PROVE durable consumption, even if it says
 // the challenge is unused. An independent registrar MUST atomically consume
 // the nonce, enforce replay resistance and sign an acknowledgement.
 const ledger=protectedNonceLedgerSnapshot;
 if(!ledger||ledger.schemaVersion!=='PP-LANE-A-NONCE-LEDGER-V1'||
  ledger.source!=='independent-registrar-protected'||
  ledger.challengeNonce!==expectedChallengeNonce||
  ledger.status!=='ISSUED_UNUSED'||ledger.issuerId!==externalRegistrar.id||
  !HASH.test(ledger.snapshotDigest||'')||
  !Array.isArray(ledger.usedChallenges)||ledger.usedChallenges.some(v=>typeof v!=='string')||
  ledger.usedChallenges.includes(expectedChallengeNonce))return deny('PROTECTED_CHALLENGE_LEDGER_UNPROVEN');
 if(typeof expectedHostId!=='string'||!expectedHostId||
  typeof expectedReviewerPrincipal!=='string'||!expectedReviewerPrincipal||
  !Number.isSafeInteger(observedAtMs))return deny('EXTERNAL_EXPECTATIONS_MISSING');
 const result=verifyReviewerEnrollment(enrollment,{
  trustedRegistrars:{
   [externalRegistrar.id]:{
    principal:externalRegistrar.principal,
    publicKeyPem:externalRegistrar.publicKeyPem,
    revoked:false
   }
  },
  expectedRegistrarId:externalRegistrar.id,
  expectedRegistrarPrincipal:externalRegistrar.principal,
  expectedHostId,expectedReviewerSid,expectedReviewerPrincipal,
  expectedCodingSid,expectedChallengeNonce,
  alreadyUsedChallenges:ledger.usedChallenges,now:observedAtMs
 });
 if(!result.verified)return deny('ENROLLMENT_'+result.code);
 return Object.freeze({
  status:'CRYPTOGRAPHIC_CANDIDATE_ONLY',
  code:'EXTERNAL_PIN_AND_SIGNED_ENROLLMENT_MATCH',
  cryptographicCandidate:true,
  reviewerKeyFingerprint:result.keyFingerprint,
  registrarKeyFingerprint:trustedFingerprint,
  actorId:result.actorId,
  independentAttestation:false,
  requiresOutOfProcessWindowsWitness:true,
  requiresRegistrarNonceConsumptionReceipt:true,
  requiresReviewerQualification:true,
  requiresIndependentW8W9Admission:true,
  requiresSeparateCatalogueMaintainer:true,
  productionActivated:false,
  mayEnroll:false,mayAdmit:false,mayEditCatalogue:false,
  mayCode:false,mayMerge:false
 });
}
