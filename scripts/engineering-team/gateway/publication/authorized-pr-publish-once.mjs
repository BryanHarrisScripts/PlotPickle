/**
 * #3142: one-use owner-granted publication of an already prepared local coding
 * commit as a DRAFT PR. Fixed GitHub Git-data API operations only; no shell,
 * git push, force updates, merge, CI-success claims or implicit model grants.
 * Importing this module performs no action.
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gatewayAppSource, privateGatewayRoot } from '../gateway-host.mjs';
import { ownerOneShotAllowed } from '../owner-runtime-gate.mjs';
import { appendPrivateJsonOnce as writeOnce } from '../receipts/write-once-json.mjs';
import { codingReleaseIsReconciled } from '../receipts/atomic-coding-ownership.mjs';

const exec = promisify(execFile);
const ID = /^[a-f0-9]{32}$/;
const SHA = /^[a-f0-9]{40}$/;
const SOURCE = /^scripts\/engineering-team\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.mjs$/;
const REPO = 'BryanHarrisScripts/PlotPickle';
const API = 'https://api.github.com/repos/' + REPO;
const CONSENT = 'AUTHORIZE_ONE_DRAFT_ENGINEERING_PR';
const exact = (value, fields) => value && typeof value === 'object' &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype &&
  Object.keys(value).length === fields.length && fields.every(f => Object.hasOwn(value, f));
const blocked = code => Object.freeze({ state: 'BLOCKED', code, pullRequestCreated: false,
  independentVerification: false, automaticMergeAuthorized: false, replayAuthorized: false });
const uncertain = phase => Object.freeze({ state: 'PUBLISH_STARTED_UNCONFIRMED', phase,
  pullRequestCreated: false, independentVerification: false, automaticMergeAuthorized: false,
  replayAuthorized: false });
const hash = text => createHash('sha256').update(text, 'utf8').digest('hex');

export function validatePublicationGrant(grant, prepared, codingGrant, source, at) {
  if (!exact(grant, ['schemaVersion', 'kind', 'publicationId', 'grantId', 'issueNumber',
    'sourceHead', 'localCommit', 'branch', 'targetPath', 'expiresAt', 'maxRequests', 'consent']))
    return false;
  const expectedBranch = 'engineering/' + grant.issueNumber + '-' + grant.grantId;
  return grant.schemaVersion === 1 && grant.kind === 'draft-pr-publish-once' &&
    ID.test(grant.publicationId) && ID.test(grant.grantId) &&
    Number.isSafeInteger(grant.issueNumber) && grant.issueNumber > 0 &&
    grant.issueNumber <= 9_999_999 && SHA.test(grant.sourceHead) &&
    SHA.test(grant.localCommit) && SOURCE.test(grant.targetPath) &&
    grant.branch === expectedBranch && grant.maxRequests === 1 &&
    grant.consent === CONSENT && Number.isSafeInteger(grant.expiresAt) &&
    grant.expiresAt > at + 30_000 && grant.expiresAt <= at + 3_600_000 &&
    source?.channel === 'main' && source.head === grant.sourceHead &&
    prepared?.state === 'LOCAL_COMMIT_PREPARED' &&
    prepared.code === 'SYNTAX_CHECK_PASSED_TESTS_PENDING' &&
    prepared.sourceMutationVerified === true &&
    prepared.focusedTestExecuted === false && prepared.pullRequestCreated === false &&
    prepared.independentVerification === false &&
    prepared.automaticMergeAuthorized === false &&
    prepared.grantId === grant.grantId && prepared.issueNumber === grant.issueNumber &&
    prepared.sourceHead === grant.sourceHead && prepared.commit === grant.localCommit &&
    prepared.branch === grant.branch &&
    codingGrant?.schemaVersion === 1 && codingGrant.kind === 'engineering-edit-once' &&
    codingGrant.grantId === grant.grantId &&
    codingGrant.issueNumber === grant.issueNumber &&
    codingGrant.sourceHead === grant.sourceHead &&
    codingGrant.targetPath === grant.targetPath &&
    codingGrant.consent === 'AUTHORIZE_ONE_ENGINEERING_SOURCE_EDIT';
}

async function regularJson(filename, limit = 8192) {
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > limit)
    throw Error('PRIVATE_RECORD_UNVERIFIABLE');
  return JSON.parse(await readFile(filename, 'utf8'));
}
async function boundedJson(response) {
  if (!response?.body || typeof response.body.getReader !== 'function') return null;
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) return null;
      size += value.byteLength;
      if (size > 32_768) { await reader.cancel().catch(() => {}); return null; }
      chunks.push(Buffer.from(value));
    }
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
  finally { reader.releaseLock(); }
}
function makeRequester(fetchImpl, token) {
  return async (method, route, payload) => {
    const response = await fetchImpl(API + route, {
      method,
      headers: {
        Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response?.ok) throw Error('GITHUB_HTTP_UNCONFIRMED');
    const json = await boundedJson(response);
    if (!json) throw Error('GITHUB_RESPONSE_UNVERIFIABLE');
    return json;
  };
}
async function readStagedCommit({ repoRoot, privateRoot, grant, git }) {
  const stage = path.join(privateRoot, 'coding-worktrees', grant.grantId);
  const stageStat = await lstat(stage);
  if (!stageStat.isDirectory() || stageStat.isSymbolicLink())
    throw Error('PRIVATE_DIRECTORY_UNVERIFIABLE');
  const call = async args => String((await git(stage, args)).stdout || '').trim();
  const [head, parent, branch, tracked, untracked, changed, tree, blob] = await Promise.all([
    call(['rev-parse', 'HEAD']),
    call(['rev-parse', 'HEAD^']),
    call(['branch', '--show-current']),
    call(['status', '--porcelain', '--untracked-files=no']),
    call(['ls-files', '--others', '--exclude-standard']),
    call(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']),
    call(['rev-parse', 'HEAD^{tree}']),
    call(['rev-parse', 'HEAD:' + grant.targetPath]),
  ]);
  if (head !== grant.localCommit || parent !== grant.sourceHead ||
      branch !== grant.branch || tracked || untracked || changed !== grant.targetPath ||
      !SHA.test(tree) || !SHA.test(blob)) throw Error('STAGED_COMMIT_UNVERIFIABLE');
  const source = String((await git(stage, ['show', 'HEAD:' + grant.targetPath])).stdout || '');
  if (!source || Buffer.byteLength(source, 'utf8') > 16_384) throw Error('STAGED_BLOB_UNVERIFIABLE');
  // A blob from the COMMITTED object is used, never the working-copy text.
  // CRLF conversion on Windows therefore cannot silently change published code.
  return { tree, blob, content: source, digest: hash(source) };
}

/**
 * Testable local publisher. Permission cannot be inferred from a successful
 * coding receipt: it requires a SECOND, exact-commit, private owner grant.
 */
export async function publishAuthorizedDraftOnce({
  repoRoot, privateRoot, source, grant, codingGrant, prepared, token,
  runGit = null, fetchImpl = globalThis.fetch, now = Date.now,
  operatorReady = async () => true,
} = {}) {
  const at = now();
  if (!validatePublicationGrant(grant, prepared, codingGrant, source, at))
    return blocked('PUBLISH_OWNER_GRANT_REQUIRED');
  if (typeof repoRoot !== 'string' || !path.isAbsolute(repoRoot) ||
      typeof privateRoot !== 'string' || !path.isAbsolute(privateRoot) ||
      typeof token !== 'string' || token.length < 20 ||
      typeof fetchImpl !== 'function')
    return blocked('PUBLISH_HOST_OR_TOKEN_UNAVAILABLE');
  let operatorInspectionFault = null;
  const operatorOk = async () => {
    let ready = false;
    try { ready = await operatorReady() === true; }
    catch (error) { operatorInspectionFault = String(error?.code ?? 'UNCLASSIFIED'); }
    return operatorInspectionFault === null && ready;
  };
  if (!await operatorOk()) return blocked('PUBLISH_OWNER_STOP_PAUSE_OR_HEARTBEAT_UNVERIFIABLE');
  const git = runGit || ((cwd, args) => exec('git', args,
    { cwd, windowsHide: true, timeout: 15_000, maxBuffer: 65_536 }));
  let staged;
  try { staged = await readStagedCommit({ repoRoot, privateRoot, grant, git }); }
  catch { return blocked('PUBLISH_STAGED_COMMIT_UNVERIFIABLE'); }
  const receipts = path.join(privateRoot, 'publication-attempts');
  try {
    await mkdir(receipts, { recursive: true, mode: 0o700 });
    const receiptsStat = await lstat(receipts);
    if (!receiptsStat.isDirectory() || receiptsStat.isSymbolicLink())
      throw Error('PRIVATE_DIRECTORY_UNVERIFIABLE');
  } catch { return blocked('PUBLISH_PRIVATE_STORAGE_UNVERIFIABLE'); }
  const reservation = path.join(receipts, grant.publicationId + '.reserved.json');
  if (!await writeOnce(reservation, { schemaVersion: 1, publicationId: grant.publicationId,
    grantId: grant.grantId, issueNumber: grant.issueNumber, sourceHead: source.head,
    localCommit: grant.localCommit, tree: staged.tree, contentDigest: staged.digest,
    reservedAt: at, state: 'EXTERNAL_REQUEST_OUTCOME_UNCERTAIN_NO_REPLAY' }))
    return blocked('PUBLISH_ALREADY_RESERVED_OR_UNVERIFIABLE');
  const rawRequest = makeRequester(fetchImpl, token);
  // A STOP after reservation makes any possibly-started external operation
  // UNCERTAIN and permanently nonreplayable; never continue the API sequence.
  const request = async (...args) => {
    if (!await operatorOk()) throw Error('OPERATOR_STOP_OR_UNVERIFIABLE');
    const response = await rawRequest(...args);
    if (!await operatorOk()) throw Error('OPERATOR_CHANGED_DURING_EXTERNAL_REQUEST');
    return response;
  };
  let result = uncertain('GITHUB_REQUEST_OUTCOME_UNKNOWN'), phase = 'CHECK_BASE';
  try {
    const main = await request('GET', '/git/ref/heads/main');
    if (main?.ref !== 'refs/heads/main' || main?.object?.sha !== source.head)
      throw Error('REMOTE_MAIN_DRIFT');
    phase = 'CREATE_BLOB';
    const uploaded = await request('POST', '/git/blobs', {
      content: Buffer.from(staged.content, 'utf8').toString('base64'), encoding: 'base64',
    });
    if (uploaded.sha !== staged.blob) throw Error('PUBLISHED_BLOB_MISMATCH');
    phase = 'READ_BASE_TREE';
    const base = await request('GET', '/git/commits/' + source.head);
    if (!SHA.test(base?.tree?.sha || '')) throw Error('REMOTE_BASE_TREE_UNVERIFIABLE');
    phase = 'CREATE_TREE';
    const publishedTree = await request('POST', '/git/trees', {
      base_tree: base.tree.sha,
      tree: [{ path: grant.targetPath, mode: '100644', type: 'blob', sha: staged.blob }],
    });
    if (publishedTree.sha !== staged.tree) throw Error('PUBLISHED_TREE_MISMATCH');
    phase = 'CREATE_COMMIT';
    const publishedCommit = await request('POST', '/git/commits', {
      message: 'fix(#' + grant.issueNumber + '): owner-authorized coding candidate',
      tree: staged.tree, parents: [source.head],
    });
    if (!SHA.test(publishedCommit?.sha || '') ||
        publishedCommit.tree?.sha !== staged.tree ||
        publishedCommit.parents?.length !== 1 ||
        publishedCommit.parents[0]?.sha !== source.head)
      throw Error('PUBLISHED_COMMIT_UNVERIFIABLE');
    phase = 'CREATE_REF';
    const branch = await request('POST', '/git/refs', {
      ref: 'refs/heads/' + grant.branch, sha: publishedCommit.sha,
    });
    if (branch?.ref !== 'refs/heads/' + grant.branch ||
        branch?.object?.sha !== publishedCommit.sha)
      throw Error('PUBLISHED_REF_UNVERIFIABLE');
    // Avoid opening a PR from an already stale base; do not delete the
    // retained branch on drift or retry any uncertain external mutation.
    phase = 'RECHECK_BASE';
    const rechecked = await request('GET', '/git/ref/heads/main');
    if (rechecked?.object?.sha !== source.head) throw Error('REMOTE_MAIN_DRIFT');
    phase = 'CREATE_DRAFT_PR';
    const pr = await request('POST', '/pulls', {
      title: 'fix(#' + grant.issueNumber + '): owner-authorized engineering candidate',
      head: grant.branch, base: 'main', draft: true,
      body: 'Source-bound one-shot coding candidate. Local commit: ' +
        grant.localCommit + '\nOwner grant: ' + grant.grantId +
        '\nFocused tests and independent CI/Windows Product Gate required. ' +
        'Not independently verified; no automatic merge authorization.',
    });
    if (!Number.isSafeInteger(pr?.number) || pr.number <= 0 ||
        pr.draft !== true || pr.state !== 'open' ||
        pr.head?.ref !== grant.branch || pr.head?.sha !== publishedCommit.sha ||
        pr.base?.ref !== 'main')
      throw Error('DRAFT_PR_RESPONSE_UNVERIFIABLE');
    result = Object.freeze({ state: 'DRAFT_PR_CREATED', code: 'EXACT_TREE_DRAFT_PR_PUBLISHED',
      issueNumber: grant.issueNumber, publicationId: grant.publicationId,
      grantId: grant.grantId, sourceHead: source.head, localCommit: grant.localCommit,
      remoteCommit: publishedCommit.sha, tree: staged.tree,
      branch: grant.branch, prNumber: pr.number,
      prUrl: 'https://github.com/' + REPO + '/pull/' + pr.number,
      pullRequestCreated: true, focusedTestExecuted: false,
      independentVerification: false, automaticMergeAuthorized: false,
      replayAuthorized: false });
  } catch {
    result = uncertain(phase);
  }
  if (!await writeOnce(path.join(receipts, grant.publicationId + '.result.json'), result))
    return uncertain('PUBLISH_RESULT_RECEIPT_UNVERIFIABLE');
  return result;
}

/** A worker's prepared commit is not publishable without its exact release receipt. */
export function validateCodingReleaseWitness(release, grant, prepared) {
  return release?.schemaVersion === 1 &&
    release.kind === 'coding-resource-release' &&
    release.state === 'RELEASED_AFTER_DURABLE_RESULT' &&
    release.grantId === grant?.grantId &&
    release.sourceHead === grant?.sourceHead &&
    release.localCommit === grant?.localCommit &&
    release.branch === grant?.branch &&
    prepared?.grantId === release.grantId &&
    prepared.commit === release.localCommit &&
    prepared.sourceHead === release.sourceHead &&
    prepared.branch === release.branch &&
    prepared.state === 'LOCAL_COMMIT_PREPARED' &&
    typeof release.ownershipEpoch === 'string' &&
    /^[a-f0-9-]{36}$/.test(release.ownershipEpoch) &&
    typeof release.ownershipNonce === 'string' &&
    /^[a-f0-9-]{36}$/.test(release.ownershipNonce);
}

/** Local Windows CLI; never installs a service, admits a queue or invokes Pi. */
export async function runOwnerPublishOnce({ publicationId, repoRoot = process.cwd(),
  env = process.env, platform = process.platform, now = Date.now,
} = {}) {
  if (platform !== 'win32' || !ID.test(publicationId || ''))
    return blocked('PUBLISH_WINDOWS_ONLY');
  const source = await gatewayAppSource({ repoRoot, env });
  if (source?.channel !== 'main') return blocked('PUBLISH_EXACT_CLEAN_MAIN_REQUIRED');
  if (!await ownerOneShotAllowed(source.head))
    return blocked('PUBLISH_OWNER_STOP_PAUSE_OR_HEARTBEAT_UNVERIFIABLE');
  const privateRoot = privateGatewayRoot(env);
  let grant, codingGrant, prepared, release;
  try {
    const grantDir = path.join(privateRoot, 'owner-publication-grants');
    grant = await regularJson(path.join(grantDir, publicationId + '.json'), 4096);
    codingGrant = await regularJson(path.join(privateRoot, 'owner-coding-grants',
      grant.grantId + '.json'), 4096);
    prepared = await regularJson(path.join(privateRoot, 'coding-attempts',
      grant.grantId + '.result.json'), 4096);
    release = await regularJson(path.join(privateRoot, 'coding-attempts',
      grant.grantId + '.released.json'), 4096);
    if (!validateCodingReleaseWitness(release, grant, prepared) ||
        !codingReleaseIsReconciled(path.join(privateRoot, 'coding-attempts'), release))
      return blocked('PUBLISH_CODING_OWNERSHIP_RELEASE_UNVERIFIABLE');
    // Legacy shared lock files from the previous worker implementation are
    // unreconciled historical evidence; never use a new witness to bypass them.
    // Current per-attempt evidence files are immutable and are never unlinked.
    for (const name of ['.coding-stage-budget.lock', '.coding-stage-owner.lock']) {
      try {
        await lstat(path.join(privateRoot, 'coding-attempts', name));
        return blocked('PUBLISH_LEGACY_OWNER_RECONCILIATION_REQUIRED');
      } catch (error) {
        if (error?.code !== 'ENOENT')
          return blocked('PUBLISH_CODING_OWNERSHIP_RELEASE_UNVERIFIABLE');
      }
    }
    if (grant.publicationId !== publicationId)
      return blocked('PUBLISH_GRANT_ID_MISMATCH');
  } catch { return blocked('PUBLISH_OWNER_GRANT_OR_CODING_RECEIPT_REQUIRED'); }
  return publishAuthorizedDraftOnce({ repoRoot, privateRoot, source, grant,
    codingGrant, prepared, token: env.PLOTPICKLE_GITHUB_PUBLISH_TOKEN, now,
    operatorReady: () => ownerOneShotAllowed(source.head) });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const result = args.length === 2 && args[0] === '--once'
    ? await runOwnerPublishOnce({ publicationId: args[1] })
    : blocked('PUBLISH_EXACT_ARGUMENTS_REQUIRED');
  process.stdout.write(JSON.stringify(result) + '\n');
  if (result.state !== 'DRAFT_PR_CREATED') process.exitCode = 2;
}
