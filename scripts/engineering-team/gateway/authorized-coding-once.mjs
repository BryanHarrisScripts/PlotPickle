/**
 * #3142: owner-granted, one-shot engineering edit in a fresh Git worktree.
 * This is NOT an unattended scheduler, PR publisher, independent verifier,
 * general shell, queue consumer, or automatic merger. Import is inert.
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { link, lstat, mkdir, open, readdir, readFile, statfs, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gatewayAppSource, privateGatewayRoot } from './gateway-host.mjs';
import { appendPrivateJsonOnce as onceJson } from './receipts/write-once-json.mjs';

const exec = promisify(execFile);
const ID = /^[a-f0-9]{32}$/;
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const MODEL = /^[a-z][a-z0-9.-]{1,63}$/;
const SOURCE = /^scripts\/engineering-team\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.mjs$/;
const TEST = /^tests\/issue-[0-9]+-[a-z0-9-]+\.test\.mjs$/;
const CONSENT = 'AUTHORIZE_ONE_ENGINEERING_SOURCE_EDIT';
const ENDPOINT = 'https://api.openai.com/v1/responses';
// Retained evidence does not consume a concurrent worker slot. Reserve disk
// headroom for one new worktree and leave every historical stage untouched.
const MIN_CODING_STAGE_FREE_BYTES = 9n * 1024n ** 3n;
const MAX_CODING_STAGE_INVENTORY = 4096;
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
/**
 * A crash-retained stage is evidence, not garbage. Serialize admission and
 * check actual disk headroom before consuming a grant or calling a model.
 * Retained stages are evidence, not a three-stage admission quota.
 * An abandoned lock requires owner inspection; never steal it by age.
 */
async function reserveCodingStage(stages, receipts, grant, at, checkCapacity, execute) {
  const lockPath = path.join(receipts, '.coding-stage-budget.lock');
  // A second, immutable hardlink remains a fail-closed guard if the visible
  // budget pathname is removed while a model/Git request is already in flight.
  // Neither a new worker nor recovery is allowed to discard this guard by age.
  const guardPath = path.join(receipts, '.coding-stage-owner.lock');
  let lock, identity, guardCreated = false;
  let releaseSafe = true, executionStarted = false, completed = null;
  const same = (stat, owned) => stat.isFile() && !stat.isSymbolicLink() &&
    stat.dev === owned.dev && stat.ino === owned.ino;
  const matches = async filename => {
    if (!identity) return false;
    try { return same(await lstat(filename), identity); }
    catch { return false; }
  };
  const owns = async () => Boolean(guardCreated) &&
    await matches(lockPath) && await matches(guardPath);
  try {
    lock = await open(lockPath, 'wx', 0o600);
    identity = await lock.stat();
    if (!identity.isFile()) return block('CODING_STAGE_BUDGET_LOCKED_OR_UNVERIFIABLE');
    await lock.writeFile(JSON.stringify({ grantId: grant.grantId, acquiredAt: at }) + '\n');
    await lock.sync();
    // Hardlink creation is atomic and fails when another attempt's persistent
    // guard exists. The new owner cannot bypass an interrupted first attempt
    // even after somebody removes the primary lock pathname.
    await link(lockPath, guardPath);
    guardCreated = true;
    if (!await owns()) return block('CODING_STAGE_BUDGET_LOCKED_OR_UNVERIFIABLE');
    const entries = await readdir(stages, { withFileTypes: true });
    const ids = new Set();
    for (const entry of entries) {
      const reserved = /^\.reserved-([a-f0-9]{32})\.json$/.exec(entry.name);
      if (reserved && entry.isFile() && !entry.isSymbolicLink()) ids.add(reserved[1]);
      else if (ID.test(entry.name) && entry.isDirectory() && !entry.isSymbolicLink())
        ids.add(entry.name);
      else return block('CODING_STAGE_CONTENT_UNVERIFIABLE');
    }
    if (ids.size > MAX_CODING_STAGE_INVENTORY)
      return block('CODING_STAGE_INVENTORY_UNVERIFIABLE');
    let space;
    try {
      space = await checkCapacity(stages, { bigint: true });
      const available = BigInt(space.bavail) * BigInt(space.bsize);
      if (BigInt(space.bavail) < 0n || BigInt(space.bsize) <= 0n)
        return block('CODING_STAGE_DISK_UNVERIFIABLE');
      if (available < MIN_CODING_STAGE_FREE_BYTES)
        return block('CODING_STAGE_RESOURCE_PRESSURE');
    } catch { return block('CODING_STAGE_DISK_UNVERIFIABLE'); }
    // Do not reserve a one-use grant if either ownership pathname was lost.
    if (!await owns()) return block('CODING_STAGE_BUDGET_LOCKED_OR_UNVERIFIABLE');
    const saved = await onceJson(path.join(stages, '.reserved-' + grant.grantId + '.json'),
      { schemaVersion: 1, grantId: grant.grantId, reservedAt: at,
        state: 'RESERVED_NO_REPLAY' });
    if (!saved) return block('CODING_STAGE_RESERVATION_UNVERIFIABLE');
    if (!await owns()) return block('CODING_STAGE_BUDGET_LOCKED_OR_UNVERIFIABLE');
    // The callback must check ownership before and after irreversible effects.
    executionStarted = true;
    const outcome = await execute(owns);
    if (!await owns()) return block('CODING_STAGE_OWNERSHIP_LOST_UNVERIFIABLE');
    completed = outcome;
    return outcome;
  } catch {
    return block('CODING_STAGE_BUDGET_LOCKED_OR_UNVERIFIABLE');
  } finally {
    if (lock) {
      // Only delete the current attempt's own pathname while the persistent
      // guard still prevents a second compliant worker from gaining ownership.
      // Lost/replaced ownership is an unreconciled attempt, not free capacity.
      const ownedLock = await matches(lockPath);
      const ownedGuard = guardCreated && await matches(guardPath);
      if (guardCreated && (!ownedLock || !ownedGuard)) {
        releaseSafe = false;
      } else {
        try {
          if (ownedLock) await unlink(lockPath);
          else releaseSafe = false;
          if (guardCreated && releaseSafe && await matches(guardPath))
            await unlink(guardPath);
          else if (guardCreated) releaseSafe = false;
        } catch { releaseSafe = false; }
      }
      try { await lock.close(); } catch { releaseSafe = false; }
      // The prepared-result JSON is NOT a safe publication credential until
      // the independent release witness confirms this attempt dropped its own
      // lifetime guard; uncertain release is permanently non-replayable.
      if (releaseSafe && completed?.state === 'LOCAL_COMMIT_PREPARED') {
        try {
          const released = await onceJson(path.join(receipts, grant.grantId + '.released.json'),
            { schemaVersion: 1, kind: 'coding-resource-release',
              grantId: grant.grantId, sourceHead: grant.sourceHead,
              localCommit: completed.commit, branch: completed.branch,
              state: 'RELEASED_AFTER_DURABLE_RESULT' });
          if (!released) releaseSafe = false;
        } catch { releaseSafe = false; }
      }
      if (!releaseSafe) return block(executionStarted
        ? 'CODING_STAGE_OWNERSHIP_LOST_UNVERIFIABLE'
        : 'CODING_STAGE_BUDGET_LOCKED_OR_UNVERIFIABLE');
    }
  }
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
      text: { format: { type: 'json_schema', name: 'bounded_source_edit', strict: true,
        schema: { type: 'object', additionalProperties: false,
          properties: { oldText: { type: 'string' }, newText: { type: 'string' } },
          required: ['oldText', 'newText'] } } },
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
  requestEdit = modelEdit, checkCapacity = statfs, now = Date.now } = {}) {
  const at = now();
  if (!validateCodingGrant(grant, source, at)) return block('CODING_OWNER_GRANT_REQUIRED');
  if (!path.isAbsolute(repoRoot || '') || !path.isAbsolute(privateRoot || '') ||
      !credential || typeof credential !== 'string' || credential.length < 20)
    return block('CODING_HOST_OR_CREDENTIAL_UNAVAILABLE');
  const rawGit = runGit || (async (cwd, args) => exec('git', args,
    { cwd, windowsHide: true, timeout: 30_000, maxBuffer: 8192 }));
  // Do not execute model-edited code with the owner's credentials. Native
  // focused tests belong to the subsequent independent, isolated CI gate.
  const rawSyntax = checkSyntax || (async (cwd, file) => exec(process.execPath, ['--check', file],
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
  // Preserve the existing idempotent duplicate outcome without allocating a
  // second stage slot. A concurrent delivery still fails closed on the lock.
  try { await lstat(reservation); return block('CODING_ALREADY_RESERVED_OR_UNVERIFIABLE'); }
  catch (error) {
    if (error?.code !== 'ENOENT') return block('CODING_ALREADY_RESERVED_OR_UNVERIFIABLE');
  }
  return reserveCodingStage(stages, receipts, grant, at, checkCapacity, async owns => {
  const guarded = async fn => {
    if (!await owns()) throw Error('CODING_STAGE_OWNERSHIP_LOST');
    const output = await fn();
    if (!await owns()) throw Error('CODING_STAGE_OWNERSHIP_LOST');
    return output;
  };
  const git = (cwd, args) => guarded(() => rawGit(cwd, args));
  const syntax = (cwd, file) => guarded(() => rawSyntax(cwd, file));
  if (!await onceJson(reservation, { schemaVersion: 1, grantId: grant.grantId,
    issueNumber: grant.issueNumber, sourceHead: source.head, reservedAt: at,
    state: 'RESERVED_NO_REPLAY' })) return block('CODING_ALREADY_RESERVED_OR_UNVERIFIABLE');
  const stage = path.join(stages, grant.grantId);
  const branch = `engineering/${grant.issueNumber}-${grant.grantId}`;
  let result = block('CODING_OUTCOME_UNCERTAIN');
  // A fixed phase from this allowlist is safe to retain; never copy exception
  // messages, model text, stderr, credentials or host paths into receipts.
  let phase = 'CREATE_WORKTREE';
  try {
    await git(repoRoot, ['worktree', 'add', '--detach', stage, source.head]);
    phase = 'CREATE_BRANCH';
    await git(stage, ['switch', '-c', branch]);
    phase = 'VERIFY_STAGE_SOURCE';
    const stageFile = await safePath(stage, grant.targetPath);
    if ((await regularFile(stageFile, 16_384)).replace(/\r\n/g, '\n') !== original.replace(/\r\n/g, '\n'))
      throw Error('STAGED_SOURCE_DIFFERENT');
    phase = 'REQUEST_MODEL';
    const proposal = await guarded(() => requestEdit({ grant, original, credential, fetchImpl }));
    phase = 'VALIDATE_MODEL_EDIT';
    const updated = boundedSourceEdit(original, proposal);
    if (!updated || updated.length > 16_384) throw Error('MODEL_EDIT_UNVERIFIABLE');
    phase = 'WRITE_STAGE_EDIT';
    await guarded(() => writeFile(stageFile, updated, 'utf8'));
    phase = 'CHECK_STAGE_DIFF';
    await git(stage, ['diff', '--check']);
    phase = 'CHECK_STAGE_SYNTAX';
    await syntax(stage, stageFile);
    phase = 'VERIFY_CHANGE_SCOPE';
    const changed = String((await git(stage, ['diff', '--name-only'])).stdout || '').trim();
    if (changed !== grant.targetPath) throw Error('UNEXPECTED_CHANGED_FILES');
    phase = 'ADD_STAGE_EDIT';
    await git(stage, ['add', '--', grant.targetPath]);
    phase = 'COMMIT_STAGE_EDIT';
    await git(stage, ['-c', 'commit.gpgSign=false', '-c', `core.hooksPath=${path.join(privateRoot, 'disabled-hooks')}`,
      'commit', '-m', `fix(#${grant.issueNumber}): bounded owner-authorized coding edit`]);
    phase = 'VERIFY_COMMIT_SHA';
    const commit = String((await git(stage, ['rev-parse', 'HEAD'])).stdout || '').trim();
    if (!SHA.test(commit)) throw Error('COMMIT_UNVERIFIABLE');
    result = Object.freeze({ state: 'LOCAL_COMMIT_PREPARED', code: 'SYNTAX_CHECK_PASSED_TESTS_PENDING',
      issueNumber: grant.issueNumber, sourceHead: source.head, commit, branch,
      grantId: grant.grantId, sourceMutationVerified: true,
      focusedTest: grant.focusedTest, focusedTestExecuted: false,
      independentVerification: false, pullRequestCreated: false,
      automaticMergeAuthorized: false, replayAuthorized: false });
  } catch {
    result = Object.freeze({ ...block('CODING_OUTCOME_UNCERTAIN_REVIEW_STAGE'), phase });
  }
  if (!await owns()) return block('CODING_STAGE_OWNERSHIP_LOST_UNVERIFIABLE');
  if (!await onceJson(path.join(receipts, grant.grantId + '.result.json'), result))
    return block('CODING_RESULT_RECEIPT_UNVERIFIABLE');
  return result;
  });
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

/**
 * Single operator/startup invocation can proceed from coding to draft PR
 * without a Human handoff between stages. Both independent private grants are
 * checked by their respective owners; this wrapper creates neither grant.
 */
export async function runOwnerCodingAndPublishOnce({ grantId, publicationId,
  code = runOwnerCodingOnce, publish = null, record = null } = {}) {
  if (!ID.test(grantId || '') || !ID.test(publicationId || ''))
    return block('CODING_AND_PUBLISH_GRANT_IDS_REQUIRED');
  const prepared = await code({ grantId });
  if (prepared?.state !== 'LOCAL_COMMIT_PREPARED') return prepared;
  const publisher = publish || (await import('./publication/authorized-pr-publish-once.mjs')).runOwnerPublishOnce;
  const published = await publisher({ publicationId });
  if (published?.state !== 'DRAFT_PR_CREATED') return published;
  // A remote PR created but lacking its private engineering receipt is NOT a
  // completed Factory result. Never replay publishing to repair a lost receipt.
  const writer = record || (await import('./verification/two-receipt-verifier.mjs')).issueEngineeringReceiptOnce;
  let receipt;
  try {
    receipt = await writer({ privateRoot: privateGatewayRoot(process.env),
      requestId: grantId, publicationId });
  } catch { receipt = null; }
  if (receipt?.state !== 'SOURCE_COMMITTED_AND_PR_PUBLISHED' ||
      receipt.requestId !== grantId ||
      receipt.publicationId !== publicationId ||
      receipt.prNumber !== published.prNumber ||
      receipt.candidateHead !== published.remoteCommit) {
    return Object.freeze({ ...published, state: 'DRAFT_PR_RECEIPT_UNVERIFIED',
      code: 'ENGINEERING_RECEIPT_MISSING_OR_INCONSISTENT',
      engineeringReceiptId: null, independentVerification: false,
      automaticMergeAuthorized: false, replayAuthorized: false });
  }
  return Object.freeze({ ...published, engineeringReceiptId: receipt.receiptId,
    verificationState: 'WAITING_FOR_SEPARATE_VERIFIER',
    independentVerification: false, automaticMergeAuthorized: false });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const result = args.length === 2 && args[0] === '--once'
    ? await runOwnerCodingOnce({ grantId: args[1] })
    : args.length === 3 && args[0] === '--once-and-publish'
      ? await runOwnerCodingAndPublishOnce({ grantId: args[1], publicationId: args[2] })
      : block('CODING_EXACT_ARGUMENTS_REQUIRED');
  process.stdout.write(JSON.stringify(result) + '\n');
  if (!['LOCAL_COMMIT_PREPARED', 'DRAFT_PR_CREATED'].includes(result.state)) process.exitCode = 2;
}
