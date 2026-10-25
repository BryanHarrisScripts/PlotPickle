import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { publishAuthorizedDraftOnce, validatePublicationGrant } from '../scripts/engineering-team/gateway/publication/authorized-pr-publish-once.mjs';

const MAIN = 'a'.repeat(40), COMMIT = 'b'.repeat(40);
const TREE = 'c'.repeat(40), REMOTE = 'd'.repeat(40), BASE_TREE = 'e'.repeat(40);
const GRANT_ID = '1'.repeat(32), PUB_ID = '2'.repeat(32);
const TARGET = 'scripts/engineering-team/gateway/example.mjs';
const BRANCH = 'engineering/3142-' + GRANT_ID;
const CONTENT = 'export function calculate() { return 2; }\n';
const BLOB = createHash('sha1').update('blob ' + Buffer.byteLength(CONTENT) + '\0' + CONTENT).digest('hex');
const source = { channel: 'main', head: MAIN };
const at = Date.now();
const grant = { schemaVersion: 1, kind: 'draft-pr-publish-once',
  publicationId: PUB_ID, grantId: GRANT_ID, issueNumber: 3142,
  sourceHead: MAIN, localCommit: COMMIT, branch: BRANCH,
  targetPath: TARGET, expiresAt: at + 600_000,
  maxRequests: 1, consent: 'AUTHORIZE_ONE_DRAFT_ENGINEERING_PR' };
const codingGrant = { schemaVersion: 1, kind: 'engineering-edit-once',
  grantId: GRANT_ID, issueNumber: 3142, sourceHead: MAIN, targetPath: TARGET,
  consent: 'AUTHORIZE_ONE_ENGINEERING_SOURCE_EDIT' };
const prepared = { state: 'LOCAL_COMMIT_PREPARED', code: 'SYNTAX_CHECK_PASSED_TESTS_PENDING',
  sourceMutationVerified: true, focusedTestExecuted: false,
  pullRequestCreated: false, independentVerification: false,
  grantId: GRANT_ID, issueNumber: 3142, sourceHead: MAIN,
  commit: COMMIT, branch: BRANCH };

async function fixture(callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pp-publish-once-'));
  const repoRoot = path.join(root, 'repo');
  const privateRoot = path.join(root, 'private');
  await mkdir(repoRoot);
  await mkdir(path.join(privateRoot, 'coding-worktrees', GRANT_ID), { recursive: true });
  try { return await callback({ repoRoot, privateRoot }); }
  finally { await rm(root, { recursive: true, force: true }); }
}
function gitFixture({ wrongParent = false, wrongPath = false } = {}) {
  const calls = [];
  const git = async (cwd, args) => {
    calls.push(args);
    const key = args.join(' ');
    if (key === 'rev-parse HEAD') return { stdout: COMMIT };
    if (key === 'rev-parse HEAD^') return { stdout: wrongParent ? REMOTE : MAIN };
    if (key === 'branch --show-current') return { stdout: BRANCH };
    if (key.startsWith('status ') || key.startsWith('ls-files ')) return { stdout: '' };
    if (key.startsWith('diff-tree ')) return { stdout: wrongPath ? 'README.md' : TARGET };
    if (key === 'rev-parse HEAD^{tree}') return { stdout: TREE };
    if (key === 'rev-parse HEAD:' + TARGET) return { stdout: BLOB };
    if (key === 'show HEAD:' + TARGET) return { stdout: CONTENT };
    throw Error('unexpected git operation ' + key);
  };
  return { git, calls };
}
function apiFixture({ failAt = '', wrongDraft = false, staleMain = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const route = url.replace('https://api.github.com/repos/BryanHarrisScripts/PlotPickle', '');
    calls.push({ route, method: init.method, body: init.body && JSON.parse(init.body) });
    if (route === failAt) throw Error('uncertain network result');
    let value;
    if (route === '/git/ref/heads/main') value = {
      ref: 'refs/heads/main', object: { sha: staleMain ? REMOTE : MAIN }
    };
    else if (route === '/git/blobs') value = { sha: BLOB };
    else if (route === '/git/commits/' + MAIN) value = { tree: { sha: BASE_TREE } };
    else if (route === '/git/trees') value = { sha: TREE };
    else if (route === '/git/commits') value = {
      sha: REMOTE, tree: { sha: TREE }, parents: [{ sha: MAIN }]
    };
    else if (route === '/git/refs') value = {
      ref: 'refs/heads/' + BRANCH, object: { sha: REMOTE }
    };
    else if (route === '/pulls') value = { number: 77, draft: !wrongDraft,
      state: 'open', head: { ref: BRANCH, sha: REMOTE }, base: { ref: 'main' } };
    else throw Error('unexpected route ' + route);
    return new Response(JSON.stringify(value), { status: init.method === 'POST' ? 201 : 200,
      headers: { 'Content-Type': 'application/json' } });
  };
  return { fetchImpl, calls };
}
const options = (paths, git, fetchImpl) => ({ ...paths, source, grant, codingGrant,
  prepared, token: 'fixture-only-github-token-123456', runGit: git,
  fetchImpl, now: () => at });

test('separate owner grant is exact, scoped and short-lived', () => {
  assert.equal(validatePublicationGrant(grant, prepared, codingGrant, source, at), true);
  for (const change of [{ sourceHead: REMOTE }, { localCommit: MAIN },
    { branch: 'main' }, { targetPath: 'README.md' },
    { maxRequests: 2 }, { expiresAt: at + 1000 },
    { consent: 'AUTHORIZE_ONE_ENGINEERING_SOURCE_EDIT' }, { extra: true }])
    assert.equal(validatePublicationGrant({ ...grant, ...change },
      prepared, codingGrant, source, at), false);
  assert.equal(validatePublicationGrant(grant, { ...prepared, focusedTestExecuted: true },
    codingGrant, source, at), false);
});

test('publisher sends exact committed blob/tree to fixed GitHub API and opens draft PR only', () =>
  fixture(async paths => {
    const { git, calls: gitCalls } = gitFixture(), { fetchImpl, calls } = apiFixture();
    const opts = options(paths, git, fetchImpl);
    const result = await publishAuthorizedDraftOnce(opts);
    assert.equal(result.state, 'DRAFT_PR_CREATED');
    assert.equal(result.localCommit, COMMIT);
    assert.equal(result.remoteCommit, REMOTE);
    assert.equal(result.prNumber, 77);
    assert.equal(result.independentVerification, false);
    assert.equal(result.automaticMergeAuthorized, false);
    assert.equal(calls.filter(x => x.method === 'POST').length, 5);
    assert.equal(calls.at(-1).route, '/pulls');
    assert.equal(calls.at(-1).body.draft, true);
    assert.equal(calls.at(-1).body.head, BRANCH);
    assert.equal(calls.at(-1).body.base, 'main');
    assert.equal(calls.find(x => x.route === '/git/blobs').body.content,
      Buffer.from(CONTENT).toString('base64'));
    assert.equal(gitCalls.some(args => args.includes('push') || args.includes('merge')), false);
    assert.equal((await publishAuthorizedDraftOnce(opts)).code,
      'PUBLISH_ALREADY_RESERVED_OR_UNVERIFIABLE');
    assert.equal(calls.filter(x => x.method === 'POST').length, 5);
    const saved = JSON.parse(await readFile(path.join(paths.privateRoot,
      'publication-attempts', PUB_ID + '.result.json'), 'utf8'));
    assert.equal(saved.state, 'DRAFT_PR_CREATED');
  }));

test('wrong local parent or changed file refuses before any external write', () =>
  fixture(async paths => {
    for (const mode of [{ wrongParent: true }, { wrongPath: true }]) {
      const { git } = gitFixture(mode), { fetchImpl, calls } = apiFixture();
      assert.equal((await publishAuthorizedDraftOnce(options(paths, git, fetchImpl))).code,
        'PUBLISH_STAGED_COMMIT_UNVERIFIABLE');
      assert.equal(calls.length, 0);
    }
  }));

test('remote MAIN drift is held as uncertain without uploading source or retrying', () =>
  fixture(async paths => {
    const { git } = gitFixture(), { fetchImpl, calls } = apiFixture({ staleMain: true });
    const opts = options(paths, git, fetchImpl);
    const result = await publishAuthorizedDraftOnce(opts);
    assert.equal(result.state, 'PUBLISH_STARTED_UNCONFIRMED');
    assert.equal(result.phase, 'CHECK_BASE');
    assert.equal(calls.length, 1);
    assert.equal((await publishAuthorizedDraftOnce(opts)).code,
      'PUBLISH_ALREADY_RESERVED_OR_UNVERIFIABLE');
    assert.equal(calls.length, 1);
  }));

test('ambiguous branch or PR response never replays any GitHub mutation', () =>
  fixture(async paths => {
    const { git } = gitFixture();
    const { fetchImpl, calls } = apiFixture({ failAt: '/git/refs' });
    const opts = options(paths, git, fetchImpl);
    const result = await publishAuthorizedDraftOnce(opts);
    assert.equal(result.state, 'PUBLISH_STARTED_UNCONFIRMED');
    assert.equal(result.phase, 'CREATE_REF');
    assert.equal(calls.filter(x => x.route === '/git/refs').length, 1);
    assert.equal(calls.some(x => x.route === '/pulls'), false);
    assert.equal((await publishAuthorizedDraftOnce(opts)).code,
      'PUBLISH_ALREADY_RESERVED_OR_UNVERIFIABLE');
    assert.equal(calls.filter(x => x.route === '/git/refs').length, 1);
  }));

test('missing publication token denies before staged Git reads', () =>
  fixture(async paths => {
    const { git, calls } = gitFixture();
    const result = await publishAuthorizedDraftOnce({
      ...options(paths, git, apiFixture().fetchImpl), token: '' });
    assert.equal(result.code, 'PUBLISH_HOST_OR_TOKEN_UNAVAILABLE');
    assert.equal(calls.length, 0);
  }));
