/**
 * #3142: one-use, owner-authorized publication of an already prepared local commit.
 * Not a dispatcher, test runner, credential provisioner, merge or retry mechanism.
 * Import is inert. Never takes shell, path or PR text from a model or issue body.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gatewayAppSource, privateGatewayRoot } from './gateway-host.mjs';

const exec = promisify(execFile);
const ID = /^[a-f0-9]{32}$/;
const SHA = /^[a-f0-9]{40}$/;
const SOURCE = /^scripts\/engineering-team\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.mjs$/;
const CONSENT = 'AUTHORIZE_ONE_DRAFT_PR_PUBLICATION';
const ORIGIN = /^(?:https:\/\/github\.com\/|git@github\.com:)BryanHarrisScripts\/PlotPickle(?:\.git)?$/i;
const API = 'https://api.github.com/repos/BryanHarrisScripts/PlotPickle/pulls';
const exact = (value, keys) => value && typeof value === 'object' &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const blocked = code => Object.freeze({ state: 'BLOCKED', code, pullRequestCreated: false,
  independentVerification: false, automaticMergeAuthorized: false, replayAuthorized: false });

export function validatePublicationGrant(grant, source, at) {
  return exact(grant, ['schemaVersion', 'kind', 'publicationId', 'grantId', 'issueNumber',
    'sourceHead', 'preparedCommit', 'targetPath', 'branch', 'expiresAt',
    'maxPushes', 'maxPrRequests', 'consent']) &&
    grant.schemaVersion === 1 && grant.kind === 'draft-pr-publication-once' &&
    ID.test(grant.publicationId) && ID.test(grant.grantId) &&
    grant.publicationId !== grant.grantId &&
    Number.isInteger(grant.issueNumber) && grant.issueNumber >= 1 &&
    grant.issueNumber <= 9_999_999 && source?.channel === 'main' &&
    SHA.test(source.head || '') && grant.sourceHead === source.head &&
    SHA.test(grant.preparedCommit) && grant.preparedCommit !== source.head &&
    SOURCE.test(grant.targetPath) &&
    grant.branch === `engineering/${grant.issueNumber}-${grant.grantId}` &&
    Number.isSafeInteger(grant.expiresAt) && grant.expiresAt > at + 30_000 &&
    grant.expiresAt <= at + 3_600_000 &&
    grant.maxPushes === 1 && grant.maxPrRequests === 1 && grant.consent === CONSENT;
}

async function privateJson(filename, max = 8192) {
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > max)
    throw Error('PRIVATE_FILE_UNVERIFIABLE');
  return JSON.parse(await readFile(filename, 'utf8'));
}
async function privateDirectory(filename) {
  const stat = await lstat(filename);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('PRIVATE_DIRECTORY_UNVERIFIABLE');
}
async function writeOnce(filename, value) {
  let handle;
  try {
    handle = await open(filename, 'wx', 0o600);
    await handle.writeFile(JSON.stringify(value) + '\n');
    await handle.sync();
    return true;
  } catch { return false; }
  finally { await handle?.close().catch(() => {}); }
}
async function defaultGit(cwd, args) {
  return exec('git', args, { cwd, windowsHide: true, timeout: 45_000, maxBuffer: 4096,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } });
}
const output = result => String(result?.stdout || '').trim();

/**
 * Each external write is preceded by a write-once private reservation.
 * An uncertain push/POST is NEVER repeated; reconciliation must be read-only.
 * runGit and createPr are fixture seams, not remote MCP capabilities.
 */
export async function publishPreparedCommit({ repoRoot, privateRoot, source, grant,
  token, runGit = defaultGit, createPr = null, now = Date.now } = {}) {
  const at = now();
  if (!validatePublicationGrant(grant, source, at)) return blocked('PUBLISH_OWNER_GRANT_REQUIRED');
  if (!path.isAbsolute(repoRoot || '') || !path.isAbsolute(privateRoot || '') ||
      typeof token !== 'string' || token.length < 20)
    return blocked('PUBLISH_HOST_OR_CREDENTIAL_UNAVAILABLE');

  const receipts = path.join(privateRoot, 'coding-attempts');
  const publications = path.join(privateRoot, 'coding-publications');
  const stage = path.join(privateRoot, 'coding-worktrees', grant.grantId);
  let prepared;
  try {
    await privateDirectory(privateRoot);
    await privateDirectory(receipts);
    await privateDirectory(path.join(privateRoot, 'coding-worktrees'));
    await privateDirectory(stage);
    prepared = await privateJson(path.join(receipts, grant.grantId + '.result.json'));
    if (prepared.state !== 'LOCAL_COMMIT_PREPARED' ||
        prepared.grantId !== grant.grantId ||
        prepared.issueNumber !== grant.issueNumber ||
        prepared.sourceHead !== grant.sourceHead ||
        prepared.commit !== grant.preparedCommit ||
        prepared.branch !== grant.branch ||
        prepared.sourceMutationVerified !== true ||
        prepared.pullRequestCreated !== false ||
        prepared.independentVerification !== false)
      return blocked('PUBLISH_PREPARED_RECEIPT_MISMATCH');
    // The original edit grant is also required; the publisher cannot widen its path.
    const editGrant = await privateJson(path.join(privateRoot, 'owner-coding-grants',
      grant.grantId + '.json'), 4096);
    if (editGrant.grantId !== grant.grantId || editGrant.targetPath !== grant.targetPath ||
        editGrant.issueNumber !== grant.issueNumber ||
        editGrant.sourceHead !== grant.sourceHead)
      return blocked('PUBLISH_EDIT_SCOPE_MISMATCH');
    await mkdir(publications, { recursive: true, mode: 0o700 });
    await privateDirectory(publications);
  } catch { return blocked('PUBLISH_PRIVATE_EVIDENCE_UNVERIFIABLE'); }

  const prefix = path.join(publications, grant.publicationId);
  // No duplicate attempt, even if the first run crashed before any network call.
  try { await lstat(prefix + '.reserved.json'); return blocked('PUBLISH_ALREADY_RESERVED'); }
  catch (error) { if (error?.code !== 'ENOENT') return blocked('PUBLISH_RESERVATION_UNVERIFIABLE'); }

  const branchRef = 'refs/heads/' + grant.branch;
  try {
    if (!ORIGIN.test(output(await runGit(repoRoot, ['remote', 'get-url', 'origin']))))
      return blocked('PUBLISH_ORIGIN_UNTRUSTED');
    if (output(await runGit(stage, ['rev-parse', 'HEAD'])) !== grant.preparedCommit ||
        output(await runGit(stage, ['rev-parse', '--verify', grant.branch])) !== grant.preparedCommit ||
        output(await runGit(stage, ['show', '-s', '--format=%P', 'HEAD'])) !== grant.sourceHead ||
        output(await runGit(stage, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'])) !== grant.targetPath ||
        output(await runGit(stage, ['status', '--porcelain', '--untracked-files=all'])) !== '')
      return blocked('PUBLISH_COMMIT_SCOPE_UNVERIFIABLE');
    if (output(await runGit(repoRoot, ['ls-remote', '--heads', 'origin', branchRef])) !== '')
      return blocked('PUBLISH_REMOTE_BRANCH_EXISTS');
  } catch { return blocked('PUBLISH_PREFLIGHT_UNVERIFIABLE'); }

  if (!await writeOnce(prefix + '.reserved.json', {
    schemaVersion: 1, publicationId: grant.publicationId, grantId: grant.grantId,
    issueNumber: grant.issueNumber, commit: grant.preparedCommit,
    branch: grant.branch, reservedAt: at, state: 'RESERVED_NO_REPLAY'
  })) return blocked('PUBLISH_ALREADY_RESERVED');

  // Fixed Git invocation; no model-authored command, hook, refspec or URL.
  try {
    const hooks = path.join(privateRoot, 'disabled-hooks');
    await mkdir(hooks, { recursive: true, mode: 0o700 });
    await runGit(stage, ['-c', 'core.hooksPath=' + hooks, 'push', '--porcelain',
      'origin', grant.preparedCommit + ':' + branchRef]);
    const observed = output(await runGit(repoRoot, ['ls-remote', '--heads', 'origin', branchRef]));
    if (observed !== grant.preparedCommit + '\t' + branchRef)
      return blocked('PUBLISH_PUSH_OUTCOME_UNCERTAIN');
    if (!await writeOnce(prefix + '.pushed.json', {
      state: 'REMOTE_COMMIT_OBSERVED', publicationId: grant.publicationId,
      commit: grant.preparedCommit, branch: grant.branch, observedAt: now()
    })) return blocked('PUBLISH_PUSH_RECEIPT_UNVERIFIABLE');
  } catch { return blocked('PUBLISH_PUSH_OUTCOME_UNCERTAIN'); }

  if (!await writeOnce(prefix + '.pr-attempt.json', {
    state: 'PR_REQUEST_RESERVED_NO_REPLAY', publicationId: grant.publicationId,
    commit: grant.preparedCommit, reservedAt: now()
  })) return blocked('PUBLISH_PR_RESERVATION_UNVERIFIABLE');

  const payload = { title: `fix(#${grant.issueNumber}): owner-authorized bounded edit`,
    head: grant.branch, base: 'main', draft: true, maintainer_can_modify: false,
    body: `Closes no issue automatically. Prepared under owner grant ${grant.grantId}.\n\n` +
      `Issue #${grant.issueNumber}; source ${grant.sourceHead}; prepared commit ${grant.preparedCommit}.\n` +
      `Changed path: ${grant.targetPath}. Focused tests and independent owner-Windows acceptance PENDING.\n` +
      'Do not merge until exact-head CI, independent verification and applicable acceptance are green.' };
  try {
    const request = createPr || (async data => {
      const response = await fetch(API, { method: 'POST', redirect: 'error',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
        body: JSON.stringify(data), signal: AbortSignal.timeout(30_000) });
      if (response.status !== 201) throw Error('PR_RESPONSE_NOT_CREATED');
      return response.json();
    });
    const pr = await request(payload);
    if (!Number.isInteger(pr?.number) || pr.number < 1 || pr?.draft !== true ||
        pr?.state !== 'open' || pr?.head?.sha !== grant.preparedCommit ||
        pr?.head?.ref !== grant.branch || pr?.base?.ref !== 'main' ||
        pr?.head?.repo?.full_name !== 'BryanHarrisScripts/PlotPickle')
      return blocked('PUBLISH_PR_OUTCOME_UNCERTAIN');
    const result = Object.freeze({ state: 'DRAFT_PR_CREATED', issueNumber: grant.issueNumber,
      publicationId: grant.publicationId, grantId: grant.grantId,
      sourceHead: grant.sourceHead, commit: grant.preparedCommit,
      branch: grant.branch, pullRequestNumber: pr.number,
      pullRequestCreated: true, focusedTestExecuted: false,
      independentVerification: false, automaticMergeAuthorized: false, replayAuthorized: false });
    if (!await writeOnce(prefix + '.result.json', result))
      return blocked('PUBLISH_PR_RESULT_UNVERIFIABLE');
    return result;
  } catch { return blocked('PUBLISH_PR_OUTCOME_UNCERTAIN'); }
}

/** Windows owner CLI. Separate local publication grant; no automatic publishing. */
export async function runOwnerPublishOnce({ publicationId, env = process.env,
  platform = process.platform, repoRoot = process.cwd(), now = Date.now } = {}) {
  if (platform !== 'win32' || !ID.test(publicationId || ''))
    return blocked('PUBLISH_WINDOWS_ONLY');
  const source = await gatewayAppSource({ repoRoot, env });
  if (!source || source.channel !== 'main') return blocked('PUBLISH_EXACT_CLEAN_MAIN_REQUIRED');
  const privateRoot = privateGatewayRoot(env);
  let grant;
  try {
    grant = await privateJson(path.join(privateRoot, 'owner-publish-grants',
      publicationId + '.json'), 4096);
    if (grant.publicationId !== publicationId) return blocked('PUBLISH_GRANT_ID_MISMATCH');
  } catch { return blocked('PUBLISH_OWNER_GRANT_REQUIRED'); }
  return publishPreparedCommit({ repoRoot, privateRoot, source, grant,
    token: env.PLOTPICKLE_GITHUB_TOKEN, now });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const result = args.length === 2 && args[0] === '--once'
    ? await runOwnerPublishOnce({ publicationId: args[1] })
    : blocked('PUBLISH_EXACT_ARGUMENTS_REQUIRED');
  process.stdout.write(JSON.stringify(result) + '\n');
  if (result.state !== 'DRAFT_PR_CREATED') process.exitCode = 2;
}
