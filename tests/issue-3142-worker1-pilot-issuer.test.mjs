import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { issueFixedWorker1Pilot } from "../scripts/engineering-team/mcp/engineering/operations/factory-worker1-pilot-issuer.mjs";
const HEAD="a".repeat(40);
const DIGEST="b".repeat(64);
const ready=()=>({expectedHead:HEAD,platform:"win32",verifyHead:async()=>HEAD,
  dispatcherRead:async()=>({state:"ONLINE_OBSERVED"}),
  operatorReady:async()=>true,targetDigest:async()=>DIGEST,
  now:()=>1800000000000,
  id:(()=>{let i=0;return ()=>String(++i).padStart(32,"0")})()});
test("issue #3142 writes exactly one fully source-bound Worker 1 pilot ticket",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"pp3142-pilot-"));
 try{
   const opts={...ready(),root};
   const first=await issueFixedWorker1Pilot(opts);
   assert.equal(first.state,"TEST_PASSED");
   assert.equal(first.code,"WORKER1_PILOT_GRANTED_NOT_DISPATCHED");
   assert.equal(first.modelInvoked,false);
   const orders=await readdir(path.join(root,"owner-work-orders"));
   assert.equal(orders.length,1);
   const order=JSON.parse(await readFile(path.join(root,"owner-work-orders",orders[0]),"utf8"));
   assert.equal(order.issueNumber,3142);
   assert.equal(order.assignedWorker,"coding-worker-1");
   assert.equal(order.sourceHead,HEAD);
   const coding=JSON.parse(await readFile(path.join(root,"owner-coding-grants",order.grantId+".json"),"utf8"));
   const published=JSON.parse(await readFile(path.join(root,"owner-publication-grants",order.publicationId+".json"),"utf8"));
   assert.equal(coding.model,"qwen2.5-coder:7b");
   assert.equal(coding.targetDigest,DIGEST);
   assert.equal(coding.maxRequests,1);
   assert.equal(published.localCommit,null);
   assert.equal(published.maxRequests,1);
   assert.equal(published.branch,"engineering/3142-"+order.grantId);
   assert.equal((await issueFixedWorker1Pilot({...ready(),root})).state,"BLOCKED");
   assert.equal((await readdir(path.join(root,"owner-work-orders"))).length,1);
 } finally{await rm(root,{force:true,recursive:true});}
});
test("pilot rejects missing dispatcher, STOP, head drift, and non-Windows",async()=>{
 for(const opts of [
  {platform:"linux"},
  {verifyHead:async()=>("c".repeat(40))},
  {dispatcherRead:async()=>({state:"BLOCKED"})},
  {operatorReady:async()=>false},
  {targetDigest:async()=>null}
 ]){
  const root=await mkdtemp(path.join(os.tmpdir(),"pp3142-negative-"));
  try{
    const result=await issueFixedWorker1Pilot({...ready(),...opts,root});
    assert.equal(result.state,"BLOCKED");
    assert.equal(result.replayAuthorized,false);
    assert.equal(await readdir(root).then(x=>x.length),0);
  }finally{await rm(root,{recursive:true,force:true});}
 }
});


async function historic(root,id,{kind="BLOCKED",expire=true,claim=true,
  receipt=true,current=false,invalid=false}={}){
  const at=1800000000000,old=current?HEAD:"c".repeat(40);
  const requestId=String(id).padStart(32,"0"),
    grantId=String(id+10).padStart(32,"0"),
    publicationId=String(id+20).padStart(32,"0");
  const write=async (dir,name,value)=>{
    const folder=path.join(root,dir);
    await mkdir(folder,{recursive:true});
    await writeFile(path.join(folder,name),JSON.stringify(value)+"\n");
  };
  const work={schemaVersion:1,kind:"owner-authorized-factory-job",
    requestId,grantId,publicationId,issueNumber:3142,sourceHead:old,
    assignedWorker:"coding-worker-1",consent:"ONE_OWNER_AUTHORIZED_JOB_NO_REPLAY"};
  await write("owner-work-orders",requestId+".json",work);
  await write("owner-coding-grants",grantId+".json",{
    grantId,issueNumber:3142,sourceHead:old,maxRequests:1,
    expiresAt:expire?at-1:at+600000});
  await write("owner-publication-grants",publicationId+".json",{
    publicationId,grantId,issueNumber:3142,sourceHead:old,maxRequests:1,expiresAt:at-1});
  if(claim)await write("factory-worker-claims",requestId+".json",{
    state:"RESERVED_NO_REPLAY",requestId,issueNumber:3142,
    sourceHead:old,workerId:"coding-worker-1"});
  if(kind==="BLOCKED"){
    await write("coding-attempts",grantId+".result.json",{
      state:"BLOCKED",code:"CODING_OUTCOME_UNCERTAIN_REVIEW_STAGE",replayAuthorized:false});
  }else{
    await write("coding-attempts",grantId+".result.json",{
      state:"LOCAL_COMMIT_PREPARED",grantId,sourceHead:old});
    await write("publication-attempts",publicationId+".result.json",{
      state:"DRAFT_PR_CREATED",publicationId,grantId,issueNumber:3142,
      sourceHead:old,prNumber:3357,remoteCommit:"d".repeat(40)});
    if(receipt)await write("engineering-receipts",grantId+".json",{
      state:"SOURCE_COMMITTED_AND_PR_PUBLISHED",requestId:grantId,
      publicationId,sourceHead:old,issueNumber:3142,prNumber:3357,
      candidateHead:"d".repeat(40),replayAuthorized:false});
  }
  if(invalid)await write("owner-work-orders",requestId+".unexpected",work);
}
test("historical terminal records do not replay but allow exactly one NEW pilot",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"pp3142-history-"));
  try{
    await historic(root,5,{kind:"DRAFT_PR_CREATED"});
    await historic(root,6,{kind:"BLOCKED"});
    const result=await issueFixedWorker1Pilot({...ready(),root});
    assert.equal(result.code,"WORKER1_PILOT_GRANTED_NOT_DISPATCHED");
    assert.equal((await readdir(path.join(root,"owner-work-orders"))).length,3);
    assert.equal((await readdir(path.join(root,"owner-pilot-reservations"))).length,1);
    assert.equal((await issueFixedWorker1Pilot({...ready(),root})).state,"BLOCKED");
    assert.equal((await readdir(path.join(root,"owner-work-orders"))).length,3);
  }finally{await rm(root,{recursive:true,force:true});}
});
test("prior attempt without terminal evidence, valid expiry or no-replay claim blocks fresh issuance",async()=>{
  const scenarios=[
    {kind:"DRAFT_PR_CREATED",receipt:false},
    {kind:"BLOCKED",expire:false},
    {kind:"BLOCKED",claim:false},
    {kind:"BLOCKED",current:true},
    {kind:"BLOCKED",invalid:true}
  ];
  for(const [index,options] of scenarios.entries()){
    const root=await mkdtemp(path.join(os.tmpdir(),"pp3142-history-negative-"));
    try{
      await historic(root,index+30,options);
      const result=await issueFixedWorker1Pilot({...ready(),root});
      assert.equal(result.state,"BLOCKED");
      assert.ok(["PILOT_EXISTING_ORDER_REQUIRES_RECONCILIATION",
        "PILOT_PRIVATE_STORAGE_UNVERIFIED"].includes(result.code));
      assert.equal((await readdir(root)).includes("owner-pilot-reservations"),true);
      assert.equal((await readdir(path.join(root,"owner-pilot-reservations"))).length,0);
    }finally{await rm(root,{recursive:true,force:true});}
  }
});

test("exact terminal release of first #3142 pilot permits one distinct second request only",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"pp3142-terminal-second-"));
  try{
    await historic(root,61,{kind:"BLOCKED"});
    const requestId=String(61).padStart(32,"0");
    const grantId=String(71).padStart(32,"0");
    await mkdir(path.join(root,"owner-pilot-reservations"),{recursive:true});
    await writeFile(path.join(root,"owner-pilot-reservations","issue-3142.json"),
      JSON.stringify({schemaVersion:1,issueNumber:3142,requestId,
        sourceHead:"c".repeat(40),state:"GRANT_WRITES_RESERVED_NO_REPLAY",
        at:1799999000000})+"\n");
    const receipt={schemaVersion:1,kind:"coding-resource-release",grantId,
      sourceHead:"c".repeat(40),state:"RECONCILED_SYNTAX_REJECTED_NO_COMMIT",
      phase:"CHECK_STAGE_SYNTAX",replayAuthorized:false,publicationAuthorized:false};
    await writeFile(path.join(root,"coding-attempts",grantId+".result.json"),
      JSON.stringify({state:"BLOCKED",code:"CODING_OUTCOME_UNCERTAIN_REVIEW_STAGE",
        phase:"CHECK_STAGE_SYNTAX",replayAuthorized:false})+"\n");
    assert.equal((await issueFixedWorker1Pilot({...ready(),root})).state,"BLOCKED",
      "missing terminal release witness must deny");
    const witness=path.join(root,"coding-attempts",grantId+".released.json");
    await writeFile(witness,JSON.stringify({...receipt,publicationAuthorized:true})+"\n");
    assert.equal((await issueFixedWorker1Pilot({...ready(),root})).state,"BLOCKED",
      "a release claiming publication authority must deny");
    await writeFile(witness,JSON.stringify(receipt)+"\n");
    const result=await issueFixedWorker1Pilot({...ready(),root});
    assert.equal(result.code,"WORKER1_PILOT_GRANTED_NOT_DISPATCHED");
    assert.deepEqual((await readdir(path.join(root,"owner-pilot-reservations"))).sort(),
      ["issue-3142.json","issue-3142-terminal-recovery.json"].sort());
    assert.equal((await issueFixedWorker1Pilot({...ready(),root})).state,"BLOCKED",
      "no third pilot even after a terminal failure");
    assert.equal((await readdir(path.join(root,"owner-work-orders"))).length,2);
  }finally{await rm(root,{recursive:true,force:true});}
});
