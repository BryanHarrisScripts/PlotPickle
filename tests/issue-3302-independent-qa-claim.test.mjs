import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {claimReview,readClaim,appendReviewObservation} from '../scripts/engineering-team/verification/independent-qa-claim.mjs';
const head='0eb774a5a53ec86db883ee66d689e90ef9b8e186';
async function fixture(fn){const root=await mkdtemp(join(tmpdir(),'pp-qa-claim-'));try{await fn(root);}finally{await rm(root,{recursive:true,force:true});}}
test('concurrent distinct workers cannot both claim one review',()=>fixture(async root=>{
 const outcomes=await Promise.all(Array.from({length:12},(_,i)=>claimReview({root,jobId:'w8w9-3311',workerId:'worker-'+i,head,expectedHead:head})));
 assert.equal(outcomes.filter(x=>x.status==='CLAIMED').length,1);
 assert.equal(outcomes.filter(x=>x.code==='ALREADY_CLAIMED').length,11);
 assert.equal((await readClaim({root,jobId:'w8w9-3311'})).nonce,outcomes.find(x=>x.status==='CLAIMED').claim.nonce);
}));
test('STOP and head mismatch cannot reserve a claim',()=>fixture(async root=>{
 assert.equal((await claimReview({root,jobId:'w8w9',workerId:'qa1',head,expectedHead:head,stop:true})).code,'STOP_ACTIVE');
 assert.equal((await claimReview({root,jobId:'w8w9',workerId:'qa1',head:'other',expectedHead:head})).code,'HEAD_MISMATCH');
 assert.equal(await readClaim({root,jobId:'w8w9'}),null);
}));
test('observations require exact claim identity, are immutable, and cannot assert PASS',()=>fixture(async root=>{
 const claimed=await claimReview({root,jobId:'w8w9',workerId:'qa1',head,expectedHead:head});
 const args={root,jobId:'w8w9',workerId:'qa1',claimNonce:claimed.claim.nonce,claimDigest:claimed.claimDigest,observationId:'first',disposition:'UNPROVEN',evidence:['No signed Windows Product Gate']};
 await assert.rejects(appendReviewObservation({...args,claimNonce:'wrong'}),/CLAIM_IDENTITY_MISMATCH/);
 await assert.rejects(appendReviewObservation({...args,disposition:'PASS'}),/PASS_REQUIRES/);
 assert.equal((await appendReviewObservation(args)).status,'RECORDED');
 assert.equal((await appendReviewObservation(args)).code,'OBSERVATION_EXISTS');
}));
test('unsafe IDs are rejected',()=>fixture(async root=>{
 await assert.rejects(claimReview({root,jobId:'../escape',workerId:'qa1',head,expectedHead:head}),/INVALID_ID/);
}));
