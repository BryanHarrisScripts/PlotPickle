/**
 * #3142: owner-granted, one-shot engineering edit in a fresh Git worktree.
 * This is NOT an unattended scheduler, PR publisher, independent verifier,
 * general shell, queue consumer, or automatic merger. Import is inert.
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, mkdir, open, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gatewayAppSource, privateGatewayRoot } from './gateway-host.mjs';

const exec = promisify(execFile);
const ID = /^[a-f0-9]{32}$/;
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const MODEL = /^[a-z][a-z0-9.-]{1,63}$/;
const SOURCE = /^scripts\/engineering-team\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.mjs$/;
const TEST = /^tests\/issue-[0-9]+-[a-z0-9-]+\.test\.mjs$/;
const CONSENT = 'AUTHORIZE_ONE_ENGINEERING_SOURCE_EDIT';
const ENDPOINT = 'https://api.openai.com/v1/responses';
const hash = value => createHash('sha256').update(value, 'utf8').digest('hex');
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) &&
  Object.getPrototypeOf(v) === Object.prototype && Object.keys(v).length === keys.length &&
  keys.every(k => Object.hasOwn(v, k));
const block = code => Object.freeze({ state: 'BLOCKED', code, sourceMutationVerified: false,
  independentVerification: false, automaticMergeAuthorized: false, replayAuthorized: false });

export function validateCodingGrant(grant, source, at) {
  return exact(grant, ['schemaVersion', 'kind', 'grantId', 'issueNumber', 'sourceHead',
    'targetPath', 'targetDigest', 'focusedTest', 'objective', 'model', 'maxOutputTokens',
    'expiresAt', 'maxRequests', 'consent']) &&
    grant.schemaVersion === 1 && grant.kind === 'engineering-edit-once' &&
    ID.test(grant.grantId) && Number.isInteger(grant.issueNumber) &&
    grant.issueNumber >= 1 && grant.issueNumber <= 9_999_999 &&
    source?.channel === 'main' && SHA.test(source.head || '') &&
    grant.sourceHead === source.head && SOURCE.test(grant.targetPath) &&
    !grant.targetPath.split('/').includes('..') && DIGEST.test(grant.targetDigest) &&
    TEST.test(grant.focusedTest) && typeof grant.objective === 'string' &&
    grant.objective.length >= 16 && grant.objective.length <= 1000 &&
    !/(?:sk-[a-z0-9_-]{12,}|ghp_[a-z0-9]{12,}|bearer\s+\S+)/i.test(grant.objective) &&
    MODEL.test(grant.model) &&
    Number.isInteger(grant.maxOutputTokens) && grant.maxOutputTokens >= 512 &&
    grant.maxOutputTokens <= 2500 && Number.isSafeInteger(grant.expiresAt) &&
    grant.expiresAt > at + 30_000 && grant.expiresAt <= at + 3_600_000 &&
    grant.maxRequests === 1 && grant.consent === CONSENT;
}

export function boundedSourceEdit(original, proposal) {
  if (!exact(proposal, ['oldText', 'newText']) ||
      typeof proposal.oldText !== 'string' || typeof proposal.newText !== 'string' ||
      proposal.oldText.length < 8 || proposal.oldText.length > 4096 ||
      proposal.newText.length < 1 || proposal.newText.length > 4096 ||
      proposal.newText === proposal.oldText) return null;
  const index = original.indexOf(proposal.oldText);
  if (index < 0 || original.indexOf(proposal.oldText, index + 1) !== -1) return null;
  return original.slice(0, index) + proposal.newText + original.slice(index + proposal.oldText.length);
}

async function regularFile(filename, limit) {
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > limit)
    throw Error('FILE_UNVERIFIABLE');
  return readFile(filename, 'utf8');
}
async function safePath(root, relative) {
  let current = root;
  for (const segment of relative.split('/')) {
    current = path.join(current, segment);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw Error('SYMLINK_DENIED');
  }
  return current;
}
async function onceJson(filename, data) {
  let handle;
  try {
    handle = await open(filename, 'wx', 0o600);
    await handle.writeFile(JSON.stringify(data) + '\n');
    await handle.sync();
    return true;
  } catch { return false; }
  finally { await handle?.close().catch(() => {}); }
}
async function boundedResponse(response) {
  if (!response?.ok || !response.body?.getReader) return null;
  const reader = response.body.getReader();
  const chunks = []; let count = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > 32_768) { await reader.cancel().catch(() => {}); return null; }
      chunks.push(Buffer.from(value));
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (data?.status !== 'completed' || data.error || data.incomplete_details ||
        !Array.isArray(data.output) || data.output.some(x => !['message', 'reasoning'].includes(x?.type))) return null;
    const messages = data.output.filter(x => x.type === 'message');
    if (messages.length !== 1 || messages[0].status !== 'completed' ||
        messages[0].content?.length !== 1 ||
        messages[0].content[0]?.type !== 'output_text') return null;
    const value = messages[0].content[0].text;
    return typeof value === 'string' && value.length < 16_384 ? JSON.parse(value) : null;
  } catch { return null; }
  finally { reader.releaseLock(); }
}

async function modelEdit({ grant, original, credential, fetchImpl }) {
  const response = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + credential, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: grant.model, store: false,
      max_output_tokens: grant.maxOutputTokens,
      input: [
        { role: 'developer', content: 'Return JSON only: {"oldText":"...","newText":"..."}. Replace one unique exact substring. No markdown, tools, shell, network, unrelated edits, or claims of testing.' },
        { role: 'user', content: `Issue #${grant.issueNumber}. Owner objective: ${grant.objective}\\nModify only ${grant.targetPath}. Current source:\\n${original}` },
      ] }),
    signal: AbortSignal.timeout(45_000),
  });
  return boundedResponse(response);
}

/** Injection seams enable disposable fixture verification without paid calls. */
export async function runAuthorizedCodingOnce({ repoRoot, privateRoot, source, grant,
  credential, fetchImpl = globalThis.fetch, runGit = null, checkSyntax = null,
  requestEdit = modelEdit, now = Date.now } = {}) {
  const at = now();
  if (!validateCodingGrant(grant, source, at)) return block('CODING_OWNER_GRANT_REQUIRED');
  if (!path.isAbsolute(repoRoot || '') || !path.isAbsolute(privateRoot || '') ||
      !credential || typeof credential !== 'string' || credential.length < 20)
    return block('CODING_HOST_OR_CREDENTIAL_UNAVAILABLE');
  const git = runGit || (async (cwd, args) => exec('git', args,
    { cwd, windowsHide: true, timeout: 30_000, maxBuffer: 8192 }));
  // Do not execute model-edited code with the owner's credentials. Native
  // focused tests belong to the subsequent independent, isolated CI gate.
  const syntax = checkSyntax || (async (cwd, file) => exec(process.execPath, ['--check', file],
    { cwd, windowsHide: true, timeout: 15_000, maxBuffer: 8192 }));
  let original;
  try {
    const p = await safePath(repoRoot, grant.targetPath);
    original = await regularFile(p, 16_384);
    await safePath(repoRoot, grant.focusedTest);
  } catch { return block('CODING_TARGET_UNVERIFIABLE'); }
  if (hash(original.replace(/\r\n/g, '\n')) !== grant.targetDigest)
    return block('CODING_TARGET_DIGEST_MISMATCH');
  const receipts = path.join(privateRoot, 'coding-attempts');
  const stages = path.join(privateRoot, 'coding-worktrees');
  try {
    await mkdir(receipts, { recursive: true, mode: 0o700 });
    await mkdir(stages, { recursive: true, mode: 0o700 });
    const r = await lstat(receipts), s = await lstat(stages);
    if (!r.isDirectory() || r.isSymbolicLink() || !s.isDirectory() || s.isSymbolicLink())
      return block('CODING_PRIVATE_STORAGE_UNVERIFIABLE');
  } catch { return block('CODING_PRIVATE_STORAGE_UNVERIFIABLE'); }
  const reservation = path.join(receipts, grant.grantId + '.reserved.json');
  if (!await onceJson(reservation, { schemaVersion: 1, grantId: grant.grantId,
    issueNumber: grant.issueNumber, sourceHead: source.head, reservedAt: at,
    state: 'RESERVED_NO_REPLAY' })) return block('CODING_ALREADY_RESERVED_OR_UNVERIFIABLE');
  const stage = path.join(stages, grant.grantId);
  const branch = `engineering/${grant.issueNumber}-${grant.grantId}`;
  let result = block('CODING_OUTCOME_UNCERTAIN');
  try {
    await git(repoRoot, ['worktree', 'add', '--detach', stage, source.head]);
    await git(stage, ['switch', '-c', branch]);
    const stageFile = await safePath(stage, grant.targetPath);
    if (await regularFile(stageFile, 16_384) !== original) throw Error('STAGED_SOURCE_DIFFERENT');
    const proposal = await requestEdit({ grant, original, credential, fetchImpl });
    const updated = boundedSourceEdit(original, proposal);
    if (!updated || updated.length > 16_384) throw Error('MODEL_EDIT_UNVERIFIABLE');
    await writeFile(stageFile, updated, 'utf8');
    await git(stage, ['diff', '--check']);
    await syntax(stage, stageFile);
    const changed = String((await git(stage, ['diff', '--name-only'])).stdout || '').trim();
    if (changed !== grant.targetPath) throw Error('UNEXPECTED_CHANGED_FILES');
    await git(stage, ['add', '--', grant.targetPath]);
    await git(stage, ['-c', 'commit.gpgSign=false', '-c', `core.hooksPath=${path.join(privateRoot, 'disabled-hooks')}`,
      'commit', '-m', `fix(#${grant.issueNumber}): bounded owner-authorized coding edit`]);
    const commit = String((await git(stage, ['rev-parse', 'HEAD'])).stdout || '').trim();
    if (!SHA.test(commit)) throw Error('COMMIT_UNVERIFIABLE');
    result = Object.freeze({ state: 'LOCAL_COMMIT_PREPARED', code: 'SYNTAX_CHECK_PASSED_TESTS_PENDING',
      issueNumber: grant.issueNumber, sourceHead: source.head, commit, branch,
      grantId: grant.grantId, sourceMutationVerified: true,
      focusedTest: grant.focusedTest, focusedTestExecuted: false,
      independentVerification: false, pullRequestCreated: false,
      automaticMergeAuthorized: false, replayAuthorized: false });
  } catch {
    result = block('CODING_OUTCOME_UNCERTAIN_REVIEW_STAGE');
  }
  if (!await onceJson(path.join(receipts, grant.grantId + '.result.json'), result))
    return block('CODING_RESULT_RECEIPT_UNVERIFIABLE');
  return result;
}

/** Fixed local operator CLI; never exposed through MCP or the read-only supervisor. */
export async function runOwnerCodingOnce({ grantId, env = process.env,
  platform = process.platform, repoRoot = process.cwd(), now = Date.now } = {}) {
  if (platform !== 'win32' || !ID.test(grantId || '')) return block('CODING_WINDOWS_ONLY');
  const source = await gatewayAppSource({ repoRoot, env });
  if (!source || source.channel !== 'main') return block('CODING_EXACT_CLEAN_MAIN_REQUIRED');
  const privateRoot = privateGatewayRoot(env);
  let grant;
  try {
    const file = path.join(privateRoot, 'owner-coding-grants', grantId + '.json');
    grant = JSON.parse(await regularFile(file, 4096));
    if (grant.grantId !== grantId) return block('CODING_GRANT_ID_MISMATCH');
  } catch { return block('CODING_OWNER_GRANT_REQUIRED'); }
  return runAuthorizedCodingOnce({ repoRoot, privateRoot, source, grant,
    credential: env.OPENAI_API_KEY, now });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const result = args.length === 2 && args[0] === '--once'
    ? await runOwnerCodingOnce({ grantId: args[1] }) : block('CODING_EXACT_ARGUMENTS_REQUIRED');
  process.stdout.write(JSON.stringify(result) + '\n');
  if (result.state !== 'LOCAL_COMMIT_PREPARED') process.exitCode = 2;
}
