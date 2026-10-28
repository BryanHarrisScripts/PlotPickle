/**
 * #3302 Independent F00 registrar nonce ledger -- source candidate only.
 *
 * Must run under a SEPARATE registrar's protected OS identity/storage.
 * The source cannot prove Windows ACL, independent authority or public-key pin.
 * No key generation, signatures, W8/W9 ADMIT, test catalogue writes or release.
 * Never delete a spent entry, retry a previously reserved challenge or treat
 * an uncertain fsync/process outcome as reusable.
 */
import { randomBytes } from 'node:crypto';
import { open, lstat, readFile } from 'node:fs/promises';
import path from 'node:path';

const NONCE = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,95}$/;
const SID = /^S-1-(?:[0-9]+-){2,}[0-9]+$/;
const MAX_ISSUED_BYTES = 2048;
const deny = code => Object.freeze({
  status:'BLOCKED', code, independentAuthorityVerified:false,
  nonceConsumedForProduction:false, mayAdmit:false, mayEnroll:false,
  mayEditCatalogue:false, mayCode:false, mayMerge:false, replayAuthorized:false,
});

async function safeDirectory(p){
  const stat = await lstat(p);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('UNSAFE_DIRECTORY');
}
async function validateRoot(root){
  if (typeof root !== 'string' || !path.isAbsolute(root) || root.length > 512)
    throw Error('PRIVATE_ROOT_REQUIRED');
  const directories = [root,path.join(root,'issued'),path.join(root,'spent')];
  for (const p of directories) await safeDirectory(p);
}
async function syncParent(directory){
  // Windows can refuse directory fsync; fail CLOSED rather than claiming a
  // crash-durable spend. Marker files remain and are never auto-deleted.
  const handle = await open(directory,'r');
  try { await handle.sync(); } finally { await handle.close(); }
}
async function writeOnce(filename,record,directory){
  let handle;
  try {
    handle = await open(filename,'wx',0o600);
    await handle.writeFile(JSON.stringify(record)+'\n',{encoding:'utf8'});
    await handle.sync();
  } finally { if (handle) await handle.close().catch(()=>{}); }
  await syncParent(directory);
}
const fieldsValid = (x) =>
  x && typeof x === 'object' && !Array.isArray(x) &&
  ID.test(x.registrarId||'') && ID.test(x.hostId||'') &&
  ID.test(x.reviewerPrincipal||'') && SID.test(x.reviewerSid||'') &&
  ID.test(x.requestId||'');

/** Registrar-owned source candidate; only emits a non-secret random challenge. */
export async function issueLaneAChallenge({root,registrarId,hostId,reviewerPrincipal,reviewerSid,requestId}={}){
  const identity={registrarId,hostId,reviewerPrincipal,reviewerSid,requestId};
  if(!fieldsValid(identity)) return deny('CHALLENGE_SCOPE_INVALID');
  try { await validateRoot(root); } catch { return deny('PROTECTED_REGISTRAR_STORAGE_UNVERIFIABLE'); }
  const challengeNonce=randomBytes(32).toString('hex');
  const record={schemaVersion:'PP-LANE-A-NONCE-LEDGER-V1',challengeNonce,
    ...identity, status:'ISSUED_UNUSED', immutableCandidate:true};
  try {
    await writeOnce(path.join(root,'issued',challengeNonce+'.json'), record, path.join(root,'issued'));
  } catch { return deny('CHALLENGE_ISSUANCE_UNCERTAIN_NEVER_RETRY'); }
  return Object.freeze({status:'ISSUED_CANDIDATE_ONLY',challengeNonce,
    registrarId,hostId,reviewerPrincipal,reviewerSid,requestId,
    independentAuthorityVerified:false,nonceConsumedForProduction:false,
    mayEnroll:false,mayAdmit:false,mayEditCatalogue:false,mayCode:false,
    mayMerge:false,replayAuthorized:false,
    requiresExternalRegistrarIdentityAndAclProof:true});
}

/** Permanently spend an existing challenge. Concurrent contenders cannot both win. */
export async function spendLaneAChallengeOnce({root,challengeNonce,registrarId,hostId,
  reviewerPrincipal,reviewerSid,requestId}={}){
  const identity={registrarId,hostId,reviewerPrincipal,reviewerSid,requestId};
  if(!NONCE.test(challengeNonce||'') || !fieldsValid(identity)) return deny('CHALLENGE_SCOPE_INVALID');
  try { await validateRoot(root); } catch { return deny('PROTECTED_REGISTRAR_STORAGE_UNVERIFIABLE'); }
  const issuedPath=path.join(root,'issued',challengeNonce+'.json');
  let issued;
  try {
    const stat=await lstat(issuedPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size<=0 || stat.size>MAX_ISSUED_BYTES)
      return deny('ISSUED_CHALLENGE_NOT_REGULAR');
    issued=JSON.parse(await readFile(issuedPath,'utf8'));
    if(!issued || issued.schemaVersion!=='PP-LANE-A-NONCE-LEDGER-V1' ||
      issued.status!=='ISSUED_UNUSED' || issued.immutableCandidate!==true ||
      issued.challengeNonce!==challengeNonce ||
      Object.keys(issued).sort().join(',')!==
        ['schemaVersion','challengeNonce','registrarId','hostId','reviewerPrincipal',
         'reviewerSid','requestId','status','immutableCandidate'].sort().join(',') ||
      Object.entries(identity).some(([k,v])=>issued[k]!==v))
      return deny('ISSUED_CHALLENGE_CONTENT_MISMATCH');
  } catch { return deny('ISSUED_CHALLENGE_MISSING_OR_UNVERIFIABLE'); }
  const spentDir=path.join(root,'spent');
  try {
    await writeOnce(path.join(spentDir,challengeNonce+'.json'),{
      schemaVersion:'PP-LANE-A-NONCE-SPENT-V1',challengeNonce,...identity,
      state:'SPENT_NO_REPLAY'},spentDir);
  } catch { return deny('CHALLENGE_ALREADY_SPENT_OR_DURABILITY_UNVERIFIABLE'); }
  return Object.freeze({status:'SPENT_CANDIDATE_ONLY',code:'ATOMIC_SPENT_MARKER_RETAINED',
    challengeNonce, independentAuthorityVerified:false,nonceConsumedForProduction:false,
    mayEnroll:false, mayAdmit:false,mayEditCatalogue:false,mayCode:false,
    mayMerge:false,replayAuthorized:false,
    requiresExternalRegistrarIdentityAndAclProof:true,
    requiresIndependentWindowsCrashRecoveryWitness:true});
}
