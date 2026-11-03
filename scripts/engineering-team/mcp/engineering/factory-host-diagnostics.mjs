/**
 * #3333: host-only diagnostic adapter to an immutable, fixed checked-in
 * PowerShell -File. No arbitrary shell arguments, lock writes or task control.
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { gatewayAppSource } from '../../gateway/gateway-host.mjs';

const exec = promisify(execFile);
const SHA = /^[a-f0-9]{40}$/;
export const SUPERVISOR_DIAGNOSTIC_SCRIPT_SHA256 = 'd2b86a63d5eb3e094a7b1403130092dda8a0fc9834abad89d4edef32d10ecbde';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'engineering-team', 'windows',
  'supervisor', 'Read-PlotPickleSupervisorDiagnostics.ps1');
const blocked = code => Object.freeze({ state:'BLOCKED', code,
  processOwnershipVerified:false, remediationAuthorized:false });

const taskStates = new Set(['Ready','Running','Disabled','Queued','Unknown',
  'NOT_INSTALLED','NOT_INSTALLED_OR_UNREADABLE','UNKNOWN']);
const markers = new Set(['ABSENT','PRESENT','UNVERIFIABLE']);
const processStates = new Set(['MISSING','CANDIDATE_NOT_VERIFIED',
  'OTHER_PROCESS_OR_REUSED_PID','UNVERIFIABLE']);
const eventStates = new Set(['OBSERVED','NOT_FOUND_IN_BOUNDED_SCAN','UNAVAILABLE']);
const eventIds = new Set([100,101,102,103,107,111,129,200,201,203]);
const utcStamp = value => value === null || (typeof value === 'string' &&
  /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{7}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)));
const resultCode = value => value === null || (typeof value === 'string' &&
  /^(?:0x[0-9A-Fa-f]{1,8}|[0-9]{1,10}|-[0-9]{1,10})$/.test(value));
const safeEvent = value => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === 'id,resultCode,timeUtc' &&
  eventIds.has(value.id) && utcStamp(value.timeUtc) &&
  typeof value.timeUtc === 'string' && resultCode(value.resultCode);
function safeEventExtension(raw) {
  // Synthetic pre-extension fixtures remain explicitly UNAVAILABLE, never PASS.
  if (raw.taskEventsState === undefined && raw.taskEvents === undefined &&
      raw.lastRunUtc === undefined && raw.nextRunUtc === undefined)
    return Object.freeze({state:'UNAVAILABLE',events:Object.freeze([]),
      lastRunUtc:null,nextRunUtc:null});
  if(!eventStates.has(raw.taskEventsState) || !Array.isArray(raw.taskEvents) ||
     raw.taskEvents.length > 8 || !raw.taskEvents.every(safeEvent) ||
     !utcStamp(raw.lastRunUtc) || !utcStamp(raw.nextRunUtc) ||
     (raw.taskEventsState === 'OBSERVED') !== (raw.taskEvents.length > 0))
    return null;
  return Object.freeze({state:raw.taskEventsState,
    events:Object.freeze(raw.taskEvents.map(e=>Object.freeze({
      id:e.id,timeUtc:e.timeUtc,resultCode:e.resultCode}))),
    lastRunUtc:raw.lastRunUtc,nextRunUtc:raw.nextRunUtc});
}
export function sanitizeOwnerWindowsDiagnostics(raw, head) {
  const events=raw && typeof raw === 'object' && !Array.isArray(raw)
    ?safeEventExtension(raw):null;
  if(!events || !raw || typeof raw !== 'object' || Array.isArray(raw) ||
     raw.schemaVersion !== 1 || !taskStates.has(raw.taskState) ||
     !markers.has(raw.lockState) || !markers.has(raw.stopMarker) ||
     !markers.has(raw.pauseMarker) || !processStates.has(raw.processState) ||
     (raw.lastTaskResult !== null && (!Number.isSafeInteger(raw.lastTaskResult) ||
       raw.lastTaskResult < 0 || raw.lastTaskResult > 4294967295)) ||
     (raw.lockPid !== null && (!Number.isSafeInteger(raw.lockPid) ||
       raw.lockPid < 1 || raw.lockPid > 4294967295)) ||
     raw.processOwnershipVerified !== false || raw.remediationAuthorized !== false ||
     (raw.lockState !== 'PRESENT' && raw.lockPid !== null) ||
     !SHA.test(head || '')) return blocked('DIAGNOSTIC_OUTPUT_UNVERIFIABLE');
  return Object.freeze({
    state:'OBSERVED_NOT_RELEASE_PROOF', sourceHead:head,
    taskState:raw.taskState, lastTaskResult:raw.lastTaskResult,
    lastRunUtc:events.lastRunUtc,nextRunUtc:events.nextRunUtc,
    taskEventsState:events.state,taskEvents:events.events,
    lockState:raw.lockState, lockPid:raw.lockPid,
    processState:raw.processState,
    stopMarker:raw.stopMarker, pauseMarker:raw.pauseMarker,
    processOwnershipVerified:false, remediationAuthorized:false,
    replayAuthorized:false,
  });
}

export async function inspectOwnerWindowsHost({ expectedHead, platform=process.platform,
  repoRoot=ROOT, scriptPath=SCRIPT,
  source=()=>gatewayAppSource({repoRoot}),
  inspect=lstat, read=readFile, run=exec,
}={}) {
  if(platform!=='win32')return blocked('DIAGNOSTIC_WINDOWS_ONLY');
  if(!SHA.test(expectedHead || ''))return blocked('DIAGNOSTIC_SOURCE_ID_REQUIRED');
  let head;
  try { head=await source(); }
  catch { return blocked('DIAGNOSTIC_EXACT_MAIN_UNVERIFIABLE'); }
  if(head?.channel!=='main'||head.head!==expectedHead)
    return blocked('DIAGNOSTIC_EXACT_MAIN_UNVERIFIABLE');
  try {
    const info=await inspect(scriptPath);
    if(!info.isFile()||info.isSymbolicLink()||info.size<100||info.size>8192)
      return blocked('DIAGNOSTIC_SCRIPT_UNVERIFIABLE');
    const bytes=await read(scriptPath);
    if(createHash('sha256').update(bytes).digest('hex')!==SUPERVISOR_DIAGNOSTIC_SCRIPT_SHA256)
      return blocked('DIAGNOSTIC_SCRIPT_DIGEST_MISMATCH');
  } catch { return blocked('DIAGNOSTIC_SCRIPT_UNVERIFIABLE'); }
  try {
    const result=await run('powershell.exe',
      ['-NoProfile','-NonInteractive','-File',scriptPath],{
        cwd:repoRoot,windowsHide:true,timeout:10000,maxBuffer:4096,encoding:'utf8',
      });
    if(result?.stderr || typeof result?.stdout!=='string' ||
       Buffer.byteLength(result.stdout,'utf8')>4096)
      return blocked('DIAGNOSTIC_PROCESS_UNVERIFIABLE');
    return sanitizeOwnerWindowsDiagnostics(JSON.parse(result.stdout),expectedHead);
  } catch { return blocked('DIAGNOSTIC_PROCESS_UNVERIFIABLE'); }
}
