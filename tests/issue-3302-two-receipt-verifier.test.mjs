import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  engineeringReceiptFor, issueEngineeringReceiptOnce,
  ownerWitnessPayload, verifyOwnerWitness,
  collectGitHubChecks, issueVerifierReceiptOnce,
} from '../scripts/engineering-team/gateway/verification/two-receipt-verifier.mjs';

const REQUEST = 'a'.repeat(32), PUBLICATION = 'b'.repeat(32), ATTEMPT = 'c'.repeat(32);
const SOURCE = '1'.repeat(40), LOCAL = '2'.repeat(40), REMOTE = '3'.repeat(40);
const TREE = '4'.repeat(40), CONTENT = '5'.repeat(64), NOW = 1800000000000;
const BRANCH = 'engineering/3142-' + REQUEST;
const TARGET = 'scripts/engineering-team/gateway/example.mjs';
const TEST = 'tests/issue-3142-authorized-coding-once.test.mjs';
const grant = { schemaVersion: 1, kind: 'engineering-edit-once',
  grantId: REQUEST, issueNumber: 3142, sourceHead: SOURCE, targetPath: TARGET,
  focusedTest: TEST, maxRequests: 1, consent: 'AUTHORIZE_ONE_ENGINEERING_SOURCE_EDIT' };
const edit = { state: 'LOCAL_COMMIT_PREPARED', code: 'SYNTAX_CHECK_PASSED_TESTS_PENDING',
  sourceMutationVerified: true, focusedTestExecuted: false,
  independentVerification: false, pullRequestCreated: false,
  commit: LOCAL, sourceHead: SOURCE, grantId: REQUEST, issueNumber: 3142,
  focusedTest: TEST, branch: BRANCH };
const publicationGrant = { schemaVersion: 1, kind: 'draft-pr-publish-once',
  publicationId: PUBLICATION, grantId: REQUEST, issueNumber: 3142,
  sourceHead: SOURCE, targetPath: TARGET, localCommit: LOCAL, branch: BRANCH,
  maxRequests: 1, consent: 'AUTHORIZE_ONE_DRAFT_ENGINEERING_PR' };
const reservation = { grantId: REQUEST, sourceHead: SOURCE,
  localCommit: LOCAL, tree: TREE, contentDigest: CONTENT };
const published = { state: 'DRAFT_PR_CREATED', pullRequestCreated: true,
  independentVerification: false, automaticMergeAuthorized: false,
  grantId: REQUEST, publicationId: PUBLICATION, issueNumber: 3142,
  sourceHead: SOURCE, localCommit: LOCAL, tree: TREE, branch: BRANCH,
  remoteCommit: REMOTE, prNumber: 4242 };
const receipt = () => engineeringReceiptFor({ requestId: REQUEST, grant, edit,
  publicationGrant, reservation, published, at: NOW });
const layers = [
  'Layer 1 Experience Skins', 'Layer 2 Experience Contract',
  'Layer 3 Production Orchestration', 'Layer 4 Agent & Skill Mesh',
  'Layer 5 Story / Canon / Evidence', 'Layer 6 Provider Runtime',
  'Layer 7 Validation & Operations',
];
const jobList = () => ({
  total_count: 8,
  jobs: [
    ...layers.map((name, i) => ({ id: i + 1, name,
      status: 'completed', conclusion: 'success' })),
    { id: 8, name: 'Windows owned verifier STOP and sentinel proof',
      status: 'completed', conclusion: 'success',
      steps: [{ name: 'Verify owner-authorized coding worker on exact-head native Windows',
        status: 'completed', conclusion: 'success' }] },
  ],
});
const reply = value => new Response(JSON.stringify(value), {
  status: 200, headers: { 'content-type': 'application/json' },
});
function fakeGithub({ bad = null } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer fixture-token-1234567890');
    calls.push(url);
    if (bad === 'network') throw Error('secret internal network error');
    if (url.endsWith('/pulls/4242')) return reply({
      state: 'open', draft: true,
      head: { sha: bad === 'head' ? SOURCE : REMOTE, ref: BRANCH,
        repo: { full_name: 'BryanHarrisScripts/PlotPickle' } },
      base: { ref: 'main', sha: SOURCE },
    });
    if (url.endsWith('/git/commits/' + REMOTE)) return reply({
      tree: { sha: TREE }, parents: [{ sha: SOURCE }],
    });
    if (url.includes('/actions/runs?')) return reply({
      total_count: 1, workflow_runs: [{
        name: 'Architecture Verification', event: 'pull_request',
        head_sha: REMOTE, run_attempt: 1, id: 1001,
        status: 'completed', conclusion: 'success',
      }],
    });
    if (url.endsWith('/actions/runs/1001/jobs?per_page=100')) {
      const jobs = jobList();
      if (bad === 'skip') jobs.jobs[0].conclusion = 'skipped';
      if (bad === 'cancel') jobs.jobs[0].conclusion = 'cancelled';
      if (bad === 'timeout') jobs.jobs[0].conclusion = 'timed_out';
      if (bad === 'native') jobs.jobs[7].steps[0].conclusion = 'failure';
      return reply(jobs);
    }
    throw Error('unexpected route');
  };
  return { fetchImpl, calls };
}
async function fixture(callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pp-3302-two-receipt-'));
  try { return await callback(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}
async function seedEngineering(root) {
  const files = [
    ['owner-coding-grants', REQUEST + '.json', grant],
    ['coding-attempts', REQUEST + '.result.json', edit],
    ['owner-publication-grants', PUBLICATION + '.json', publicationGrant],
    ['publication-attempts', PUBLICATION + '.reserved.json', reservation],
    ['publication-attempts', PUBLICATION + '.result.json', published],
  ];
  for (const [folder, filename, value] of files) {
    await mkdir(path.join(root, folder), { recursive: true });
    await writeFile(path.join(root, folder, filename), JSON.stringify(value));
  }
}
function witnessFor(engineering, privateKey) {
  const witness = { schemaVersion: 1, kind: 'owner-windows-verification',
    receiptId: 'd'.repeat(32), requestId: REQUEST, issueNumber: 3142,
    sourceHead: SOURCE, candidateHead: REMOTE, prNumber: 4242,
    proofDigest: 'e'.repeat(64), observedAt: NOW, state: 'PASS' };
  const signature = sign(null, Buffer.from(ownerWitnessPayload(witness)),
    privateKey).toString('base64');
  return { ...witness, signature };
}

test('engineering receipt binds all private grant/edit/publication identities, never claims tests or merge', () => {
  const result = receipt();
  assert.equal(result.state, 'SOURCE_COMMITTED_AND_PR_PUBLISHED');
  assert.equal(result.sourceHead, SOURCE);
  assert.equal(result.candidateHead, REMOTE);
  assert.equal(result.focusedTestExecuted, false);
  assert.equal(result.independentlyVerified, false);
  assert.equal(result.automaticMergeAuthorized, false);
  assert.match(result.receiptId, /^[a-f0-9]{64}$/);
  assert.equal(engineeringReceiptFor({ requestId: REQUEST, grant, edit,
    publicationGrant, reservation, published: { ...published, remoteCommit: 'bad' },
    at: NOW }), null);
  assert.equal(engineeringReceiptFor({ requestId: REQUEST, grant,
    edit: { ...edit, focusedTestExecuted: true }, publicationGrant, reservation,
    published, at: NOW }), null);
});

test('engineering receipt is durable write-once and rejects duplicate publication', () =>
  fixture(async root => {
    await seedEngineering(root);
    const result = await issueEngineeringReceiptOnce({
      privateRoot: root, requestId: REQUEST, publicationId: PUBLICATION,
      now: () => NOW,
    });
    assert.equal(result.state, 'SOURCE_COMMITTED_AND_PR_PUBLISHED');
    const saved = JSON.parse(await readFile(path.join(root, 'engineering-receipts',
      REQUEST + '.json'), 'utf8'));
    assert.deepEqual(saved, result);
    assert.equal((await issueEngineeringReceiptOnce({
      privateRoot: root, requestId: REQUEST, publicationId: PUBLICATION,
      now: () => NOW,
    })).code, 'ENGINEERING_RECEIPT_ALREADY_ISSUED_OR_UNVERIFIABLE');
  }));

test('owner Windows Ed25519 witness requires independent private key and exact source', () => {
  const engineering = receipt();
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
  const witness = witnessFor(engineering, privateKey);
  assert.equal(verifyOwnerWitness(witness, engineering, publicPem, NOW), true);
  assert.equal(verifyOwnerWitness({ ...witness, proofDigest: 'f'.repeat(64) },
    engineering, publicPem, NOW), false);
  assert.equal(verifyOwnerWitness({ ...witness, candidateHead: SOURCE },
    engineering, publicPem, NOW), false);
  assert.equal(verifyOwnerWitness(witness, engineering, publicPem, NOW + 8 * 86400000), false);
  assert.equal(verifyOwnerWitness(witness, engineering, null, NOW), false);
});

test('hosted CI reads fixed GitHub endpoints, requires all seven layers and native Windows step', async () => {
  const gh = fakeGithub();
  const result = await collectGitHubChecks(receipt(), {
    token: 'fixture-token-1234567890', fetchImpl: gh.fetchImpl,
  });
  assert.equal(result.state, 'PASS');
  assert.equal(result.code, 'EXACT_HEAD_HOSTED_CI_VERIFIED');
  assert.equal(result.candidateHead, REMOTE);
  assert.equal(gh.calls.length, 4);
  assert.equal(gh.calls.every(x => x.startsWith(
    'https://api.github.com/repos/BryanHarrisScripts/PlotPickle/')), true);
});

test('skipped, cancelled, timed-out, mismatched and missing Windows jobs cannot pass', async () => {
  for (const bad of ['skip', 'cancel', 'timeout', 'head', 'native', 'network']) {
    const gh = fakeGithub({ bad });
    const result = await collectGitHubChecks(receipt(), {
      token: 'fixture-token-1234567890', fetchImpl: gh.fetchImpl,
    });
    assert.notEqual(result.state, 'PASS', bad);
    assert.ok(result.code);
  }
  const gh = fakeGithub();
  assert.equal((await collectGitHubChecks(receipt(), {
    token: '', fetchImpl: gh.fetchImpl,
  })).code, 'VERIFIER_TOKEN_REQUIRED');
  assert.equal(gh.calls.length, 0);
});

test('two distinct immutable receipts: missing witness blocks; signed independent witness passes without merge', () =>
  fixture(async root => {
    await seedEngineering(root);
    const engineering = await issueEngineeringReceiptOnce({
      privateRoot: root, requestId: REQUEST, publicationId: PUBLICATION,
      now: () => NOW,
    });
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
    const gh = fakeGithub();
    const first = await issueVerifierReceiptOnce({
      privateRoot: root, requestId: REQUEST, attemptId: ATTEMPT,
      token: 'fixture-token-1234567890', fetchImpl: gh.fetchImpl,
      witness: null, witnessPublicKey: publicPem, now: () => NOW,
    });
    assert.equal(first.state, 'BLOCKED');
    assert.equal(first.code, 'OWNER_WINDOWS_EVIDENCE_MISSING_OR_INVALID');
    assert.equal(first.automaticMergeAuthorized, false);
    const count = gh.calls.length;
    assert.equal((await issueVerifierReceiptOnce({
      privateRoot: root, requestId: REQUEST, attemptId: ATTEMPT,
      token: 'fixture-token-1234567890', fetchImpl: gh.fetchImpl,
      witness: witnessFor(engineering, privateKey),
      witnessPublicKey: publicPem, now: () => NOW,
    })).code, 'VERIFIER_ATTEMPT_ALREADY_RESERVED');
    assert.equal(gh.calls.length, count);
    const second = await issueVerifierReceiptOnce({
      privateRoot: root, requestId: REQUEST, attemptId: 'f'.repeat(32),
      token: 'fixture-token-1234567890', fetchImpl: gh.fetchImpl,
      witness: witnessFor(engineering, privateKey),
      witnessPublicKey: publicPem, now: () => NOW,
    });
    assert.equal(second.state, 'INDEPENDENTLY_VERIFIED');
    assert.equal(second.ownerWindowsProven, true);
    assert.equal(second.independentlyVerified, true);
    assert.equal(second.automaticMergeAuthorized, false);
    assert.notEqual(second.receiptId, engineering.receiptId);
    const saved = JSON.parse(await readFile(path.join(root, 'verification-receipts',
      'f'.repeat(32) + '.result.json'), 'utf8'));
    assert.deepEqual(saved, second);
  }));
