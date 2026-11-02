import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {issueOne3110Worker1Ticket}
  from "../scripts/engineering-team/mcp/engineering/operations/factory-worker1-pilot-issuer.mjs";
import {validOwnerPilotException}
  from "../scripts/engineering-team/gateway/worker-pool/worker-host.mjs";
import {handleRpc,MCP_CONTROL_TOOLS}
  from "../scripts/engineering-team/mcp/factory-readonly-server.mjs";

const HEAD="a".repeat(40),OLD="c".repeat(40),DIGEST="b".repeat(64),AT=1800000000000;
const withRoot=async fn=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"pp-3110-worker-once-"));
  try{return await fn(root);}finally{await rm(root,{recursive:true,force:true});}
};
const options=root=>({
  root,expectedHead:HEAD,platform:"win32",
  verifyHead:async()=>HEAD,dispatcherRead:async()=>({state:"ONLINE_OBSERVED"}),
  operatorReady:async()=>true,targetDigest:async()=>DIGEST,
  now:()=>AT,id:(()=>{let n=0;return()=>String(++n).padStart(32,"0");})(),
});
const save=async(root,folder,name,obj)=>{
  const dir=path.join(root,folder);await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,name),JSON.stringify(obj)+"\n");
};
async function historic(root,{release=true,oldSource=OLD}={}){
  const requestId="8".repeat(32),grantId="9".repeat(32),
    publicationId="7".repeat(32);
  const order={schemaVersion:1,kind:"owner-authorized-factory-job",
    requestId,grantId,publicationId,issueNumber:3142,
    sourceHead:oldSource,assignedWorker:"coding-worker-1",
    consent:"ONE_OWNER_AUTHORIZED_JOB_NO_REPLAY"};
  await save(root,"owner-work-orders",requestId+".json",order);
  await save(root,"factory-worker-claims",requestId+".json",{
    state:"RESERVED_NO_REPLAY",requestId,issueNumber:3142,
    sourceHead:oldSource,workerId:"coding-worker-1"});
  await save(root,"owner-coding-grants",grantId+".json",{
    grantId,issueNumber:3142,sourceHead:oldSource,
    maxRequests:1,expiresAt:AT-50000});
  await save(root,"owner-publication-grants",publicationId+".json",{
    publicationId,grantId,issueNumber:3142,sourceHead:oldSource,
    maxRequests:1,expiresAt:AT-50000});
  await save(root,"coding-attempts",grantId+".result.json",{
    state:"BLOCKED",code:"CODING_OUTCOME_UNCERTAIN_REVIEW_STAGE",
    replayAuthorized:false});
  if(release)await save(root,"coding-attempts",grantId+".released.json",{
    schemaVersion:1,kind:"coding-resource-release",grantId,
    sourceHead:oldSource,state:"RECONCILED_MODEL_EDIT_REJECTED_NO_WRITE",
    replayAuthorized:false,publicationAuthorized:false});
}
test("#3110 one new exact-head Worker1 work order, three disjoint IDs, no authority to merge",()=>withRoot(async root=>{
  const first=await issueOne3110Worker1Ticket(options(root));
  assert.equal(first.code,"WORKER1_3110_GRANTED_NOT_DISPATCHED");
  assert.equal(first.modelInvoked,false);
  assert.equal(first.automaticMergeEnabled,false);
  const files=await readdir(path.join(root,"owner-work-orders"));
  assert.equal(files.length,1);
  const work=JSON.parse(await readFile(path.join(root,"owner-work-orders",files[0]),"utf8"));
  assert.equal(work.issueNumber,3110);
  assert.equal(work.assignedWorker,"coding-worker-1");
  assert.equal(work.sourceHead,HEAD);
  assert.equal(new Set([work.requestId,work.grantId,work.publicationId]).size,3);
  const grant=JSON.parse(await readFile(path.join(root,"owner-coding-grants",work.grantId+".json"),"utf8"));
  assert.equal(grant.issueNumber,3110);
  assert.equal(grant.targetPath,"scripts/engineering-team/gateway/worker-pool/worker-pool.mjs");
  assert.equal(grant.focusedTest,"tests/issue-3142-factory-worker-pool.test.mjs");
  assert.equal(grant.targetDigest,DIGEST);
  assert.equal(grant.model,"qwen2.5-coder:7b");
  assert.equal(grant.maxRequests,1);
  assert.ok(grant.expiresAt-AT<=3600000);
  const exception=JSON.parse(await readFile(path.join(root,"owner-pilot-exceptions",work.requestId+".json"),"utf8"));
  assert.equal(validOwnerPilotException(exception,work,HEAD,AT),true);
  assert.equal(validOwnerPilotException({...exception,issueNumber:3355},work,HEAD,AT),false);
  assert.equal(validOwnerPilotException({...exception,consent:"OTHER"},work,HEAD,AT),false);
  assert.equal((await readdir(path.join(root,"owner-pilot-reservations"))).length,1);
  const second=await issueOne3110Worker1Ticket(options(root));
  assert.equal(second.state,"BLOCKED");
  assert.equal(second.code,"WORKER1_PRIOR_ATTEMPT_UNVERIFIED_NO_REPLAY");
  assert.equal((await readdir(path.join(root,"owner-work-orders"))).length,1);
}));
test("#3110 previous blocked pilot is not silently rearmed or mistaken for terminal",()=>withRoot(async root=>{
  await historic(root,{release:false});
  const denied=await issueOne3110Worker1Ticket(options(root));
  assert.equal(denied.code,"WORKER1_PRIOR_ATTEMPT_UNVERIFIED_NO_REPLAY");
  await save(root,"coding-attempts","9".repeat(32)+".released.json",{
    schemaVersion:1,kind:"coding-resource-release",grantId:"9".repeat(32),
    sourceHead:OLD,state:"RECONCILED_MODEL_EDIT_REJECTED_NO_WRITE",
    replayAuthorized:false,publicationAuthorized:false});
  const allowed=await issueOne3110Worker1Ticket(options(root));
  assert.equal(allowed.code,"WORKER1_3110_GRANTED_NOT_DISPATCHED");
  const files=await readdir(path.join(root,"owner-work-orders"));
  assert.equal(files.length,2);
  assert.ok(files.includes("8".repeat(32)+".json"));
}));
test("#3110 cross-head history and unsafe platform/identity/STOP/dispatcher fail closed",()=>withRoot(async root=>{
  const cases=[
    {platform:"linux"}, {verifyHead:async()=>OLD},
    {dispatcherRead:async()=>({state:"BLOCKED"})},
    {operatorReady:async()=>false},{targetDigest:async()=>null},
  ];
  for(const given of cases){
    const r=await issueOne3110Worker1Ticket({...options(root),...given});
    assert.equal(r.state,"BLOCKED");
    assert.equal(r.replayAuthorized,false);
  }
  assert.deepEqual(await readdir(root),[],"no failed preflight should reserve grant");
  await historic(root,{oldSource:HEAD});
  assert.equal((await issueOne3110Worker1Ticket(options(root))).code,
    "WORKER1_PRIOR_ATTEMPT_UNVERIFIED_NO_REPLAY");
}));
test("#3110 authenticated MCP selection is fixed, one-use and never invokes a model",()=>withRoot(async root=>{
  const suite=MCP_CONTROL_TOOLS.find(x=>x.name==="factory_run_named_test");
  assert.ok(suite.inputSchema.properties.suite.enum.includes("factory-worker1-3110-once"));
  const args={requestId:"f".repeat(32),expectedHead:HEAD,suite:"factory-worker1-3110-once"};
  let invoked=0;
  const invoke=(input,authenticated)=>handleRpc({jsonrpc:"2.0",id:7,
    method:"tools/call",params:{name:"factory_run_named_test",arguments:input}},
    {root,controlAuthenticated:authenticated,controlOps:{
      testHead:async()=>HEAD,
      worker3110Issuer:async({expectedHead})=>{
        invoked++;assert.equal(expectedHead,HEAD);
        return {state:"TEST_PASSED",code:"WORKER1_3110_GRANTED_NOT_DISPATCHED",
          sourceHead:HEAD,modelInvoked:false,replayAuthorized:false};
      },
    }});
  assert.equal((await invoke(args,false)).error.code,-32001);
  assert.equal((await invoke({...args,issueNumber:3355},true)).error.code,-32602);
  assert.equal(invoked,0);
  const issued=(await invoke(args,true)).result.structuredContent;
  assert.equal(issued.code,"WORKER1_3110_GRANTED_NOT_DISPATCHED");
  assert.equal(issued.independentVerification,false);
  assert.equal(issued.releaseAuthorized,false);
  assert.equal(issued.modelInvoked,false);
  assert.equal(invoked,1);
  assert.equal((await invoke(args,true)).result.structuredContent.state,
    "DUPLICATE_OR_UNVERIFIABLE_REQUEST");
  assert.equal(invoked,1);
}));
