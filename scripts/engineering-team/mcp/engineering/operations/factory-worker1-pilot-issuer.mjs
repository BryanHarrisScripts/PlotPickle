/**
 * #3142: owner-only fixed pilot issuance with ONE separately authorized
 * terminal-recovery attempt. Both reservations are write-once; never replay.
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
/**
 * A former owner order is never rearmed. Allow a new fixed one-shot grant ONLY
 * when every pre-issuer order is source-stale, expired, durably claimed, and
 * demonstrably terminal. Malformed/uncertain records are a permanent block
 * pending separate review; no historical file is deleted or rewritten.
 */
async function historicalRecord(root,folder,name){
  if(!/^[a-f0-9]{32}(?:\.result)?\.json$/.test(name))
    throw Error("HISTORICAL_RECORD_NAME_INVALID");
  const parent=path.join(root,folder);
  const ps=await lstat(parent);
  if(!ps.isDirectory()||ps.isSymbolicLink())
    throw Error("HISTORICAL_DIRECTORY_UNTRUSTED");
  const file=path.join(parent,name),stat=await lstat(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>8192)
    throw Error("HISTORICAL_RECORD_UNTRUSTED");
  return JSON.parse(await readFile(file,"utf8"));
}
async function historicalAbsent(root,folder,name){
  if(!/^[a-f0-9]{32}(?:\.result)?\.json$/.test(name))return false;
  try{
    const parent=path.join(root,folder);
    const stat=await lstat(parent);
    if(!stat.isDirectory()||stat.isSymbolicLink())return false;
    await lstat(path.join(parent,name));
    return false;
  }catch(error){return error?.code==="ENOENT";}
}
export async function priorOwnerOrdersTerminal({root,entries,expectedHead,at}={}){
  if(!path.isAbsolute(root||"")||!SHA.test(expectedHead||"")||
     !Number.isSafeInteger(at)||!Array.isArray(entries)||
     entries.length<1||entries.length>20||
     new Set(entries).size!==entries.length)return false;
  for(const filename of entries){
      if(!/^[a-f0-9]{32}\.json$/.test(filename))return false;
      const work=await historicalRecord(root,"owner-work-orders",filename);
      if(work.requestId+".json"!==filename||
         !validateOwnerWorkOrder(work,work.sourceHead)||
         work.sourceHead===expectedHead)return false;
      const claim=await historicalRecord(root,"factory-worker-claims",filename);
      const grant=await historicalRecord(root,"owner-coding-grants",work.grantId+".json");
      const publishing=await historicalRecord(root,"owner-publication-grants",work.publicationId+".json");
      const coding=await historicalRecord(root,"coding-attempts",work.grantId+".result.json");
      if(claim.state!=="RESERVED_NO_REPLAY"||claim.requestId!==work.requestId||
         claim.issueNumber!==work.issueNumber||claim.sourceHead!==work.sourceHead||
         claim.workerId!=="coding-worker-1"||
         grant.grantId!==work.grantId||grant.sourceHead!==work.sourceHead||
         grant.issueNumber!==work.issueNumber||grant.maxRequests!==1||
         !Number.isSafeInteger(grant.expiresAt)||grant.expiresAt>=at||
         publishing.publicationId!==work.publicationId||
         publishing.grantId!==work.grantId||publishing.sourceHead!==work.sourceHead||
         publishing.issueNumber!==work.issueNumber||publishing.maxRequests!==1||
         !Number.isSafeInteger(publishing.expiresAt)||publishing.expiresAt>=at)
        return false;
      if(coding.state==="BLOCKED"){
        if(typeof coding.code!=="string"||!/^CODING_[A-Z0-9_]+$/.test(coding.code)||
           coding.replayAuthorized===true||
           !await historicalAbsent(root,"publication-attempts",work.publicationId+".result.json")||
           !await historicalAbsent(root,"engineering-receipts",work.grantId+".json"))
          return false;
      }else if(coding.state==="LOCAL_COMMIT_PREPARED"){
        const published=await historicalRecord(root,"publication-attempts",work.publicationId+".result.json");
        const receipt=await historicalRecord(root,"engineering-receipts",work.grantId+".json");
        if(coding.grantId!==work.grantId||coding.sourceHead!==work.sourceHead||
           published.state!=="DRAFT_PR_CREATED"||published.publicationId!==work.publicationId||
           published.grantId!==work.grantId||published.issueNumber!==work.issueNumber||
           published.sourceHead!==work.sourceHead||
           receipt.state!=="SOURCE_COMMITTED_AND_PR_PUBLISHED"||
           receipt.requestId!==work.grantId||receipt.publicationId!==work.publicationId||
           receipt.sourceHead!==work.sourceHead||receipt.issueNumber!==work.issueNumber||
           receipt.prNumber!==published.prNumber||receipt.candidateHead!==published.remoteCommit||
           receipt.replayAuthorized!==false)return false;
      }else return false;
    }
  return true;
}

/**
 * Owner-authorized terminal recovery can mint ONE new pilot only after
 * the original specifically marked #3142 pilot is conclusively rejected,
 * its coding resource has a retained terminal witness, and publication is
 * proven absent. A prior success or uncertain claim never reauthorizes.
 */
async function priorPilotTerminalRecoveryProven(root,expectedHead,at){
  try{
    const dir=path.join(root,"owner-pilot-reservations");
    const parent=await lstat(dir);
    if(!parent.isDirectory()||parent.isSymbolicLink())return false;
    const file=path.join(dir,"issue-3142.json"),stat=await lstat(file);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>4096)return false;
    const marker=JSON.parse(await readFile(file,"utf8"));
    if(marker.schemaVersion!==1||marker.issueNumber!==ISSUE||
       marker.state!=="GRANT_WRITES_RESERVED_NO_REPLAY"||
       !/^[a-f0-9]{32}$/.test(marker.requestId||"")||
       !SHA.test(marker.sourceHead||"")||marker.sourceHead===expectedHead||
       !Number.isSafeInteger(marker.at)||marker.at>=at)return false;
    const work=await historicalRecord(root,"owner-work-orders",marker.requestId+".json");
    if(!validateOwnerWorkOrder(work,work.sourceHead)||
       work.issueNumber!==ISSUE||work.requestId!==marker.requestId||
       work.sourceHead!==marker.sourceHead||work.assignedWorker!=="coding-worker-1")return false;
    const coding=await historicalRecord(root,"coding-attempts",work.grantId+".result.json");
    if(coding.state!=="BLOCKED"||
       coding.code!=="CODING_OUTCOME_UNCERTAIN_REVIEW_STAGE"||
       coding.phase!=="CHECK_STAGE_SYNTAX"||coding.replayAuthorized!==false)return false;
    const pathname=path.join(root,"coding-attempts",work.grantId+".released.json");
    const releasedStat=await lstat(pathname);
    if(!releasedStat.isFile()||releasedStat.isSymbolicLink()||
       releasedStat.size<2||releasedStat.size>4096)return false;
    const release=JSON.parse(await readFile(pathname,"utf8"));
    if(release.schemaVersion!==1||release.kind!=="coding-resource-release"||
       release.grantId!==work.grantId||release.sourceHead!==work.sourceHead||
       release.state!=="RECONCILED_SYNTAX_REJECTED_NO_COMMIT"||
       release.phase!=="CHECK_STAGE_SYNTAX"||release.replayAuthorized!==false||
       release.publicationAuthorized!==false||release.localCommit!==undefined||
       release.branch!==undefined)return false;
    return await historicalAbsent(root,"publication-attempts",work.publicationId+".result.json") &&
      await historicalAbsent(root,"engineering-receipts",work.grantId+".json");
  }catch{return false;}
}
/** Creates only the first or distinct terminal-recovery #3142 order. Never merges. */
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
  let dirs,terminalRecovery=false;
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
    if(existing.length!==0 && !await priorOwnerOrdersTerminal({
      root,entries:existing,expectedHead,at}))
      return denied("PILOT_EXISTING_ORDER_REQUIRES_RECONCILIATION");
    const reserved=await readdir(dirs.reserve);
    if(reserved.length===0){ /* original fixed pilot */ }
    else if(reserved.length===1&&reserved[0]==="issue-3142.json"&&
      await priorPilotTerminalRecoveryProven(root,expectedHead,at)){
      terminalRecovery=true;
    }else return denied("PILOT_ALREADY_RESERVED_NO_REPLAY");
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
    objective:"For #3142 Worker 1 commissioning, improve exactly one EXISTING JavaScript line comment in the worker fleet diagnostics. Modify no executable statement, import, grant, permission, STOP/PAUSE, release or merge behavior. Return exact oldText/newText JSON only; the replacement must remain a valid JavaScript line comment.",
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
    await oneFile(dirs.reserve,terminalRecovery?"issue-3142-terminal-recovery.json":"issue-3142.json",{
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

/**
 * #3110: one owner-supervised Worker 1 commissioning job, not a general
 * issue-text-to-model API. The previous #3142 tickets are never retried.
 * This exact issue, target, focused test and objective are pinned in trusted
 * installed MAIN. No F00 signature, test admission or merge is granted.
 */
async function prior3110HistorySettled(root,entries,expectedHead,at){
  if(entries.length===0)return true;
  if(!await priorOwnerOrdersTerminal({root,entries,expectedHead,at}))return false;
  // A rejected model proposal is not, by itself, proof of no write.
  // Require an independently recorded terminal release witness for EVERY
  // blocked older coding attempt before another model can be admitted.
  for(const filename of entries){
    try{
      const work=await historicalRecord(root,"owner-work-orders",filename);
      const coding=await historicalRecord(root,"coding-attempts",work.grantId+".result.json");
      if(coding.state!=="BLOCKED")continue;
      const p=path.join(root,"coding-attempts",work.grantId+".released.json");
      const st=await lstat(p);
      if(!st.isFile()||st.isSymbolicLink()||st.size<2||st.size>4096)return false;
      const released=JSON.parse(await readFile(p,"utf8"));
      if(released.schemaVersion!==1||released.kind!=="coding-resource-release"||
         released.grantId!==work.grantId||released.sourceHead!==work.sourceHead||
         !["RECONCILED_SYNTAX_REJECTED_NO_COMMIT",
           "RECONCILED_MODEL_EDIT_REJECTED_NO_WRITE"].includes(released.state)||
         released.replayAuthorized!==false||released.publicationAuthorized!==false)
        return false;
    }catch{return false;}
  }
  return true;
}

export async function issueOne3110Worker1Ticket({
  expectedHead,platform=process.platform,repoRoot=ROOT,
  verifyHead=readFactoryVerificationHead,root=privateGatewayRoot(),
  operatorReady=ownerOneShotAllowed,dispatcherRead=readDispatcher,
  now=Date.now,id=()=>randomBytes(16).toString("hex"),
  targetDigest=readTarget,
}={}){
  if(platform!=="win32")return denied("WORKER1_WINDOWS_ONLY");
  if(!SHA.test(expectedHead||""))return denied("WORKER1_SOURCE_UNVERIFIED");
  let head,dispatcher,digest,at;
  try{
    [head,dispatcher,digest]=await Promise.all([
      verifyHead({repoRoot}),dispatcherRead(),targetDigest(repoRoot)]);
    at=now();
    if(head!==expectedHead||!Number.isSafeInteger(at)||
       !/^[a-f0-9]{64}$/.test(digest))
      return denied("WORKER1_SOURCE_UNVERIFIED");
    if(dispatcher?.state!=="ONLINE_OBSERVED")
      return denied("WORKER1_DISPATCHER_NOT_ONLINE");
    if(await operatorReady(expectedHead)!==true)
      return denied("WORKER1_STOP_PAUSE_OR_SOURCE_UNVERIFIED");
  }catch{return denied("WORKER1_READINESS_UNVERIFIED");}

  let dirs;
  try{
    dirs={
      reserve:await ownerDirectory(root,"owner-pilot-reservations"),
      orders:await ownerDirectory(root,"owner-work-orders"),
      coding:await ownerDirectory(root,"owner-coding-grants"),
      publication:await ownerDirectory(root,"owner-publication-grants"),
      exceptions:await ownerDirectory(root,"owner-pilot-exceptions"),
    };
    const prior=await readdir(dirs.orders);
    if(!await prior3110HistorySettled(root,prior,expectedHead,at))
      return denied("WORKER1_PRIOR_ATTEMPT_UNVERIFIED_NO_REPLAY");
    const reservations=await readdir(dirs.reserve);
    if(reservations.some(n=>!["issue-3142.json",
      "issue-3142-terminal-recovery.json"].includes(n)))
      return denied("WORKER1_ONCE_ALREADY_RESERVED");
  }catch{return denied("WORKER1_STORAGE_UNVERIFIED");}

  const requestId=id(),grantId=id(),publicationId=id();
  if(![requestId,grantId,publicationId].every(n=>/^[a-f0-9]{32}$/.test(n))||
     new Set([requestId,grantId,publicationId]).size!==3)
    return denied("WORKER1_IDS_UNVERIFIED");
  const expiresAt=at+45*60*1000;
  const order={schemaVersion:1,kind:"owner-authorized-factory-job",
    requestId,grantId,publicationId,issueNumber:3110,
    sourceHead:expectedHead,assignedWorker:"coding-worker-1",
    consent:"ONE_OWNER_AUTHORIZED_JOB_NO_REPLAY"};
  const coding={schemaVersion:1,kind:"engineering-edit-once",grantId,
    issueNumber:3110,sourceHead:expectedHead,targetPath:TARGET,
    targetDigest:digest,focusedTest:TEST,
    objective:"Fix the owner work-order validator to reject requestId equal to grantId or publicationId, in addition to the existing grantId/publicationId inequality. Change only that one existing JavaScript validation expression. Preserve other checks and behavior.",
    model:"qwen2.5-coder:7b",maxOutputTokens:1200,expiresAt,maxRequests:1,
    consent:"AUTHORIZE_ONE_ENGINEERING_SOURCE_EDIT"};
  const publication={schemaVersion:1,kind:"draft-pr-publish-approved-coding-once",
    publicationId,grantId,issueNumber:3110,sourceHead:expectedHead,
    localCommit:null,branch:`engineering/3110-${grantId}`,
    targetPath:TARGET,expiresAt,maxRequests:1,
    consent:"AUTHORIZE_ONE_DRAFT_PR_FROM_ONE_APPROVED_CODING_EDIT"};
  const exception={schemaVersion:1,kind:"owner-one-shot-exception",
    issueNumber:3110,sourceHead:expectedHead,requestId,grantId,publicationId,
    expiresAt,maxRequests:1,consent:"AUTHORIZE_ONE_3110_SUPERVISED_DRAFT_NO_F00"};
  if(!validateOwnerWorkOrder(order,expectedHead)||
     !validateCodingGrant(coding,{channel:"main",head:expectedHead},at))
    return denied("WORKER1_GRANTS_UNVERIFIED");
  try{
    if(await verifyHead({repoRoot})!==expectedHead||
       await operatorReady(expectedHead)!==true||
       (await dispatcherRead())?.state!=="ONLINE_OBSERVED")
      return denied("WORKER1_READINESS_CHANGED");
    // Write-once reservation FIRST; preserve partial failure for Human review.
    await oneFile(dirs.reserve,"issue-3110.json",{
      schemaVersion:1,issueNumber:3110,requestId,sourceHead:expectedHead,
      state:"GRANT_WRITES_RESERVED_NO_REPLAY",at});
    await oneFile(dirs.coding,grantId+".json",coding);
    await oneFile(dirs.publication,publicationId+".json",publication);
    await oneFile(dirs.exceptions,requestId+".json",exception);
    // Dispatcher sees the ticket only after both grants and owner exception.
    await oneFile(dirs.orders,requestId+".json",order);
  }catch{return denied("WORKER1_PARTIAL_GRANTS_RECONCILE_NO_REPLAY");}
  return Object.freeze({state:"TEST_PASSED",
    code:"WORKER1_3110_GRANTED_NOT_DISPATCHED",sourceHead:expectedHead,
    modelInvoked:false,workerProcessVerified:false,replayAuthorized:false,
    automaticMergeEnabled:false});
}
