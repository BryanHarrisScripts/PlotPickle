/**
 * #3302: NON-RELEASE candidate for a pre-provisioned, append-only F00 nonce journal.
 *
 * A distinct registrar must provision the file and its ACL before use. This
 * module never creates, truncates, repairs or rotates that file, clears an
 * abandoned lock, enrolls a reviewer, signs, or grants W8/W9 admission.
 * A regular-file sync is supported by the Windows diagnostic; actual
 * power-loss durability, registrar identity/ACL and STOP require independent
 * native Windows acceptance. Do not use this as a production trust root.
 */
import {createHash,randomBytes} from 'node:crypto';
import {open,lstat,mkdir,rmdir} from 'node:fs/promises';
import path from 'node:path';

export const JOURNAL_HEADER='PP-LANE-A-PREPROVISIONED-JOURNAL-V1\n';
const HEADER=Buffer.from(JOURNAL_HEADER,'utf8');
const HEX64=/^[a-f0-9]{64}$/;
const REQUEST=/^[a-f0-9]{32}$/;
const MAX_BYTES=8*1024*1024;
const MAX_RECORD=512;
const deny=(code)=>Object.freeze({status:'BLOCKED',code,
  independentAuthorityVerified:false,nonceConsumedForProduction:false,
  mayAdmit:false,mayEnroll:false,mayEditCatalogue:false,mayCode:false,
  mayMerge:false,replayAuthorized:false});

function digest(buffer){return createHash('sha256').update(buffer).digest();}
function recordBytes(record){return Buffer.from(JSON.stringify(record),'utf8');}
function validRecord(record){
  return record && typeof record==='object' && !Array.isArray(record) &&
    Object.keys(record).sort().join(',')==='nonce,op,requestId,scopeDigest,v' &&
    record.v===1 && ['ISSUE','SPEND'].includes(record.op) &&
    HEX64.test(record.nonce) && HEX64.test(record.scopeDigest) &&
    REQUEST.test(record.requestId);
}
async function safePath(p){
  if(typeof p!=='string' || !path.isAbsolute(p) || p.length>512 ||
     p.includes('\\0')) throw Error('INVALID_JOURNAL_PATH');
  const full=path.resolve(p), parsed=path.parse(full);
  let part=parsed.root;
  for(const component of full.slice(parsed.root.length).split(path.sep).filter(Boolean)){
    part=path.join(part,component);
    const st=await lstat(part);
    if(st.isSymbolicLink()) throw Error('REPARSE_POINT_DENIED');
    if(part===full ? !st.isFile() : !st.isDirectory())
      throw Error('UNSAFE_JOURNAL_PATH');
  }
  return full;
}
function decode(bytes){
  if(bytes.length<HEADER.length || !bytes.subarray(0,HEADER.length).equals(HEADER))
    throw Error('JOURNAL_HEADER_INVALID');
  let offset=HEADER.length, previous=digest(HEADER);
  const issued=new Map(),spent=new Set(),requests=new Set();
  while(offset<bytes.length){
    if(bytes.length-offset<4) throw Error('JOURNAL_TORN_TAIL');
    const len=bytes.readUInt32BE(offset);offset+=4;
    if(len===0 || len>MAX_RECORD || bytes.length-offset<len+32)
      throw Error('JOURNAL_TORN_OR_OVERSIZED_FRAME');
    const payload=bytes.subarray(offset,offset+len);offset+=len;
    const checksum=bytes.subarray(offset,offset+32);offset+=32;
    const expected=digest(Buffer.concat([previous,payload]));
    if(!checksum.equals(expected)) throw Error('JOURNAL_CHAIN_INVALID');
    previous=expected;
    const record=JSON.parse(payload.toString('utf8'));
    if(!validRecord(record) || !payload.equals(recordBytes(record)))
      throw Error('JOURNAL_RECORD_INVALID');
    if(requests.has(record.requestId)) throw Error('JOURNAL_DUPLICATE_REQUEST');
    requests.add(record.requestId);
    if(record.op==='ISSUE'){
      if(issued.has(record.nonce)) throw Error('JOURNAL_DUPLICATE_ISSUE');
      issued.set(record.nonce,record.scopeDigest);
    } else {
      if(!issued.has(record.nonce) || issued.get(record.nonce)!==record.scopeDigest ||
         spent.has(record.nonce)) throw Error('JOURNAL_INVALID_SPEND');
      spent.add(record.nonce);
    }
  }
  return {previous,issued,spent,requests};
}
async function appendFrame(handle,offset,previous,record){
  const payload=recordBytes(record);
  const frame=Buffer.allocUnsafe(4+payload.length+32);
  frame.writeUInt32BE(payload.length,0);
  payload.copy(frame,4);
  digest(Buffer.concat([previous,payload])).copy(frame,4+payload.length);
  let written=0;
  while(written<frame.length){
    const r=await handle.write(frame,written,frame.length-written,offset+written);
    if(!r.bytesWritten) throw Error('JOURNAL_SHORT_WRITE');
    written+=r.bytesWritten;
  }
  await handle.sync(); // regular pre-existing file; no directory fsync
}

/**
 * The lock directory is a process-concurrency guard, NOT a durability claim.
 * Any uncertain write retains it and requires independent recovery review.
 * Request IDs are permanently recorded, and a corrupt/torn tail blocks all
 * future operations without truncation or automatic replay.
 */
export async function operateLaneAPreprovisionedJournal({
  journalPath,operation,challengeNonce,scopeDigest,requestId
}={}){
  if(!['ISSUE','SPEND'].includes(operation) || !HEX64.test(scopeDigest||'') ||
     !REQUEST.test(requestId||'') ||
     (operation==='SPEND' && !HEX64.test(challengeNonce||'')))
    return deny('JOURNAL_SCOPE_INVALID');
  let full;
  try {full=await safePath(journalPath);}
  catch {return deny('PREPROVISIONED_JOURNAL_UNVERIFIABLE');}
  const lock=full+'.exclusive-lock';
  try {await mkdir(lock);}
  catch {return deny('JOURNAL_LOCKED_OR_UNVERIFIABLE');}
  let handle,committed=false,nonce=challengeNonce;
  try {
    // r+ requires an existing file. Never create or replace registrar storage.
    handle=await open(full,'r+');
    const st=await handle.stat();
    if(!st.isFile() || st.size>MAX_BYTES || st.size<HEADER.length)
      throw Error('JOURNAL_SIZE_INVALID');
    const bytes=Buffer.alloc(st.size);
    let got=0;
    while(got<bytes.length){
      const r=await handle.read(bytes,got,bytes.length-got,got);
      if(!r.bytesRead) throw Error('JOURNAL_SHORT_READ');
      got+=r.bytesRead;
    }
    const state=decode(bytes);
    if(state.requests.has(requestId)) throw Error('REQUEST_REPLAY_DENIED');
    if(operation==='ISSUE'){
      nonce=randomBytes(32).toString('hex');
      if(state.issued.has(nonce)) throw Error('NONCE_COLLISION');
    } else if(!state.issued.has(nonce) ||
       state.issued.get(nonce)!==scopeDigest || state.spent.has(nonce)){
      throw Error('NONCE_MISSING_SCOPE_MISMATCH_OR_SPENT');
    }
    await appendFrame(handle,st.size,state.previous,{
      v:1,op:operation,nonce,scopeDigest,requestId
    });
    committed=true;
  } catch {
    // Intentionally retain lock on any uncertain outcome. No repair/replay.
    return deny('JOURNAL_UNCERTAIN_OR_REPLAY_DENIED');
  } finally {
    if(handle) await handle.close().catch(()=>{});
  }
  if(!committed) return deny('JOURNAL_UNCERTAIN_OR_REPLAY_DENIED');
  try {await rmdir(lock);}
  catch {return deny('JOURNAL_LOCK_RELEASE_UNVERIFIABLE');}
  return Object.freeze({status:operation==='ISSUE'?'ISSUED_CANDIDATE_ONLY':'SPENT_CANDIDATE_ONLY',
    challengeNonce:nonce,code:'PREPROVISIONED_JOURNAL_FLUSHED_CANDIDATE',
    independentAuthorityVerified:false,nonceConsumedForProduction:false,
    mayAdmit:false,mayEnroll:false,mayEditCatalogue:false,mayCode:false,
    mayMerge:false,replayAuthorized:false,
    requiresExternalRegistrarIdentityAndAclProof:true,
    requiresIndependentWindowsCrashRecoveryWitness:true});
}
