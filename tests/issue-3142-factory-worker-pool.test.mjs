import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FACTORY_WORKERS, projectWorkerFleet, validateOwnerWorkOrder,
  claimAndRunOwnerJobOnce } from '../scripts/engineering-team/gateway/worker-pool/worker-pool.mjs';
import { readOwnerOrder, validOwnerPilotException, readOwnerPilotException, inspectOwnerWorkerFleet } from '../scripts/engineering-team/gateway/worker-pool/worker-host.mjs';
const head = 'a'.repeat(40);
const order = { schemaVersion: 1, kind: 'owner-authorized-factory-job',
  requestId: '1'.repeat(32), grantId: '2'.repeat(32),
  publicationId: '3'.repeat(32), issueNumber: 3142,
  sourceHead: head, assignedWorker: 'coding-worker-1',
  consent: 'ONE_OWNER_AUTHORIZED_JOB_NO_REPLAY' };
const good = async () => true;
test('five coding replicas share the worker-pool role contract without proving online throughput', () => {
  assert.deepEqual(FACTORY_WORKERS.map(x => x.id), [
    'independent-reviewer', 'coding-dispatcher',
    ...Array.from({ length: 5 }, (_, i) => 'coding-worker-' + (i + 1))]);
  assert.deepEqual(FACTORY_WORKERS.slice(2).map(x => x.slot), [1, 2, 3, 4, 5]);
  assert.ok(FACTORY_WORKERS.slice(2).every(x => x.authority === 'owner-granted-coding'));
  const running = projectWorkerFleet({ expectedHead: head,
    supervisor: { state: 'RUNNING', exactSha: head },
    reviewer: { state: 'ADMIT', independentlySigned: true }, verifiedCycles: 2 });
  assert.equal(running.onlineCodingWorkers, 0);
  assert.equal(running.mayAdmitTests, false);
  assert.ok(running.workers.slice(3).every(x => x.state === 'PARKED'));
  assert.ok(running.workers.every(x => !x.canCode && !x.canMerge));
  const stopped = projectWorkerFleet({ expectedHead: head,
    supervisor: { state: 'STOP_REQUESTED', exactSha: head } });
  assert.ok(stopped.workers.every(x => x.state === 'BLOCKED'));
});
test('a bare or widened queue ticket cannot grant source execution', () => {
  assert.equal(validateOwnerWorkOrder(order, head), true);
  for (let i = 1; i <= 5; i++) {
    assert.equal(validateOwnerWorkOrder({ ...order, assignedWorker:'coding-worker-' + i }, head), true);
  }
  for(const bad of [ { ...order, assignedWorker: 'coding-worker-6' },
    { ...order, assignedWorker: 'coding-dispatcher' },
    { ...order, sourceHead: 'b'.repeat(40) },
    { ...order, consent: 'RUN_ALL' },
    { ...order, extra: true },
    { ...order, publicationId: order.grantId } ])
    assert.equal(validateOwnerWorkOrder(bad, head), false);
});
test('the identical bounded claim engine supports each replica without reusing another worker identity', async () => {
  for (let i = 1; i <= 5; i++) {
    const root = await mkdtemp(path.join(os.tmpdir(), 'pp-replica-'));
    const ticket = { ...order, assignedWorker:'coding-worker-' + i,
      requestId:String(i).repeat(32) };
    let invoked = 0;
    try {
      const got = await claimAndRunOwnerJobOnce({
        order:ticket, expectedHead:head, privateRoot:root,
        operatorReady:good, independentReleaseReady:good,
        runAuthorizedOnce:async () => {
          invoked++;
          return { state:'DRAFT_PR_CREATED',
            engineeringReceiptId:'f'.repeat(64),
            grantId:ticket.grantId, publicationId:ticket.publicationId,
            issueNumber:ticket.issueNumber, sourceHead:head,
            pullRequestCreated:true, focusedTestExecuted:false,
            independentVerification:false, automaticMergeAuthorized:false,
            replayAuthorized:false, remoteCommit:'b'.repeat(40), prNumber:3333 };
        },
      });
      assert.equal(got.state, 'DRAFT_PR_RECEIPT_READY');
      assert.equal(invoked, 1);
      const claim = JSON.parse(await readFile(path.join(root,'factory-worker-claims',
        ticket.requestId+'.json'), 'utf8'));
      assert.equal(claim.workerId, ticket.assignedWorker);
    } finally { await rm(root, { recursive:true, force:true }); }
  }
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
        grantId:order.grantId, publicationId:order.publicationId,
        issueNumber:order.issueNumber, sourceHead:head,
        pullRequestCreated:true, focusedTestExecuted:false,
        independentVerification:false, automaticMergeAuthorized:false,
        replayAuthorized:false,
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

test('a published-looking result for the wrong issue, grant, source or merge permission cannot complete a claimed job', async () => {
  const valid = { state:'DRAFT_PR_CREATED', engineeringReceiptId:'f'.repeat(64),
    grantId:order.grantId, publicationId:order.publicationId,
    issueNumber:order.issueNumber, sourceHead:head,
    pullRequestCreated:true, focusedTestExecuted:false,
    independentVerification:false, automaticMergeAuthorized:false,
    replayAuthorized:false,
    remoteCommit:'b'.repeat(40), prNumber:3333 };
  for (const field of ['grantId','publicationId','issueNumber','sourceHead',
    'pullRequestCreated','focusedTestExecuted','independentVerification',
    'automaticMergeAuthorized','replayAuthorized']) {
    const root = await mkdtemp(path.join(os.tmpdir(), 'pp-pool-'));
    try {
      const bad = { ...valid, [field]:
        typeof valid[field] === 'boolean' ? !valid[field] :
        typeof valid[field] === 'number' ? valid[field] + 1 : 'c'.repeat(40) };
      let invoked = 0;
      const attempt = await claimAndRunOwnerJobOnce({
        order, expectedHead:head, privateRoot:root,
        operatorReady:good, independentReleaseReady:good,
        runAuthorizedOnce:async () => { invoked++; return bad; },
      });
      assert.equal(attempt.code,'CLAIM_RETAINED_CODING_OR_PUBLICATION_UNPROVEN',field);
      assert.equal(attempt.replayAuthorized,false,field);
      assert.equal(invoked,1,field);
    } finally { await rm(root,{recursive:true,force:true}); }
  }
});

test('owner-work-order loader rejects a symlinked parent and reads only a real private directory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pp-owner-order-'));
  const outsider = await mkdtemp(path.join(os.tmpdir(), 'pp-order-outside-'));
  const dir = path.join(root, 'owner-work-orders');
  try {
    const filename = order.requestId + '.json';
    await writeFile(path.join(outsider, filename), JSON.stringify(order));
    await symlink(outsider, dir, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(await readOwnerOrder(root, order.requestId), null,
      'private order loader must not traverse a symlink or Windows junction parent');
    await rm(dir);
    await mkdir(dir);
    await writeFile(path.join(dir, filename), JSON.stringify(order));
    assert.deepEqual(await readOwnerOrder(root, order.requestId), order,
      'a real private directory can still serve the exact request');
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outsider, { recursive: true, force: true });
  }
});

test('one-owner exception is pinned to only #3142, exact work order and expiry', () => {
  const now = Date.now();
  const permit = { schemaVersion:1, kind:'owner-one-shot-exception',
    issueNumber:3142, sourceHead:head, requestId:order.requestId,
    grantId:order.grantId, publicationId:order.publicationId,
    expiresAt:now + 600_000, maxRequests:1,
    consent:'AUTHORIZE_ONE_3142_PILOT_NO_F00' };
  assert.equal(validOwnerPilotException(permit, order, head, now), true);
  for (const bad of [
    { ...permit, issueNumber:2955 }, { ...permit, sourceHead:'b'.repeat(40) },
    { ...permit, requestId:'a'.repeat(32) },
    { ...permit, grantId:'b'.repeat(32) },
    { ...permit, publicationId:'c'.repeat(32) },
    { ...permit, expiresAt:now - 1 },
    { ...permit, expiresAt:now + 3_700_000 },
    { ...permit, expiresAt:now + 15_000 },
    { ...permit, maxRequests:2 }, { ...permit, consent:'AUTHORIZE_UNLIMITED' },
    { ...permit, canMerge:true },
  ]) assert.equal(validOwnerPilotException(bad, order, head, now), false);
  assert.equal(validOwnerPilotException(permit, { ...order, issueNumber:3158 }, head, now), false);
});

test('owner exception is private-file only; no symlinked parent, symlinked permit or silent release', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pp-pilot-owner-'));
  const outsider = await mkdtemp(path.join(os.tmpdir(), 'pp-pilot-outside-'));
  const dir = path.join(root, 'owner-pilot-exceptions');
  const now = Date.now();
  const permit = { schemaVersion:1, kind:'owner-one-shot-exception',
    issueNumber:3142, sourceHead:head, requestId:order.requestId,
    grantId:order.grantId, publicationId:order.publicationId,
    expiresAt:now + 600_000, maxRequests:1,
    consent:'AUTHORIZE_ONE_3142_PILOT_NO_F00' };
  const filename = order.requestId + '.json';
  try {
    assert.equal(await readOwnerPilotException(root, order, head, now), false);
    await writeFile(path.join(outsider, filename), JSON.stringify(permit));
    await symlink(outsider, dir, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(await readOwnerPilotException(root, order, head, now), false);
    await rm(dir);
    await mkdir(dir);
    // Windows without Developer Mode cannot create a file symlink. The
    // junction test above still proves parent redirection is rejected.
    // Do not report a file-symlink assertion when the OS denies fixture setup.
    let fileSymlinkCreated = false;
    try {
      await symlink(path.join(outsider, filename), path.join(dir, filename));
      fileSymlinkCreated = true;
    } catch (error) {
      if (process.platform !== 'win32' ||
          !['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) throw error;
    }
    if (fileSymlinkCreated) {
      assert.equal(await readOwnerPilotException(root, order, head, now), false);
      await rm(path.join(dir, filename));
    }
    await writeFile(path.join(dir, filename), JSON.stringify(permit));
    assert.equal(await readOwnerPilotException(root, order, head, now), true);
    assert.equal(await readOwnerPilotException(root, order, 'b'.repeat(40), now), false);
    assert.equal(await readOwnerPilotException(root, order, head, now + 600_000), false);
  } finally {
    await rm(root, { recursive:true, force:true });
    await rm(outsider, { recursive:true, force:true });
  }
});

test('Worker 1 pilot observation is read-only, exact-head scoped and never a worker release', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pp-owner-pilot-observation-'));
  const run = promisify(execFile);
  const git = async (...args) => String((await run('git', args, {
    cwd: root, timeout: 12000, windowsHide: true, maxBuffer: 4096,
  })).stdout).trim();
  try {
    await git('init', '-b', 'main');
    await writeFile(path.join(root, 'fixture.txt'), 'one-shot pilot fixture\n');
    await git('add', 'fixture.txt');
    await git('-c', 'user.name=PlotPickle Fixture', '-c', 'user.email=fixture@invalid.example',
      '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=.git/no-hooks',
      'commit', '-m', 'fixture');
    await git('remote', 'add', 'origin', 'https://github.com/BryanHarrisScripts/PlotPickle.git');
    const pinned = await git('rev-parse', 'HEAD');
    const inspect = async supervisor => inspectOwnerWorkerFleet({
      repoRoot: root, env: {}, inspect: async () => supervisor,
    });
    const observed = await inspect({ state: 'RUNNING', exactSha: pinned });
    assert.equal(observed.pilotSupervisorObservedOnExactHead, true);
    assert.equal(observed.onlineCodingWorkers, 0);
    assert.equal(observed.mayMerge, false);
    assert.ok(observed.workers.every(worker => !worker.canCode && !worker.canMerge));
    for (const supervisor of [
      { state: 'RUNNING', exactSha: 'b'.repeat(40) },
      { state: 'PAUSED', exactSha: pinned },
      { state: 'STOP_REQUESTED', exactSha: pinned },
      null,
    ]) {
      const result = await inspect(supervisor);
      assert.equal(result.pilotSupervisorObservedOnExactHead, false);
      assert.equal(result.onlineCodingWorkers, 0);
      assert.equal(result.mayMerge, false);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
