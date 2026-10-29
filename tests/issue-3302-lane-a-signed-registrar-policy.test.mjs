import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {registrarPolicyPayload,inspectSignedRegistrarPolicy}
 from '../scripts/engineering-team/verification/lane-a-signed-registrar-policy.mjs';

const root=generateKeyPairSync('ed25519'),registrar=generateKeyPairSync('ed25519');
const pem=x=>x.export({type:'spki',format:'pem'});
const fp=x=>createHash('sha256').update(x.export({type:'spki',format:'der'})).digest('hex');
const now=Date.parse('2026-10-28T12:00:00Z');
function policy(delta={}){
 const p={
  schemaVersion:'PP-LANE-A-REGISTRAR-POLICY-V1',policyId:'root-policy-v1',
  publisherPrincipal:'IndependentRootPublisher',
  registrarPrincipal:'IndependentRegistrar',
  registrarKeyId:'reviewer-registrar-01',
  registrarPublicKeyPem:pem(registrar.publicKey),candidateHead:'a'.repeat(40),
  allowedCapabilities:['reviewer-enrollment-only'],
  issuedAtUtc:'2026-10-28T11:00:00Z',
  expiresAtUtc:'2026-10-29T11:00:00Z',...delta
 };
 p.signatureBase64=sign(null,registrarPolicyPayload(p),root.privateKey).toString('base64');
 return p;
}
const externalRoot={
 origin:'owner-or-vendor-protected',revoked:false,
 publicKeyPem:pem(root.publicKey),pinnedPublicKeyFingerprint:fp(root.publicKey)
};
const check=(delta={})=>inspectSignedRegistrarPolicy({
 signedPolicy:policy(),externalRoot,stopMarkerState:'ABSENT',nowMs:now,...delta
});

test('valid synthetic root-signed registrar delegation is only a candidate',()=>{
 const r=check();
 assert.equal(r.status,'SIGNED_POLICY_CANDIDATE_ONLY');
 assert.equal(r.signedPolicyValid,true);
 assert.equal(r.independentlyAnchored,false);
 for(const k of ['mayEnroll','mayAdmit','mayEditCatalogue','mayMerge','productionActivated'])
  assert.equal(r[k],false,k);
 assert.equal(r.registrarKeyFingerprint,fp(registrar.publicKey));
});

test('no root, revoked root or non-owner policy source cannot be trusted',()=>{
 assert.equal(check({externalRoot:undefined}).code,'PROTECTED_ROOT_NOT_OBSERVED');
 assert.equal(check({externalRoot:{...externalRoot,origin:'candidate-pr'}}).code,'PROTECTED_ROOT_NOT_OBSERVED');
 assert.equal(check({externalRoot:{...externalRoot,revoked:true}}).code,'PROTECTED_ROOT_NOT_OBSERVED');
});

test('pinned root substitution and malformed keys fail closed',()=>{
 assert.equal(check({externalRoot:{...externalRoot,pinnedPublicKeyFingerprint:'0'.repeat(64)}}).code,'PROTECTED_ROOT_FINGERPRINT_MISMATCH');
 assert.equal(check({externalRoot:{...externalRoot,publicKeyPem:'invalid'}}).code,'REGISTRAR_POLICY_SIGNATURE_INVALID');
});

test('a registrar cannot sign its own root-level delegation',()=>{
 const item=policy({registrarPublicKeyPem:pem(root.publicKey)});
 assert.equal(check({signedPolicy:item}).code,'ROOT_REGISTRAR_KEY_COLLAPSE');
});

test('unsigned extension and privilege escalation are rejected',()=>{
 const item=policy();item.mayMerge=true;
 assert.equal(check({signedPolicy:item}).code,'POLICY_SCOPE_OR_SCHEMA_INVALID');
 const elevated=policy({allowedCapabilities:['reviewer-enrollment-only','merge']});
 assert.equal(check({signedPolicy:elevated}).code,'POLICY_SCOPE_OR_SCHEMA_INVALID');
});

test('tampering, wrong signer and invalid signature are rejected',()=>{
 const altered=policy();altered.candidateHead='b'.repeat(40);
 assert.equal(check({signedPolicy:altered}).code,'REGISTRAR_POLICY_SIGNATURE_INVALID');
 const impostor=generateKeyPairSync('ed25519');
 const wrong=policy();
 wrong.signatureBase64=sign(null,registrarPolicyPayload(wrong),impostor.privateKey).toString('base64');
 assert.equal(check({signedPolicy:wrong}).code,'REGISTRAR_POLICY_SIGNATURE_INVALID');
});

test('expired, future and impossible policy dates cannot activate reviewer',()=>{
 assert.equal(check({signedPolicy:policy({expiresAtUtc:'2026-10-28T11:30:00Z'})}).code,'POLICY_EXPIRED_OR_TIME_INVALID');
 assert.equal(check({signedPolicy:policy({issuedAtUtc:'2026-10-29T11:00:00Z'})}).code,'POLICY_EXPIRED_OR_TIME_INVALID');
 assert.equal(check({signedPolicy:policy({issuedAtUtc:'2026-99-99T11:00:00Z'})}).code,'POLICY_EXPIRED_OR_TIME_INVALID');
 assert.equal(check({signedPolicy:policy({expiresAtUtc:'2026-12-31T11:00:00Z'})}).code,'POLICY_EXPIRED_OR_TIME_INVALID');
});

test('untrusted clock blocks signing trust policy inspection',()=>{
 assert.equal(check({nowMs:NaN}).code,'TRUSTED_CLOCK_UNAVAILABLE');
 assert.equal(check({nowMs:undefined}).code,'TRUSTED_CLOCK_UNAVAILABLE');
});

test('owner STOP and unreadable STOP take precedence over all signatures',()=>{
 assert.equal(check({stopMarkerState:'PRESENT'}).code,'INTENTIONAL_STOP');
 assert.equal(check({stopMarkerState:'UNKNOWN'}).code,'STOP_UNVERIFIABLE');
});

test('registrar and publisher principal names must be distinct',()=>{
 assert.equal(check({signedPolicy:policy({registrarPrincipal:'IndependentRootPublisher'})}).code,'POLICY_SCOPE_OR_SCHEMA_INVALID');
});


// Proposed registrar nonce-ledger regression input: author-side unit fixtures.
// This source edition is NOT independently W8/W9 ADMITTED.
// Windows exercises the existing pre-provisioned regular-file journal; the
// legacy per-nonce directory-fsync path correctly fails closed on Windows.
const nonceFs = await import('node:fs/promises');
const nonceOS = await import('node:os');
const noncePath = await import('node:path');
const {issueLaneAChallenge,spendLaneAChallengeOnce} =
 await import('../scripts/engineering-team/verification/lane-a-nonce-ledger.mjs');
const {JOURNAL_HEADER} =
 await import('../scripts/engineering-team/verification/lane-a-preprovisioned-journal.mjs');
const nonceScope={registrarId:'Registrar001',hostId:'Host001',
 reviewerPrincipal:'IndependentReviewer001',reviewerSid:'S-1-5-80-123456',
 requestId:'Request001'};
async function newNonceFixture(){
 const dir=await nonceFs.mkdtemp(noncePath.join(nonceOS.tmpdir(),'f00-nonce-'));
 await nonceFs.mkdir(noncePath.join(dir,'issued'));
 await nonceFs.mkdir(noncePath.join(dir,'spent'));
 await nonceFs.writeFile(noncePath.join(dir,'registrar-journal.bin'),
   JOURNAL_HEADER,{flag:'wx'});
 return dir;
}
const nonceArgs=root=>({root,journalPath:noncePath.join(root,'registrar-journal.bin'),
 ...nonceScope});
test('registrar nonce candidate permits one spent claim without review grants',async()=>{
 const root=await newNonceFixture();
 try{
  const issued=await issueLaneAChallenge(nonceArgs(root));
  assert.equal(issued.status,'ISSUED_CANDIDATE_ONLY');
  assert.match(issued.challengeNonce,/^[a-f0-9]{64}$/);
  const args={...nonceArgs(root),challengeNonce:issued.challengeNonce};
  const first=await spendLaneAChallengeOnce(args);
  assert.equal(first.status,'SPENT_CANDIDATE_ONLY');
  assert.equal(first.nonceConsumedForProduction,false);
  assert.equal(first.mayAdmit,false);
  const replay=await spendLaneAChallengeOnce(args);
  assert.equal(replay.status,'BLOCKED');
  assert.equal(replay.replayAuthorized,false);
 }finally{await nonceFs.rm(root,{recursive:true,force:true});}
});
test('registrar nonce concurrent contenders have exactly one local winner',async()=>{
 const root=await newNonceFixture();
 try{
  const issued=await issueLaneAChallenge(nonceArgs(root));
  assert.equal(issued.status,'ISSUED_CANDIDATE_ONLY');
  const args={...nonceArgs(root),challengeNonce:issued.challengeNonce};
  const results=await Promise.all(Array.from({length:16},()=>spendLaneAChallengeOnce(args)));
  assert.equal(results.filter(r=>r.status==='SPENT_CANDIDATE_ONLY').length,1);
  assert.equal(results.filter(r=>r.status==='BLOCKED').length,15);
 }finally{await nonceFs.rm(root,{recursive:true,force:true});}
});
test('registrar nonce rejects mismatched identity and missing protected storage',async()=>{
 const root=await newNonceFixture();
 try{
  const issued=await issueLaneAChallenge(nonceArgs(root));
  assert.equal(issued.status,'ISSUED_CANDIDATE_ONLY');
  const args={...nonceArgs(root),challengeNonce:issued.challengeNonce};
  const mismatch=await spendLaneAChallengeOnce({...args,hostId:'Wrong001'});
  assert.equal(mismatch.status,'BLOCKED');
  assert.equal(mismatch.code,'JOURNAL_UNCERTAIN_OR_REPLAY_DENIED');
  assert.equal(mismatch.replayAuthorized,false);
  assert.equal((await spendLaneAChallengeOnce(args)).status,'BLOCKED');
  assert.equal((await spendLaneAChallengeOnce({...args,root:root+'-missing'})).code,
    'PROTECTED_REGISTRAR_STORAGE_UNVERIFIABLE');
 }finally{await nonceFs.rm(root,{recursive:true,force:true});}
});
test('registrar torn journal survives corruption and never auto-replays',async()=>{
 const root=await newNonceFixture();
 try{
  const issued=await issueLaneAChallenge(nonceArgs(root));
  assert.equal(issued.status,'ISSUED_CANDIDATE_ONLY');
  const journalPath=noncePath.join(root,'registrar-journal.bin');
  await nonceFs.appendFile(journalPath,Buffer.from([0,0,0,40,1,2,3]));
  const result=await spendLaneAChallengeOnce({
   ...nonceArgs(root),challengeNonce:issued.challengeNonce});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'JOURNAL_UNCERTAIN_OR_REPLAY_DENIED');
  assert.equal(result.replayAuthorized,false);
  assert.equal((await nonceFs.lstat(journalPath+'.exclusive-lock')).isDirectory(),true);
 }finally{await nonceFs.rm(root,{recursive:true,force:true});}
});
test('registrar nonce does not traverse a linked spent directory',async()=>{
 const root=await newNonceFixture();
 try{
  await nonceFs.rm(noncePath.join(root,'spent'),{recursive:true});
  // Junctions provide a real Windows reparse-point negative fixture without
  // requiring the symbolic-link creation privilege.
  await nonceFs.symlink(noncePath.join(root,'issued'),noncePath.join(root,'spent'),
    process.platform==='win32'?'junction':'dir');
  const result=await issueLaneAChallenge(nonceArgs(root));
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'PROTECTED_REGISTRAR_STORAGE_UNVERIFIABLE');
 }finally{await nonceFs.rm(root,{recursive:true,force:true});}
});
