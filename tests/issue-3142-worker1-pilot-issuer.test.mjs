import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
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
