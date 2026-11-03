/** #3355 one claimed Worker 1 job; draft PR only, no review or merge authority. */
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {lstat,mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {privateGatewayRoot} from '../../gateway-host.mjs';
import {ownerOneShotAllowed} from '../../owner-runtime-gate.mjs';
import {appendPrivateJsonOnce} from '../../receipts/write-once-json.mjs';
import {produceDraftIssuePR} from '../../../windows/autonomous-issue-coder.mjs';

const exec=promisify(execFile);
const ID=/^[a-f0-9]{32}$/;
const SHA=/^[a-f0-9]{40}$/;
const blocked=code=>Object.freeze({state:'BLOCKED',code,
  independentVerification:false,automaticMergeAuthorized:false,
  replayAuthorized:false});
async function privateRecord(root,folder,name){
  const dir=path.join(root,folder),parent=await lstat(dir);
  if(!parent.isDirectory()||parent.isSymbolicLink())throw Error('PRIVATE_DIR_UNVERIFIED');
  const file=path.join(dir,name),stat=await lstat(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>4096)
    throw Error('PRIVATE_RECORD_UNVERIFIED');
  return JSON.parse(await readFile(file,'utf8'));
}
async function inspectDraftPr({repoRoot,number}){
  const {stdout}=await exec('gh',['pr','view',String(number),'--repo',
    'BryanHarrisScripts/PlotPickle','--json',
    'number,state,isDraft,headRefOid,headRefName,baseRefName'],
    {cwd:repoRoot,windowsHide:true,timeout:30_000,maxBuffer:4096});
  return JSON.parse(stdout);
}

export async function runOwner3355DraftOnce({
  requestId,grantId,publicationId,sourceHead,repoRoot,root=privateGatewayRoot(),
  now=Date.now,operatorReady=ownerOneShotAllowed,
  code=produceDraftIssuePR,readPr=inspectDraftPr,
}={}){
  if(!ID.test(requestId||'')||!ID.test(grantId||'')||!ID.test(publicationId||'')||
     !SHA.test(sourceHead||'')||!path.isAbsolute(repoRoot||'')||
     !path.isAbsolute(root||''))return blocked('WORKER1_3355_SELECTION_INVALID');
  let coding,publication,claim;
  try{
    [coding,publication,claim]=await Promise.all([
      privateRecord(root,'owner-pi-grants',grantId+'.json'),
      privateRecord(root,'owner-publication-grants',publicationId+'.json'),
      privateRecord(root,'factory-worker-claims',requestId+'.json')]);
  }catch{return blocked('WORKER1_3355_GRANTS_UNVERIFIED');}
  const at=now();
  if(claim.state!=='RESERVED_NO_REPLAY'||claim.requestId!==requestId||
     claim.issueNumber!==3355||claim.sourceHead!==sourceHead||
     claim.workerId!=='coding-worker-1'||
     coding.schemaVersion!==1||coding.kind!=='local-pi-workspace-issue-once'||
     coding.grantId!==grantId||coding.issueNumber!==3355||
     coding.sourceHead!==sourceHead||coding.modelRoute!=='LOCAL_ONLY'||
     coding.maxRequests!==1||coding.consent!=='AUTHORIZE_ONE_3355_ISOLATED_DRAFT_PR'||
     publication.schemaVersion!==1||publication.kind!=='local-pi-draft-pr-once'||
     publication.publicationId!==publicationId||publication.grantId!==grantId||
     publication.issueNumber!==3355||publication.sourceHead!==sourceHead||
     publication.maxRequests!==1||
     publication.consent!=='AUTHORIZE_ONE_3355_DRAFT_PR_ONLY'||
     !Number.isSafeInteger(at)||coding.expiresAt<=at+30_000||
     publication.expiresAt<=at+30_000||
     coding.expiresAt>at+60*60_000||publication.expiresAt>at+60*60_000)
    return blocked('WORKER1_3355_GRANTS_UNVERIFIED');
  try{await lstat(path.join(root,'owner-3355-results',grantId+'.json'));
    return blocked('WORKER1_3355_ALREADY_RECORDED_NO_REPLAY');}
  catch(error){if(error?.code!=='ENOENT')
    return blocked('WORKER1_3355_RECEIPT_STORAGE_UNVERIFIED');}
  if(await operatorReady(sourceHead)!==true)
    return blocked('WORKER1_3355_STOP_PAUSE_OR_HEAD_CHANGED');
  const dir=path.join(root,'owner-3355-results');
  try{await mkdir(dir,{recursive:true,mode:0o700});
    const stat=await lstat(dir);
    if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('DIR');
  }catch{return blocked('WORKER1_3355_RECEIPT_STORAGE_UNVERIFIED');}
  const writeOutcome=record=>appendPrivateJsonOnce(path.join(dir,grantId+'.json'),record);
  const failed=async code=>{
    const record={schemaVersion:1,kind:'worker1-draft-pr-observation',
      requestId,grantId,publicationId,issueNumber:3355,sourceHead,
      state:'BLOCKED',code,independentVerification:false,
      automaticMergeAuthorized:false,replayAuthorized:false};
    if(!await writeOutcome(record))
      return blocked('WORKER1_3355_RECEIPT_STORAGE_UNVERIFIED');
    return blocked(code);
  };
  // The caller has already placed the immutable owner-work-order claim.
  // A failure here retains that claim and forbids re-execution.
  let result;
  try{result=await code({issueNumber:3355,head:sourceHead,root,
    operatorReady:()=>operatorReady(sourceHead)});}
  catch{return failed('WORKER1_3355_CODING_OUTCOME_UNCERTAIN');}
  if(result?.state!=='WAITING_FOR_PRODUCT_UAT'||result.code!=='DRAFT_PR_CREATED'||
     !/^https:\/\/github\.com\/BryanHarrisScripts\/PlotPickle\/pull\/\d+$/.test(result.prUrl||''))
    return failed('WORKER1_3355_CODING_OR_DRAFT_UNVERIFIED');
  const prNumber=Number(result.prUrl.slice(result.prUrl.lastIndexOf('/')+1));
  let pr;
  try{pr=await readPr({repoRoot,number:prNumber});}
  catch{return failed('WORKER1_3355_PR_READBACK_UNVERIFIED');}
  if(pr.number!==prNumber||pr.state!=='OPEN'||pr.isDraft!==true||
     !SHA.test(pr.headRefOid||'')||
     pr.headRefName!==`factory/issue-3355-${sourceHead.slice(0,10)}`||
     pr.baseRefName!=='main'||await operatorReady(sourceHead)!==true)
    return failed('WORKER1_3355_PR_READBACK_UNVERIFIED');
  const receipt={schemaVersion:1,kind:'worker1-draft-pr-observation',
    requestId,grantId,publicationId,issueNumber:3355,sourceHead,
    prNumber,remoteCommit:pr.headRefOid,state:'DRAFT_PR_CREATED',
    focusedTestExecuted:false,independentVerification:false,
    automaticMergeAuthorized:false,replayAuthorized:false};
  const engineeringReceiptId=createHash('sha256').update(JSON.stringify(receipt)).digest('hex');
  if(!await writeOutcome({...receipt,engineeringReceiptId}))
    return blocked('WORKER1_3355_RECEIPT_ALREADY_PRESENT_OR_UNVERIFIED');
  return Object.freeze({...receipt,pullRequestCreated:true,engineeringReceiptId});
}
