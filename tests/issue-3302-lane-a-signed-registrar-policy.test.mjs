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
