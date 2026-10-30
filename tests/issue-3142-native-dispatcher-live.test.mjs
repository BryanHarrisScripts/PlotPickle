import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile,lstat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pickOwnerAuthorizedTicket,dispatchOne,serve,status} from
  '../scripts/engineering-team/gateway/worker-pool/dispatcher/native-dispatcher.mjs';

const HEAD='a'.repeat(40),REQ='1'.repeat(32),GRANT='2'.repeat(32),PUB='3'.repeat(32);
const sandbox=async fn=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'pp-f01-native-dispatch-'));
  try{await fn(root);}finally{await rm(root,{recursive:true,force:true});}
};
const seed=async root=>{
  for(const name of ['owner-work-orders','factory-worker-claims',
    'owner-coding-grants','owner-publication-grants']){
    await mkdir(path.join(root,name),{recursive:true});
  }
  const order={schemaVersion:1,kind:'owner-authorized-factory-job',
    assignedWorker:'coding-worker-1',consent:'ONE_OWNER_AUTHORIZED_JOB_NO_REPLAY',
    requestId:REQ,grantId:GRANT,publicationId:PUB,issueNumber:3142,sourceHead:HEAD};
  const grant={grantId:GRANT,issueNumber:3142,sourceHead:HEAD,maxRequests:1,
    expiresAt:Date.now()+300000};
  const publish={publicationId:PUB,grantId:GRANT,issueNumber:3142,
    sourceHead:HEAD,maxRequests:1,expiresAt:Date.now()+300000};
  await writeFile(path.join(root,'owner-work-orders',REQ+'.json'),JSON.stringify(order));
  await writeFile(path.join(root,'owner-coding-grants',GRANT+'.json'),JSON.stringify(grant));
  await writeFile(path.join(root,'owner-publication-grants',PUB+'.json'),JSON.stringify(publish));
};
test('finds one unused owner-created source-pinned ticket, refuses claim replay',()=>sandbox(async root=>{
  await seed(root);
  let x=await pickOwnerAuthorizedTicket({root,head:HEAD});
  assert.equal(x.state,'ELIGIBLE');
  assert.equal(x.ticket.requestId,REQ);
  assert.equal((await pickOwnerAuthorizedTicket({root,head:'b'.repeat(40)})).state,'IDLE');
  await writeFile(path.join(root,'factory-worker-claims',REQ+'.json'),'{');
  x=await pickOwnerAuthorizedTicket({root,head:HEAD});
  assert.equal(x.state,'IDLE');
  assert.equal(x.ticket,null);
}));
test('expired, ambiguous, symlinked and missing grants never dispatch',()=>sandbox(async root=>{
  await seed(root);
  await writeFile(path.join(root,'owner-coding-grants',GRANT+'.json'),
    JSON.stringify({grantId:GRANT,issueNumber:3142,sourceHead:HEAD,
      maxRequests:1,expiresAt:1}));
  assert.equal((await pickOwnerAuthorizedTicket({root,head:HEAD})).state,'IDLE');
}));
test('owner-Windows dispatcher calls Worker 1 only after current-head STOP checks',()=>sandbox(async root=>{
  await seed(root);
  const env={LOCALAPPDATA:path.resolve(root,'..')};
  const pick=async()=>({state:'ELIGIBLE',ticket:{requestId:REQ,issueNumber:3142}});
  let invoked=0;
  const fake={repoRoot:root,env,platform:'win32',
    source:async()=>({channel:'main',head:HEAD}),
    inspect:async()=>({state:'RUNNING',exactSha:HEAD,pauseAcknowledged:false}),
    ready:async()=>true,pick,
    run:async args=>{invoked++;assert.equal(args.role,'coding-worker-1');
      assert.equal(args.requestId,REQ);
      return {state:'DRAFT_PR_RECEIPT_READY',prNumber:3344};
    }};
  const result=await dispatchOne(fake);
  assert.equal(result.state,'PR_PUBLISHED');
  assert.equal(result.prNumber,3344);
  assert.equal(invoked,1);
  for(const denied of ['PAUSED','STOP_REQUESTED','OFFLINE']){
    assert.equal((await dispatchOne({...fake,
      inspect:async()=>({state:denied,exactSha:HEAD})})).state,'BLOCKED');
  }
  assert.equal(invoked,1);
  assert.equal((await dispatchOne({...fake,pick:async()=>({state:'IDLE',ticket:null})})).state,'IDLE');
}));
test('separate long-lived dispatcher process owns nonce lock and durable heartbeat',()=>sandbox(async root=>{
  const out=await serve({root,platform:'win32',maxCycles:1,intervalMs:1000,
    cycle:async()=>({state:'IDLE',online:true})});
  assert.equal(out.state,'STOPPED_AFTER_TEST_CYCLES');
  const beat=JSON.parse(await readFile(path.join(root,'native-dispatcher','heartbeat.json')));
  assert.equal(beat.count,1);
  assert.equal(beat.online,true);
  assert.equal((await status({root})).state,'BLOCKED','exited process does not claim online');
  await writeFile(path.join(root,'native-dispatcher','owner.lock'),'{');
  assert.equal((await serve({root,platform:'win32',maxCycles:1,
    cycle:async()=>({state:'IDLE'})})).code,'DISPATCH_OWNER_LOCK_RETAINED');
}));
test('scheduled dispatcher never promotes other workers, Pi queue or merge rights',async()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const host=await readFile(path.join(root,
    'scripts/engineering-team/gateway/worker-pool/worker-host.mjs'),'utf8');
  const installer=await readFile(path.join(root,
    'scripts/engineering-team/windows/workers/Install-PlotPickleFactoryWorkers.ps1'),'utf8');
  assert.match(host,/args\[1\] === 'coding-dispatcher'/);
  assert.match(host,/dispatcher\.serve\(\)/);
  assert.match(installer,/Start-ScheduledTask -TaskName \$names\[0\]/);
  // Windows Task Scheduler often reports a bare local UserId after
  // registering DOMAIN\\user. Principal ownership must compare SIDs and
  // retain every exact executable, argument, source and STOP guard.
  assert.match(installer,/function Test-TaskPrincipalIsCurrentUser/);
  assert.match(installer,/NTAccount\(\$env:COMPUTERNAME,\s*\$taskUserId\)/);
  assert.match(installer,/\$local\.Value -eq \$current\.User\.Value/);
  assert.match(installer,/-not \(Test-TaskPrincipalIsCurrentUser/);
  assert.doesNotMatch(installer,/\$task\.Principal\.UserId -notin/);
  assert.match(installer,/legacyPiStarted=\$false/);
  assert.match(installer,/liveProcessVerified=\$false/);
  assert.match(installer,/LEGACY_PI_TASK_MUST_BE_DISABLED_BEFORE_DISPATCHER_START/);
  assert.doesNotMatch(installer,/LEGACY_PI_TASK_PRESENT_REVIEW_SEPARATELY/);
});
