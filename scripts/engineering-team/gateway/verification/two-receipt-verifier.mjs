/**
 * #3302: two separate, write-once and correlated engineering/verifier receipts.
 * A coding worker's statement is NEVER accepted as independent verification.
 * Verifier: read-only exact-head GitHub evidence + an independently Ed25519-
 * signed owner-Windows result. No model, shell, Pi, PR mutation or merge.
 */
import { createHash, verify as verifySignature } from 'node:crypto';
import { lstat, mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateGatewayRoot } from '../gateway-host.mjs';

const REPO = 'BryanHarrisScripts/PlotPickle';
const API = 'https://api.github.com/repos/' + REPO;
const ID = /^[a-f0-9]{32}$/, SHA = /^[a-f0-9]{40}$/, DIGEST = /^[a-f0-9]{64}$/;
const CODE = /^scripts\/engineering-team\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.mjs$/;
const TEST = /^tests\/issue-[0-9]+-[a-z0-9-]+\.test\.mjs$/;
const hash = s => createHash('sha256').update(s, 'utf8').digest('hex');
const object = x => x && typeof x === 'object' && !Array.isArray(x) &&
  Object.getPrototypeOf(x) === Object.prototype;
const block = (code, state = 'BLOCKED') => Object.freeze({
  state, code, independentlyVerified: false, automaticMergeAuthorized: false,
  replayAuthorized: false,
});
async function regularJson(p, limit = 8192) {
  const s = await lstat(p);
  if (!s.isFile() || s.isSymbolicLink() || s.size < 2 || s.size > limit)
    throw Error('FILE_UNVERIFIABLE');
  return JSON.parse(await readFile(p, 'utf8'));
}
async function dir(root, sub) {
  const name = path.join(root, sub);
  await mkdir(name, { recursive: true, mode: 0o700 });
  const s = await lstat(name);
  if (!s.isDirectory() || s.isSymbolicLink()) throw Error('STORAGE_UNVERIFIABLE');
  return name;
}
async function writeOnce(p, data) {
  let f;
  try {
    f = await open(p, 'wx', 0o600);
    await f.writeFile(JSON.stringify(data) + '\n');
    await f.sync();
    return true;
  } catch { return false; }
  finally { await f?.close().catch(() => {}); }
}

/** Validate correlations among five OWNER-PRIVATE documents, not issue prose. */
export function engineeringReceiptFor({ requestId, grant, edit, publicationGrant,
  reservation, published, at } = {}) {
  if (!ID.test(requestId || '') || ![grant, edit, publicationGrant, reservation, published].every(object) ||
      !Number.isSafeInteger(at) || at < 1) return null;
  const issue = grant.issueNumber, head = grant.sourceHead;
  const branch = 'engineering/' + issue + '-' + requestId;
  if (!Number.isSafeInteger(issue) || issue <= 0 || issue > 9_999_999 ||
      grant.schemaVersion !== 1 || grant.kind !== 'engineering-edit-once' ||
      grant.grantId !== requestId || grant.maxRequests !== 1 ||
      grant.consent !== 'AUTHORIZE_ONE_ENGINEERING_SOURCE_EDIT' ||
      !SHA.test(head || '') || !CODE.test(grant.targetPath || '') ||
      !TEST.test(grant.focusedTest || '') ||
      edit.state !== 'LOCAL_COMMIT_PREPARED' ||
      edit.code !== 'SYNTAX_CHECK_PASSED_TESTS_PENDING' ||
      edit.sourceMutationVerified !== true || edit.focusedTestExecuted !== false ||
      edit.independentVerification !== false || edit.pullRequestCreated !== false ||
      !SHA.test(edit.commit || '') || edit.sourceHead !== head ||
      edit.grantId !== requestId || edit.issueNumber !== issue ||
      edit.focusedTest !== grant.focusedTest || edit.branch !== branch ||
      publicationGrant.schemaVersion !== 1 ||
      publicationGrant.kind !== 'draft-pr-publish-once' ||
      publicationGrant.consent !== 'AUTHORIZE_ONE_DRAFT_ENGINEERING_PR' ||
      publicationGrant.maxRequests !== 1 ||
      !ID.test(publicationGrant.publicationId || '') ||
      publicationGrant.grantId !== requestId ||
      publicationGrant.issueNumber !== issue ||
      publicationGrant.sourceHead !== head ||
      publicationGrant.targetPath !== grant.targetPath ||
      publicationGrant.localCommit !== edit.commit ||
      publicationGrant.branch !== branch ||
      reservation.grantId !== requestId ||
      reservation.sourceHead !== head || reservation.localCommit !== edit.commit ||
      !SHA.test(reservation.tree || '') || !DIGEST.test(reservation.contentDigest || '') ||
      published.state !== 'DRAFT_PR_CREATED' || published.pullRequestCreated !== true ||
      published.independentVerification !== false ||
      published.automaticMergeAuthorized !== false ||
      published.grantId !== requestId ||
      published.publicationId !== publicationGrant.publicationId ||
      published.issueNumber !== issue || published.sourceHead !== head ||
      published.localCommit !== edit.commit ||
      published.tree !== reservation.tree || published.branch !== branch ||
      !SHA.test(published.remoteCommit || '') ||
      !Number.isSafeInteger(published.prNumber) ||
      published.prNumber <= 0 || published.prNumber > 9_999_999) return null;
  return Object.freeze({
    schemaVersion: 1, kind: 'engineering-execution',
    issuer: 'owner-authorized-coding-worker',
    receiptId: hash('engineering-v1:' + requestId + ':' +
      published.remoteCommit + ':' + published.prNumber),
    requestId, publicationId: publicationGrant.publicationId,
    issueNumber: issue, sourceHead: head, localCommit: edit.commit,
    candidateHead: published.remoteCommit, tree: published.tree,
    sourceContentDigest: reservation.contentDigest,
    changedPath: grant.targetPath, focusedTest: grant.focusedTest,
    branch, prNumber: published.prNumber, observedAt: at,
    state: 'SOURCE_COMMITTED_AND_PR_PUBLISHED',
    focusedTestExecuted: false, independentlyVerified: false,
    automaticMergeAuthorized: false, replayAuthorized: false,
  });
}
export async function issueEngineeringReceiptOnce({
  privateRoot, requestId, publicationId, now = Date.now,
} = {}) {
  if (typeof privateRoot !== 'string' || !path.isAbsolute(privateRoot) ||
      !ID.test(requestId || '') || !ID.test(publicationId || ''))
    return block('ENGINEERING_OWNER_IDENTITIES_REQUIRED');
  let receipt;
  try {
    const grab = (sub, name) => regularJson(path.join(privateRoot, sub, name + '.json'), 4096);
    receipt = engineeringReceiptFor({
      requestId, at: now(),
      grant: await grab('owner-coding-grants', requestId),
      edit: await grab('coding-attempts', requestId + '.result'),
      publicationGrant: await grab('owner-publication-grants', publicationId),
      reservation: await grab('publication-attempts', publicationId + '.reserved'),
      published: await grab('publication-attempts', publicationId + '.result'),
    });
  } catch { return block('ENGINEERING_SOURCE_RECORDS_UNVERIFIABLE'); }
  if (!receipt) return block('ENGINEERING_PROVENANCE_MISMATCH');
  try {
    const root = await dir(privateRoot, 'engineering-receipts');
    if (!await writeOnce(path.join(root, requestId + '.json'), receipt))
      return block('ENGINEERING_RECEIPT_ALREADY_ISSUED_OR_UNVERIFIABLE');
    return receipt;
  } catch { return block('ENGINEERING_RECEIPT_STORAGE_UNVERIFIABLE'); }
}

/** The signer is a DIFFERENT owner-Windows verifier, never this worker. */
const witnessFields = [
  'schemaVersion', 'kind', 'receiptId', 'requestId', 'issueNumber',
  'sourceHead', 'candidateHead', 'prNumber', 'proofDigest', 'observedAt', 'state',
];
export function ownerWitnessPayload(w) {
  if (!object(w) || !witnessFields.every(f => Object.hasOwn(w, f))) return null;
  return JSON.stringify(Object.fromEntries(witnessFields.map(f => [f, w[f]])));
}
export function verifyOwnerWitness(w, engineering, publicKey, at) {
  if (!object(w) || !object(engineering) ||
      typeof publicKey !== 'string' || !publicKey.includes('BEGIN PUBLIC KEY') ||
      typeof w.signature !== 'string' ||
      !/^[A-Za-z0-9+/]{80,100}={0,2}$/.test(w.signature) ||
      Object.keys(w).length !== witnessFields.length + 1 ||
      w.schemaVersion !== 1 || w.kind !== 'owner-windows-verification' ||
      !ID.test(w.receiptId || '') ||
      w.requestId !== engineering.requestId || w.issueNumber !== engineering.issueNumber ||
      w.sourceHead !== engineering.sourceHead ||
      w.candidateHead !== engineering.candidateHead ||
      w.prNumber !== engineering.prNumber ||
      !DIGEST.test(w.proofDigest || '') || w.state !== 'PASS' ||
      !Number.isSafeInteger(w.observedAt) || !Number.isSafeInteger(at) ||
      w.observedAt > at + 60_000 || at - w.observedAt > 7 * 86_400_000)
    return false;
  try {
    return verifySignature(null, Buffer.from(ownerWitnessPayload(w)),
      publicKey, Buffer.from(w.signature, 'base64'));
  } catch { return false; }
}

async function boundedResponse(response) {
  if (!response?.ok || typeof response.body?.getReader !== 'function') return null;
  const reader = response.body.getReader(), parts = [];
  let n = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) return null;
      n += value.byteLength;
      if (n > 131072) { await reader.cancel().catch(() => {}); return null; }
      parts.push(Buffer.from(value));
    }
    const parsed = JSON.parse(Buffer.concat(parts).toString('utf8'));
    return object(parsed) ? parsed : null;
  } catch { return null; }
  finally { reader.releaseLock(); }
}

/** Strict read-only GitHub, exact HEAD and no substitute for owner-Windows UAT. */
export async function collectGitHubChecks(engineering, {
  token, fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof token !== 'string' || token.length < 20 ||
      typeof fetchImpl !== 'function') return { state: 'BLOCKED', code: 'VERIFIER_TOKEN_REQUIRED' };
  const read = async route => {
    const response = await fetchImpl(API + route, {
      method: 'GET', redirect: 'error',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(25000),
    });
    const json = await boundedResponse(response);
    if (!json) throw Error('UNVERIFIABLE_READ_ONLY_RESPONSE');
    return json;
  };
  try {
    const pr = await read('/pulls/' + engineering.prNumber);
    if (pr.state !== 'open' || pr.draft !== true ||
        pr.head?.sha !== engineering.candidateHead ||
        pr.head?.ref !== engineering.branch ||
        pr.head?.repo?.full_name !== REPO ||
        pr.base?.ref !== 'main' || pr.base?.sha !== engineering.sourceHead)
      return { state: 'BLOCKED', code: 'PR_HEAD_OR_BASE_CHANGED' };
    const commit = await read('/git/commits/' + engineering.candidateHead);
    if (commit.tree?.sha !== engineering.tree || commit.parents?.length !== 1 ||
        commit.parents[0]?.sha !== engineering.sourceHead)
      return { state: 'BLOCKED', code: 'COMMIT_PARENT_OR_TREE_MISMATCH' };
    const inventory = await read('/actions/runs?head_sha=' + engineering.candidateHead +
      '&event=pull_request&per_page=30');
    if (!Number.isInteger(inventory.total_count) || inventory.total_count > 30 ||
        !Array.isArray(inventory.workflow_runs))
      return { state: 'BLOCKED', code: 'CI_RUN_INVENTORY_UNVERIFIABLE' };
    const runs = inventory.workflow_runs.filter(x => x.name === 'Architecture Verification' &&
      x.event === 'pull_request' && x.head_sha === engineering.candidateHead);
    if (!runs.length) return { state: 'WAITING', code: 'CI_RUN_NOT_FOUND' };
    const run = runs.sort((a, b) =>
      (b.run_attempt || 0) - (a.run_attempt || 0) || (b.id || 0) - (a.id || 0))[0];
    if (!Number.isSafeInteger(run.id) || run.id <= 0)
      return { state: 'BLOCKED', code: 'CI_RUN_ID_UNVERIFIABLE' };
    if (run.status !== 'completed')
      return { state: 'WAITING', code: 'CI_IN_PROGRESS', runId: run.id };
    if (run.conclusion !== 'success')
      return { state: 'BLOCKED', code: 'CI_NOT_SUCCESS', runId: run.id };
    const listing = await read('/actions/runs/' + run.id + '/jobs?per_page=100');
    if (!Number.isInteger(listing.total_count) || listing.total_count > 100 ||
        !Array.isArray(listing.jobs) || listing.jobs.length !== listing.total_count)
      return { state: 'BLOCKED', code: 'CI_JOBS_INCOMPLETE', runId: run.id };
    const required = [
      ...Array.from({ length: 7 }, (_, i) => 'Layer ' + (i + 1) + ' '),
      'Windows owned verifier STOP and sentinel proof',
    ];
    const jobIds = [];
    for (const name of required) {
      const matches = listing.jobs.filter(x => name.startsWith('Layer ')
        ? typeof x.name === 'string' && x.name.startsWith(name)
        : x.name === name);
      if (matches.length !== 1 || !Number.isSafeInteger(matches[0].id) ||
          matches[0].status !== 'completed' || matches[0].conclusion !== 'success')
        return { state: 'BLOCKED', code: 'REQUIRED_JOB_NOT_GREEN', runId: run.id };
      jobIds.push(matches[0].id);
    }
    const windows = listing.jobs.find(x => x.name === required[7]);
    const native = windows.steps?.filter(x =>
      x.name === 'Verify owner-authorized coding worker on exact-head native Windows') || [];
    if (native.length !== 1 || native[0].status !== 'completed' ||
        native[0].conclusion !== 'success')
      return { state: 'BLOCKED', code: 'NATIVE_CODING_WORKER_STEP_NOT_GREEN', runId: run.id };
    if (listing.jobs.some(x => ['failure', 'cancelled', 'timed_out', 'action_required'].includes(x.conclusion)))
      return { state: 'BLOCKED', code: 'OTHER_CI_FAILURE', runId: run.id };
    return { state: 'PASS', code: 'EXACT_HEAD_HOSTED_CI_VERIFIED',
      runId: run.id, candidateHead: engineering.candidateHead,
      requiredJobIds: jobIds, hostedWindowsJobId: windows.id };
  } catch { return { state: 'BLOCKED', code: 'CI_TRANSPORT_OR_REPLY_UNVERIFIABLE' }; }
}

/**
 * Independent read-only verifier attempt, separate append-only receipt ID.
 * Pending/unknown may be re-observed only with a NEW ID; no model or GitHub
 * mutation is ever replayed. No final merge authority is inferred.
 */
export async function issueVerifierReceiptOnce({
  privateRoot, requestId, attemptId, token, fetchImpl = globalThis.fetch,
  witness = null, witnessPublicKey = null, now = Date.now,
} = {}) {
  if (typeof privateRoot !== 'string' || !path.isAbsolute(privateRoot) ||
      !ID.test(requestId || '') || !ID.test(attemptId || '') || requestId === attemptId)
    return block('VERIFIER_IDENTITIES_REQUIRED');
  let engineering;
  try {
    engineering = await regularJson(path.join(privateRoot, 'engineering-receipts',
      requestId + '.json'), 4096);
  } catch { return block('ENGINEERING_RECEIPT_MISSING'); }
  if (engineering.schemaVersion !== 1 || engineering.kind !== 'engineering-execution' ||
      engineering.state !== 'SOURCE_COMMITTED_AND_PR_PUBLISHED' ||
      engineering.requestId !== requestId || !DIGEST.test(engineering.receiptId || '') ||
      !SHA.test(engineering.sourceHead || '') || !SHA.test(engineering.candidateHead || '') ||
      !SHA.test(engineering.tree || '') || !ID.test(engineering.publicationId || '') ||
      !Number.isSafeInteger(engineering.prNumber))
    return block('ENGINEERING_RECEIPT_UNVERIFIABLE');
  let root;
  try {
    root = await dir(privateRoot, 'verification-receipts');
    if (!await writeOnce(path.join(root, attemptId + '.reserved.json'), {
      schemaVersion: 1, kind: 'verifier-reservation', requestId, attemptId,
      engineeringReceiptId: engineering.receiptId, reservedAt: now(),
      state: 'RESERVED_NO_REPLAY',
    })) return block('VERIFIER_ATTEMPT_ALREADY_RESERVED');
  } catch { return block('VERIFIER_STORAGE_UNVERIFIABLE'); }
  const github = await collectGitHubChecks(engineering, { token, fetchImpl });
  const ownerProven = verifyOwnerWitness(witness, engineering, witnessPublicKey, now());
  const state = github.state === 'PASS' && ownerProven ? 'INDEPENDENTLY_VERIFIED' :
    github.state === 'PASS' ? 'BLOCKED' : github.state;
  const code = github.state !== 'PASS' ? github.code :
    ownerProven ? 'TWO_RECEIPTS_EXACT_HEAD_VERIFIED' : 'OWNER_WINDOWS_EVIDENCE_MISSING_OR_INVALID';
  const result = Object.freeze({
    schemaVersion: 1, kind: 'independent-verifier',
    issuer: 'independent-github-owner-windows-evidence-reader',
    receiptId: hash('verifier-v1:' + attemptId + ':' + engineering.receiptId),
    requestId, attemptId, engineeringReceiptId: engineering.receiptId,
    issueNumber: engineering.issueNumber, prNumber: engineering.prNumber,
    sourceHead: engineering.sourceHead, candidateHead: engineering.candidateHead,
    state, code, github, ownerWindowsReceiptId: ownerProven ? witness.receiptId : null,
    ownerWindowsProven: ownerProven, observedAt: now(),
    independentlyVerified: state === 'INDEPENDENTLY_VERIFIED',
    automaticMergeAuthorized: false, replayAuthorized: false,
  });
  if (!await writeOnce(path.join(root, attemptId + '.result.json'), result))
    return block('VERIFIER_RESULT_RECEIPT_UNVERIFIABLE');
  return result;
}

/** Fixed opt-in Windows-only CLI, never part of a model toolset. */
export async function runOwnerReceiptCli(args, env = process.env) {
  if (process.platform !== 'win32') return block('RECEIPT_OWNER_WINDOWS_ONLY');
  const root = privateGatewayRoot(env);
  if (args.length === 3 && args[0] === '--engineering')
    return issueEngineeringReceiptOnce({
      privateRoot: root, requestId: args[1], publicationId: args[2],
    });
  if (args.length !== 3 || args[0] !== '--verify')
    return block('RECEIPT_EXACT_ARGUMENTS_REQUIRED');
  let witness = null, publicKey = null;
  try {
    witness = await regularJson(path.join(root, 'owner-verifier-receipts',
      args[1] + '.json'), 8192);
    const keyPath = env.PLOTPICKLE_OWNER_VERIFIER_PUBLIC_KEY_PATH;
    if (keyPath && path.isAbsolute(keyPath)) {
      const stat = await lstat(keyPath);
      if (stat.isFile() && !stat.isSymbolicLink() && stat.size < 2048)
        publicKey = await readFile(keyPath, 'utf8');
    }
  } catch { /* Missing independent attestation remains BLOCKED. */ }
  return issueVerifierReceiptOnce({
    privateRoot: root, requestId: args[1], attemptId: args[2],
    token: env.PLOTPICKLE_GITHUB_VERIFY_TOKEN, witness, witnessPublicKey: publicKey,
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runOwnerReceiptCli(process.argv.slice(2));
  process.stdout.write(JSON.stringify(result) + '\n');
  if (!['SOURCE_COMMITTED_AND_PR_PUBLISHED', 'INDEPENDENTLY_VERIFIED'].includes(result.state))
    process.exitCode = 2;
}
