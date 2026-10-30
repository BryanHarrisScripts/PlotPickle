import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, link, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { claimCodingOwnership, reconcileSyntaxRejectedOwnership } from '../scripts/engineering-team/gateway/receipts/atomic-coding-ownership.mjs';
import { inspectFailedSyntaxClaim } from '../scripts/engineering-team/gateway/worker-pool/reconcile-failed-syntax-once.mjs';

const GRANT='1'.repeat(32), NEXT='2'.repeat(32), HEAD='a'.repeat(40);
const CONSENT='RECONCILE_ONE_FAILED_SYNTAX_CLAIM_NO_REPLAY';

async function fixture(callback, phase='CHECK_STAGE_SYNTAX') {
  const root=await mkdtemp(path.join(os.tmpdir(),'pp-rejected-syntax-'));
  const receipts=path.join(root,'coding-attempts');
  await mkdir(receipts);
  const owner=claimCodingOwnership(receipts,GRANT,Date.now());
  const nonce=owner.nonce, epoch=owner.epoch;
  owner.close(); // exact failed Windows process has already exited
  const stem=path.join(receipts,'.coding-attempt-'+nonce);
  await writeFile(stem+'.lock',JSON.stringify({schemaVersion:1,grantId:GRANT,
    ownerNonce:nonce,ownershipEpoch:epoch,state:'NONREPLAYABLE_OWNER_EVIDENCE'})+'\n');
  await link(stem+'.lock',stem+'.guard');
  await writeFile(path.join(receipts,GRANT+'.result.json'),
    JSON.stringify({state:'BLOCKED',code:'CODING_OUTCOME_UNCERTAIN_REVIEW_STAGE',
      phase,replayAuthorized:false})+'\n');
  try {await callback({root,receipts,nonce,epoch});}
  finally {await rm(root,{recursive:true,force:true});}
}

test('owner-reconciled syntax failure is terminal, not a replayable or publishable success', async()=>{
  await fixture(async ({receipts,nonce})=>{
    const args={grantId:GRANT,sourceHead:HEAD,consent:CONSENT,stageAndRemoteVerified:true};
    assert.equal(reconcileSyntaxRejectedOwnership(receipts,{...args,stageAndRemoteVerified:false}).state,'BLOCKED');
    assert.equal(reconcileSyntaxRejectedOwnership(receipts,{...args,consent:'GENERAL_BYPASS'}).state,'BLOCKED');
    assert.throws(()=>claimCodingOwnership(receipts,NEXT,Date.now()));
    const result=reconcileSyntaxRejectedOwnership(receipts,args);
    assert.equal(result.state,'RECONCILED_SYNTAX_REJECTED_NO_COMMIT');
    assert.equal(result.publicationAuthorized,false);
    assert.equal(result.retryOriginalAuthorized,false);
    const proof=JSON.parse(await readFile(path.join(receipts,GRANT+'.released.json'),'utf8'));
    assert.equal(proof.ownershipNonce,nonce);
    assert.equal(proof.phase,'CHECK_STAGE_SYNTAX');
    assert.equal(proof.state,'RECONCILED_SYNTAX_REJECTED_NO_COMMIT');
    assert.equal(proof.localCommit,undefined);
    assert.equal(proof.publicationAuthorized,false);
    assert.equal(reconcileSyntaxRejectedOwnership(receipts,args).state,'BLOCKED','same owner cannot release twice');
    const next=claimCodingOwnership(receipts,NEXT,Date.now());
    assert.equal(next.owned(),true);
    assert.equal(next.release(),true);
    next.close();
    assert.deepEqual((await readdir(receipts)).filter(f=>f.endsWith('.lock')).length,1);
  });
});

test('only CHECK_STAGE_SYNTAX exact blocked result is eligible', async()=>{
  await fixture(async ({receipts})=>{
    const outcome=reconcileSyntaxRejectedOwnership(receipts,{
      grantId:GRANT,sourceHead:HEAD,consent:CONSENT,stageAndRemoteVerified:true});
    assert.equal(outcome.state,'BLOCKED');
    assert.throws(()=>claimCodingOwnership(receipts,NEXT,Date.now()));
  },'REQUEST_MODEL');
});

test('owner CLI inspection remains inert and Windows-only', async()=>{
  const state=await inspectFailedSyntaxClaim({platform:'linux',requestId:GRANT,grantId:GRANT});
  assert.equal(state.state,'BLOCKED');
  assert.equal(state.code,'WINDOWS_AND_EXACT_IDENTITIES_REQUIRED');
});
