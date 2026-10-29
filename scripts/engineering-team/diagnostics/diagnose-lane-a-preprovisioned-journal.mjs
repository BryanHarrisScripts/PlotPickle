/**
 * #3302 NON-RELEASE author-side diagnostic only.
 * Not a protected W8/W9 test edition or an independent Windows Product Gate.
 */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,appendFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {JOURNAL_HEADER,operateLaneAPreprovisionedJournal as run}
  from '../verification/lane-a-preprovisioned-journal.mjs';

import {issueLaneAChallenge,spendLaneAChallengeOnce}
  from '../verification/lane-a-nonce-ledger.mjs';
const scope='a'.repeat(64);
const id=()=>randomBytes(16).toString('hex');
let passed=0;
async function fixture(fn){
  const root=await mkdtemp(path.join(os.tmpdir(),'pp-f00-journal-diag-'));
  const journalPath=path.join(root,'registrar-journal.bin');
  try{
    await writeFile(journalPath,JOURNAL_HEADER,{flag:'wx'});
    await fn(journalPath);
  }finally{await rm(root,{recursive:true,force:true});}
}
await fixture(async journalPath=>{
  const issue=await run({journalPath,operation:'ISSUE',scopeDigest:scope,requestId:id()});
  assert.equal(issue.status,'ISSUED_CANDIDATE_ONLY');passed++;
  assert.equal(issue.mayAdmit,false);passed++;
  const args={journalPath,operation:'SPEND',challengeNonce:issue.challengeNonce,
    scopeDigest:scope,requestId:id()};
  const results=await Promise.all(Array.from({length:16},(_,i)=>run({
    ...args,requestId:i===0?args.requestId:id()
  })));
  assert.equal(results.filter(x=>x.status==='SPENT_CANDIDATE_ONLY').length,1);passed++;
  assert.equal(results.filter(x=>x.status==='BLOCKED').length,15);passed++;
  assert.equal((await run(args)).status,'BLOCKED');passed++;
});
await fixture(async journalPath=>{
  const issue=await run({journalPath,operation:'ISSUE',scopeDigest:scope,requestId:id()});
  assert.equal(issue.status,'ISSUED_CANDIDATE_ONLY');passed++;
  await appendFile(journalPath,Buffer.from([0,0,0,40,1,2,3]));
  const denied=await run({journalPath,operation:'SPEND',
    challengeNonce:issue.challengeNonce,scopeDigest:scope,requestId:id()});
  assert.equal(denied.status,'BLOCKED');passed++;
  assert.equal(denied.replayAuthorized,false);passed++;
  assert.ok((await readFile(journalPath)).length>JOURNAL_HEADER.length);passed++;
});
await fixture(async journalPath=>{
  const denied=await run({journalPath,operation:'SPEND',
    challengeNonce:'b'.repeat(64),scopeDigest:scope,requestId:id()});
  assert.equal(denied.status,'BLOCKED');passed++;
});
const integrationRoot=await mkdtemp(path.join(os.tmpdir(),'pp-f00-integration-diag-'));
try {
  await mkdir(path.join(integrationRoot,'issued'));
  await mkdir(path.join(integrationRoot,'spent'));
  const journalPath=path.join(integrationRoot,'registrar-journal.bin');
  await writeFile(journalPath,JOURNAL_HEADER,{flag:'wx'});
  const identity={root:integrationRoot,journalPath,registrarId:'Registrar001',
    hostId:'Host001',reviewerPrincipal:'Reviewer001',
    reviewerSid:'S-1-5-80-123456',requestId:'Request001'};
  const issue=await issueLaneAChallenge(identity);
  assert.equal(issue.status,'ISSUED_CANDIDATE_ONLY');passed++;
  const spent=await spendLaneAChallengeOnce({...identity,challengeNonce:issue.challengeNonce});
  assert.equal(spent.status,'SPENT_CANDIDATE_ONLY');passed++;
  assert.equal(spent.mayAdmit,false);passed++;
  assert.equal((await spendLaneAChallengeOnce({...identity,
    challengeNonce:issue.challengeNonce})).status,'BLOCKED');passed++;
}finally{await rm(integrationRoot,{recursive:true,force:true});}
const missing=await run({journalPath:path.join(os.tmpdir(),'pp-f00-nonexistent-journal.bin'),
  operation:'ISSUE',scopeDigest:scope,requestId:id()});
assert.equal(missing.code,'PREPROVISIONED_JOURNAL_UNVERIFIABLE');passed++;
console.log(JSON.stringify({schemaVersion:'PP-F00-JOURNAL-AUTHOR-DIAGNOSTIC-V1',
  code:'NON_RELEASE_AUTHOR_DIAGNOSTIC_PASSED',assertionsPassed:passed,
  platform:process.platform,independentVerification:false,
  powerLossDurabilityVerified:false,aclVerified:false,w8w9Admitted:false,
  productionActivated:false,mayAdmit:false,mayMerge:false}));
