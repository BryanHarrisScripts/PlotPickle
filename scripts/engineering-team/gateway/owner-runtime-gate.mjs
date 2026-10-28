/**
 * #3142 owner one-shot pilot safety gate. This is a read-only observation,
 * never a coding dispatcher, worker identity proof or merge authorization.
 * The existing Windows Supervisor owns STOP/PAUSE and heartbeat semantics.
 */
import { supervisorStatus } from '../windows/supervisor/unattended-supervisor.mjs';

const SHA = /^[a-f0-9]{40}$/;

export async function ownerOneShotAllowed(expectedHead, { inspect = supervisorStatus, appRoot } = {}) {
  if (!SHA.test(expectedHead || '')) return false;
  try {
    const observed = await inspect(appRoot === undefined ? {} : { appRoot });
    // Fail closed for STOP/PAUSE, malformed authority, stale heartbeat and
    // different source head; a fresh Supervisor heartbeat is NOT worker proof.
    return observed?.state === 'RUNNING' && observed.exactSha === expectedHead;
  } catch { return false; }
}
