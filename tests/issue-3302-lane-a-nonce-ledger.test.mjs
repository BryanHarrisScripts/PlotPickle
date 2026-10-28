import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,rm,symlink,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {issueLaneAChallenge,spendLaneAChallengeOnce} from '../scripts/engineering-team/verification/lane-a-nonce-ledger.mjs';
const ident={registrarId:'Registrar001',hostId:'Host001',reviewerPrincipal:'IndependentReviewer001',reviewerSid:'S-1-5-80-123456',requestId:'Request001'};
async function fresh(){const dir=await mkdtemp(path.join(os.tmpdir(),'f00-nonce-'));await mkdir(path.join(dir,'issued'));await mkdir(path.join(dir,'spent'));return dir;}
test('issuance and single spend are fail-closed and never grant reviewer authority',async()=>{
 const root=await fresh();try{
  const a=await issueLaneAChallenge({root,...ident});
  assert.equal(a.status,'ISSUED_CANDIDATE_ONLY');
  assert.match(a.challengeNonce,/^[a-f0-9]{64}$/);
  assert.equal(a.mayAdmit,false);
  const b=await spendLaneAChallengeOnce({root,challengeNonce:a.challengeNonce,...ident});
  assert.equal(b.status,'SPENT_CANDIDATE_ONLY');
  assert.equal(b.nonceConsumedForProduction,false);
  assert.equal((await spendLaneAChallengeOnce({root,challengeNonce:a.challengeNonce,...ident})).status,'BLOCKED');
  assert.equal((await readdir(path.join(root,'spent'))).length,1);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('simultaneous challenge spenders yield exactly one winner',async()=>{
 const root=await fresh();try{
  const a=await issueLaneAChallenge({root,...ident});
  const b=await Promise.all(Array.from({length:16},()=>spendLaneAChallengeOnce({root,challengeNonce:a.challengeNonce,...ident})));
  assert.equal(b.filter(x=>x.status==='SPENT_CANDIDATE_ONLY').length,1);
  assert.equal(b.filter(x=>x.status==='BLOCKED').length,15);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('wrong scope cannot spend and neither missing root nor symlink creates a ledger',async()=>{
 const root=await fresh();try{
  const a=await issueLaneAChallenge({root,...ident});
  assert.equal((await spendLaneAChallengeOnce({root,challengeNonce:a.challengeNonce,...ident,hostId:'Wrong001'})).code,'ISSUED_CHALLENGE_CONTENT_MISMATCH');
  assert.equal((await spendLaneAChallengeOnce({root:root+'-absent',challengeNonce:a.challengeNonce,...ident})).code,'PROTECTED_REGISTRAR_STORAGE_UNVERIFIABLE');
  assert.equal((await spendLaneAChallengeOnce({root,challengeNonce:a.challengeNonce,...ident})).status,'SPENT_CANDIDATE_ONLY');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('pre-existing spent marker remains blocked even when corrupted or truncated',async()=>{
 const root=await fresh();try{
  const a=await issueLaneAChallenge({root,...ident});
  await writeFile(path.join(root,'spent',a.challengeNonce+'.json'),'');
  assert.equal((await spendLaneAChallengeOnce({root,challengeNonce:a.challengeNonce,...ident})).code,'CHALLENGE_ALREADY_SPENT_OR_DURABILITY_UNVERIFIABLE');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('symlinked registrar directories are never used for nonce issuance',async()=>{
 const root=await fresh();try{
  await rm(path.join(root,'spent'),{recursive:true});
  await symlink(path.join(root,'issued'),path.join(root,'spent'),'dir');
  assert.equal((await issueLaneAChallenge({root,...ident})).code,'PROTECTED_REGISTRAR_STORAGE_UNVERIFIABLE');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('corrupted spent entry is still nonreplayable',async()=>{
 const root=await fresh();try{
  const a=await issueLaneAChallenge({root,...ident});
  const b=await spendLaneAChallengeOnce({root,challengeNonce:a.challengeNonce,...ident});assert.equal(b.status,'SPENT_CANDIDATE_ONLY');
  // Existing filename must never be deleted/replaced, regardless of content.
  assert.match(await readFile(path.join(root,'spent',a.challengeNonce+'.json'),'utf8'),/SPENT_NO_REPLAY/);
  const r=await spendLaneAChallengeOnce({root,challengeNonce:a.challengeNonce,...ident});
  assert.equal(r.code,'CHALLENGE_ALREADY_SPENT_OR_DURABILITY_UNVERIFIABLE');
 }finally{await rm(root,{recursive:true,force:true});}
});
