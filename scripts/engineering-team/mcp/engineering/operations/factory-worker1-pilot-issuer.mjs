/**
 * #3142: fixed owner-only ONE pilot issuer. Not a general work-order broker.
 * Retained marker is write-once even if a later write fails: never replay.
 */
import { createHash, randomBytes } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { readFactoryVerificationHead } from "../../factory-named-tests.mjs";
import { privateGatewayRoot } from "../../../gateway/gateway-host.mjs";
import { ownerOneShotAllowed } from "../../../gateway/owner-runtime-gate.mjs";
import { status as readDispatcher } from "../../../gateway/worker-pool/dispatcher/native-dispatcher.mjs";
import { validateOwnerWorkOrder } from "../../../gateway/worker-pool/worker-pool.mjs";
import { validateCodingGrant } from "../../../gateway/authorized-coding-once.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..","..","..","..");
const TARGET="scripts/engineering-team/gateway/worker-pool/worker-pool.mjs";
const TEST="tests/issue-3142-factory-worker-pool.test.mjs";
const ISSUE=3142;
const SHA=/^[a-f0-9]{40}$/;
const denied=code=>Object.freeze({state:"BLOCKED",code,modelInvoked:false,
  workerProcessVerified:false,replayAuthorized:false,automaticMergeEnabled:false});
async function ownerDirectory(root,name){
  const target=path.join(root,name);
  try { await mkdir(target,{recursive:true,mode:0o700}); const stat=await lstat(target);
    if(!stat.isDirectory()||stat.isSymbolicLink())throw Error("BAD_DIRECTORY"); }
  catch { throw Error("PILOT_PRIVATE_STORAGE_UNVERIFIED"); }
  return target;
}
async function oneFile(directory,name,value){
  const pathname=path.join(directory,name);
  const f=await open(pathname,"wx",0o600);
  try { await f.writeFile(JSON.stringify(value)+"\n");await f.sync(); }
  finally { await f.close(); }
}
async function readTarget(root){
  const pathname=path.join(root,...TARGET.split("/"));
  const stat=await lstat(pathname);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<8||stat.size>16384)
    throw Error("TARGET_INVALID");
  const content=await readFile(pathname,"utf8");
  const focused=path.join(root,...TEST.split("/"));
  const ts=await lstat(focused);
  if(!ts.isFile()||ts.isSymbolicLink())throw Error("FOCUSED_TEST_INVALID");
  return createHash("sha256").update(content.replace(/\r\n/g,"\n"),"utf8").digest("hex");
}
/** Creates exactly one fixed #3142 order. Never issues merge permission. */
export async function issueFixedWorker1Pilot({
  expectedHead,platform=process.platform,repoRoot=ROOT,
  verifyHead=readFactoryVerificationHead,root=privateGatewayRoot(),
  operatorReady=ownerOneShotAllowed,dispatcherRead=readDispatcher,
  now=Date.now,id=()=>randomBytes(16).toString("hex"),
  targetDigest=readTarget,
}={}){
  if(platform!=="win32")return denied("WINDOWS_ONLY");
  if(!SHA.test(expectedHead||""))return denied("PILOT_SOURCE_UNVERIFIED");
  let head,online,digest,at;
  try {
    [head,online,digest]=await Promise.all([
      verifyHead({repoRoot}),dispatcherRead(),targetDigest(repoRoot)]);
    at=now();
    if(head!==expectedHead)return denied("PILOT_SOURCE_UNVERIFIED");
    if(online?.state!=="ONLINE_OBSERVED")
      return denied("PILOT_DISPATCHER_NOT_ONLINE");
    if(await operatorReady(head)!==true)
      return denied("PILOT_STOP_PAUSE_OR_SUPERVISOR_UNVERIFIED");
    if(!Number.isSafeInteger(at)||!/^[a-f0-9]{64}$/.test(digest))
      return denied("PILOT_SOURCE_UNVERIFIED");
  }catch{return denied("PILOT_READINESS_UNVERIFIED");}
  let dirs;
  try {
    dirs={
      reserve:await ownerDirectory(root,"owner-pilot-reservations"),
      orders:await ownerDirectory(root,"owner-work-orders"),
      coding:await ownerDirectory(root,"owner-coding-grants"),
      publication:await ownerDirectory(root,"owner-publication-grants"),
      exceptions:await ownerDirectory(root,"owner-pilot-exceptions"),
    };
    // Never admit over an existing owner-issued work order, even if invalid.
    // Historical legacy queue is separate and remains blocked/nonreplayable.
    const existing=await readdir(dirs.orders);
    if(existing.length!==0)return denied("PILOT_EXISTING_ORDER_REQUIRES_RECONCILIATION");
    if((await readdir(dirs.reserve)).length!==0)
      return denied("PILOT_ALREADY_RESERVED_NO_REPLAY");
  }catch{return denied("PILOT_PRIVATE_STORAGE_UNVERIFIED");}
  const requestId=id(),grantId=id(),publicationId=id();
  if(![requestId,grantId,publicationId].every(x=>/^[a-f0-9]{32}$/.test(x))||
     new Set([requestId,grantId,publicationId]).size!==3)return denied("PILOT_ID_UNVERIFIED");
  const expiresAt=at+45*60*1000;
  const work={schemaVersion:1,kind:"owner-authorized-factory-job",
    requestId,grantId,publicationId,issueNumber:ISSUE,
    sourceHead:expectedHead,assignedWorker:"coding-worker-1",
    consent:"ONE_OWNER_AUTHORIZED_JOB_NO_REPLAY"};
  const coding={schemaVersion:1,kind:"engineering-edit-once",grantId,
    issueNumber:ISSUE,sourceHead:expectedHead,targetPath:TARGET,
    targetDigest:digest,focusedTest:TEST,
    objective:"For #3142 Worker 1 proof, make one minimal source-bound clarity improvement in the worker fleet diagnostics without changing any permission, STOP/PAUSE, grant, execution or merge rule. Return one exact oldText/newText replacement only.",
    model:"qwen2.5-coder:7b",maxOutputTokens:1200,expiresAt,maxRequests:1,
    consent:"AUTHORIZE_ONE_ENGINEERING_SOURCE_EDIT"};
  const publishing={schemaVersion:1,kind:"draft-pr-publish-approved-coding-once",
    publicationId,grantId,issueNumber:ISSUE,sourceHead:expectedHead,
    localCommit:null,branch:`engineering/${ISSUE}-${grantId}`,
    targetPath:TARGET,expiresAt,maxRequests:1,
    consent:"AUTHORIZE_ONE_DRAFT_PR_FROM_ONE_APPROVED_CODING_EDIT"};
  const exception={schemaVersion:1,kind:"owner-one-shot-exception",
    issueNumber:ISSUE,sourceHead:expectedHead,requestId,grantId,publicationId,
    expiresAt,maxRequests:1,consent:"AUTHORIZE_ONE_3142_PILOT_NO_F00"};
  if(!validateOwnerWorkOrder(work,expectedHead)||
     !validateCodingGrant(coding,{channel:"main",head:expectedHead},at))
    return denied("PILOT_GRANT_VALIDATION_FAILED");
  try {
    if(await verifyHead({repoRoot})!==expectedHead||
       await operatorReady(expectedHead)!==true||
       (await dispatcherRead())?.state!=="ONLINE_OBSERVED")
      return denied("PILOT_READINESS_CHANGED");
    // Write a durable no-replay marker BEFORE any granting. A partial result
    // is an explicit operator reconciliation, never permission to retry.
    await oneFile(dirs.reserve,"issue-3142.json",{
      schemaVersion:1,issueNumber:ISSUE,requestId,sourceHead:expectedHead,
      state:"GRANT_WRITES_RESERVED_NO_REPLAY",at});
    await oneFile(dirs.coding,grantId+".json",coding);
    await oneFile(dirs.publication,publicationId+".json",publishing);
    await oneFile(dirs.exceptions,requestId+".json",exception);
    // Ticket LAST: the dispatcher can observe it only with grants present.
    await oneFile(dirs.orders,requestId+".json",work);
  }catch{return denied("PILOT_PARTIAL_GRANTS_RECONCILE_NO_REPLAY");}
  return Object.freeze({state:"TEST_PASSED",code:"WORKER1_PILOT_GRANTED_NOT_DISPATCHED",
    sourceHead:expectedHead,modelInvoked:false,workerProcessVerified:false,
    replayAuthorized:false,automaticMergeEnabled:false});
}
