/**
 * #3302: separate, read-only GitHub CI observation for a previously published
 * engineering candidate. Never treats hosted CI as owner-Windows Product Gate.
 * No coding, provider invocation, queue admission, process control or merge.
 */
import { createHash } from 'node:crypto';
import { mkdir, lstat, readFile, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateGatewayRoot } from '../gateway-host.mjs';

const ID = /^[a-f0-9]{32}$/;
const SHA = /^[a-f0-9]{40}$/;
const REPO = 'BryanHarrisScripts/PlotPickle';
const API = 'https://api.github.com/repos/' + REPO;
const ARCHITECTURE_LAYERS = Object.freeze([
  'Layer 1 Experience Skins',
  'Layer 2 Experience Contract',
  'Layer 3 Production Orchestration',
  'Layer 4 Agent & Skill Mesh',
  'Layer 5 Story / Canon / Evidence',
  'Layer 6 Provider Runtime',
  'Layer 7 Validation & Operations',
]);
const blocked = code => Object.freeze({
  state: 'BLOCKED', code, hostedCiVerified: false,
  ownerWindowsVerified: false, independentVerification: false,
  automaticMergeAuthorized: false, replayAuthorized: false,
});
const unknown = code => Object.freeze({
  state: 'UNKNOWN', code, hostedCiVerified: false,
  ownerWindowsVerified: false, independentVerification: false,
  automaticMergeAuthorized: false, replayAuthorized: false,
});
const hash = text => createHash('sha256').update(text).digest('hex');

async function regularJson(file) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 8192)
    throw Error('RECEIPT_NOT_REGULAR');
  return JSON.parse(await readFile(file, 'utf8'));
}
function matchingEngineering(pub, prepared, publicationId) {
  return pub?.state === 'DRAFT_PR_CREATED' && pub.publicationId === publicationId &&
    ID.test(pub.grantId || '') && SHA.test(pub.sourceHead || '') &&
    SHA.test(pub.remoteCommit || '') && SHA.test(pub.localCommit || '') &&
    Number.isSafeInteger(pub.prNumber) && pub.prNumber > 0 &&
    pub.pullRequestCreated === true && pub.independentVerification === false &&
    pub.automaticMergeAuthorized === false &&
    prepared?.state === 'LOCAL_COMMIT_PREPARED' &&
    prepared.grantId === pub.grantId && prepared.sourceHead === pub.sourceHead &&
    prepared.commit === pub.localCommit && prepared.issueNumber === pub.issueNumber &&
    prepared.pullRequestCreated === false && prepared.independentVerification === false;
}
export function assessHostedCi({ pub, pr, run, jobs }) {
  if (pr?.number !== pub.prNumber || pr?.state !== 'open' || pr?.draft !== true ||
      pr?.base?.ref !== 'main' || pr?.head?.sha !== pub.remoteCommit)
    return blocked('GITHUB_PR_IDENTITY_MISMATCH');
  if (!run) return unknown('CI_RUN_MISSING');
  if (run.name !== 'Architecture Verification' ||
      run.head_sha !== pub.remoteCommit || run.event !== 'pull_request' ||
      !Number.isSafeInteger(run.id) || run.id < 1 ||
      !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1)
    return blocked('CI_RUN_IDENTITY_MISMATCH');
  if (Array.isArray(run.pull_requests) && run.pull_requests.length > 0 &&
      !run.pull_requests.some(x => x?.number === pub.prNumber))
    return blocked('CI_RUN_PR_MISMATCH');
  if (run.status !== 'completed') return unknown('CI_NOT_COMPLETE');
  if (run.conclusion !== 'success') return blocked('CI_RUN_NOT_SUCCESSFUL');
  if (!jobs || !Number.isSafeInteger(jobs.total_count) ||
      jobs.total_count < 7 || jobs.total_count > 100 ||
      !Array.isArray(jobs.jobs) || jobs.jobs.length !== jobs.total_count)
    return blocked('CI_JOB_LIST_INCOMPLETE');
  const seen = new Set();
  for (const job of jobs.jobs) {
    if (typeof job?.name !== 'string' || seen.has(job.name))
      return blocked('CI_DUPLICATE_OR_INVALID_JOB');
    seen.add(job.name);
    if (job.status !== 'completed' || !['success', 'skipped'].includes(job.conclusion))
      return blocked('CI_JOB_FAILED_OR_UNFINISHED');
  }
  if (ARCHITECTURE_LAYERS.some(name =>
    !jobs.jobs.some(job => job.name === name && job.conclusion === 'success')))
    return blocked('CI_REQUIRED_LAYER_MISSING_OR_SKIPPED');
  return Object.freeze({
    state: 'UNKNOWN', code: 'CI_PASSED_OWNER_WINDOWS_UNKNOWN',
    hostedCiVerified: true, ownerWindowsVerified: false,
    independentVerification: false, automaticMergeAuthorized: false,
    replayAuthorized: false, ciRunId: run.id, ciRunAttempt: run.run_attempt,
  });
}
function githubReader(fetchImpl, token) {
  return async suffix => {
    const headers = { Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetchImpl(API + suffix, {
      method: 'GET', headers, signal: AbortSignal.timeout(20000),
    });
    if (!response?.ok) throw Error('GITHUB_READ_UNVERIFIED');
    const body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > 512000)
      throw Error('GITHUB_RESPONSE_TOO_LARGE');
    return JSON.parse(body);
  };
}
async function writeOnce(file, value) {
  let handle;
  try {
    handle = await open(file, 'wx', 0o600);
    await handle.writeFile(JSON.stringify(value) + '\n');
    await handle.sync();
    return true;
  } catch {
    return false;
  } finally {
    if (handle) await handle.close();
  }
}
/** Each verificationId is write-once; a later CI attempt uses a NEW id. */
export async function collectIndependentVerifierOnce({
  publicationId, verificationId, privateRoot, token = '',
  fetchImpl = globalThis.fetch, now = Date.now,
} = {}) {
  if (!ID.test(publicationId || '') || !ID.test(verificationId || '') ||
      typeof privateRoot !== 'string' || !path.isAbsolute(privateRoot) ||
      typeof fetchImpl !== 'function') return blocked('VERIFIER_INPUT_INVALID');
  const outputDir = path.join(privateRoot, 'verification-attempts');
  const resultFile = path.join(outputDir, verificationId + '.result.json');
  try {
    await mkdir(outputDir, { recursive: true, mode: 0o700 });
    const [rootStat, dirStat] = await Promise.all([
      lstat(privateRoot), lstat(outputDir),
    ]);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink() ||
        !dirStat.isDirectory() || dirStat.isSymbolicLink())
      return blocked('VERIFIER_STORAGE_UNVERIFIABLE');
    try {
      await lstat(resultFile);
      return blocked('VERIFICATION_ALREADY_RECORDED');
    } catch (error) {
      if (error?.code !== 'ENOENT') return blocked('VERIFIER_STORAGE_UNVERIFIABLE');
    }
  } catch { return blocked('VERIFIER_STORAGE_UNVERIFIABLE'); }
  let pub, prepared;
  try {
    pub = await regularJson(path.join(privateRoot, 'publication-attempts',
      publicationId + '.result.json'));
    prepared = await regularJson(path.join(privateRoot, 'coding-attempts',
      pub.grantId + '.result.json'));
  } catch { return blocked('ENGINEERING_RECEIPTS_UNVERIFIABLE'); }
  if (!matchingEngineering(pub, prepared, publicationId))
    return blocked('ENGINEERING_RECEIPTS_MISMATCH');
  const get = githubReader(fetchImpl, token);
  let assessment = unknown('GITHUB_READ_UNVERIFIED');
  try {
    const pr = await get('/pulls/' + pub.prNumber);
    if (pr?.head?.sha !== pub.remoteCommit || pr?.number !== pub.prNumber ||
        pr?.state !== 'open' || pr?.draft !== true || pr?.base?.ref !== 'main') {
      assessment = blocked('GITHUB_PR_IDENTITY_MISMATCH');
    } else {
      const runs = await get('/actions/runs?head_sha=' + pub.remoteCommit +
        '&event=pull_request&per_page=100');
      if (!Number.isSafeInteger(runs?.total_count) || runs.total_count > 100 ||
          !Array.isArray(runs.workflow_runs)) {
        assessment = blocked('CI_RUN_LIST_INCOMPLETE');
      } else {
        const matches = runs.workflow_runs.filter(x =>
          x?.name === 'Architecture Verification' &&
          x?.head_sha === pub.remoteCommit && x?.event === 'pull_request');
        matches.sort((a, b) => b.id - a.id);
        const run = matches[0] || null;
        if (!run || run.status !== 'completed') {
          assessment = assessHostedCi({ pub, pr, run, jobs: null });
        } else {
          const jobs = await get('/actions/runs/' + run.id + '/jobs?per_page=100');
          assessment = assessHostedCi({ pub, pr, run, jobs });
        }
        // Recheck PR identity after CI reads to reject head changes mid-read.
        const finalPr = await get('/pulls/' + pub.prNumber);
        if (finalPr?.head?.sha !== pub.remoteCommit || finalPr?.state !== 'open' ||
            finalPr?.draft !== true || finalPr?.base?.ref !== 'main')
          assessment = blocked('GITHUB_PR_CHANGED_DURING_READ');
      }
    }
  } catch { assessment = unknown('GITHUB_READ_UNVERIFIED'); }
  const observedAt = now();
  const body = {
    schemaVersion: 1, kind: 'independent-hosted-ci-observation',
    verificationId, publicationId, grantId: pub.grantId,
    issueNumber: pub.issueNumber, sourceHead: pub.sourceHead,
    candidateHead: pub.remoteCommit, prNumber: pub.prNumber,
    observedAt, ...assessment,
  };
  const result = Object.freeze({ ...body,
    receiptId: hash(JSON.stringify(body)) });
  if (!await writeOnce(resultFile, result))
    return blocked('VERIFICATION_ALREADY_RECORDED_OR_UNVERIFIABLE');
  return result;
}
export async function runOwnerVerifierOnce({ publicationId, verificationId,
  env = process.env, platform = process.platform } = {}) {
  if (platform !== 'win32') return blocked('VERIFIER_WINDOWS_ONLY');
  return collectIndependentVerifierOnce({ publicationId, verificationId,
    privateRoot: privateGatewayRoot(env),
    token: env.PLOTPICKLE_GITHUB_READ_TOKEN || '' });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const result = args.length === 3 && args[0] === '--once'
    ? await runOwnerVerifierOnce({ publicationId: args[1], verificationId: args[2] })
    : blocked('VERIFIER_EXACT_ARGUMENTS_REQUIRED');
  process.stdout.write(JSON.stringify(result) + '\n');
  if (result.hostedCiVerified !== true) process.exitCode = 2;
}
