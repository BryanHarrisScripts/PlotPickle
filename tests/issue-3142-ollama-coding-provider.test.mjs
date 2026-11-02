import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateCodingGrant, runAuthorizedCodingOnce, boundedSourceEdit,
  sourceBound3110Anchor, bindSourceBound3110Proposal }
  from '../scripts/engineering-team/gateway/authorized-coding-once.mjs';

const HEAD = 'a'.repeat(40);
const COMMIT = 'b'.repeat(40);
const MODEL = 'qwen2.5-coder:7b';
const ORIGINAL = 'export function calculate() { return 1; }\n';
const TARGET = 'scripts/engineering-team/gateway/example.mjs';
const FOCUSED = 'tests/issue-3142-ollama-coding-provider.test.mjs';
const digest = value => createHash('sha256').update(value).digest('hex');
const source = { channel: 'main', head: HEAD };
const grant = () => ({
  schemaVersion: 1, kind: 'engineering-edit-once', grantId: 'c'.repeat(32),
  issueNumber: 3142, sourceHead: HEAD, targetPath: TARGET,
  targetDigest: digest(ORIGINAL), focusedTest: FOCUSED,
  objective: 'Correct the calculation by changing only the returned number.',
  model: MODEL, maxOutputTokens: 512, expiresAt: Date.now() + 600_000,
  maxRequests: 1, consent: 'AUTHORIZE_ONE_ENGINEERING_SOURCE_EDIT',
});

async function fixture(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pp-local-ollama-grant-'));
  const repoRoot = path.join(root, 'repo');
  const privateRoot = path.join(root, 'private');
  await mkdir(path.dirname(path.join(repoRoot, TARGET)), { recursive: true });
  await mkdir(path.dirname(path.join(repoRoot, FOCUSED)), { recursive: true });
  await writeFile(path.join(repoRoot, TARGET), ORIGINAL);
  await writeFile(path.join(repoRoot, FOCUSED), 'export {};\n');
  try { await fn({ repoRoot, privateRoot }); }
  finally { await rm(root, { recursive: true, force: true }); }
}
async function fakeGit(cwd, args) {
  if (args[0] === 'worktree') {
    const stage = args[3];
    await mkdir(path.dirname(path.join(stage, TARGET)), { recursive: true });
    await writeFile(path.join(stage, TARGET), ORIGINAL);
  }
  if (args[0] === 'diff' && args[1] === '--name-only')
    return { stdout: TARGET + '\n' };
  if (args[0] === 'rev-parse') return { stdout: COMMIT + '\n' };
  return { stdout: '' };
}
function options(place, fetchImpl) {
  return { ...place, source, grant: grant(), fetchImpl,
    // No API credential is needed or passed to the fixed local model.
    credential: undefined, runGit: fakeGit, checkSyntax: async () => {},
    checkCapacity: async () => ({ bavail: 20n * 1024n ** 3n, bsize: 1n }),
  };
}
function localReply(response, model = MODEL) {
  return new Response(JSON.stringify({
    model, done: true, response: JSON.stringify(response),
  }), { status: 200 });
}

test('local Ollama model is explicit in source-bound grant; arbitrary local model is rejected', () => {
  const current = grant(), at = Date.now();
  assert.equal(validateCodingGrant(current, source, at), true);
  assert.equal(validateCodingGrant({ ...current, model: 'qwen2.5-coder:14b' }, source, at), false);
  assert.equal(validateCodingGrant({ ...current, model: 'http://evil.example/' }, source, at), false);
  assert.equal(validateCodingGrant({ ...current, sourceHead: 'f'.repeat(40) }, source, at), false);
});

test('owner-granted local model sends one bounded loopback request without a credential and commits only the staged edit', () =>
  fixture(async place => {
    let calls = 0;
    const fetchImpl = async (url, init) => {
      calls++;
      assert.equal(url, 'http://127.0.0.1:11434/api/generate');
      assert.equal(init.method, 'POST');
      assert.equal(init.headers.Authorization, undefined);
      const payload = JSON.parse(init.body);
      assert.deepEqual(Object.keys(payload.format).sort(),
        ['additionalProperties', 'properties', 'required', 'type']);
      assert.equal(payload.format.additionalProperties, false);
      assert.deepEqual(payload.format.required, ['oldText', 'newText']);
      assert.equal(payload.model, MODEL);
      assert.equal(payload.stream, false);
      assert.equal(init.redirect, 'error');
      assert.equal(payload.keep_alive, '0');
      assert.equal(payload.options.num_predict, 512);
      assert.equal(payload.options.temperature, 0);
      assert.match(payload.prompt, /Correct the calculation/);
      assert.match(payload.prompt, /return 1/);
      return localReply({ oldText: 'return 1;', newText: 'return 2;' });
    };
    const first = await runAuthorizedCodingOnce(options(place, fetchImpl));
    assert.equal(first.state, 'LOCAL_COMMIT_PREPARED');
    assert.equal(first.focusedTestExecuted, false);
    assert.equal(first.independentVerification, false);
    assert.equal(first.pullRequestCreated, false);
    assert.equal(first.automaticMergeAuthorized, false);
    assert.equal(calls, 1);
    assert.equal(await readFile(path.join(place.repoRoot, TARGET), 'utf8'), ORIGINAL);
    const again = await runAuthorizedCodingOnce(options(place, fetchImpl));
    assert.equal(again.code, 'CODING_ALREADY_RESERVED_OR_UNVERIFIABLE');
    assert.equal(calls, 1);
  }));

test('unexpected local model identity is permanently fail-closed without fallback or replay', () =>
  fixture(async place => {
    let calls = 0;
    const opts = options(place, async url => {
      calls++;
      assert.equal(url, 'http://127.0.0.1:11434/api/generate');
      return localReply({ oldText: 'return 1;', newText: 'return 2;' }, 'other-model');
    });
    const first = await runAuthorizedCodingOnce(opts);
    assert.equal(first.state, 'BLOCKED');
    assert.equal(first.code, 'CODING_OUTCOME_UNCERTAIN_RECONCILIATION_REQUIRED');
    assert.equal(calls, 1);
    const again = await runAuthorizedCodingOnce(opts);
    assert.equal(again.code, 'CODING_ALREADY_RESERVED_OR_UNVERIFIABLE');
    assert.equal(calls, 1);
  }));

// #3110: model proposals can only supply the new span. The old fragment is
// immutable, unique, checked against source, and passed to the same validator.
test('commissioning local proposal remains anchored and rejects ambiguous or incomplete edits',()=>{
  const sourceText=`export function validateOwnerWorkOrder(work) {
    return ID.test(work.publicationId || '') && work.grantId !== work.publicationId &&
      Boolean(work.requestId);
  }
`;
  const scope={issueNumber:3110,
    targetPath:'scripts/engineering-team/gateway/worker-pool/worker-pool.mjs'};
  const anchor=sourceBound3110Anchor(scope,sourceText);
  assert.ok(anchor);
  const proposed={newText:
    "    ID.test(work.publicationId || '') && work.requestId !== work.grantId &&\n" +
    "    work.requestId !== work.publicationId && work.grantId !== work.publicationId &&"};
  const edit=bindSourceBound3110Proposal(anchor,proposed);
  assert.deepEqual(Object.keys(edit).sort(),['newText','oldText']);
  assert.equal(boundedSourceEdit(sourceText,edit),sourceText.replace(anchor,proposed.newText));
  assert.equal(bindSourceBound3110Proposal(anchor,{oldText:anchor,...proposed}),null,
    'model transcription is not accepted by anchored response parser');
  assert.equal(bindSourceBound3110Proposal(anchor,{newText:'return true;'}),null);
  assert.equal(sourceBound3110Anchor(scope,sourceText+sourceText),null,
    'ambiguous old source must fail closed');
  assert.equal(sourceBound3110Anchor({...scope,issueNumber:3142},sourceText),null);
  assert.equal(sourceBound3110Anchor({...scope,targetPath:'other.mjs'},sourceText),null);
});
