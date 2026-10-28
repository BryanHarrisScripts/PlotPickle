import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {enrollmentPayload,possessionPayload,verifyReviewerEnrollment} from '../scripts/engineering-team/verification/lane-a-reviewer-enrollment.mjs';
import {inspectLaneAAdmissionChain} from '../scripts/engineering-team/verification/lane-a-admission-chain.mjs';
import {laneAReviewerServiceProfile} from '../scripts/engineering-team/verification/lane-a-service-identity-policy.mjs';
import {canonicalPayload} from '../scripts/engineering-team/verification/lane-a-admission-receipt.mjs';

const registrar=generateKeyPairSync('ed25519'),reviewer=generateKeyPairSync('ed25519');
const pem=key=>key.export({format:'pem',type:'spki'});
const now=Date.parse('2026-10-27T23:30:00Z');
const options={
 trustedRegistrars:{'registrar-1':{principal:'IndependentRegistrar01',publicKeyPem:pem(registrar.publicKey)}},
 expectedRegistrarId:'registrar-1',expectedRegistrarPrincipal:'IndependentRegistrar01',
 expectedHostId:'owner-windows-machine',expectedReviewerSid:'S-1-5-21-111-222-333-1002',
 expectedReviewerPrincipal:'WindowsReviewer01',expectedCodingSid:'S-1-5-21-111-222-333-1001',
 expectedChallengeNonce:'challenge-20261027-0001',alreadyUsedChallenges:[],now
};
function signed(fields={}){
 const r={
  schemaVersion:'PP-LANE-A-ENROLL-V1',enrollmentId:'enroll-1',roleAlias:'PP-F00-LA-W0001',actorId:'PP-F00-D02-W0001',
  reviewerPrincipal:'WindowsReviewer01',reviewerSid:options.expectedReviewerSid,
  hostId:options.expectedHostId,keyId:'reviewer-key-1',publicKeyPem:pem(reviewer.publicKey),
  challengeNonce:options.expectedChallengeNonce,registrarId:'registrar-1',registrarPrincipal:'IndependentRegistrar01',
  processTokenEvidenceDigest:'a'.repeat(64),privateKeyAclEvidenceDigest:'b'.repeat(64),
  evidenceRefs:['independent-process-token-observation','key-acl-observation'],capabilities:['catalogue-admission-review-only'],
  issuedAtUtc:'2026-10-27T23:00:00Z',expiresAtUtc:'2026-10-28T00:00:00Z',...fields
 };
 r.possessionSignatureBase64=sign(null,possessionPayload(r),reviewer.privateKey).toString('base64');
 r.registrarSignatureBase64=sign(null,enrollmentPayload(r),registrar.privateKey).toString('base64');
 return r;
}
test('valid fixture signatures prove only an inert candidate, not an operating reviewer',()=>{
 const result=verifyReviewerEnrollment(signed(),options);
 assert.equal(result.verified,true);
 assert.equal(result.code,'SIGNED_ENROLLMENT_CANDIDATE');
 assert.equal(result.actorId,'PP-F00-D02-W0001');
 assert.equal(result.productionActivated,false);
 assert.equal(result.mayAdmit,false);
 assert.equal(result.mayCode,false);
 assert.equal(result.mayMerge,false);
 assert.equal(result.requiresExternalWindowsAclAndPrincipalObservation,true);
 assert.equal(result.candidateRegistryEntry.principal,'WindowsReviewer01');
});
test('wrong or revoked registrar identity is refused',()=>{
 assert.equal(verifyReviewerEnrollment(signed(),{...options,expectedRegistrarId:'other'}).code,'REGISTRAR_NOT_AUTHORIZED');
 assert.equal(verifyReviewerEnrollment(signed(),{...options,trustedRegistrars:{}}).code,'REGISTRAR_NOT_TRUSTED');
 assert.equal(verifyReviewerEnrollment(signed(),{...options,trustedRegistrars:{'registrar-1':{...options.trustedRegistrars['registrar-1'],revoked:true}}}).code,'REGISTRAR_NOT_TRUSTED');
});
test('altering reviewer identity, scope or key material after registrar signature is rejected',()=>{
 const original=signed();
 assert.equal(verifyReviewerEnrollment({...original,reviewerPrincipal:'AnotherReviewer'},options).code,'REVIEWER_PRINCIPAL_MISMATCH');
 assert.equal(verifyReviewerEnrollment({...original,capabilities:['catalogue-admission-review-only','repo-write']},options).code,'SCOPE_INVALID');
 assert.equal(verifyReviewerEnrollment({...original,publicKeyPem:pem(generateKeyPairSync('ed25519').publicKey)},options).code,'REGISTRAR_SIGNATURE_INVALID');
});
test('wrong Windows SID, host or role alias fails closed',()=>{
 assert.equal(verifyReviewerEnrollment(signed({reviewerSid:'S-1-5-21-111-222-333-9999'}),options).code,'WINDOWS_IDENTITY_MISMATCH');
 assert.equal(verifyReviewerEnrollment(signed({hostId:'other-host'}),options).code,'HOST_MISMATCH');
 assert.equal(verifyReviewerEnrollment(signed({actorId:'PP-F01-D03-W0001'}),options).code,'ROLE_MISMATCH');
});
test('registrar and reviewer identity cannot collapse to one principal',()=>{
 assert.equal(verifyReviewerEnrollment(signed({reviewerPrincipal:'IndependentRegistrar01'}),options).code,'REGISTRAR_NOT_SEPARATE');
});
test('replayed, unapproved or expired challenge cannot enroll',()=>{
 assert.equal(verifyReviewerEnrollment(signed(),{...options,alreadyUsedChallenges:[options.expectedChallengeNonce]}).code,'CHALLENGE_REPLAY');
 assert.equal(verifyReviewerEnrollment(signed(),{...options,expectedChallengeNonce:'different'}).code,'CHALLENGE_MISMATCH');
 assert.equal(verifyReviewerEnrollment(signed(),{...options,now:Date.parse('2026-10-28T01:00:00Z')}).code,'ENROLLMENT_TIME_INVALID');
});
test('malformed or missing evidence and signature are rejected',()=>{
 assert.equal(verifyReviewerEnrollment(signed({privateKeyAclEvidenceDigest:'not-proof'}),options).code,'ATTESTATION_EVIDENCE_MISSING');
 const missing=signed();delete missing.registrarSignatureBase64;
 assert.equal(verifyReviewerEnrollment(missing,options).code,'SIGNATURE_FORMAT_INVALID');
 const forged=signed();forged.registrarSignatureBase64=sign(null,enrollmentPayload(forged),reviewer.privateKey).toString('base64');
 assert.equal(verifyReviewerEnrollment(forged,options).code,'REGISTRAR_SIGNATURE_INVALID');
});
test('missing reviewer proof-of-possession cannot impersonate a reviewer',()=>{
 const forged=signed();forged.possessionSignatureBase64=sign(null,possessionPayload(forged),registrar.privateKey).toString('base64');
 forged.registrarSignatureBase64=sign(null,enrollmentPayload(forged),registrar.privateKey).toString('base64');
 assert.equal(verifyReviewerEnrollment(forged,options).code,'REVIEWER_POSSESSION_INVALID');
});

test('reviewer must be distinct from the coding Windows SID with trusted identity expectations',()=>{
 assert.equal(verifyReviewerEnrollment(signed(),{...options,expectedCodingSid:options.expectedReviewerSid}).code,'SAME_WINDOWS_PRINCIPAL_AS_CODER');
 assert.equal(verifyReviewerEnrollment(signed(),{...options,expectedCodingSid:undefined}).code,'CODING_IDENTITY_UNATTESTED');
 assert.equal(verifyReviewerEnrollment(signed(),{...options,expectedReviewerPrincipal:'Coder'}).code,'REVIEWER_PRINCIPAL_MISMATCH');
 assert.equal(verifyReviewerEnrollment(signed(),{...options,alreadyUsedChallenges:undefined}).code,'CHALLENGE_LEDGER_UNAVAILABLE');
});

test('signed enrollment plus signed admission verdict is a verifiable but non-operational chain',()=>{
 const receipt={
  schemaVersion:'PP-TEST-ADMISSION-V1',reviewId:'review-run-1',
  reviewerPrincipal:'WindowsReviewer01',authorPrincipal:'CoderWindows01',
  credentialKeyId:'reviewer-key-1',candidateHead:'a'.repeat(40),
  testDigests:{'tests/review.test.mjs':'b'.repeat(64)},
  inputDigests:{'scripts/review.mjs':'c'.repeat(64)},
  truthRefs:['WHITE-PAPER-V3/W8'],findings:['Exact negative assertion inspected'],
  disposition:'ADMIT',evidence:['review-evidence-sha256:abc'],
  timestampUtc:'2026-10-27T23:20:00Z'
 };
 receipt.signatureBase64=sign(null,canonicalPayload(receipt),reviewer.privateKey).toString('base64');
 const arg={
  enrollment:signed(),receipt,registrationAuthority:options,
  receiptExpectations:{
   expectedAuthorPrincipal:'CoderWindows01',expectedHead:receipt.candidateHead,
   expectedTestDigests:receipt.testDigests,expectedInputDigests:receipt.inputDigests,
   allowedTruthRefs:['WHITE-PAPER-V3/W8']
  }
 };
 const outcome=inspectLaneAAdmissionChain(arg);
 assert.equal(outcome.status,'CRYPTOGRAPHIC_DRY_RUN');
 assert.equal(outcome.simulated,true);
 assert.equal(outcome.mayAdmit,false);
 assert.equal(outcome.mayEditCatalogue,false);
 assert.equal(outcome.mayStartLaneB,false);
 assert.equal(outcome.mayCode,false);
 assert.equal(outcome.mayMerge,false);
 const swapped={...receipt,credentialKeyId:'imposter-key-1'};
 assert.equal(inspectLaneAAdmissionChain({...arg,receipt:swapped}).code,'RECEIPT_KEY_IDENTITY_MISMATCH');
 const untrusted=inspectLaneAAdmissionChain({...arg,registrationAuthority:{...options,trustedRegistrars:{}}});
 assert.equal(untrusted.code,'REVIEWER_IDENTITY_REGISTRAR_NOT_TRUSTED');
});

test('installer-managed Windows service binds canonical reviewer actor, not a privileged Windows account string',()=>{
 const candidate=signed({reviewerPrincipal:laneAReviewerServiceProfile.actorId});
 const result=verifyReviewerEnrollment(candidate,{
  ...options,expectedReviewerPrincipal:laneAReviewerServiceProfile.actorId
 });
 assert.equal(result.verified,true);
 assert.equal(result.reviewerPrincipal,'PP-F00-D02-W0001');
 assert.equal(result.mayAdmit,false);
 assert.equal(result.productionActivated,false);
 assert.equal(laneAReviewerServiceProfile.serviceAccount,'NT SERVICE\\PlotPickleLaneA');
});
