#!/usr/bin/env node
/**
 * #3142/#3110: owner-Windows inspect/reconcile ONE rejected model proposal.
 * The original grant is consumed forever. This never calls a model, publishes,
 * deletes the worktree, retries a job, starts a dispatcher or authorizes merge.
 */
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {lstat,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gatewayAppSource,privateGatewayRoot} from '../gateway-host.mjs';
import {ownerOneShotAllowed} from '../owner-runtime-gate.mjs';
import {readOwnerOrder} from './worker-host.mjs';
import {reconcileModelEditRejectedOwnership} from '../receipts/atomic-coding-ownership.mjs';

const exec=promisify(execFile);
const ID=/^[a-f0-9]{32}$/;
const CONSENT='RECONCILE_ONE_REJECTED_MODEL_EDIT_NO_REPLAY';
const TARGET='scripts/engineering-team/gateway/worker-pool/worker-pool.mjs';
const deny=code=>Object.freeze({state:'BLOCKED',code,noReplay:true});
const safeJson=async file=>{
  const st=await lstat(file);
  if(!st.isFile()||st.isSymbolicLink()||st.size<2||st.size>4096)
    throw Error('PRIVATE_RECORD_UNTRUSTED');
  const value=JSON.parse(await readFile(file,'utf8'));
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw Error('PRIVATE_RECORD_INVALID');
  return value;
};
const absent=async file=>{
  try{await lstat(file);return false;}
  catch(e){if(e?.code==='ENOENT')return true;throw e;}
};
const git=async(cwd,...args)=>String((await exec('git',args,{
  cwd,windowsHide:true,timeout:15000,maxBuffer:32768
})).stdout).trim();
const powershell=async command=>String((await exec('powershell.exe',
  ['-NoProfile','-NonInteractive','-Command',command],
  {windowsHide:true,timeout:20000,maxBuffer:4096})).stdout).trim();

export async function inspectRejectedModelEdit({
  repoRoot=process.cwd(),root=privateGatewayRoot(),platform=process.platform,
  requestId,grantId,processCount=null,
}={}){
  if(platform!=='win32'||!ID.test(requestId||'')||!ID.test(grantId||''))
    return deny('OWNER_WINDOWS_EXACT_ORDER_REQUIRED');
  try{
    const source=await gatewayAppSource({repoRoot});
    if(source?.channel!=='main'||!await ownerOneShotAllowed(source.head))
      return deny('CLEAN_MAIN_AND_SUPERVISOR_REQUIRED');
    const order=await readOwnerOrder(root,requestId);
    const issueNumber=order?.issueNumber;
    if(order?.requestId!==requestId||![3142,3110].includes(issueNumber)||
       order.grantId!==grantId||order.assignedWorker!=='coding-worker-1'||
       !/^[a-f0-9]{40}$/.test(order.sourceHead||''))
      return deny('ORIGINAL_ORDER_UNVERIFIED');
    // #3142 supports only the already-issued second recovery ticket;
    // #3110 supports only its original once-only issuer reservation.
    // Neither branch accepts an arbitrary issue or a replacement ticket.
    const markerName=issueNumber===3142
      ? 'issue-3142-terminal-recovery.json' : 'issue-3110.json';
    const marker=await safeJson(path.join(root,'owner-pilot-reservations',markerName));
    if(marker.schemaVersion!==1||marker.issueNumber!==issueNumber||
       marker.state!=='GRANT_WRITES_RESERVED_NO_REPLAY'||
       marker.requestId!==requestId||marker.sourceHead!==order.sourceHead)
      return deny('SECOND_PILOT_MARKER_UNVERIFIED');
    // The failed pilot was source-bound to an older MAIN; the recovery
    // implementation itself must be reviewed and merged before owner use.
    if(!await exec('git',['merge-base','--is-ancestor',
      order.sourceHead,source.head],{
        cwd:repoRoot,windowsHide:true,timeout:15000,maxBuffer:4096
      }).then(()=>true,()=>false))
      return deny('SOURCE_ANCESTRY_UNVERIFIED');
    const grant=await safeJson(path.join(root,'owner-coding-grants',grantId+'.json'));
    if(grant.kind!=='engineering-edit-once'||grant.grantId!==grantId||
       grant.sourceHead!==order.sourceHead||grant.issueNumber!==issueNumber||
       grant.targetPath!==TARGET||grant.model!=='qwen2.5-coder:7b')
      return deny('ORIGINAL_GRANT_UNVERIFIED');
    const result=await safeJson(path.join(root,'coding-attempts',grantId+'.result.json'));
    if(result.state!=='BLOCKED'||
       result.code!=='CODING_OUTCOME_UNCERTAIN_REVIEW_STAGE'||
       result.phase!=='VALIDATE_MODEL_EDIT'||result.replayAuthorized!==false)
      return deny('MODEL_EDIT_REJECTION_NOT_PROVEN');
    if(!ID.test(order.publicationId||'')||
       !await absent(path.join(root,'publication-attempts',order.publicationId+'.reserved.json'))||
       !await absent(path.join(root,'publication-attempts',order.publicationId+'.result.json'))||
       !await absent(path.join(root,'engineering-receipts',grantId+'.json'))||
       !await absent(path.join(root,'coding-attempts',grantId+'.released.json')))
      return deny('PUBLISH_OR_PRIOR_RELEASE_EVIDENCE_EXISTS');
    const stage=path.join(root,'coding-worktrees',grantId);
    const st=await lstat(stage);
    if(!st.isDirectory()||st.isSymbolicLink()||
       await git(stage,'rev-parse','HEAD')!==order.sourceHead||
       await git(stage,'branch','--show-current')!==`engineering/${issueNumber}-${grantId}`||
       await git(stage,'status','--porcelain','--untracked-files=normal')!==''||
       await git(stage,'diff','--cached','--name-only')!==''||
       await git(stage,'diff','--name-only')!=='')
      return deny('STAGE_NOT_CLEAN_AT_ORIGINAL_HEAD');
    await git(stage,'diff','--check');
    // A remote operation failure is not branch absence.
    if(await git(repoRoot,'ls-remote','--heads','origin',
      `refs/heads/engineering/${issueNumber}-${grantId}`)!=='')
      return deny('REMOTE_BRANCH_PRESENT');
    const count=processCount===null
      ?await powershell("@((Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" -ErrorAction Stop) | Where-Object { $_.CommandLine -match '(worker-host\\.mjs[\\"'']?\\s+--(?:once|serve)\\s+coding-worker-1|authorized-coding-once\\.mjs)' }).Count")
      :String(processCount);
    if(count!=='0')return deny('ACTIVE_OR_UNKNOWN_WORKER_PROCESS');
    return Object.freeze({state:'READY_FOR_OWNER_NO_WRITE_RECONCILIATION',
      currentHead:source.head,sourceHead:order.sourceHead,
      sourceUnchanged:true,stageClean:true,noLocalCommit:true,
      noRemoteBranch:true,noPublication:true,workerProcessAbsent:true,
      replayAuthorized:false});
  }catch{return deny('NO_WRITE_RECONCILIATION_PREFLIGHT_UNVERIFIED');}
}

async function main(){
  const args=process.argv.slice(2);
  const inspect=args.length===3&&args[0]==='--inspect';
  const reconcile=args.length===5&&args[0]==='--reconcile'&&
    args[3]==='--consent'&&args[4]===CONSENT;
  if(!inspect&&!reconcile){
    process.stdout.write(JSON.stringify(deny('EXACT_INSPECT_OR_CONSENT_REQUIRED'))+'\n');
    process.exitCode=2;return;
  }
  const observation=await inspectRejectedModelEdit({
    requestId:args[1],grantId:args[2]});
  if(inspect||observation.state!=='READY_FOR_OWNER_NO_WRITE_RECONCILIATION'){
    process.stdout.write(JSON.stringify(observation)+'\n');
    if(observation.state==='BLOCKED')process.exitCode=2;
    return;
  }
  const outcome=reconcileModelEditRejectedOwnership(
    path.join(privateGatewayRoot(),'coding-attempts'),{
      grantId:args[2],sourceHead:observation.sourceHead,
      consent:CONSENT,stageAndRemoteVerified:true,
    });
  process.stdout.write(JSON.stringify({
    state:outcome.state,
    code:outcome.code||null,
    retryOriginalAuthorized:false,publicationAuthorized:false,
    originalEvidencePreserved:outcome.originalEvidencePreserved===true,
  })+'\n');
  if(outcome.state==='BLOCKED')process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(()=>{process.stdout.write(JSON.stringify(
    deny('OWNER_NO_WRITE_RECONCILIATION_UNVERIFIED'))+'\n');process.exitCode=2;});
