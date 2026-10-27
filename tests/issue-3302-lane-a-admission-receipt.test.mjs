import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {canonicalPayload,verifyAdmissionReceipt} from '../scripts/engineering-team/verification/lane-a-admission-receipt.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const sha='a'.repeat(40),digests={'tests/one.test.mjs':'b'.repeat(64)},inputs={'scripts/one.mjs':'c'.repeat(64)};
const opts={trustedReviewers:{'qa-key-1':{principal:'PP-F00-LA-W0001',publicKeyPem:publicKey.export({format:'pem',type:'spki'})}},expectedHead:sha,expectedTestDigests:digests,expectedInputDigests:inputs,expectedAuthorPrincipal:'PP-F01-ENG-W0001',allowedTruthRefs:['WHITE-PAPER-V3/W8','WHITE-PAPER-V3/W9']};
function signed(overrides={}){
 const r={schemaVersion:'PP-TEST-ADMISSION-V1',reviewId:'review1',reviewerPrincipal:'PP-F00-LA-W0001',authorPrincipal:'PP-F01-ENG-W0001',credentialKeyId:'qa-key-1',candidateHead:sha,testDigests:digests,inputDigests:inputs,truthRefs:['WHITE-PAPER-V3/W8'],findings:['Assertion reviewed'],disposition:'ADMIT',evidence:['immutable-review-evidence'],timestampUtc:'2026-10-27T22:00:00Z',...overrides};
 r.signatureBase64=sign(null,canonicalPayload(r),privateKey).toString('base64');return r;
}
test('valid independently keyed ADMIT is a catalogue candidate, never Lane B execution',()=>{const r=verifyAdmissionReceipt(signed(),opts);assert.equal(r.mayUpdateCatalogue,true);assert.equal(r.mayRunLaneB,false);});
test('self-review is rejected even with valid cryptographic signature',()=>assert.equal(verifyAdmissionReceipt(signed({authorPrincipal:'PP-F00-LA-W0001'}),opts).code,'SELF_REVIEW'));
test('tampering after signing invalidates receipt',()=>{const r=signed();r.findings=['altered'];assert.equal(verifyAdmissionReceipt(r,opts).code,'SIGNATURE_INVALID');});
test('stale head, input digests and unknown truth obligations are rejected',()=>{
 assert.equal(verifyAdmissionReceipt(signed({candidateHead:'d'.repeat(40)}),opts).code,'HEAD_MISMATCH');
 assert.equal(verifyAdmissionReceipt(signed({inputDigests:{'scripts/one.mjs':'e'.repeat(64)}}),opts).code,'EDITION_MISMATCH');
 assert.equal(verifyAdmissionReceipt(signed({truthRefs:['UNKNOWN']}),opts).code,'TRUTH_REF_UNAPPROVED');
});
test('untrusted or revoked reviewer key cannot admit',()=>{
 assert.equal(verifyAdmissionReceipt(signed(),{...opts,trustedReviewers:{}}).code,'REVIEWER_NOT_TRUSTED');
 assert.equal(verifyAdmissionReceipt(signed(),{...opts,trustedReviewers:{'qa-key-1':{...opts.trustedReviewers['qa-key-1'],revoked:true}}}).code,'REVIEWER_NOT_TRUSTED');
});
test('signed FIX verdict is evidence but cannot authorize catalogue update',()=>{const r=verifyAdmissionReceipt(signed({disposition:'FIX'}),opts);assert.equal(r.accepted,true);assert.equal(r.mayUpdateCatalogue,false);});

test('signed receipt round trip is attributable to a separate ephemeral fixture key',()=>{
 const receipt=signed();
 const bytes=canonicalPayload(receipt);
 const verified=verifyAdmissionReceipt(JSON.parse(JSON.stringify(receipt)),opts);
 assert.equal(verified.accepted,true);
 assert.equal(verified.disposition,'ADMIT');
 assert.equal(verified.mayRunLaneB,false);
 assert.equal(bytes.toString('utf8'),canonicalPayload(receipt).toString('utf8'));
 assert.match(verified.receiptDigest,/^[a-f0-9]{64}$/);
});
test('wrong signing key cannot impersonate trusted reviewer',()=>{
 const imposter=generateKeyPairSync('ed25519');
 const receipt=signed();
 receipt.signatureBase64=sign(null,canonicalPayload(receipt),imposter.privateKey).toString('base64');
 assert.equal(verifyAdmissionReceipt(receipt,opts).code,'SIGNATURE_INVALID');
});
test('missing evidence or signature cannot become admission',()=>{
 assert.equal(verifyAdmissionReceipt(signed({evidence:[]}),opts).code,'EVIDENCE_MISSING');
 const receipt=signed();delete receipt.signatureBase64;
 assert.equal(verifyAdmissionReceipt(receipt,opts).code,'SIGNATURE_MISSING');
});

test('attested author cannot be substituted by signer',()=>{
 const receipt=signed({authorPrincipal:'PP-F01-ENG-W9999'});
 assert.equal(verifyAdmissionReceipt(receipt,opts).code,'AUTHOR_NOT_ATTESTED');
 assert.equal(verifyAdmissionReceipt(signed(),{...opts,expectedAuthorPrincipal:undefined}).code,'AUTHOR_NOT_ATTESTED');
});
test('empty test or implementation editions can never be admitted',()=>{
 const noTests=signed({testDigests:{}});
 assert.equal(verifyAdmissionReceipt(noTests,{...opts,expectedTestDigests:{}}).code,'EDITION_MISMATCH');
 const noInputs=signed({inputDigests:{}});
 assert.equal(verifyAdmissionReceipt(noInputs,{...opts,expectedInputDigests:{}}).code,'EDITION_MISMATCH');
});
test('malformed base64 and inherited key registry entries fail closed',()=>{
 const receipt=signed();receipt.signatureBase64+='garbage';
 assert.equal(verifyAdmissionReceipt(receipt,opts).code,'SIGNATURE_FORMAT_INVALID');
 const noOwnKey=Object.create({'qa-key-1':opts.trustedReviewers['qa-key-1']});
 assert.equal(verifyAdmissionReceipt(signed(),{...opts,trustedReviewers:noOwnKey}).code,'REVIEWER_NOT_TRUSTED');
});
