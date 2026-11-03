import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {issueOne3110Worker1Ticket} from "../scripts/engineering-team/mcp/engineering/operations/factory-worker1-pilot-issuer.mjs";
import {inspectRejectedModelEdit} from "../scripts/engineering-team/gateway/worker-pool/reconcile-rejected-model-edit-once.mjs";

const OLD="c".repeat(40),HEAD="d".repeat(40),DIGEST="b".repeat(64),AT=1800000000000;
const withRoot=async fn=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"pp-3110-terminal-proof-"));
  try{await fn(root);}finally{await rm(root,{recursive:true,force:true});}
};
const put=async(root,folder,name,value)=>{
  await mkdir(path.join(root,folder),{recursive:true});
  await writeFile(path.join(root,folder,name),JSON.stringify(value)+"\n");
};
const get=async(root,folder,name)=>JSON.parse(await readFile(path.join(root,folder,name),"utf8"));
const issuer=(root,head,at,offset)=>({
  root,expectedHead:head,platform:"win32",
  verifyHead:async()=>head,dispatcherRead:async()=>({state:"ONLINE_OBSERVED"}),
  operatorReady:async()=>true,targetDigest:async()=>DIGEST,now:()=>at,
  id:(()=>{let n=offset;return()=>String(n++).padStart(32,"0")})()
});
async function originalConsumed(root){
  const first=await issueOne3110Worker1Ticket(issuer(root,OLD,AT,1));
  assert.equal(first.code,"WORKER1_3110_GRANTED_NOT_DISPATCHED");
  const [name]=await readdir(path.join(root,"owner-work-orders"));
  const order=await get(root,"owner-work-orders",name);
  assert.equal(order.issueNumber,3110);
  await put(root,"factory-worker-claims",order.requestId+".json",{
    state:"RESERVED_NO_REPLAY",requestId:order.requestId,issueNumber:3110,
    sourceHead:OLD,workerId:"coding-worker-1"
  });
  await put(root,"coding-attempts",order.grantId+".result.json",{
    state:"BLOCKED",code:"CODING_OUTCOME_UNCERTAIN_REVIEW_STAGE",
    phase:"VALIDATE_MODEL_EDIT",replayAuthorized:false
  });
  for(const folder of ["publication-attempts","engineering-receipts"]){
    await mkdir(path.join(root,folder),{recursive:true});
  }
  await mkdir(path.join(root,"coding-worktrees",order.grantId),{recursive:true});
  return order;
}
const witness=(order,phase="VALIDATE_MODEL_EDIT")=>({
  schemaVersion:1,kind:"coding-resource-release",grantId:order.grantId,
  sourceHead:OLD,state:"RECONCILED_MODEL_EDIT_REJECTED_NO_WRITE",
  phase,replayAuthorized:false,publicationAuthorized:false
});
function inspector(root,order,extras={}){
  const stage=path.join(root,"coding-worktrees",order.grantId);
  return {repoRoot:root,root,platform:"win32",
    requestId:order.requestId,grantId:order.grantId,processCount:"0",
    sourceRead:async()=>({channel:"main",head:HEAD}),
    operatorReady:async()=>true,ancestry:async()=>true,
    gitRead:async(cwd,...args)=>{
      if(args[0]==="rev-parse")return OLD;
      if(args[0]==="branch")return "engineering/3110-"+order.grantId;
      if(args[0]==="status"||args[0]==="diff")return "";
      if(args[0]==="ls-remote")return "";
      throw Error("UNEXPECTED_GIT");
    },
    ...extras,stage};
}
test("#3110 rejects model-release without exact original owned order and pristine stage",()=>withRoot(async root=>{
  const order=await originalConsumed(root);
  let r=await inspectRejectedModelEdit(inspector(root,order));
  assert.equal(r.state,"READY_FOR_OWNER_NO_WRITE_RECONCILIATION",JSON.stringify(r));
  assert.equal(r.noPublication,true);
  assert.equal(r.workerProcessAbsent,true);
  r=await inspectRejectedModelEdit(inspector(root,order,{processCount:"1"}));
  assert.equal(r.code,"ACTIVE_OR_UNKNOWN_WORKER_PROCESS");
  r=await inspectRejectedModelEdit(inspector(root,order,{ancestry:async()=>false}));
  assert.equal(r.code,"SOURCE_ANCESTRY_UNVERIFIED");
  r=await inspectRejectedModelEdit(inspector(root,order,{
    gitRead:async(cwd,...args)=>args[0]==="status"?" M target":""
  }));
  assert.equal(r.code,"STAGE_NOT_CLEAN_AT_ORIGINAL_HEAD");
  const sample=inspector(root,order);
  r=await inspectRejectedModelEdit(inspector(root,order,{
    gitRead:async(cwd,...args)=>args[0]==="ls-remote"?"remote-branch":sample.gitRead(cwd,...args)
  }));
  assert.equal(r.code,"REMOTE_BRANCH_PRESENT");
  await put(root,"coding-attempts",order.grantId+".released.json",witness(order));
  r=await inspectRejectedModelEdit(inspector(root,order));
  assert.equal(r.code,"PUBLISH_OR_PRIOR_RELEASE_EVIDENCE_EXISTS");
}));
test("#3110 one new ticket only after matching expired no-write release witness",()=>withRoot(async root=>{
  const order=await originalConsumed(root),opts=()=>issuer(root,HEAD,AT+7200000,5);
  let r=await issueOne3110Worker1Ticket(opts());
  assert.equal(r.code,"WORKER1_PRIOR_ATTEMPT_UNVERIFIED_NO_REPLAY");
  await put(root,"coding-attempts",order.grantId+".released.json",witness(order,"CHECK_STAGE_SYNTAX"));
  r=await issueOne3110Worker1Ticket(opts());
  assert.equal(r.code,"WORKER1_ONCE_ALREADY_RESERVED");
  await put(root,"coding-attempts",order.grantId+".released.json",witness(order));
  r=await issueOne3110Worker1Ticket(opts());
  assert.equal(r.code,"WORKER1_3110_GRANTED_NOT_DISPATCHED",JSON.stringify(r));
  assert.equal(r.modelInvoked,false);
  assert.equal(r.automaticMergeEnabled,false);
  assert.equal(r.replayAuthorized,false);
  const reserves=await readdir(path.join(root,"owner-pilot-reservations"));
  assert.deepEqual(reserves.sort(),["issue-3110-terminal-recovery.json","issue-3110.json"].sort());
  const orders=await readdir(path.join(root,"owner-work-orders"));
  assert.equal(orders.length,2);
  const newId=(await get(root,"owner-pilot-reservations","issue-3110-terminal-recovery.json")).requestId;
  assert.notEqual(newId,order.requestId);
  const replacement=await get(root,"owner-work-orders",newId+".json");
  assert.equal(replacement.sourceHead,HEAD);
  const grant=await get(root,"owner-coding-grants",replacement.grantId+".json");
  assert.match(grant.objective,/oldText exactly the unique source substring/);
  assert.match(grant.objective,/work.grantId !== work.publicationId/);
  const third=await issueOne3110Worker1Ticket(opts());
  assert.equal(third.state,"BLOCKED");
  assert.equal((await readdir(path.join(root,"owner-pilot-reservations"))).length,2);
}));
test("#3110 forged first reservation or publication blocks terminal ticket",()=>withRoot(async root=>{
  const order=await originalConsumed(root);
  await put(root,"coding-attempts",order.grantId+".released.json",witness(order));
  await put(root,"publication-attempts",order.publicationId+".result.json",{state:"DRAFT_PR_CREATED"});
  let r=await issueOne3110Worker1Ticket(issuer(root,HEAD,AT+7200000,15));
  assert.equal(r.state,"BLOCKED");
  await rm(path.join(root,"publication-attempts",order.publicationId+".result.json"));
  const marker=await get(root,"owner-pilot-reservations","issue-3110.json");
  marker.sourceHead=HEAD; // source-stale guard fails
  await put(root,"owner-pilot-reservations","issue-3110.json",marker);
  r=await issueOne3110Worker1Ticket(issuer(root,HEAD,AT+7200000,15));
  assert.equal(r.code,"WORKER1_ONCE_ALREADY_RESERVED");
}));
