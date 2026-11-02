#!/usr/bin/env node
/**
 * #3142 F01 Windows dispatcher: actual idle process with owned heartbeat.
 * Consumes ONLY owner-created, exact-head, never-claimed tickets. It cannot
 * mint grants, bypass F00 release, merge, use Pi or recover an uncertain job.
 */
import path from 'node:path';
import process from 'node:process';
import {open,readFile,lstat,mkdir,readdir,rm,rename} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {privateGatewayRoot,gatewayAppSource} from '../../gateway-host.mjs';
import {ownerOneShotAllowed} from '../../owner-runtime-gate.mjs';
import {supervisorStatus} from '../../../windows/supervisor/unattended-supervisor.mjs';
import {validateOwnerWorkOrder} from '../worker-pool.mjs';
import {readOwnerOrder,runOwnerWorkerTicket} from '../worker-host.mjs';

const ID=/^[a-f0-9]{32}$/;
const blocked=code=>Object.freeze({state:'BLOCKED',code,online:false,
  mergeEnabled:false,replayAuthorized:false});
async function safeDir(dir){
  try{const s=await lstat(dir);return s.isDirectory()&&!s.isSymbolicLink();}
  catch(e){if(e.code==='ENOENT')return false;throw e;}
}
async function present(file){
  try{await lstat(file);return true;}
  catch(e){if(e.code==='ENOENT')return false;throw e;}
}
async function readDispatcherRecord({file,maximumBytes=4096,requireObject=true}={}){
  const s=await lstat(file);
  if(!s.isFile()||s.isSymbolicLink()||s.size<2||s.size>maximumBytes)
    throw Error('BAD_DISPATCH_RECORD');
  const record=JSON.parse(await readFile(file,'utf8'));
  if(requireObject && (!record||typeof record!=='object'||Array.isArray(record)))
    throw Error('DISPATCH_RECORD_SCHEMA_INVALID');
  return record;
}
export async function pickOwnerAuthorizedTicket({root,head,now=Date.now()}={}){
  if(typeof root!=='string'||!path.isAbsolute(root)||
    !/^[a-f0-9]{40}$/.test(head||''))return blocked('QUEUE_IDENTITY_INVALID');
  const dir=path.join(root,'owner-work-orders');
  const claims=path.join(root,'factory-worker-claims');
  try{
    if(!await safeDir(dir))return {state:'IDLE',ticket:null};
    if(!await safeDir(claims))return blocked('CLAIM_DIRECTORY_UNVERIFIABLE');
    const entries=await readdir(dir,{withFileTypes:true});
    if(entries.length>2000)return blocked('QUEUE_INVENTORY_UNBOUNDED');
    const eligible=[];
    for(const entry of entries){
      if(!/^[a-f0-9]{32}\.json$/.test(entry.name))continue;
      if(!entry.isFile()||entry.isSymbolicLink())
        return blocked('ORDER_FILE_UNTRUSTED');
      if(await present(path.join(claims,entry.name)))continue;
      const id=entry.name.slice(0,32);
      const order=await readOwnerOrder(root,id);
      if(!validateOwnerWorkOrder(order,head)||
         order.assignedWorker!=='coding-worker-1')continue;
      try{
        const code=await readDispatcherRecord({file:path.join(root,'owner-coding-grants',order.grantId+'.json')});
        const publish=await readDispatcherRecord({file:path.join(root,'owner-publication-grants',order.publicationId+'.json')});
        if(code.grantId!==order.grantId||code.sourceHead!==head||
           code.issueNumber!==order.issueNumber||
           code.maxRequests!==1||code.expiresAt<=now||
           publish.publicationId!==order.publicationId||
           publish.grantId!==order.grantId||
           publish.issueNumber!==order.issueNumber||
           publish.sourceHead!==head||
           publish.maxRequests!==1||publish.expiresAt<=now)continue;
        eligible.push({requestId:id,issueNumber:order.issueNumber});
      }catch{/* Invalid, missing or expired grants cannot dispatch. */}
    }
    eligible.sort((a,b)=>a.requestId.localeCompare(b.requestId));
    return {state:eligible.length?'ELIGIBLE':'IDLE',ticket:eligible[0]||null};
  }catch{return blocked('QUEUE_INTEGRITY_UNVERIFIABLE');}
}
export async function dispatchOne({
  repoRoot=process.cwd(),env=process.env,platform=process.platform,
  source=gatewayAppSource,inspect=supervisorStatus,
  ready=ownerOneShotAllowed,pick=pickOwnerAuthorizedTicket,
  run=runOwnerWorkerTicket,
}={}){
  if(platform!=='win32')return blocked('WINDOWS_ONLY');
  let s,supervisor;
  try{s=await source({repoRoot,env});supervisor=await inspect();}
  catch{return blocked('CURRENT_HEAD_OR_SUPERVISOR_UNVERIFIABLE');}
  if(s?.channel!=='main'||supervisor?.state!=='RUNNING'||
     supervisor.exactSha!==s.head||supervisor.pauseAcknowledged===true||
     !await ready(s.head))return blocked('STOP_PAUSE_OR_HEAD_NOT_READY');
  const ticket=await pick({root:privateGatewayRoot(env),head:s.head});
  if(ticket.state==='BLOCKED')return ticket;
  if(ticket.state==='IDLE')return Object.freeze({state:'IDLE',
    sourceHead:s.head,online:true,mergeEnabled:false,replayAuthorized:false});
  if(!ID.test(ticket.ticket?.requestId||'')||!await ready(s.head))
    return blocked('TICKET_OR_PRE_DISPATCH_STOP_UNVERIFIABLE');
  // The worker host performs its own independent-release and two STOP checks;
  // this dispatcher never grants authority based on a queue record.
  const result=await run({role:'coding-worker-1',requestId:ticket.ticket.requestId,
    repoRoot,env,platform});
  return Object.freeze({state:result.state==='DRAFT_PR_RECEIPT_READY'?
    'PR_PUBLISHED':'WORKER_RELEASE_BLOCKED',
    requestId:ticket.ticket.requestId,issueNumber:ticket.ticket.issueNumber,
    prNumber:result.prNumber||null,code:result.code||null,
    sourceHead:s.head,online:true,mergeEnabled:false,replayAuthorized:false});
}
const paths=root=>({dir:path.join(root,'native-dispatcher'),
  lock:path.join(root,'native-dispatcher','owner.lock'),
  beat:path.join(root,'native-dispatcher','heartbeat.json')});
async function heartbeat(dir,value){
  const tmp=path.join(dir,'beat-'+randomBytes(8).toString('hex')+'.tmp');
  const file=await open(tmp,'wx',0o600);
  try{await file.writeFile(JSON.stringify(value)+'\n');await file.sync();}
  finally{await file.close();}
  try{await rename(tmp,path.join(dir,'heartbeat.json'));}
  catch(e){await rm(tmp,{force:true});throw e;}
}
export async function serve({
  root=privateGatewayRoot(),platform=process.platform,cycle=dispatchOne,
  maxCycles=Infinity,intervalMs=15000,now=Date.now,
}={}){
  if(platform!=='win32')return blocked('WINDOWS_ONLY');
  if(!Number.isSafeInteger(intervalMs)||intervalMs<1000||intervalMs>60000)
    return blocked('INVALID_POLL_INTERVAL');
  const p=paths(root);await mkdir(p.dir,{recursive:true,mode:0o700});
  if(!await safeDir(p.dir))return blocked('DISPATCH_PRIVATE_DIR_UNVERIFIABLE');
  const nonce=randomBytes(16).toString('hex');
  let lock;
  try{lock=await open(p.lock,'wx',0o600);await lock.writeFile(
    JSON.stringify({pid:process.pid,nonce,state:'CLAIMED_NO_STEAL'})+'\n');
    await lock.sync();}
  catch{return blocked('DISPATCH_OWNER_LOCK_RETAINED');}
  finally{await lock?.close();}
  let count=0;
  try{
    while(count<maxCycles){
      const result=await cycle();
      count++;
      await heartbeat(p.dir,{pid:process.pid,nonce,at:now(),
        state:result.state,online:result.online===true,count});
      if(['BLOCKED','WORKER_RELEASE_BLOCKED'].includes(result.state))
        return Object.freeze({state:'HALTED_FAIL_CLOSED',code:result.code||result.state,
          count,replayAuthorized:false});
      if(count<maxCycles)await sleep(intervalMs);
    }
    return Object.freeze({state:'STOPPED_AFTER_TEST_CYCLES',count});
  }finally{
    // Never delete a lock if its ownership changed.
    try{const owner=await readDispatcherRecord({file:p.lock});
      if(owner.pid===process.pid&&owner.nonce===nonce)await rm(p.lock);
    }catch(error){
      // A retained or unreadable owner lock is evidence requiring inspection.
      if(error?.code!=='ENOENT')
        process.stderr.write('DISPATCH_OWNER_LOCK_RELEASE_UNVERIFIABLE\\n');
    }
  }
}
export async function status({root=privateGatewayRoot(),now=Date.now,
  alive=pid=>{try{process.kill(pid,0);return true;}
    catch(error){if(error?.code==='ESRCH')return false;throw error;}}}={}){
  const p=paths(root);
  try{
    const [owner,b]=await Promise.all([readDispatcherRecord({file:p.lock}),readDispatcherRecord({file:p.beat})]);
    if(owner.pid!==b.pid||owner.nonce!==b.nonce||
       !Number.isSafeInteger(b.at)||b.at>now()+5000||
       now()-b.at>45000||!alive(b.pid))
      return blocked('DISPATCH_HEARTBEAT_OR_PID_UNVERIFIED');
    return Object.freeze({state:'ONLINE_OBSERVED',pid:b.pid,
      lastCycle:b.state,at:b.at,mergeEnabled:false,replayAuthorized:false});
  }catch{return blocked('DISPATCH_OFFLINE_OR_UNVERIFIABLE');}
}
async function main(){
  const args=process.argv.slice(2);
  const result=args.length===1&&args[0]==='--status'?await status():
    args.length===1&&args[0]==='--once'?await dispatchOne():
    args.length===1&&args[0]==='--serve'?await serve():
    blocked('DISPATCH_EXACT_COMMAND_REQUIRED');
  process.stdout.write(JSON.stringify(result)+'\n');
  if(['BLOCKED','HALTED_FAIL_CLOSED'].includes(result.state))process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(()=>{process.stdout.write(JSON.stringify(blocked('DISPATCH_RUNTIME_UNVERIFIABLE'))+'\n');
    process.exitCode=2;});
