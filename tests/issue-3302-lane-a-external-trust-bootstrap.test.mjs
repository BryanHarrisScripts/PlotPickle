import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {enrollmentPayload,possessionPayload} from '../scripts/engineering-team/verification/lane-a-reviewer-enrollment.mjs';
import {fingerprintEd25519PublicKey,inspectLaneAExternalTrustCandidate}
 from '../scripts/engineering-team/verification/lane-a-external-trust-bootstrap.mjs';

const registrar=generateKeyPairSync('ed25519'),reviewer=generateKeyPairSync('ed25519');
const keyPem=key=>key.export({format:'pem',type:'spki'});
const registrarPem=keyPem(registrar.publicKey);
const reviewerPem=keyPem(reviewer.publicKey);
const nonce='challenge-20261028-separate-0001';
const reviewerSid='S-1-5-21-111-222-333-1002',coderSid='S-1-5-21-111-222-333-1001';
const processDigest='a'.repeat(64),aclDigest='b'.repeat(64);
const now=Date.parse('2026-10-28T12:00:00Z');

function signedEnrollment(patch={}){
 const item={
  schemaVersion:'PP-LANE-A-ENROLL-V1',
  enrollmentId:'enroll-test-0001',roleAlias:'PP-F00-LA-W0001',
  actorId:'PP-F00-D02-W0001',
  reviewerPrincipal:'RestrictedReviewerA',reviewerSid,
  hostId:'owner-windows-01',keyId:'ed25519-reviewer-01',
  publicKeyPem:reviewerPem,challengeNonce:nonce,
  registrarId:'registrar-01',registrarPrincipal:'ExternalRegistrar01',
  processTokenEvidenceDigest:processDigest,
  privateKeyAclEvidenceDigest:aclDigest,
  evidenceRefs:['separately-witnessed-token','separately-witnessed-acl'],
  capabilities:['catalogue-admission-review-only'],
  issuedAtUtc:'2026-10-28T11:00:00Z',
  expiresAtUtc:'2026-10-28T13:00:00Z',...patch
 };
 item.possessionSignatureBase64=sign(null,possessionPayload(item),reviewer.privateKey).toString('base64');
 item.registrarSignatureBase64=sign(null,enrollmentPayload(item),registrar.privateKey).toString('base64');
 return item;
}
function argumentsFor(enrollment=signedEnrollment()){
 return {
  enrollment,
  externalRegistrar:{
   id:'registrar-01',principal:'ExternalRegistrar01',publicKeyPem:registrarPem,revoked:false
  },
  externallyPinnedRegistrarFingerprint:fingerprintEd25519PublicKey(registrarPem),
  expectedHostId:'owner-windows-01',
  expectedReviewerSid:reviewerSid,expectedCodingSid:coderSid,
  expectedReviewerPrincipal:'RestrictedReviewerA',
  expectedProcessEvidenceDigest:processDigest,
  expectedKeyAclEvidenceDigest:aclDigest,
  expectedChallengeNonce:nonce,
  protectedNonceLedgerSnapshot:{
   schemaVersion:'PP-LANE-A-NONCE-LEDGER-V1',source:'independent-registrar-protected',
   challengeNonce:nonce,status:'ISSUED_UNUSED',issuerId:'registrar-01',
   snapshotDigest:'c'.repeat(64),usedChallenges:[]
  },
  stopMarkerState:'ABSENT',observedAtMs:now
 };
}
const check=patch=>inspectLaneAExternalTrustCandidate({...argumentsFor(),...patch});

test('valid synthetic registrar signature is a candidate, never operational enrollment',()=>{
 const r=check();
 assert.equal(r.cryptographicCandidate,true);
 assert.equal(r.status,'CRYPTOGRAPHIC_CANDIDATE_ONLY');
 assert.equal(r.independentAttestation,false);
 for(const key of ['mayEnroll','mayAdmit','mayEditCatalogue','mayCode','mayMerge','productionActivated'])
  assert.equal(r[key],false,key);
 assert.equal(r.requiresRegistrarNonceConsumptionReceipt,true);
 assert.equal(r.requiresIndependentW8W9Admission,true);
});

test('external registrar fingerprint must match separately pinned exact Ed25519 public key',()=>{
 assert.equal(check({externallyPinnedRegistrarFingerprint:'d'.repeat(64)}).code,'EXTERNAL_REGISTRAR_PIN_MISMATCH');
 assert.equal(check({externallyPinnedRegistrarFingerprint:undefined}).code,'EXTERNAL_REGISTRAR_TRUST_PIN_MISSING');
 assert.equal(check({externalRegistrar:{...argumentsFor().externalRegistrar,revoked:true}}).code,'EXTERNAL_REGISTRAR_TRUST_PIN_MISSING');
 assert.equal(check({externalRegistrar:null}).code,'EXTERNAL_REGISTRAR_TRUST_PIN_MISSING');
});

test('registrar and reviewer must have different signing keys',()=>{
 const alternative=signedEnrollment({publicKeyPem:registrarPem});
 assert.equal(inspectLaneAExternalTrustCandidate(argumentsFor(alternative)).code,
  'REVIEWER_REGISTRAR_SIGNING_KEY_COLLAPSE');
});
test('coding and reviewer Windows SIDs cannot be equal or unpinned',()=>{
 assert.equal(check({expectedCodingSid:reviewerSid}).code,'EXTERNAL_WINDOWS_IDENTITY_EXPECTATIONS_MISSING');
 assert.equal(check({expectedReviewerSid:null}).code,'EXTERNAL_WINDOWS_IDENTITY_EXPECTATIONS_MISSING');
});
test('token and key ACL witness digests must be separately pinned',()=>{
 assert.equal(check({expectedProcessEvidenceDigest:'c'.repeat(64)}).code,'EXTERNAL_WINDOWS_WITNESS_MISMATCH');
 assert.equal(check({expectedKeyAclEvidenceDigest:undefined}).code,'EXTERNAL_WITNESS_DIGESTS_MISSING');
 assert.equal(check({expectedKeyAclEvidenceDigest:processDigest}).code,'EXTERNAL_WITNESS_DIGESTS_MISSING');
});
test('no protected challenge ledger or re-used nonce yields no enrollment candidate',()=>{
 assert.equal(check({protectedNonceLedgerSnapshot:undefined}).code,'PROTECTED_CHALLENGE_LEDGER_UNPROVEN');
 assert.equal(check({protectedNonceLedgerSnapshot:{
  ...argumentsFor().protectedNonceLedgerSnapshot,status:'CONSUMED'
 }}).code,'PROTECTED_CHALLENGE_LEDGER_UNPROVEN');
 assert.equal(check({protectedNonceLedgerSnapshot:{
  ...argumentsFor().protectedNonceLedgerSnapshot,usedChallenges:[nonce]
 }}).code,'PROTECTED_CHALLENGE_LEDGER_UNPROVEN');
});
test('owner STOP or unknown STOP prevents even a cryptographic candidate',()=>{
 assert.equal(check({stopMarkerState:'PRESENT'}).code,'INTENTIONAL_STOP');
 assert.equal(check({stopMarkerState:'UNKNOWN'}).code,'STOP_UNVERIFIABLE');
});
test('signed enrollments that alter host, reviewer or registrar are rejected',()=>{
 const wrongHost=signedEnrollment({hostId:'other-host'});
 assert.equal(inspectLaneAExternalTrustCandidate(argumentsFor(wrongHost)).code,'ENROLLMENT_HOST_MISMATCH');
 const forged=signedEnrollment();
 forged.capabilities=['repo-write'];
 assert.equal(inspectLaneAExternalTrustCandidate(argumentsFor(forged)).code,'ENROLLMENT_SCOPE_INVALID');
 const wrongKey=signedEnrollment();
 wrongKey.possessionSignatureBase64=sign(null,possessionPayload(wrongKey),registrar.privateKey).toString('base64');
 wrongKey.registrarSignatureBase64=sign(null,enrollmentPayload(wrongKey),registrar.privateKey).toString('base64');
 assert.equal(inspectLaneAExternalTrustCandidate(argumentsFor(wrongKey)).code,'ENROLLMENT_REVIEWER_POSSESSION_INVALID');
});
test('a spoofed enrollment signed by a different registrar cannot pass an external pin',()=>{
 const impostor=generateKeyPairSync('ed25519');
 const r=argumentsFor();
 r.externalRegistrar.publicKeyPem=keyPem(impostor.publicKey);
 assert.equal(inspectLaneAExternalTrustCandidate(r).code,'EXTERNAL_REGISTRAR_PIN_MISMATCH');
});
test('missing trusted observation clock cannot enroll',()=>{
 assert.equal(check({observedAtMs:undefined}).code,'EXTERNAL_EXPECTATIONS_MISSING');
 assert.equal(check({observedAtMs:NaN}).code,'EXTERNAL_EXPECTATIONS_MISSING');
});
