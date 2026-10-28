import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FACTORY_WORKERS, projectWorkerFleet, validateOwnerWorkOrder,
  claimAndRunOwnerJobOnce } from '../scripts/engineering-team/gateway/worker-pool/worker-pool.mjs';
const head = 'a'.repeat(40);
const order = { schemaVersion: 1, kind: 'owner-authorized-factory-job',
  requestId: '1'.repeat(32), grantId: '2'.repeat(32),
  publicationId: '3'.repeat(32), issueNumber: 3142,
  sourceHead: head, assignedWorker: 'coding-worker-1',
  consent: 'ONE_OWNER_AUTHORIZED_JOB_NO_REPLAY' };
const good = async () => true;
test('four roles never promote reviewer identity or verified model throughput', () => {
  assert.deepEqual(FACTORY_WORKERS.map(x => x.id), [
    'independent-reviewer', 'coding-dispatcher', 'coding-worker-1', 'coding-worker-2']);
  const running = projectWorkerFleet({ expectedHead: head,
    supervisor: { state: 'RUNNING', exactSha: head },
    reviewer: { state: 'ADMIT', independentlySigned: true }, verifiedCycles: 2 });
  assert.equal(running.onlineCodingWorkers, 0);
  assert.equal(running.mayAdmitTests, false);
  assert.equal(running.workers[3].state, 'PARKED');
  assert.ok(running.workers.every(x => !x.canCode && !x.canMerge));
  const stopped = projectWorkerFleet({ expectedHead: head,
    supervisor: { state: 'STOP_REQUESTED', exactSha: head } });
  assert.ok(stopped.workers.every(x => x.state === 'BLOCKED'));
});
test('a bare or widened queue ticket cannot grant source execution', () => {
  assert.equal(validateOwnerWorkOrder(order, head), true);
  for(const bad of [ { ...order, assignedWorker: 'coding-worker-2' },
    { ...order, sourceHead: 'b'.repeat(40) },
    { ...order, consent: 'RUN_ALL' },
    { ...order, extra: true },
    { ...order, publicationId: order.grantId } ])
    assert.equal(validateOwnerWorkOrder(bad, head), false);
});
test('STOP and missing independent release block before any claim or model', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pp-pool-'));
  let invoked = 0;
  try {
    const base = { order, expectedHead: head, privateRoot: root,
      runAuthorizedOnce: async () => { invoked++; throw Error('must not execute'); } };
    assert.equal((await claimAndRunOwnerJobOnce({ ...base,
      operatorReady: async () => false, independentReleaseReady: good })).code,
    'OWNER_STOP_PAUSE_OR_HEAD_UNVERIFIABLE');
    assert.equal((await claimAndRunOwnerJobOnce({ ...base,
      operatorReady: good, independentReleaseReady: async () => false })).code,
    'INDEPENDENT_RELEASE_NOT_ESTABLISHED');
    assert.equal(invoked, 0);
    await assert.rejects(readdir(path.join(root,'factory-worker-claims')));
  } finally { await rm(root, {recursive:true,force:true}); }
});
test('concurrent same-job attempts have exactly one winner and preserve no-replay', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pp-pool-'));
  let calls = 0;
  let allowFinish;
  const pending = new Promise(resolve => { allowFinish = resolve; });
  const opts = { order, expectedHead: head, privateRoot: root,
    operatorReady: good, independentReleaseReady: good,
    runAuthorizedOnce: async () => { calls++; await pending;
      return { state:'DRAFT_PR_CREATED', engineeringReceiptId:'f'.repeat(64),
        remoteCommit:'b'.repeat(40), prNumber:3333 }; } };
  try {
    const a = claimAndRunOwnerJobOnce(opts);
    const b = claimAndRunOwnerJobOnce(opts);
    allowFinish();
    const results = await Promise.all([a,b]);
    assert.equal(results.filter(x=>x.state==='DRAFT_PR_RECEIPT_READY').length,1);
    assert.equal(calls,1);
    assert.equal((await claimAndRunOwnerJobOnce(opts)).code,'JOB_ALREADY_CLAIMED_OR_UNVERIFIABLE');
    const claims = await readdir(path.join(root, 'factory-worker-claims'));
    assert.deepEqual(claims, [order.requestId+'.json']);
    assert.match(await readFile(path.join(root,'factory-worker-claims',claims[0]),'utf8'), /RESERVED_NO_REPLAY/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
test('execution uncertainty retains permanent reservation, no retries or merger', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pp-pool-'));
  let calls = 0;
  const opts = { order, expectedHead: head, privateRoot: root,
    operatorReady: good, independentReleaseReady: good,
    runAuthorizedOnce: async () => { calls++; throw Error('network lost'); } };
  try {
    const first = await claimAndRunOwnerJobOnce(opts);
    assert.equal(first.code,'CLAIM_RETAINED_EXECUTION_UNCERTAIN');
    const second = await claimAndRunOwnerJobOnce(opts);
    assert.equal(second.code,'JOB_ALREADY_CLAIMED_OR_UNVERIFIABLE');
    assert.equal(calls,1);
    assert.equal(first.mergeAuthorized,false);
  } finally { await rm(root,{recursive:true,force:true}); }
});
