/**
 * One Human-authorized #3355 Worker 1 coding order. No issue text, model,
 * historical receipt, or coding child can issue another order or merge a PR.
 */
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {lstat,mkdir,open,readdir} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {privateGatewayRoot} from '../../../gateway/gateway-host.mjs';
import {ownerOneShotAllowed} from '../../../gateway/owner-runtime-gate.mjs';
import {status as dispatcherStatus} from '../../../gateway/worker-pool/dispatcher/native-dispatcher.mjs';
import {validateOwnerWorkOrder} from '../../../gateway/worker-pool/worker-pool.mjs';
import {prior3355OwnerOrdersReconciled} from '../../../gateway/worker-pool/issue-3355/prerequisites.mjs';
import {readFactoryVerificationHead} from '../../factory-named-tests.mjs';
import {probeLocalCoderRoute} from '../../../windows/autonomous-queue.mjs';

const exec=promisify(execFile);
const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..','..','..','..');
const ISSUE=3355;
const ID=/^[a-f0-9]{32}$/;
const denied=code=>Object.freeze({state:'BLOCKED',code,modelInvoked:false,
  workerProcessVerified:false,replayAuthorized:false,automaticMergeEnabled:false});
async function ownerDirectory(root,name){
  const dir=path.join(root,name);
  await mkdir(dir,{recursive:true,mode:0o700});
  const stat=await lstat(dir);
  if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('PRIVATE_STORAGE_UNVERIFIED');
  return dir;
}
async function oneFile(dir,name,value){
  const file=await open(path.join(dir,name),'wx',0o600);
  try{await file.writeFile(JSON.stringify(value)+'\n');await file.sync();}
  finally{await file.close();}
}
async function ownerIssueOpen(repoRoot){
  const {stdout}=await exec('gh',['issue','view',String(ISSUE),'--repo',
    'BryanHarrisScripts/PlotPickle','--json','number,state,author'],
    {cwd:repoRoot,windowsHide:true,timeout:30_000,maxBuffer:4096});
  const issue=JSON.parse(stdout);
  return issue.number===ISSUE&&issue.state==='OPEN'&&
    issue.author?.login==='BryanHarrisScripts';
}

/** Reserve first; a partial write is retained and blocks a second attempt. */
export async function issueOne3355Worker1Order({
  expectedHead,platform=process.platform,repoRoot=REPO,
  root=privateGatewayRoot(),verifyHead=readFactoryVerificationHead,
  operatorReady=ownerOneShotAllowed,dispatcherRead=dispatcherStatus,
  previousOrders=prior3355OwnerOrdersReconciled,issueOpen=ownerIssueOpen,
  coderRoute=probeLocalCoderRoute,now=Date.now,
  id=()=>randomBytes(16).toString('hex'),
}={}){
  if(platform!=='win32')return denied('WORKER1_3355_WINDOWS_ONLY');
  if(!/^[a-f0-9]{40}$/.test(expectedHead||''))return denied('WORKER1_3355_HEAD_INVALID');
  let at;
  try{
    at=now();
    if(!Number.isSafeInteger(at)||await verifyHead({repoRoot})!==expectedHead||
       await operatorReady(expectedHead)!==true||
       (await dispatcherRead())?.state!=='ONLINE_OBSERVED'||
       !await issueOpen(repoRoot)||
       (await coderRoute())?.ready!==true||
       !await previousOrders({root,repoRoot,expectedHead,at}))
      return denied('WORKER1_3355_PREREQUISITES_UNVERIFIED');
  }catch{return denied('WORKER1_3355_PREREQUISITES_UNVERIFIED');}
  let dirs;
  try{
    dirs={reservation:await ownerDirectory(root,'owner-3355-reservations'),
      orders:await ownerDirectory(root,'owner-work-orders'),
      coding:await ownerDirectory(root,'owner-pi-grants'),
      publication:await ownerDirectory(root,'owner-publication-grants'),
      exceptions:await ownerDirectory(root,'owner-pilot-exceptions')};
    if((await readdir(dirs.reservation)).length!==0)
      return denied('WORKER1_3355_ALREADY_RESERVED_NO_REPLAY');
  }catch{return denied('WORKER1_3355_STORAGE_UNVERIFIED');}
  const [requestId,grantId,publicationId]=[id(),id(),id()];
  if(![requestId,grantId,publicationId].every(x=>ID.test(x))||
     new Set([requestId,grantId,publicationId]).size!==3)
    return denied('WORKER1_3355_IDS_UNVERIFIED');
  const expiresAt=at+60*60_000;
  const order={schemaVersion:1,kind:'owner-authorized-factory-job',
    requestId,grantId,publicationId,issueNumber:ISSUE,
    sourceHead:expectedHead,assignedWorker:'coding-worker-1',
    consent:'ONE_OWNER_AUTHORIZED_JOB_NO_REPLAY'};
  const coding={schemaVersion:1,kind:'local-pi-workspace-issue-once',
    grantId,issueNumber:ISSUE,sourceHead:expectedHead,
    modelRoute:'LOCAL_ONLY',maxRequests:1,expiresAt,
    consent:'AUTHORIZE_ONE_3355_ISOLATED_DRAFT_PR'};
  const publication={schemaVersion:1,kind:'local-pi-draft-pr-once',
    publicationId,grantId,issueNumber:ISSUE,sourceHead:expectedHead,
    maxRequests:1,expiresAt,consent:'AUTHORIZE_ONE_3355_DRAFT_PR_ONLY'};
  const exception={schemaVersion:1,kind:'owner-one-shot-exception',
    issueNumber:ISSUE,sourceHead:expectedHead,requestId,grantId,publicationId,
    expiresAt,maxRequests:1,consent:'AUTHORIZE_ONE_3355_WORKER1_NO_F00'};
  if(!validateOwnerWorkOrder(order,expectedHead))
    return denied('WORKER1_3355_ORDER_INVALID');
  try{
    if(await verifyHead({repoRoot})!==expectedHead||
       await operatorReady(expectedHead)!==true||
       (await dispatcherRead())?.state!=='ONLINE_OBSERVED')
      return denied('WORKER1_3355_READINESS_CHANGED');
    await oneFile(dirs.reservation,'issue-3355.json',{
      schemaVersion:1,issueNumber:ISSUE,requestId,sourceHead:expectedHead,
      state:'GRANT_WRITES_RESERVED_NO_REPLAY',at});
    await oneFile(dirs.coding,grantId+'.json',coding);
    await oneFile(dirs.publication,publicationId+'.json',publication);
    await oneFile(dirs.exceptions,requestId+'.json',exception);
    await oneFile(dirs.orders,requestId+'.json',order);
  }catch{return denied('WORKER1_3355_PARTIAL_GRANTS_RECONCILE_NO_REPLAY');}
  return Object.freeze({state:'TEST_PASSED',code:'WORKER1_3355_ORDER_RELEASED_FOR_DISPATCH',
    sourceHead:expectedHead,modelInvoked:false,workerProcessVerified:false,
    replayAuthorized:false,automaticMergeEnabled:false});
}
