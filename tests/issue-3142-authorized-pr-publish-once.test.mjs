import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { publishAuthorizedDraftOnce, validatePublicationGrant } from
  '../scripts/engineering-team/gateway/authorized-pr-publish-once.mjs';
import { runOwnerCodingAndPublishOnce } from '../scripts/engineering-team/gateway/authorized-coding-once.mjs';

const exec = promisify(execFile);
const ISSUE = 3142;
const ID = 'a'.repeat(32);
const PUB = 'b'.repeat(32);
const REMOTE = 'e'.repeat(40);
const FILE = 'scripts/engineering-team/gateway/example.mjs';
const TARGET = 'tests/issue-3142-authorized-coding-once.test.mjs';
const ORIGINAL = 'export function calculate() { return 1; }\n';
const EDITED = 'export function calculate() { return 2; }\n';
const TOKEN = 'fixture-token-not-a-real-secret';
const reply = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json' },
});
async function fixture(callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pp-publish-once-'));
  const repoRoot = path.join(root, 'repo'), privateRoot = path.join(root, 'private');
  const git = async (cwd, args) => exec('git', args, { cwd, timeout: 15_000 });
  try {
    await mkdir(path.dirname(path.join(repoRoot, FILE)), { recursive: true });
    await mkdir(path.dirname(path.join(repoRoot, TARGET)), { recursive: true });
    await writeFile(path.join(repoRoot, FILE), ORIGINAL);
    await writeFile(path.join(repoRoot, TARGET), 'export {};\n');
    await git(repoRoot, ['init', '-q', '-b', 'main']);
    await git(repoRoot, ['config', 'user.name', 'Fixture Publisher']);
    await git(repoRoot, ['config', 'user.email', 'fixture@invalid.test']);
    await git(repoRoot, ['add', '--', FILE, TARGET]);
    await git(repoRoot, ['-c', 'commit.gpgSign=false', 'commit', '-qm', 'fixture main']);
    const head = (await git(repoRoot, ['rev-parse', 'HEAD'])).stdout.trim();
    const branch = 'engineering/' + ISSUE + '-' + ID;
    const stage = path.join(privateRoot, 'coding-worktrees', ID);
    await mkdir(path.dirname(stage), { recursive: true });
    await git(repoRoot, ['worktree', 'add', '--detach', stage, head]);
    await git(stage, ['switch', '-c', branch]);
    await writeFile(path.join(stage, FILE), EDITED);
    await git(stage, ['add', '--', FILE]);
    await git(stage, ['-c', 'commit.gpgSign=false', 'commit', '-qm', 'fixture coding edit']);
    const localCommit = (await git(stage, ['rev-parse', 'HEAD'])).stdout.trim();
    const tree = (await git(stage, ['rev-parse', 'HEAD^{tree}'])).stdout.trim();
    const blob = (await git(stage, ['rev-parse', 'HEAD:' + FILE])).stdout.trim();
    const baseTree = (await git(repoRoot, ['rev-parse', 'HEAD^{tree}'])).stdout.trim();
    const grant = { schemaVersion: 1, kind: 'draft-pr-publish-once',
      publicationId: PUB, grantId: ID, issueNumber: ISSUE, sourceHead: head,
      localCommit, branch, targetPath: FILE, expiresAt: Date.now() + 600_000,
      maxRequests: 1, consent: 'AUTHORIZE_ONE_DRAFT_ENGINEERING_PR' };
    const codingGrant = { schemaVersion: 1, kind: 'engineering-edit-once',
      grantId: ID, issueNumber: ISSUE, sourceHead: head, targetPath: FILE,
      consent: 'AUTHORIZE_ONE_ENGINEERING_SOURCE_EDIT' };
    const prepared = { state: 'LOCAL_COMMIT_PREPARED',
      code: 'SYNTAX_CHECK_PASSED_TESTS_PENDING', grantId: ID,
      issueNumber: ISSUE, sourceHead: head, commit: localCommit,
      branch, sourceMutationVerified: true, focusedTestExecuted: false,
      pullRequestCreated: false, independentVerification: false,
      automaticMergeAuthorized: false };
    return await callback({ repoRoot, privateRoot, stage, source: { channel: 'main', head },
      grant, codingGrant, prepared, tree, blob, baseTree, localCommit, git });
  } finally { await rm(root, { recursive: true, force: true }); }
}
function fakeGitHub(f, { stale = false, wrongBlob = false, wrongTree = false,
  failAt = null } = {}) {
  const calls = [];
  let mainGets = 0;
  const fetchImpl = async (url, options) => {
    const prefix = 'https://api.github.com/repos/BryanHarrisScripts/PlotPickle';
    assert.ok(url.startsWith(prefix));
    const route = url.slice(prefix.length), method = options.method;
    assert.equal(options.headers.Authorization, 'Bearer ' + TOKEN);
    assert.equal(options.signal?.aborted, false);
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ method, route, body });
    if (failAt === route) throw Error('disconnected response');
    if (method === 'GET' && route === '/git/ref/heads/main') {
      mainGets++;
      return reply({ ref: 'refs/heads/main',
        object: { sha: stale && mainGets === 1 ? 'd'.repeat(40) : f.source.head } });
    }
    if (method === 'POST' && route === '/git/blobs') {
      assert.equal(body.encoding, 'base64');
      const committed = (await f.git(f.stage, ['show', 'HEAD:' + FILE])).stdout;
      assert.equal(Buffer.from(body.content, 'base64').toString('utf8'), committed);
      return reply({ sha: wrongBlob ? 'c'.repeat(40) : f.blob }, 201);
    }
    if (method === 'GET' && route === '/git/commits/' + f.source.head)
      return reply({ tree: { sha: f.baseTree } });
    if (method === 'POST' && route === '/git/trees') {
      assert.equal(body.base_tree, f.baseTree);
      assert.deepEqual(body.tree, [{ path: FILE, mode: '100644', type: 'blob', sha: f.blob }]);
      return reply({ sha: wrongTree ? 'c'.repeat(40) : f.tree }, 201);
    }
    if (method === 'POST' && route === '/git/commits') {
      assert.deepEqual(body.parents, [f.source.head]);
      assert.equal(body.tree, f.tree);
      return reply({ sha: REMOTE, tree: { sha: f.tree },
        parents: [{ sha: f.source.head }] }, 201);
    }
    if (method === 'POST' && route === '/git/refs') {
      assert.deepEqual(body, { ref: 'refs/heads/' + f.grant.branch, sha: REMOTE });
      return reply({ ref: body.ref, object: { sha: REMOTE } }, 201);
    }
    if (method === 'POST' && route === '/pulls') {
      assert.equal(body.draft, true);
      assert.equal(body.head, f.grant.branch);
      assert.equal(body.base, 'main');
      assert.match(body.title, /owner-authorized/);
      assert.doesNotMatch(body.body, /fixture-token/);
      return reply({ number: 4242, draft: true, state: 'open',
        head: { ref: f.grant.branch, sha: REMOTE }, base: { ref: 'main' } }, 201);
    }
    throw Error('unexpected GitHub request ' + method + ' ' + route);
  };
  return { calls, fetchImpl };
}
function options(f, fetchImpl) {
  return { ...f, token: TOKEN, fetchImpl, now: () => Date.now() };
}

test('publisher requires separate exact-commit owner authorization; invalid grants never contact GitHub', () =>
  fixture(async f => {
    const gh = fakeGitHub(f), at = Date.now();
    assert.equal(validatePublicationGrant(f.grant, f.prepared, f.codingGrant, f.source, at), true);
    const invalid = [
      { ...f.grant, localCommit: 'c'.repeat(40) },
      { ...f.grant, targetPath: '.github/workflows/publish.yml' },
      { ...f.grant, consent: 'AUTHORIZE_ONE_ENGINEERING_SOURCE_EDIT' },
      { ...f.grant, branch: 'main' },
      { ...f.grant, expiresAt: at + 1000 },
      { ...f.grant, maxRequests: 2 },
    ];
    for (const grant of invalid) {
      const r = await publishAuthorizedDraftOnce({ ...options(f, gh.fetchImpl), grant });
      assert.equal(r.state, 'BLOCKED');
    }
    assert.equal((await publishAuthorizedDraftOnce({ ...options(f, gh.fetchImpl),
      prepared: { ...f.prepared, independentVerification: true } })).state, 'BLOCKED');
    assert.equal(gh.calls.length, 0);
  }));

test('native Git prepared commit publishes exactly one draft PR matching source tree; never merge', () =>
  fixture(async f => {
    const gh = fakeGitHub(f);
    const result = await publishAuthorizedDraftOnce(options(f, gh.fetchImpl));
    assert.equal(result.state, 'DRAFT_PR_CREATED');
    assert.equal(result.localCommit, f.localCommit);
    assert.equal(result.remoteCommit, REMOTE);
    assert.equal(result.tree, f.tree);
    assert.equal(result.prNumber, 4242);
    assert.equal(result.pullRequestCreated, true);
    assert.equal(result.independentVerification, false);
    assert.equal(result.automaticMergeAuthorized, false);
    assert.equal((await f.git(f.repoRoot, ['status', '--porcelain'])).stdout.trim(), '');
    assert.equal(await readFile(path.join(f.repoRoot, FILE), 'utf8'), ORIGINAL);
    assert.deepEqual(gh.calls.map(x => x.method + ' ' + x.route), [
      'GET /git/ref/heads/main', 'POST /git/blobs',
      'GET /git/commits/' + f.source.head, 'POST /git/trees',
      'POST /git/commits', 'POST /git/refs',
      'GET /git/ref/heads/main', 'POST /pulls',
    ]);
    assert.equal(gh.calls.some(x => /merge|DELETE|PATCH|PUT/.test(x.method + x.route)), false);
    const saved = JSON.parse(await readFile(path.join(f.privateRoot, 'publication-attempts',
      PUB + '.result.json'), 'utf8'));
    assert.equal(saved.state, 'DRAFT_PR_CREATED');
    assert.equal((await publishAuthorizedDraftOnce(options(f, gh.fetchImpl))).code,
      'PUBLISH_ALREADY_RESERVED_OR_UNVERIFIABLE');
    assert.equal(gh.calls.length, 8);
  }));

test('stale remote MAIN consumes one publication reservation but creates no object or PR', () =>
  fixture(async f => {
    const gh = fakeGitHub(f, { stale: true });
    const first = await publishAuthorizedDraftOnce(options(f, gh.fetchImpl));
    assert.equal(first.state, 'PUBLISH_STARTED_UNCONFIRMED');
    assert.equal(first.phase, 'CHECK_BASE');
    assert.deepEqual(gh.calls.map(x => x.method), ['GET']);
    assert.equal((await publishAuthorizedDraftOnce(options(f, gh.fetchImpl))).code,
      'PUBLISH_ALREADY_RESERVED_OR_UNVERIFIABLE');
    assert.equal(gh.calls.length, 1);
  }));

test('mismatched GitHub object identity blocks draft publication without silently promoting success', () =>
  fixture(async f => {
    const gh = fakeGitHub(f, { wrongTree: true });
    const r = await publishAuthorizedDraftOnce(options(f, gh.fetchImpl));
    assert.equal(r.state, 'PUBLISH_STARTED_UNCONFIRMED');
    assert.equal(r.phase, 'CREATE_TREE');
    assert.equal(gh.calls.some(x => x.route === '/pulls'), false);
  }));

test('unknown GitHub PR-create outcome is durable and never blindly retried or deleted', () =>
  fixture(async f => {
    const gh = fakeGitHub(f, { failAt: '/pulls' });
    const r = await publishAuthorizedDraftOnce(options(f, gh.fetchImpl));
    assert.equal(r.state, 'PUBLISH_STARTED_UNCONFIRMED');
    assert.equal(r.phase, 'CREATE_DRAFT_PR');
    assert.equal(r.pullRequestCreated, false);
    const count = gh.calls.length;
    assert.equal(count, 8);
    assert.equal((await publishAuthorizedDraftOnce(options(f, gh.fetchImpl))).code,
      'PUBLISH_ALREADY_RESERVED_OR_UNVERIFIABLE');
    assert.equal(gh.calls.length, count);
  }));

test('modified, detached or unexpectedly dirty coding stage cannot publish', () =>
  fixture(async f => {
    const gh = fakeGitHub(f);
    await writeFile(path.join(f.stage, FILE), 'tampered but uncommitted\n');
    const r = await publishAuthorizedDraftOnce(options(f, gh.fetchImpl));
    assert.equal(r.code, 'PUBLISH_STAGED_COMMIT_UNVERIFIABLE');
    assert.equal(gh.calls.length, 0);
  }));

test('one invocation can hand off an authorized prepared commit to separate publication without manual steps', async () => {
  let coding = 0, publishing = 0;
  const options = {
    grantId: ID, publicationId: PUB,
    code: async ({ grantId }) => {
      assert.equal(grantId, ID);
      coding++;
      return { state: 'LOCAL_COMMIT_PREPARED' };
    },
    publish: async ({ publicationId }) => {
      assert.equal(publicationId, PUB);
      publishing++;
      return { state: 'DRAFT_PR_CREATED', automaticMergeAuthorized: false };
    },
  };
  assert.equal((await runOwnerCodingAndPublishOnce(options)).state, 'DRAFT_PR_CREATED');
  assert.equal(coding, 1);
  assert.equal(publishing, 1);
  const blocked = await runOwnerCodingAndPublishOnce({
    ...options, code: async () => ({ state: 'BLOCKED', code: 'OWNER_GRANT_REQUIRED' }),
  });
  assert.equal(blocked.state, 'BLOCKED');
  assert.equal(publishing, 1);
  assert.equal((await runOwnerCodingAndPublishOnce({
    ...options, publicationId: 'bad',
  })).code, 'CODING_AND_PUBLISH_GRANT_IDS_REQUIRED');
  assert.equal(coding, 1);
});
