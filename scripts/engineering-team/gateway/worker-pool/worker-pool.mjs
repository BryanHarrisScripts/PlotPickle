/**
 * #3142/#3302: one Software Factory, four worker roles, no implicit grants.
 * The F00 signer is an EXTERNAL Windows identity; it is never a coding child.
 * This is a candidate scheduling primitive, not an independent verifier.
 */
import { open, lstat, mkdir } from 'node:fs/promises';
import path from 'node:path';

const SHA = /^[a-f0-9]{40}$/;
const ID = /^[a-f0-9]{32}$/;
const ROLES = Object.freeze([
  Object.freeze({ id: 'independent-reviewer', authority: 'external-lane-a-service', slot: 0 }),
  Object.freeze({ id: 'coding-dispatcher', authority: 'owner-windows-supervisor', slot: 0 }),
  Object.freeze({ id: 'coding-worker-1', authority: 'owner-granted-coding', slot: 1 }),
  Object.freeze({ id: 'coding-worker-2', authority: 'owner-granted-coding', slot: 2 }),
]);
export { ROLES as FACTORY_WORKERS };

const fail = code => Object.freeze({ state: 'BLOCKED', code, modelInvoked: false,
  independentVerification: false, mergeAuthorized: false, replayAuthorized: false });

/** STATUS ONLY. Never derive independent F00 qualification from a text flag. */
export function projectWorkerFleet({ expectedHead, supervisor, reviewer, verifiedCycles = 0 } = {}) {
  const base = SHA.test(expectedHead || '') && supervisor?.state === 'RUNNING' &&
    supervisor?.exactSha === expectedHead;
  const stop = !base || supervisor?.pauseAcknowledged === true;
  const roles = ROLES.map(({ id, authority, slot }) => {
    let state = 'BLOCKED';
    let code = 'SUPERVISOR_NOT_RUNNING_ON_EXACT_HEAD';
    if (!stop) {
      if (id === 'independent-reviewer') {
        code = 'EXTERNAL_F00_SIGNED_QUALIFICATION_REQUIRED';
      } else if (id === 'coding-dispatcher') {
        code = 'AUTHENTICATED_QUEUE_AND_DISPATCHER_RELEASE_REQUIRED';
      } else if (id === 'coding-worker-1') {
        code = 'ONE_USE_OWNER_GRANT_AND_INDEPENDENT_GATE_REQUIRED';
      } else {
        state = 'PARKED';
        code = verifiedCycles >= 2 ? 'TWO_WORKER_RESOURCE_SAFETY_NOT_YET_ADMITTED' :
          'TWO_CONSECUTIVE_CYCLES_REQUIRED';
      }
    }
    return Object.freeze({ id, authority, slot, state, code, processVerified: false,
      independentlyAdmitted: false, canCode: false, canMerge: false });
  });
  // Reviewer metadata is not a signer attestation. Never publish a positive
  // admission claim from a coding or dashboard process.
  void reviewer;
  return Object.freeze({ schemaVersion: 1, state: 'RELEASE_GATED',
    sourceHead: SHA.test(expectedHead || '') ? expectedHead : null,
    workers: Object.freeze(roles), onlineCodingWorkers: 0,
    mayMerge: false, mayAdmitTests: false });
}

export function validateOwnerWorkOrder(work, expectedHead) {
  return Boolean(work && Object.getPrototypeOf(work) === Object.prototype &&
    Object.keys(work).sort().join(',') ===
      ['assignedWorker','consent','grantId','issueNumber','kind','publicationId','requestId','schemaVersion','sourceHead'].sort().join(',') &&
    work.schemaVersion === 1 && work.kind === 'owner-authorized-factory-job' &&
    work.consent === 'ONE_OWNER_AUTHORIZED_JOB_NO_REPLAY' &&
    work.assignedWorker === 'coding-worker-1' &&
    ID.test(work.requestId || '') && ID.test(work.grantId || '') &&
    ID.test(work.publicationId || '') && work.grantId !== work.publicationId &&
    Number.isSafeInteger(work.issueNumber) && work.issueNumber > 0 &&
    work.issueNumber <= 9999999 && SHA.test(expectedHead || '') &&
    work.sourceHead === expectedHead);
}

/**
 * Atomic, no-steal, no-replay claim for one already owner-granted job.
 * A queue JSON record never supplies coding, model or PR permissions.
 * No timeout or crashed process can cause this claim to be retried.
 */
export async function claimAndRunOwnerJobOnce({
  order, expectedHead, privateRoot, operatorReady,
  independentReleaseReady, runAuthorizedOnce,
} = {}) {
  if (!validateOwnerWorkOrder(order, expectedHead)) return fail('OWNER_WORK_ORDER_INVALID');
  if (typeof privateRoot !== 'string' || !path.isAbsolute(privateRoot) ||
    typeof operatorReady !== 'function' || typeof independentReleaseReady !== 'function' ||
    typeof runAuthorizedOnce !== 'function') return fail('WORKER_BOUNDARIES_MISSING');
  // These callbacks must be independently wired on the owner host; a coding
  // manifest or this library cannot manufacture external release authority.
  try {
    if (await operatorReady() !== true) return fail('OWNER_STOP_PAUSE_OR_HEAD_UNVERIFIABLE');
    if (await independentReleaseReady() !== true) return fail('INDEPENDENT_RELEASE_NOT_ESTABLISHED');
  } catch { return fail('AUTHORITY_OBSERVATION_UNVERIFIABLE'); }
  const dir = path.join(privateRoot, 'factory-worker-claims');
  try {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const claimDirStat = await lstat(dir);
    if (!claimDirStat.isDirectory() || claimDirStat.isSymbolicLink())
      throw Error('PRIVATE_STORAGE_UNTRUSTED');
  } catch { return fail('CLAIM_STORAGE_UNVERIFIABLE'); }
  const file = path.join(dir, order.requestId + '.json');
  let handle;
  try {
    handle = await open(file, 'wx', 0o600);
    await handle.writeFile(JSON.stringify({ schemaVersion: 1,
      requestId: order.requestId, issueNumber: order.issueNumber,
      sourceHead: expectedHead, workerId: order.assignedWorker,
      state: 'RESERVED_NO_REPLAY' }) + '\n');
    await handle.sync();
  } catch { return fail('JOB_ALREADY_CLAIMED_OR_UNVERIFIABLE'); }
  finally { if (handle) await handle.close().catch(() => {}); }
  // A STOP after reservation blocks the job permanently pending external
  // reconciliation. No automated claim deletion, retry or issue rotation.
  try {
    if (await operatorReady() !== true || await independentReleaseReady() !== true)
      return fail('CLAIM_RETAINED_AUTHORITY_CHANGED');
    const result = await runAuthorizedOnce({ grantId: order.grantId,
      publicationId: order.publicationId });
    if (await operatorReady() !== true || await independentReleaseReady() !== true)
      return fail('CLAIM_RETAINED_AUTHORITY_CHANGED_AFTER_EXECUTION');
    if (result?.state !== 'DRAFT_PR_CREATED' ||
      result.grantId !== order.grantId ||
      result.publicationId !== order.publicationId ||
      result.issueNumber !== order.issueNumber ||
      result.sourceHead !== expectedHead ||
      result.pullRequestCreated !== true ||
      result.focusedTestExecuted !== false ||
      result.independentVerification !== false ||
      result.automaticMergeAuthorized !== false ||
      result.replayAuthorized !== false ||
      !SHA.test(result.remoteCommit || '') ||
      !Number.isSafeInteger(result.prNumber) || result.prNumber <= 0 ||
      !/^[a-f0-9]{64}$/.test(result.engineeringReceiptId || ''))
      return fail('CLAIM_RETAINED_CODING_OR_PUBLICATION_UNPROVEN');
    return Object.freeze({ state: 'DRAFT_PR_RECEIPT_READY',
      requestId: order.requestId, issueNumber: order.issueNumber,
      candidateHead: result.remoteCommit, prNumber: result.prNumber,
      engineeringReceiptId: result.engineeringReceiptId,
      independentVerification: false, mayMerge: false, replayAuthorized: false });
  } catch { return fail('CLAIM_RETAINED_EXECUTION_UNCERTAIN'); }
}
