import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assessHostedCi, collectIndependentVerifierOnce } from
  '../scripts/engineering-team/gateway/verification/independent-verifier-once.mjs';

const PUB = 'b'.repeat(32), VER = 'c'.repeat(32), GRANT = 'a'.repeat(32);
const SOURCE = '1'.repeat(40), LOCAL = '2'.repeat(40), REMOTE = '3'.repeat(40);
const LAYERS = [
  'Layer 1 Experience Skins', 'Layer 2 Experience Contract',
  'Layer 3 Production Orchestration', 'Layer 4 Agent & Skill Mesh',
  'Layer 5 Story / Canon / Evidence', 'Layer 6 Provider Runtime',
  'Layer 7 Validation & Operations',
];
const pub = { state: 'DRAFT_PR_CREATED', publicationId: PUB, grantId: GRANT,
  sourceHead: SOURCE, localCommit: LOCAL, remoteCommit: REMOTE,
  prNumber: 4242, issueNumber: 3142, pullRequestCreated: true,
  independentVerification: false, automaticMergeAuthorized: false };
const prepared = { state: 'LOCAL_COMMIT_PREPARED', grantId: GRANT,
  sourceHead: SOURCE, commit: LOCAL, issueNumber: 3142,
  pullRequestCreated: false, independentVerification: false };
const pr = { number: 4242, state: 'open', draft: true,
  head: { sha: REMOTE }, base: { ref: 'main' } };
const run = { id: 1001, run_attempt: 1, name: 'Architecture Verification',
  head_sha: REMOTE, event: 'pull_request', status: 'completed',
  conclusion: 'success', pull_requests: [{ number: 4242 }] };
const jobs = { total_count: 7, jobs: LAYERS.map(name =>
  ({ name, status: 'completed', conclusion: 'success' })) };
const reply = data => new Response(JSON.stringify(data), {
  status: 200, headers: { 'content-type': 'application/json' },
});
async function fixture(callback, { receipt = true } = {}) {
  const privateRoot = await mkdtemp(path.join(os.tmpdir(), 'pp-3302-'));
  try {
    if (receipt) {
      await mkdir(path.join(privateRoot, 'publication-attempts'));
      await mkdir(path.join(privateRoot, 'coding-attempts'));
      await writeFile(path.join(privateRoot, 'publication-attempts', PUB + '.result.json'),
        JSON.stringify(pub));
      await writeFile(path.join(privateRoot, 'coding-attempts', GRANT + '.result.json'),
        JSON.stringify(prepared));
    }
    return await callback(privateRoot);
  } finally { await rm(privateRoot, { recursive: true, force: true }); }
}
function github({ candidate = pr, workflowRuns = [run], jobList = jobs,
  failAt = null } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    assert.ok(url.startsWith('https://api.github.com/repos/BryanHarrisScripts/PlotPickle/'));
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Authorization, 'Bearer fixture-read-token');
    calls.push(url);
    if (url.includes(failAt || 'never-fail-this')) throw Error('offline credential detail');
    if (url.endsWith('/pulls/4242')) return reply(candidate);
    if (url.includes('/actions/runs?')) return reply({
      total_count: workflowRuns.length, workflow_runs: workflowRuns,
    });
    if (url.endsWith('/actions/runs/1001/jobs?per_page=100')) return reply(jobList);
    throw Error('unexpected endpoint');
  };
  return { fetchImpl, calls };
}
const opts = (privateRoot, fetchImpl, verificationId = VER) => ({
  privateRoot, fetchImpl, publicationId: PUB, verificationId,
  token: 'fixture-read-token', now: () => 1800000000000,
});

test('green hosted CI yields a durable distinct receipt, never Windows acceptance or merge', () =>
  fixture(async privateRoot => {
    const gh = github();
    const result = await collectIndependentVerifierOnce(opts(privateRoot, gh.fetchImpl));
    assert.equal(result.state, 'UNKNOWN');
    assert.equal(result.code, 'CI_PASSED_OWNER_WINDOWS_UNKNOWN');
    assert.equal(result.hostedCiVerified, true);
    assert.equal(result.ownerWindowsVerified, false);
    assert.equal(result.independentVerification, false);
    assert.equal(result.automaticMergeAuthorized, false);
    assert.equal(result.candidateHead, REMOTE);
    assert.equal(result.ciRunId, 1001);
    assert.match(result.receiptId, /^[a-f0-9]{64}$/);
    assert.deepEqual(gh.calls.map(url => url.split('/repos/BryanHarrisScripts/PlotPickle')[1]), [
      '/pulls/4242',
      '/actions/runs?head_sha=' + REMOTE + '&event=pull_request&per_page=100',
      '/actions/runs/1001/jobs?per_page=100',
      '/pulls/4242',
    ]);
    const saved = JSON.parse(await readFile(path.join(privateRoot,
      'verification-attempts', VER + '.result.json'), 'utf8'));
    assert.deepEqual(saved, result);
    const count = gh.calls.length;
    assert.equal((await collectIndependentVerifierOnce(opts(privateRoot, gh.fetchImpl)))
      .code, 'VERIFICATION_ALREADY_RECORDED');
    assert.equal(gh.calls.length, count);
  }));

test('cancelled, timed-out, skipped, missing or duplicated required jobs cannot pass', () => {
  const examples = [
    { ...jobs, jobs: jobs.jobs.map((j, i) => i === 0
      ? { ...j, conclusion: 'skipped' } : j) },
    { ...jobs, jobs: jobs.jobs.map((j, i) => i === 0
      ? { ...j, conclusion: 'cancelled' } : j) },
    { ...jobs, jobs: jobs.jobs.map((j, i) => i === 0
      ? { ...j, conclusion: 'timed_out' } : j) },
    { ...jobs, jobs: jobs.jobs.map((j, i) => i === 0
      ? { ...j, status: 'in_progress', conclusion: null } : j) },
    { total_count: 7, jobs: jobs.jobs.slice(1) },
    { ...jobs, jobs: [...jobs.jobs.slice(0, 6), jobs.jobs[0]] },
  ];
  for (const bad of examples) {
    const outcome = assessHostedCi({ pub, pr, run, jobs: bad });
    assert.equal(outcome.state, 'BLOCKED');
    assert.equal(outcome.hostedCiVerified, false);
  }
});

test('mismatched PR head, run association, stale run and incomplete pagination fail closed', () => {
  const cases = [
    { pr: { ...pr, head: { sha: '4'.repeat(40) } }, run, jobs },
    { pr, run: { ...run, head_sha: SOURCE }, jobs },
    { pr, run: { ...run, pull_requests: [{ number: 9999 }] }, jobs },
    { pr, run: { ...run, conclusion: 'failure' }, jobs },
    { pr, run, jobs: { total_count: 101, jobs: jobs.jobs } },
  ];
  for (const input of cases) {
    assert.equal(assessHostedCi({ pub, ...input }).state, 'BLOCKED');
  }
  assert.equal(assessHostedCi({ pub, pr, run: null, jobs }).state, 'UNKNOWN');
  assert.equal(assessHostedCi({ pub, pr,
    run: { ...run, status: 'in_progress', conclusion: null }, jobs }).state, 'UNKNOWN');
});

test('no engineering receipt means no GitHub calls and no synthetic success', () =>
  fixture(async privateRoot => {
    const gh = github();
    const result = await collectIndependentVerifierOnce(opts(privateRoot, gh.fetchImpl));
    assert.equal(result.code, 'ENGINEERING_RECEIPTS_UNVERIFIABLE');
    assert.equal(gh.calls.length, 0);
  }, { receipt: false }));

test('unavailable GitHub remains durable UNKNOWN, never retried with the same id', () =>
  fixture(async privateRoot => {
    const gh = github({ failAt: '/actions/runs?' });
    const result = await collectIndependentVerifierOnce(opts(privateRoot, gh.fetchImpl));
    assert.equal(result.code, 'GITHUB_READ_UNVERIFIED');
    assert.equal(result.state, 'UNKNOWN');
    assert.equal(result.hostedCiVerified, false);
    assert.equal(result.ownerWindowsVerified, false);
    assert.ok(result.receiptId);
    const count = gh.calls.length;
    assert.equal((await collectIndependentVerifierOnce(opts(privateRoot, gh.fetchImpl)))
      .code, 'VERIFICATION_ALREADY_RECORDED');
    assert.equal(gh.calls.length, count);
  }));

test('latest incomplete run cannot inherit success from an older completed run', () =>
  fixture(async privateRoot => {
    const newer = { ...run, id: 1002, status: 'in_progress', conclusion: null };
    const gh = github({ workflowRuns: [run, newer] });
    const result = await collectIndependentVerifierOnce(opts(privateRoot, gh.fetchImpl));
    assert.equal(result.state, 'UNKNOWN');
    assert.equal(result.code, 'CI_NOT_COMPLETE');
    assert.equal(result.hostedCiVerified, false);
    assert.equal(gh.calls.some(url => url.includes('/jobs?')), false);
  }));

test('new observation uses a new immutable id without replaying publication', () =>
  fixture(async privateRoot => {
    const gh = github();
    const first = await collectIndependentVerifierOnce(opts(privateRoot, gh.fetchImpl));
    const secondId = 'd'.repeat(32);
    const second = await collectIndependentVerifierOnce(
      opts(privateRoot, gh.fetchImpl, secondId));
    assert.equal(first.hostedCiVerified, true);
    assert.equal(second.hostedCiVerified, true);
    assert.notEqual(first.receiptId, second.receiptId);
    assert.equal(second.verificationId, secondId);
    assert.equal(gh.calls.every(url => url.includes('api.github.com')), true);
  }));

test('invalid correlation IDs and mismatched coding receipt cannot contact GitHub', () =>
  fixture(async privateRoot => {
    const gh = github();
    assert.equal((await collectIndependentVerifierOnce({
      ...opts(privateRoot, gh.fetchImpl), verificationId: '../wrong',
    })).code, 'VERIFIER_INPUT_INVALID');
    await writeFile(path.join(privateRoot, 'coding-attempts', GRANT + '.result.json'),
      JSON.stringify({ ...prepared, commit: 'f'.repeat(40) }));
    assert.equal((await collectIndependentVerifierOnce(
      opts(privateRoot, gh.fetchImpl))).code, 'ENGINEERING_RECEIPTS_MISMATCH');
    assert.equal(gh.calls.length, 0);
  }));
