import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {issueOne3355Worker1Order} from '../scripts/engineering-team/mcp/engineering/operations/issue-3355-worker1-issuer.mjs';
import {runOwner3355DraftOnce} from '../scripts/engineering-team/gateway/worker-pool/issue-3355/worker-execution.mjs';
import {validOwnerPilotException} from '../scripts/engineering-team/gateway/worker-pool/worker-host.mjs';
import {pickOwnerAuthorizedTicket,runDistinctOwnerWorker1,serve,status} from '../scripts/engineering-team/gateway/worker-pool/dispatcher/native-dispatcher.mjs';

const HEAD='a'.repeat(40);
const IDS=['1'.repeat(32),'2'.repeat(32),'3'.repeat(32)];
const AT=1_793_720_000_000;
async function fixture(fn){
  const root=await mkdtemp(path.join(os.tmpdir(),'pp-3355-worker1-'));
  try{return await fn(root);}finally{await rm(root,{recursive:true,force:true});}
}
async function record(root,folder,name){
  return JSON.parse(await readFile(path.join(root,folder,name),'utf8'));
}
async function issue(root,overrides={}){
  let next=0;
  return issueOne3355Worker1Order({root,repoRoot:root,expectedHead:HEAD,
    verifyHead:async()=>HEAD,operatorReady:async()=>true,
    dispatcherRead:async()=>({state:'ONLINE_OBSERVED'}),
    previousOrders:async()=>true,issueOpen:async()=>true,
    coderRoute:async()=>({ready:true}),now:()=>AT,
    id:()=>IDS[next++],...overrides});
}

test('one fresh #3355 order is write-once and cannot authorize merge',()=>fixture(async root=>{
  const first=await issue(root);
  assert.equal(first.code,'WORKER1_3355_ORDER_RELEASED_FOR_DISPATCH');
  const order=await record(root,'owner-work-orders',IDS[0]+'.json');
  const coding=await record(root,'owner-pi-grants',IDS[1]+'.json');
  const publication=await record(root,'owner-publication-grants',IDS[2]+'.json');
  const exception=await record(root,'owner-pilot-exceptions',IDS[0]+'.json');
  assert.equal(order.issueNumber,3355);
  assert.equal(order.assignedWorker,'coding-worker-1');
  assert.equal(coding.modelRoute,'LOCAL_ONLY');
  assert.equal(publication.consent,'AUTHORIZE_ONE_3355_DRAFT_PR_ONLY');
  assert.equal(validOwnerPilotException(exception,order,HEAD,AT+1000),true);
  assert.equal((await issue(root)).code,'WORKER1_3355_ALREADY_RESERVED_NO_REPLAY');
  const claimDir=path.join(root,'factory-worker-claims');
  await mkdir(claimDir);
  const ticket=await pickOwnerAuthorizedTicket({root,head:HEAD,now:AT+1000});
  assert.equal(ticket.state,'ELIGIBLE');
  assert.equal(ticket.ticket.issueNumber,3355);
}));

test('STOP and unreconciled history refuse issuance without a reservation',()=>fixture(async root=>{
  assert.equal((await issue(root,{operatorReady:async()=>false})).state,'BLOCKED');
  assert.equal((await issue(root,{previousOrders:async()=>false})).state,'BLOCKED');
  await assert.rejects(readFile(path.join(root,'owner-3355-reservations','issue-3355.json')));
}));

test('claimed Worker 1 job records only a verified draft PR, never a merge',()=>fixture(async root=>{
  assert.equal((await issue(root)).state,'TEST_PASSED');
  const claimDir=path.join(root,'factory-worker-claims');
  await mkdir(claimDir);
  await writeFile(path.join(claimDir,IDS[0]+'.json'),JSON.stringify({
    schemaVersion:1,requestId:IDS[0],issueNumber:3355,
    sourceHead:HEAD,workerId:'coding-worker-1',state:'RESERVED_NO_REPLAY'}));
  let runs=0;
  const args={root,repoRoot:root,sourceHead:HEAD,requestId:IDS[0],
    grantId:IDS[1],publicationId:IDS[2],now:()=>AT+1000,
    operatorReady:async()=>true,
    code:async()=>{runs++;return {state:'WAITING_FOR_PRODUCT_UAT',
      code:'DRAFT_PR_CREATED',
      prUrl:'https://github.com/BryanHarrisScripts/PlotPickle/pull/3399'};},
    readPr:async()=>({number:3399,state:'OPEN',isDraft:true,
      headRefOid:'b'.repeat(40),headRefName:'factory/issue-3355-'+HEAD.slice(0,10),
      baseRefName:'main'})};
  const result=await runOwner3355DraftOnce(args);
  assert.equal(result.state,'DRAFT_PR_CREATED');
  assert.equal(result.pullRequestCreated,true);
  assert.equal(result.independentVerification,false);
  assert.equal(result.automaticMergeAuthorized,false);
  assert.equal((await record(root,'owner-3355-results',IDS[1]+'.json')).prNumber,3399);
  assert.equal((await runOwner3355DraftOnce(args)).code,
    'WORKER1_3355_ALREADY_RECORDED_NO_REPLAY');
  assert.equal(runs,1);
}));

test('failed claimed job writes a terminal blocked record and refuses replay',()=>fixture(async root=>{
  assert.equal((await issue(root)).state,'TEST_PASSED');
  await mkdir(path.join(root,'factory-worker-claims'));
  await writeFile(path.join(root,'factory-worker-claims',IDS[0]+'.json'),JSON.stringify({
    schemaVersion:1,requestId:IDS[0],issueNumber:3355,
    sourceHead:HEAD,workerId:'coding-worker-1',state:'RESERVED_NO_REPLAY'}));
  let calls=0;
  const args={root,repoRoot:root,sourceHead:HEAD,requestId:IDS[0],
    grantId:IDS[1],publicationId:IDS[2],now:()=>AT+1000,
    operatorReady:async()=>true,code:async()=>{calls++;return {
      state:'BLOCKED',code:'PI_WRITE_TOOL_NOT_OBSERVED'};}};
  assert.equal((await runOwner3355DraftOnce(args)).code,
    'WORKER1_3355_CODING_OR_DRAFT_UNVERIFIED');
  assert.equal((await record(root,'owner-3355-results',IDS[1]+'.json')).state,'BLOCKED');
  assert.equal((await runOwner3355DraftOnce(args)).code,
    'WORKER1_3355_ALREADY_RECORDED_NO_REPLAY');
  assert.equal(calls,1);
}));

test('Dispatcher launches a distinct fixed Worker 1 child and records its PID',()=>fixture(async root=>{
  const child=new EventEmitter();
  child.pid=41234;
  child.stdout=new EventEmitter();
  const args=[];
  const result=await runDistinctOwnerWorker1({requestId:IDS[0],repoRoot:root,
    root,head:HEAD,ready:async()=>true,
    launch:(program,argv,options)=>{
      args.push(program,argv,options);
      queueMicrotask(()=>{
        child.stdout.emit('data',JSON.stringify({state:'DRAFT_PR_RECEIPT_READY',
          prNumber:3399}));
        child.emit('close',0);
      });
      return child;
    },stopTree:async()=>{throw Error('unexpected stop');}});
  assert.equal(result.state,'DRAFT_PR_RECEIPT_READY');
  assert.equal(args[1][0].endsWith('worker-host.mjs'),true);
  assert.deepEqual(args[1].slice(1),['--once','coding-worker-1',IDS[0]]);
  assert.equal(args[2].shell,false);
  assert.equal((await record(root,'owner-worker1-process','heartbeat.json')).pid,41234);
}));

test('Dispatcher heartbeat stays fresh during a long Worker 1 cycle',()=>fixture(async root=>{
  const running=serve({root,platform:'win32',maxCycles:1,
    heartbeatIntervalMs:1000,cycle:async()=>{
      await delay(1700);
      return {state:'IDLE',online:true};
    }});
  await delay(1300);
  const observed=await status({root});
  assert.equal(observed.state,'ONLINE_OBSERVED');
  assert.equal(observed.lastCycle,'WORKER_IN_FLIGHT');
  assert.equal((await running).state,'STOPPED_AFTER_TEST_CYCLES');
}));
