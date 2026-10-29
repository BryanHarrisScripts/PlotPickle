/**
 * #3142 owner one-shot pilot safety gate. This is a read-only observation,
 * never a coding dispatcher, worker identity proof or merge authorization.
 * The existing Windows Supervisor owns STOP/PAUSE and heartbeat semantics.
 */
import { supervisorStatus } from '../windows/supervisor/unattended-supervisor.mjs';

const SHA = /^[a-f0-9]{40}$/;

export async function ownerOneShotAllowed(expectedHead, { inspect = supervisorStatus, appRoot } = {}) {
  if (!SHA.test(expectedHead || '')) return false;
  let observed = null, inspectionFault = null;
  try { observed = await inspect(appRoot === undefined ? {} : { appRoot }); }
  catch (error) { inspectionFault = String(error?.code ?? 'UNCLASSIFIED'); }
  // STOP, malformed authority, failed inspection and stale heartbeat all deny.
  // A fresh Supervisor heartbeat alone is NOT a worker identity proof.
  return inspectionFault === null && observed?.state === 'RUNNING' &&
    observed.exactSha === expectedHead;
}
