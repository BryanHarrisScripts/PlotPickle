import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, lstat, readFile, writeFile, unlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { boundedSourceEdit, runAuthorizedCodingOnce as runCodingNative, validateCodingGrant } from '../scripts/engineering-team/gateway/authorized-coding-once.mjs';

const HEAD = 'a'.repeat(40);
const COMMIT = 'b'.repeat(40);
const ORIGINAL = 'export function calculate() { return 1; }\n';
const TARGET = 'scripts/engineering-team/gateway/example.mjs';
const TEST_FILE = 'tests/issue-3142-authorized-coding-once.test.mjs';
const digest = s => createHash('sha256').update(s).digest('hex');
const source = { head: HEAD, channel: 'main' };
// Disposable fixtures inject disk evidence; production uses native statfs.
const diskReady = async () => ({ bavail: 20n * 1024n ** 3n, bsize: 1n });
const runAuthorizedCodingOnce = options => runCodingNative({
  ...options, checkCapacity: options.checkCapacity || diskReady,
});
const makeGrant = at => ({ schemaVersion: 1, kind: 'engineering-edit-once',
  grantId: '1'.repeat(32), issueNumber: 3142, sourceHead: HEAD,
  targetPath: TARGET, targetDigest: digest(ORIGINAL), focusedTest: TEST_FILE,
  objective: 'Correct the returned calculation without changing unrelated code.',
  model: 'gpt-6', maxOutputTokens: 1024, expiresAt: at + 600_000,
  maxRequests: 1, consent: 'AUTHORIZE_ONE_ENGINEERING_SOURCE_EDIT' });
const work = async callback => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pp-coding-once-'));
  const repoRoot = path.join(root, 'repo');
  const privateRoot = path.join(root, 'private');
  await mkdir(path.dirname(path.join(repoRoot, TARGET)), { recursive: true });
  await mkdir(path.dirname(path.join(repoRoot, TEST_FILE)), { recursive: true });
  await writeFile(path.join(repoRoot, TARGET), ORIGINAL);
  await writeFile(path.join(repoRoot, TEST_FILE), 'export {};\n');
  try { return await callback({ repoRoot, privateRoot }); }
  finally { await rm(root, { recursive: true, force: true }); }
};

test('grant refuses stale source, path traversal, scope widening and stale expiry', () => {
  const at = Date.now();
  const grant = makeGrant(at);
  assert.equal(validateCodingGrant(grant, source, at), true);
  assert.equal(validateCodingGrant({ ...grant, sourceHead: 'b'.repeat(40) }, source, at), false);
  assert.equal(validateCodingGrant({ ...grant, targetPath: '../outside.mjs' }, source, at), false);
  assert.equal(validateCodingGrant({ ...grant, targetPath: '.github/workflows/x.yml' }, source, at), false);
  assert.equal(validateCodingGrant({ ...grant, maxRequests: 2 }, source, at), false);
  assert.equal(validateCodingGrant({ ...grant, expiresAt: at + 1000 }, source, at), false);
  assert.equal(validateCodingGrant({ ...grant, objective: 'sk-secret-secret-secret-secret' }, source, at), false);
});

test('proposed edit must replace exactly one bounded substring', () => {
  assert.equal(boundedSourceEdit('alpha beta alpha beta', { oldText: 'alpha beta', newText: 'foo' }), null);
  assert.equal(boundedSourceEdit(ORIGINAL, { oldText: 'return 1;', newText: 'return 2;' }),
    ORIGINAL.replace('return 1;', 'return 2;'));
  assert.equal(boundedSourceEdit(ORIGINAL, { oldText: 'return 3;', newText: 'return 2;' }), null);
  assert.equal(boundedSourceEdit(ORIGINAL, { oldText: 'return 1;', newText: 'return 1;' }), null);
});

test('one owner-granted edit creates isolated local commit, never runs generated code or merges', () =>
  work(async ({ repoRoot, privateRoot }) => {
    const at = Date.now();
    const grant = makeGrant(at);
    const gitCalls = [], syntaxCalls = [];
    let edits = 0;
    const git = async (cwd, args) => {
      gitCalls.push(args);
      if (args[0] === 'worktree') {
        const stage = args[3];
        await mkdir(path.dirname(path.join(stage, TARGET)), { recursive: true });
        await writeFile(path.join(stage, TARGET), ORIGINAL);
      }
      if (args[0] === 'diff' && args[1] === '--name-only') return { stdout: TARGET + '\n' };
      if (args[0] === 'rev-parse') return { stdout: COMMIT + '\n' };
      return { stdout: '' };
    };
    const options = { repoRoot, privateRoot, source, grant, credential: 'fake-test-key-not-real-123456',
      now: () => at, runGit: git, checkSyntax: async (cwd, file) => {
        syntaxCalls.push(file);
        assert.match(await readFile(file, 'utf8'), /return 2;/);
      },
      requestEdit: async () => { edits++; return { oldText: 'return 1;', newText: 'return 2;' }; } };
    const result = await runAuthorizedCodingOnce(options);
    assert.equal(result.state, 'LOCAL_COMMIT_PREPARED');
    assert.equal(result.commit, COMMIT);
    assert.equal(result.focusedTestExecuted, false);
    assert.equal(result.pullRequestCreated, false);
    assert.equal(result.independentVerification, false);
    assert.equal(edits, 1);
    assert.equal(syntaxCalls.length, 1);
    assert.equal(gitCalls.some(a => a.includes('merge') || a.includes('push')), false);
    assert.equal((await runAuthorizedCodingOnce(options)).code, 'CODING_ALREADY_RESERVED_OR_UNVERIFIABLE');
    assert.equal(edits, 1);
    assert.equal((await readFile(path.join(repoRoot, TARGET), 'utf8')), ORIGINAL);
  }));

test('failed model edit is held for inspection and cannot be replayed', () =>
  work(async ({ repoRoot, privateRoot }) => {
    const at = Date.now();
    const grant = makeGrant(at);
    const git = async (cwd, args) => {
      if (args[0] === 'worktree') {
        const stage = args[3];
        await mkdir(path.dirname(path.join(stage, TARGET)), { recursive: true });
        await writeFile(path.join(stage, TARGET), ORIGINAL);
      }
      return { stdout: '' };
    };
    const options = { repoRoot, privateRoot, source, grant, credential: 'fake-test-key-not-real-123456',
      now: () => at, runGit: git, requestEdit: async () => ({ oldText: 'missing old code', newText: 'something' }) };
    const result = await runAuthorizedCodingOnce(options);
    assert.equal(result.code, 'CODING_OUTCOME_UNCERTAIN_REVIEW_STAGE');
    assert.equal(result.phase, 'VALIDATE_MODEL_EDIT');
    assert.equal((await runAuthorizedCodingOnce(options)).code, 'CODING_ALREADY_RESERVED_OR_UNVERIFIABLE');
    const saved = JSON.parse(await readFile(path.join(privateRoot, 'coding-attempts',
      grant.grantId + '.result.json'), 'utf8'));
    assert.equal(saved.phase, 'VALIDATE_MODEL_EDIT');
  }));

test('a failed model request records only a fixed phase and preserves non-replay', () =>
  work(async ({ repoRoot, privateRoot }) => {
    const at = Date.now();
    const grant = makeGrant(at);
    const credential = 'fake-test-key-not-real-123456';
    let modelCalls = 0;
    const git = async (cwd, args) => {
      if (args[0] === 'worktree') {
        const stage = args[3];
        await mkdir(path.dirname(path.join(stage, TARGET)), { recursive: true });
        await writeFile(path.join(stage, TARGET), ORIGINAL);
      }
      return { stdout: '' };
    };
    const options = { repoRoot, privateRoot, source, grant, credential, now: () => at,
      runGit: git, requestEdit: async () => {
        modelCalls++;
        throw Error('SECRET_MODEL_PAYLOAD_AND_HOST_PATH');
      } };
    const first = await runAuthorizedCodingOnce(options);
    assert.equal(first.state, 'BLOCKED');
    assert.equal(first.code, 'CODING_OUTCOME_UNCERTAIN_REVIEW_STAGE');
    assert.equal(first.phase, 'REQUEST_MODEL');
    assert.equal((await runAuthorizedCodingOnce(options)).code,
      'CODING_ALREADY_RESERVED_OR_UNVERIFIABLE');
    assert.equal(modelCalls, 1);
    const receiptText = await readFile(path.join(privateRoot, 'coding-attempts',
      grant.grantId + '.result.json'), 'utf8');
    assert.equal(JSON.parse(receiptText).phase, 'REQUEST_MODEL');
    assert.doesNotMatch(receiptText, /SECRET_MODEL|fake-test-key|privateRoot/);
  }));

test('coding worker requests strict structured JSON edits from the Responses API', () =>
  work(async ({ repoRoot, privateRoot }) => {
    const at = Date.now();
    const grant = makeGrant(at);
    const git = async (cwd, args) => {
      if (args[0] === 'worktree') {
        const stage = args[3];
        await mkdir(path.dirname(path.join(stage, TARGET)), { recursive: true });
        await writeFile(path.join(stage, TARGET), ORIGINAL);
      }
      if (args[0] === 'diff' && args[1] === '--name-only')
        return { stdout: TARGET + '\n' };
      if (args[0] === 'rev-parse') return { stdout: COMMIT + '\n' };
      return { stdout: '' };
    };
    let called = 0;
    const fetchImpl = async (url, options) => {
      called++;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      const payload = JSON.parse(options.body);
      assert.equal(payload.store, false);
      assert.equal(payload.max_output_tokens, grant.maxOutputTokens);
      assert.equal(payload.text.format.type, 'json_schema');
      assert.equal(payload.text.format.strict, true);
      assert.deepEqual(payload.text.format.schema.required, ['oldText', 'newText']);
      assert.equal(payload.text.format.schema.additionalProperties, false);
      return new Response(JSON.stringify({
        status: 'completed',
        output: [{ type: 'message', status: 'completed',
          content: [{ type: 'output_text',
            text: JSON.stringify({ oldText: 'return 1;', newText: 'return 2;' }) }] }],
      }), { status: 200 });
    };
    const result = await runAuthorizedCodingOnce({
      repoRoot, privateRoot, source, grant,
      credential: 'fake-test-key-not-real-123456', now: () => at,
      runGit: git, fetchImpl, checkSyntax: async () => {},
    });
    assert.equal(result.state, 'LOCAL_COMMIT_PREPARED');
    assert.equal(result.commit, COMMIT);
    assert.equal(called, 1);
  }));

test('invalid grant or missing credential has no staging side effects', () =>
  work(async ({ repoRoot, privateRoot }) => {
    const at = Date.now();
    const grant = makeGrant(at);
    let writes = 0;
    const runGit = async () => { writes++; throw Error('must not run'); };
    assert.equal((await runAuthorizedCodingOnce({ repoRoot, privateRoot, source,
      grant: { ...grant, sourceHead: COMMIT }, credential: 'fake-test-key-not-real-123456', runGit })).code,
    'CODING_OWNER_GRANT_REQUIRED');
    assert.equal((await runAuthorizedCodingOnce({ repoRoot, privateRoot, source,
      grant, credential: '', runGit })).code, 'CODING_HOST_OR_CREDENTIAL_UNAVAILABLE');
    assert.equal(writes, 0);
  }));

test('seventy retained stages are preserved and do not block resource-backed admission', () =>
  work(async ({ repoRoot, privateRoot }) => {
    const stages = path.join(privateRoot, 'coding-worktrees');
    await mkdir(stages, { recursive: true });
    for (let i = 2; i < 72; i++) await mkdir(path.join(stages, i.toString(16).padStart(32, '0')));
    const at = Date.now();
    let edits = 0;
    const result = await runAuthorizedCodingOnce({ repoRoot, privateRoot, source,
      grant: makeGrant(at), credential: 'fake-test-key-not-real-123456', now: () => at,
      runGit: async (cwd, args) => {
        if (args[0] === 'worktree') {
          const stage = args[3];
          await mkdir(path.dirname(path.join(stage, TARGET)), { recursive: true });
          await writeFile(path.join(stage, TARGET), ORIGINAL);
        }
        if (args[0] === 'diff' && args[1] === '--name-only') return { stdout: TARGET + '\n' };
        if (args[0] === 'rev-parse') return { stdout: COMMIT + '\n' };
        return { stdout: '' };
      },
      checkSyntax: async () => {},
      requestEdit: async () => { edits++; return { oldText: 'return 1;', newText: 'return 2;' }; } });
    assert.equal(result.state, 'LOCAL_COMMIT_PREPARED');
    assert.equal(edits, 1);
    for (let i = 2; i < 72; i++) assert.equal(
      (await lstat(path.join(stages, i.toString(16).padStart(32, '0')))).isDirectory(), true);
    assert.equal((await readFile(path.join(stages, '.reserved-' + '1'.repeat(32) + '.json'), 'utf8')).includes('RESERVED_NO_REPLAY'), true);
  }));

test('low or unverifiable disk capacity refuses admission before grant reservation or model call', () =>
  work(async ({ repoRoot, privateRoot }) => {
    const at = Date.now();
    let calls = 0;
    const base = { repoRoot, privateRoot, source, grant: makeGrant(at),
      credential: 'fake-test-key-not-real-123456', now: () => at,
      runGit: async () => { calls++; throw Error('must not run'); },
      requestEdit: async () => { calls++; throw Error('must not call model'); } };
    assert.equal((await runAuthorizedCodingOnce({ ...base,
      checkCapacity: async () => ({ bavail: 1n, bsize: 4096n }) })).code,
      'CODING_STAGE_RESOURCE_PRESSURE');
    assert.equal((await runAuthorizedCodingOnce({ ...base,
      checkCapacity: async () => { throw Error('disk unavailable'); } })).code,
      'CODING_STAGE_DISK_UNVERIFIABLE');
    assert.equal(calls, 0);
    await assert.rejects(readFile(path.join(privateRoot, 'coding-attempts',
      '1'.repeat(32) + '.reserved.json'), 'utf8'));
  }));

test('lost admission lock during disk preflight cannot launch model or consume grant', () =>
  work(async ({ repoRoot, privateRoot }) => {
    const at = Date.now();
    let gitCalls = 0, modelCalls = 0;
    const lock = path.join(privateRoot, 'coding-attempts', '.coding-stage-budget.lock');
    const result = await runAuthorizedCodingOnce({ repoRoot, privateRoot, source,
      grant: makeGrant(at), credential: 'fake-test-key-not-real-123456', now: () => at,
      checkCapacity: async () => {
        // Simulate another actor removing the lock while admission is pending.
        // The stage sentinel may be written, but worker execution must stop.
        await unlink(lock);
        return diskReady();
      },
      runGit: async () => { gitCalls++; throw Error('must not run Git'); },
      requestEdit: async () => { modelCalls++; throw Error('must not call model'); } });
    assert.equal(result.code, 'CODING_STAGE_BUDGET_LOCKED_OR_UNVERIFIABLE');
    assert.equal(gitCalls, 0);
    assert.equal(modelCalls, 0);
    await assert.rejects(readFile(path.join(privateRoot, 'coding-attempts',
      '1'.repeat(32) + '.reserved.json'), 'utf8'));
    assert.match(await readFile(path.join(privateRoot, 'coding-worktrees',
      '.reserved-' + '1'.repeat(32) + '.json'), 'utf8'), /RESERVED_NO_REPLAY/);
  }));

test('orphaned budget lock fails closed without model invocation or replay', () =>
  work(async ({ repoRoot, privateRoot }) => {
    const receipts = path.join(privateRoot, 'coding-attempts');
    await mkdir(receipts, { recursive: true });
    await writeFile(path.join(receipts, '.coding-stage-budget.lock'), 'orphaned');
    const at = Date.now();
    let calls = 0;
    const result = await runAuthorizedCodingOnce({ repoRoot, privateRoot, source,
      grant: makeGrant(at), credential: 'fake-test-key-not-real-123456', now: () => at,
      runGit: async () => { calls++; throw Error('must not run'); },
      requestEdit: async () => { calls++; throw Error('must not call model'); } });
    assert.equal(result.code, 'CODING_STAGE_BUDGET_LOCKED_OR_UNVERIFIABLE');
    assert.equal(calls, 0);
    assert.equal(await readFile(path.join(receipts, '.coding-stage-budget.lock'), 'utf8'),
      'orphaned');
  }));

test('native Git creates a real isolated commit without modifying clean main', () =>
  work(async ({ repoRoot, privateRoot }) => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const exec = promisify(execFile);
    const git = args => exec('git', args, { cwd: repoRoot });
    await git(['init', '-q', '-b', 'main']);
    await git(['config', 'user.name', 'Fixture Worker']);
    await git(['config', 'user.email', 'fixture@invalid.test']);
    await git(['add', '--', TARGET, TEST_FILE]);
    await git(['commit', '-qm', 'fixture baseline']);
    const head = (await git(['rev-parse', 'HEAD'])).stdout.trim();
    const at = Date.now();
    const grant = { ...makeGrant(at), sourceHead: head, grantId: '2'.repeat(32) };
    const result = await runAuthorizedCodingOnce({ repoRoot, privateRoot,
      source: { head, channel: 'main' }, grant,
      credential: 'fake-test-key-not-real-123456', now: () => at,
      requestEdit: async () => ({ oldText: 'return 1;', newText: 'return 2;' }) });
    assert.equal(result.state, 'LOCAL_COMMIT_PREPARED');
    assert.equal(result.sourceHead, head);
    assert.equal(result.commit.length, 40);
    assert.notEqual(result.commit, head);
    assert.equal((await git(['rev-parse', 'HEAD'])).stdout.trim(), head);
    assert.equal((await git(['status', '--porcelain'])).stdout.trim(), '');
    assert.equal(await readFile(path.join(repoRoot, TARGET), 'utf8'), ORIGINAL);
    const staged = path.join(privateRoot, 'coding-worktrees', grant.grantId, TARGET);
    assert.match(await readFile(staged, 'utf8'), /return 2;/);
    const saved = JSON.parse(await readFile(path.join(privateRoot, 'coding-attempts',
      grant.grantId + '.result.json'), 'utf8'));
    assert.equal(saved.state, 'LOCAL_COMMIT_PREPARED');
    assert.equal(saved.independentVerification, false);
  }));
