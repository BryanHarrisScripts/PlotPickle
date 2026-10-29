#!/usr/bin/env node
/**
 * #3142 candidate Windows worker entry point. Does not activate F00 signer,
 * mint private grants, bypass local STOP, or dispatch legacy Pi jobs.
 */
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { gatewayAppSource, privateGatewayRoot } from '../gateway-host.mjs';
import { ownerOneShotAllowed } from '../owner-runtime-gate.mjs';
import { runOwnerCodingAndPublishOnce } from '../authorized-coding-once.mjs';
import { supervisorStatus } from '../../windows/supervisor/unattended-supervisor.mjs';
import { FACTORY_WORKERS, projectWorkerFleet, claimAndRunOwnerJobOnce } from './worker-pool.mjs';

const ID = /^[a-f0-9]{32}$/;
const blocked = code => ({ state: 'BLOCKED', code,
  independentVerification: false, automaticMergeEnabled: false,
  replayAuthorized: false });

export async function readOwnerOrder(root, id) {
  if (!ID.test(id || '')) return null;
  const directory = path.join(root, 'owner-work-orders');
  const p = path.join(directory, id + '.json');
  try {
    // The JSON file may be regular while an ancestor is a junction/symlink.
    // Never follow an owner-order directory redirected outside private storage.
    const parent = await lstat(directory);
    if (!parent.isDirectory() || parent.isSymbolicLink()) return null;
    const stat = await lstat(p);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 4096)
      return null;
    const order = JSON.parse(await readFile(p, 'utf8'));
    return order?.requestId === id ? order : null;
  } catch { return null; }
}

/** Runtime records are observations, not proof of separate reviewer custody. */
export async function inspectOwnerWorkerFleet({
  repoRoot = process.cwd(), env = process.env, inspect = supervisorStatus,
} = {}) {
  const source = await gatewayAppSource({ repoRoot, env });
  if (!source || source.channel !== 'main') return blocked('EXACT_CLEAN_MAIN_REQUIRED');
  let supervisor;
  try { supervisor = await inspect(); } catch { supervisor = null; }
  return projectWorkerFleet({ expectedHead: source.head, supervisor });
}

/** Live release is intentionally not bootstrapped by author-controlled code. */
export async function runOwnerWorkerTicket({
  role, requestId, repoRoot = process.cwd(), env = process.env,
  platform = process.platform, independentReleaseReady = async () => false,
  code = runOwnerCodingAndPublishOnce,
} = {}) {
  if (platform !== 'win32') return blocked('WINDOWS_ONLY');
  if (!FACTORY_WORKERS.some(x => x.id === role)) return blocked('UNKNOWN_WORKER_ROLE');
  if (role === 'independent-reviewer') return blocked('F00_SEPARATE_WINDOWS_SERVICE_REQUIRED');
  if (role === 'coding-dispatcher') return blocked('DISPATCHER_DURABLE_GRANT_BROKER_NOT_ADMITTED');
  if (role === 'coding-worker-2') return blocked('TWO_CONSECUTIVE_CYCLES_AND_RESOURCE_PROOF_REQUIRED');
  if (!ID.test(requestId || '')) return blocked('OWNER_REQUEST_ID_REQUIRED');
  const source = await gatewayAppSource({ repoRoot, env });
  if (!source || source.channel !== 'main') return blocked('EXACT_CLEAN_MAIN_REQUIRED');
  const root = privateGatewayRoot(env);
  const order = await readOwnerOrder(root, requestId);
  if (!order) return blocked('PRIVATE_OWNER_WORK_ORDER_REQUIRED');
  return claimAndRunOwnerJobOnce({
    order, expectedHead: source.head, privateRoot: root,
    operatorReady: () => ownerOneShotAllowed(source.head),
    independentReleaseReady,
    runAuthorizedOnce: code,
  });
}

async function main() {
  const args = process.argv.slice(2);
  let result;
  if (args.length === 1 && args[0] === '--status') {
    result = await inspectOwnerWorkerFleet();
  } else if (args.length === 2 && args[0] === '--serve' &&
    FACTORY_WORKERS.some(x => x.id === args[1])) {
    // Registered task is inert until independently signed F00 admission,
    // exact-head Product Gate, a separate owner grant broker and two-cycle proof.
    // No background agent, polling/paid dispatch, STOP clearing or Pi fallback.
    result = blocked('SCHEDULED_ROLE_NOT_RELEASED_OR_INDEPENDENTLY_ADMITTED');
  } else if (args.length === 3 && args[0] === '--once' &&
    FACTORY_WORKERS.some(x => x.id === args[1])) {
    result = await runOwnerWorkerTicket({ role: args[1], requestId: args[2] });
  } else {
    result = blocked('WORKER_STATUS_OR_ONE_AUTHORIZED_TICKET_ONLY');
  }
  process.stdout.write(JSON.stringify(result) + '\n');
  if (result.state !== 'DRAFT_PR_RECEIPT_READY' &&
      !(args.length === 1 && args[0] === '--status')) process.exitCode = 2;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { process.stdout.write(JSON.stringify(blocked('WORKER_HOST_UNVERIFIABLE'))+'\n'); process.exitCode=2; });
}
