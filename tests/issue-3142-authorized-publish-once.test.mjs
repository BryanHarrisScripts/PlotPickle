import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { publishPreparedCommit, validatePublicationGrant } from '../scripts/engineering-team/gateway/authorized-publish-once.mjs';

const MAIN = 'a'.repeat(40), COMMIT = 'b'.repeat(40);
const GRANT_ID = '1'.repeat(32), PUB_ID = '2'.repeat(32);
const TARGET = 'scripts/engineering-team/gateway/example.mjs';
const BRANCH = 'engineering/3142-' + GRANT_ID;
const REF = 'refs/heads/' + BRANCH;
const TOKEN = 'test-only-credential-never-used-12345';
const source = { channel: 'main', head: MAIN };
const grantAt = at => ({ schemaVersion: 1, kind: 'draft-pr-publication-once',
  publicationId: PUB_ID, grantId: GRANT_ID, issueNumber: 3142,
  sourceHead: MAIN, preparedCommit: COMMIT, targetPath: TARGET,
  branch: BRANCH, expiresAt: at + 600_000, maxPushes: 1,
  maxPrRequests: 1, consent: 'AUTHORIZE_ONE_DRAFT_PR_PUBLICATION' });

async function fixture(callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pp-publisher-'));
  const repoRoot = path.join(root, 'repo');
  const privateRoot = path.join(root, 'private');
  await mkdir(repoRoot);
  await mkdir(path.join(privateRoot, 'coding-worktrees', GRANT_ID), { recursive: true });
  await mkdir(path.join(privateRoot, 'coding-attempts'), { recursive: true });
  await mkdir(path.join(privateRoot, 'owner-coding-grants'), { recursive: true });
  await writeFile(path.join(privateRoot, 'owner-coding-grants', GRANT_ID + '.json'),
    JSON.stringify({ grantId: GRANT_ID, targetPath: TARGET,
      issueNumber: 3142, sourceHead: MAIN }));
  await writeFile(path.join(privateRoot, 'coding-attempts', GRANT_ID + '.result.json'),
    JSON.stringify({ state: 'LOCAL_COMMIT_PREPARED', grantId: GRANT_ID,
      issueNumber: 3142, sourceHead: MAIN, commit: COMMIT,
      branch: BRANCH, sourceMutationVerified: true,
      pullRequestCreated: false, independentVerification: false }));
  try { return await callback({ repoRoot, privateRoot }); }
  finally { await rm(root, { recursive: true, force: true }); }
}

function mockedGit({ wrongParent = false, existingRemote = false,
  uncertainPush = false, wrongPushUrl = false, staleMain = false } = {}) {
  const calls = [];
  let pushed = false;
  const git = async (cwd, args) => {
    calls.push(args);
    if (args[0] === 'remote') return { stdout: wrongPushUrl && args.includes('--push')
      ? 'https://github.com/other/repo.git\n'
      : 'https://github.com/BryanHarrisScripts/PlotPickle.git\n' };
    if (args[0] === 'rev-parse') return { stdout: COMMIT + '\n' };
    if (args[0] === 'show') return { stdout: (wrongParent ? COMMIT : MAIN) + '\n' };
    if (args[0] === 'diff-tree') return { stdout: TARGET + '\n' };
    if (args[0] === 'status') return { stdout: '' };
    if (args[0] === 'ls-remote') return {
      stdout: args[3] === 'refs/heads/main'
        ? (staleMain ? COMMIT : MAIN) + '\trefs/heads/main\n'
        : (existingRemote || pushed ? COMMIT + '\t' + REF + '\n' : '')
    };
    if (args.includes('push')) {
      pushed = true;
      if (uncertainPush) throw Error('network lost after push');
      return { stdout: 'ok\n' };
    }
    throw Error('unexpected git operation: ' + args.join(' '));
  };
  return { git, calls };
}
const goodPr = { number: 123, draft: true, state: 'open',
  head: { sha: COMMIT, ref: BRANCH, repo: { full_name: 'BryanHarrisScripts/PlotPickle' } },
  base: { ref: 'main' } };

test('publisher grant is exact, short-lived and cannot widen authority', () => {
  const at = Date.now(), grant = grantAt(at);
  assert.equal(validatePublicationGrant(grant, source, at), true);
  for (const change of [
    { sourceHead: COMMIT }, { preparedCommit: MAIN },
    { targetPath: '.github/workflows/evil.yml' },
    { branch: 'main' }, { maxPushes: 2 }, { maxPrRequests: 2 },
    { expiresAt: at + 1_000 }, { consent: 'AUTHORIZE_ONE_ENGINEERING_SOURCE_EDIT' },
    { publicationId: GRANT_ID }
  ]) assert.equal(validatePublicationGrant({ ...grant, ...change }, source, at), false);
  assert.equal(validatePublicationGrant({ ...grant, extra: 'no' }, source, at), false);
});

test('prepared commit publishes one exact branch and a draft PR, never merges or tests code', () =>
  fixture(async ({ repoRoot, privateRoot }) => {
    const at = Date.now(), { git, calls } = mockedGit();
    const prCalls = [];
    const opts = { repoRoot, privateRoot, source, grant: grantAt(at),
      token: TOKEN, now: () => at, runGit: git,
      createPr: async payload => { prCalls.push(payload); return goodPr; } };
    const result = await publishPreparedCommit(opts);
    assert.equal(result.state, 'DRAFT_PR_CREATED');
    assert.equal(result.commit, COMMIT);
    assert.equal(result.pullRequestNumber, 123);
    assert.equal(result.independentVerification, false);
    assert.equal(result.automaticMergeAuthorized, false);
    assert.equal(prCalls.length, 1);
    assert.equal(prCalls[0].draft, true);
    assert.equal(prCalls[0].head, BRANCH);
    assert.equal(prCalls[0].base, 'main');
    assert.equal(prCalls[0].maintainer_can_modify, false);
    assert.equal(calls.filter(args => args.includes('push')).length, 1);
    assert.equal(calls.some(args => args.some(x => x.startsWith('--force-with-lease='))), true);
    assert.equal(calls.some(args => args.includes('merge') || args.includes('reset')), false);
    assert.equal((await publishPreparedCommit(opts)).code, 'PUBLISH_ALREADY_RESERVED');
    assert.equal(prCalls.length, 1);
    assert.equal(calls.filter(args => args.includes('push')).length, 1);
    const files = await readdir(path.join(privateRoot, 'coding-publications'));
    assert.equal(files.filter(f => f.endsWith('.json')).length, 4);
    const receipt = JSON.parse(await readFile(path.join(privateRoot, 'coding-publications',
      PUB_ID + '.result.json'), 'utf8'));
    assert.equal(receipt.state, 'DRAFT_PR_CREATED');
  }));

test('untrusted commit parent or existing remote branch never reserves or publishes', () =>
  fixture(async ({ repoRoot, privateRoot }) => {
    const at = Date.now();
    for (const setup of [{ wrongParent: true }, { existingRemote: true },
      { wrongPushUrl: true }, { staleMain: true }]) {
      const { git, calls } = mockedGit(setup);
      const result = await publishPreparedCommit({ repoRoot, privateRoot, source,
        grant: grantAt(at), token: TOKEN, now: () => at, runGit: git,
        createPr: async () => { throw Error('must not call'); } });
      assert.equal(result.state, 'BLOCKED');
      assert.equal(calls.some(args => args.includes('push')), false);
    }
    await assert.rejects(readFile(path.join(privateRoot, 'coding-publications',
      PUB_ID + '.reserved.json')));
  }));

test('unknown push result is non-replayable and never opens a PR', () =>
  fixture(async ({ repoRoot, privateRoot }) => {
    const at = Date.now(), { git, calls } = mockedGit({ uncertainPush: true });
    let prs = 0;
    const opts = { repoRoot, privateRoot, source, grant: grantAt(at), token: TOKEN,
      now: () => at, runGit: git, createPr: async () => { prs++; return goodPr; } };
    assert.equal((await publishPreparedCommit(opts)).code, 'PUBLISH_PUSH_OUTCOME_UNCERTAIN');
    assert.equal((await publishPreparedCommit(opts)).code, 'PUBLISH_ALREADY_RESERVED');
    assert.equal(calls.filter(args => args.includes('push')).length, 1);
    assert.equal(prs, 0);
  }));

test('ambiguous PR response cannot trigger another POST', () =>
  fixture(async ({ repoRoot, privateRoot }) => {
    const at = Date.now(), { git, calls } = mockedGit();
    let prs = 0;
    const opts = { repoRoot, privateRoot, source, grant: grantAt(at), token: TOKEN,
      now: () => at, runGit: git, createPr: async () => { prs++; return {
        ...goodPr, draft: false
      }; } };
    assert.equal((await publishPreparedCommit(opts)).code, 'PUBLISH_PR_OUTCOME_UNCERTAIN');
    assert.equal((await publishPreparedCommit(opts)).code, 'PUBLISH_ALREADY_RESERVED');
    assert.equal(prs, 1);
    assert.equal(calls.filter(args => args.includes('push')).length, 1);
    const record = JSON.parse(await readFile(path.join(privateRoot, 'coding-publications',
      PUB_ID + '.pr-attempt.json'), 'utf8'));
    assert.equal(record.state, 'PR_REQUEST_RESERVED_NO_REPLAY');
  }));

test('missing owner token or edited source receipt fails before network', () =>
  fixture(async ({ repoRoot, privateRoot }) => {
    const at = Date.now(), { git, calls } = mockedGit();
    const opts = { repoRoot, privateRoot, source, grant: grantAt(at), token: '',
      now: () => at, runGit: git };
    assert.equal((await publishPreparedCommit(opts)).code, 'PUBLISH_HOST_OR_CREDENTIAL_UNAVAILABLE');
    assert.equal(calls.length, 0);
    await writeFile(path.join(privateRoot, 'coding-attempts', GRANT_ID + '.result.json'),
      JSON.stringify({ state: 'LOCAL_COMMIT_PREPARED', grantId: GRANT_ID,
        issueNumber: 3142, sourceHead: MAIN, commit: COMMIT, branch: BRANCH,
        sourceMutationVerified: false, pullRequestCreated: false,
        independentVerification: false }));
    assert.equal((await publishPreparedCommit({ ...opts, token: TOKEN })).code,
      'PUBLISH_PREPARED_RECEIPT_MISMATCH');
    assert.equal(calls.length, 0);
  }));
