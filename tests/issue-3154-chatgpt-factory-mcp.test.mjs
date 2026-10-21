import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import http from "node:http";
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  privateFactoryRoot, sanitizeReceipt, sanitizeDependencyPreflight, factoryStatus, factoryEvidence,
  factoryIssuePreview, factoryObserver, factoryHostHead, executeMcpRequest, handleRpc, MCP_TOOLS,
  createLocalMcpHttpServer, runStdio, controlTokenMatches,
  MCP_CONTROL_TOOLS, factoryControlReceipt,
} from "../scripts/engineering-team/mcp/factory-readonly-server.mjs";

const OLD="a".repeat(40),NEW="b".repeat(40);
async function sandbox(fn) {
  const root=await mkdtemp(path.join(os.tmpdir(),"plotpickle-mcp-3154-"));
  try{return await fn(root);}finally{await rm(root,{recursive:true,force:true});}
}
async function seed(root) {
  const jobs=path.join(root,"jobs");
  await mkdir(jobs,{recursive:true});
  await writeFile(path.join(root,"config.json"),JSON.stringify({
    schemaVersion:1,enabled:true,repository:"BryanHarrisScripts/PlotPickle",
    issues:[3141],mergeDocsOnly:false,automaticMergeEnabled:false,
  }));
  await writeFile(path.join(root,"heartbeat.json"),JSON.stringify({
    schemaVersion:1,state:"WAITING_FOR_ELIGIBLE_ISSUE",
    issueNumber:null,at:1000,
  }));
  await writeFile(path.join(jobs,"issue-3141.json"),JSON.stringify({
    issueNumber:3141,attempt:1,sourceHead:OLD,state:"STARTED_UNCONFIRMED",
    privatePrompt:"do not disclose original",replayAuthorized:false,
  }));
  await writeFile(path.join(jobs,"result-3141.json"),JSON.stringify({
    issueNumber:3141,state:"BLOCKED",head:OLD,
    code:"SOURCE_OR_BUILD_OR_PROVIDER_FAILURE",reportedAt:1200,
    stderr:"SECRET_PRIVATE_LOCAL_PATH=12345",
    prUrl:null,replayAuthorized:false,
  }));
  await writeFile(path.join(jobs,"issue-3141-attempt-2.json"),JSON.stringify({
    issueNumber:3141,attempt:2,sourceHead:NEW,state:"STARTED_UNCONFIRMED",
    privatePrompt:"OAUTH_TOKEN=secret",replayAuthorized:false,
  }));
  await writeFile(path.join(jobs,"result-3141-attempt-2.json"),JSON.stringify({
    issueNumber:3141,attempt:2,state:"BLOCKED",head:NEW,
    code:"SOURCE_OR_BUILD_OR_PROVIDER_FAILURE",phase:"RUN_LOCAL_PI",
    reportedAt:1800,rawError:"bearer very-private",
    prUrl:null,replayAuthorized:false,
  }));
  return jobs;
}
test("fixed private Factory root and read-only annotations",()=>{
  assert.equal(privateFactoryRoot({LOCALAPPDATA:"C:\\Temp"},"win32"),path.join("C:\\Temp","PlotPickle","engineering-team","autonomous-queue"));
  assert.deepEqual(MCP_TOOLS.map(x=>x.name),["factory_status","factory_observer","factory_evidence","factory_issue_preview"]);
  assert.equal(MCP_TOOLS.every(x=>x.annotations.readOnlyHint===true &&
    x.annotations.destructiveHint===false),true);
  assert.equal(MCP_TOOLS.filter(x=>x.annotations.openWorldHint).length,1);
  assert.equal(MCP_TOOLS.every(x=>!x.name.includes("execute")&&!x.name.includes("merge")),true);
});
test("private receipts are sanitized and earliest failed attempts stay intact",()=>sandbox(async root=>{
  const jobs=await seed(root);
  const before=await Promise.all(["result-3141.json","result-3141-attempt-2.json"].map(
    name=>readFile(path.join(jobs,name),"utf8")));
  const status=await factoryStatus({root,now:()=>4000});
  assert.equal(status.state,"WAITING_FOR_ELIGIBLE_ISSUE");
  assert.equal(status.activeIssue,null);
  assert.equal(status.heartbeatAgeSeconds,3);
  assert.equal(status.agentVerified,false);
  assert.equal(status.productGateVerified,false);
  assert.equal(status.automaticMergeEnabled,false);
  assert.equal(status.lastOutcome.phase,"RUN_LOCAL_PI");
  assert.equal(status.lastOutcome.issueNumber,3141);
  assert.equal(status.lastOutcome.attempt,2);
  assert.ok(["EXACT_CLEAN_MAIN","NOT_VERIFIED"].includes(status.hostRevision.state));
  assert.equal(status.hostRevision.sourceMutationAuthorized,false);
  assert.equal(status.hostRevision.issueReserved,false);
  const first=await factoryEvidence({root,issueNumber:3141,attempt:1});
  const second=await factoryEvidence({root,issueNumber:3141,attempt:2});
  assert.equal(first.record.sourceHead,OLD);
  assert.equal(second.record.sourceHead,NEW);
  assert.equal(second.record.prUrl,null);
  assert.equal(second.record.replayAuthorized,false);
  assert.equal(JSON.stringify([status,first,second]).includes("SECRET_PRIVATE"),false);
  assert.equal(JSON.stringify([status,first,second]).includes("OAUTH_TOKEN"),false);
  assert.equal(JSON.stringify([status,first,second]).includes("bearer"),false);
  const after=await Promise.all(["result-3141.json","result-3141-attempt-2.json"].map(
    name=>readFile(path.join(jobs,name),"utf8")));
  assert.deepEqual(after,before);
}));
test("invalid attempts, private symlinks, malicious phase/code and corrupt records are rejected",()=>sandbox(async root=>{
  const jobs=await seed(root);
  for(const [issueNumber,attempt] of [[-1,1],[3141,3],[3142,2],[99999999,1]]){
    assert.equal((await factoryEvidence({root,issueNumber,attempt})).status,"INVALID_SELECTION");
  }
  assert.equal((await factoryEvidence({root,issueNumber:999,attempt:1})).status,"NO_RESERVATION");
  assert.equal(sanitizeReceipt({issueNumber:3141,attempt:2,state:"BLOCKED",
    head:NEW,phase:"RUN_LOCAL_PI;cat ./secret",code:"PRIVATE_PASSWORD"},3141,2).phase,null);
  for(const code of ["PI_WRITE_TOOL_NOT_OBSERVED","PI_WRITE_TOOL_FAILED","PI_WRITE_EVENTS_UNVERIFIED"]){
    const safe=sanitizeReceipt({issueNumber:3141,attempt:2,state:"BLOCKED",
      head:NEW,phase:"RUN_LOCAL_PI",code,privateOutput:"PRIVATE PI JSONL CONTENT"},3141,2);
    assert.equal(safe.code,code);
    assert.equal(safe.phase,"RUN_LOCAL_PI");
    assert.equal(JSON.stringify(safe).includes("PRIVATE"),false);
  }
  const file=path.join(jobs,"result-3141-attempt-2.json");
  await rm(file);
  // Unprivileged Windows accounts cannot always create file symlinks (EPERM).
  // Preserve the symlink security assertion wherever the OS permits it;
  // denial of symlink creation must not skip the other adversarial fixtures.
  let linkCreated=false;
  try {
    await symlink(path.join(jobs,"result-3141.json"),file);
    linkCreated=true;
  } catch(error) {
    if(process.platform!=="win32" ||
       !["EPERM","EACCES","ENOTSUP"].includes(error?.code))throw error;
  }
  if(linkCreated) {
    assert.equal((await factoryEvidence({root,issueNumber:3141,attempt:2})).status,"RESERVED_NO_RESULT");
    await rm(file);
  }
  await writeFile(file,"not json");
  assert.equal((await factoryEvidence({root,issueNumber:3141,attempt:2})).status,"RESERVED_NO_RESULT");
  const missing=await factoryStatus({root:path.join(root,"missing"),now:()=>4000});
  assert.equal(missing.state,"OFF");
}));
test("read-only newest-first preview cannot enable queues or dispatch jobs",()=>sandbox(async root=>{
  await seed(root);
  let calls=0;
  const github={issues:async()=>{
    calls++;return [
      {number:3142,state:"OPEN",title:"C",labels:[]},
      {number:3148,state:"OPEN",title:"B",labels:[]},
      {number:3153,state:"OPEN",title:"[BLOCKED] no Chat-only dispatcher",labels:[]},
      {number:3141,state:"OPEN",title:"A",labels:[]},
      {number:3100,state:"OPEN",title:"[HOLD] skip",labels:[]},
    ];
  }};
  const proposed=await factoryIssuePreview({github,root});
  assert.deepEqual(proposed.proposedIssues.map(x=>x.number),[3148,3142]);
  assert.equal(proposed.alreadyApprovedCount,1);
  assert.equal(proposed.queueModified,false);
  assert.equal(proposed.workerStarted,false);
  assert.equal(proposed.approvalRequired,true);
  assert.equal(calls,1);
  const existing=await readFile(path.join(root,"config.json"),"utf8");
  assert.ok(existing.includes('"issues":[3141]'));
  assert.equal((await factoryIssuePreview({github:{
    issues:async()=>{throw Error("API token leaked");}},root})).state,"GITHUB_UNAVAILABLE");
  await writeFile(path.join(root,"config.json"),"{BROKEN");
  const corrupt=await factoryIssuePreview({root,github});
  assert.equal(corrupt.state,"QUEUE_UNVERIFIABLE");
  assert.equal(corrupt.queueModified,false);
  assert.equal(calls,1);
}));
test("Chat-driven Factory host checkout reports exact clean main, never trusting heartbeat",async()=>{
 const exact=await factoryHostHead({verify:async()=>OLD});
 assert.deepEqual(exact,{state:"EXACT_CLEAN_MAIN",sourceHead:OLD,branch:"main",
   sourceMutationAuthorized:false,modelInvoked:false,issueReserved:false,windowsUatVerified:false});
 for(const bad of [async()=>null,async()=>"SECRET_PRIVATE_PATH",
   async()=>{throw Error("PRIVATE GIT CREDENTIAL")} ]){
   const denied=await factoryHostHead({verify:bad});
   assert.deepEqual(denied,{state:"NOT_VERIFIED",sourceHead:null,branch:null,
     sourceMutationAuthorized:false,modelInvoked:false,issueReserved:false,windowsUatVerified:false});
   assert.equal(JSON.stringify(denied).includes("PRIVATE"),false);
 }
});
test("factory status provides exact verified local Git SHA within stable launcher tool catalog",()=>sandbox(async root=>{
  await seed(root);
  const accepted=await factoryStatus({root,now:()=>4000,verifyHead:async()=>OLD});
  assert.equal(accepted.hostRevision.state,"EXACT_CLEAN_MAIN");
  assert.equal(accepted.hostRevision.sourceHead,OLD);
  const uncertain=await factoryStatus({root,now:()=>4000,verifyHead:async()=>{throw Error("SECRET");}});
  assert.equal(uncertain.hostRevision.state,"NOT_VERIFIED");
  assert.equal(uncertain.hostRevision.sourceHead,null);
  assert.equal(JSON.stringify(uncertain).includes("SECRET"),false);
  assert.deepEqual(MCP_TOOLS.map(t=>t.name),["factory_status","factory_observer","factory_evidence","factory_issue_preview"]);
  assert.equal(MCP_CONTROL_TOOLS.length,4);
}));
test("protocol initialization, tool schemas, denylist and malformed args fail closed",()=>sandbox(async root=>{
  await seed(root);
  const init=await executeMcpRequest({jsonrpc:"2.0",method:"initialize",id:1});
  assert.equal(init.result.serverInfo.name,"plotpickle-factory-readonly");
  assert.equal(init.result.capabilities.tools.listChanged,false);
  const listed=await executeMcpRequest({jsonrpc:"2.0",method:"tools/list",id:2});
  assert.equal(listed.result.tools.length,4);
  const request=(name,args)=>handleRpc({jsonrpc:"2.0",id:3,method:"tools/call",params:{name,arguments:args}},{root,now:()=>4000});
  assert.equal((await request("factory_status",{})).result.structuredContent.lastOutcome.phase,"RUN_LOCAL_PI");
  assert.equal((await request("factory_evidence",{issueNumber:3141,attempt:2})).result.structuredContent.record.attempt,2);
  for(const args of [{issueNumber:"3141"},{issueNumber:3141,attempt:4},
    {issueNumber:3141,attempt:2,root:"/etc/shadow"},{issueNumber:3142,attempt:2}]){
    assert.equal((await request("factory_evidence",args)).error.code,-32602);
  }
  assert.equal((await request("factory_observer",{shell:"run"})).error.code,-32602);
  for(const op of ["factory_run_tests","factory_execute","factory_stop","factory_retry",
    "factory_merge","shell","queue_enable"]){
    assert.equal((await request(op,{})).error.code,-32601);
  }
  assert.equal((await request("factory_host_head",{shell:"git reset --hard"})).error.code,-32602);
  const host=await request("factory_host_head",{});
  assert.equal(host.error.code,-32601);
  assert.equal((await request("factory_status",{shell:"rm -rf"})).error.code,-32602);
  assert.equal(await handleRpc({jsonrpc:"2.0",method:"notifications/initialized"}),null);
  assert.equal(await handleRpc({jsonrpc:"2.0",method:"tools/call",params:{name:"factory_status"}}),null);
}));
test("loopback MCP HTTP transport completes actual JSON-RPC handshake, rejects external Origin",()=>sandbox(async root=>{
  await seed(root);
  const server=createLocalMcpHttpServer({root,now:()=>4000});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try{
    const port=server.address().port;
    const url="http://127.0.0.1:"+port+"/mcp";
    const headers={"content-type":"application/json","accept":"application/json, text/event-stream"};
    async function post(body,extra={}) {
      return fetch(url,{method:"POST",headers:{...headers,...extra},body:JSON.stringify(body)});
    }
    const init=await post({jsonrpc:"2.0",id:1,method:"initialize",params:{
      protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"fixture",version:"1"}}});
    assert.equal(init.status,200);
    assert.equal((await init.json()).result.protocolVersion,"2025-06-18");
    const tools=await post({jsonrpc:"2.0",id:2,method:"tools/list"});
    assert.equal((await tools.json()).result.tools.length,4);
    const status=await post({jsonrpc:"2.0",id:3,method:"tools/call",params:{
      name:"factory_status",arguments:{}}});
    assert.equal((await status.json()).result.structuredContent.state,"WAITING_FOR_ELIGIBLE_ISSUE");
    const notification=await post({jsonrpc:"2.0",method:"notifications/initialized"});
    assert.equal(notification.status,202);
    assert.equal((await fetch(url)).status,405);
    const evil=await post({jsonrpc:"2.0",id:4,method:"tools/list"},
      {origin:"https://attacker.invalid"});
    assert.equal(evil.status,403);
    // fetch normalizes Host from URL; use raw HTTP to actually test spoofed Host.
    const bad=await new Promise((resolve,reject)=>{
      const body=JSON.stringify({jsonrpc:"2.0",id:4,method:"tools/list"});
      const req=http.request(url,{method:"POST",headers:{
        ...headers,host:"attacker.invalid:123","content-length":Buffer.byteLength(body),
      }},response=>{
        response.resume();response.on("end",()=>resolve(response.statusCode));
      });
      req.on("error",reject);req.end(body);
    });
    assert.equal(bad,403);
    const huge=await fetch(url,{method:"POST",headers,body:JSON.stringify({
      jsonrpc:"2.0",id:5,method:"tools/list",padding:"a".repeat(70000)})});
    assert.equal(huge.status,413);
  }finally{await new Promise(resolve=>server.close(resolve));}
}));
test("stdio transport sends protocol JSON only, never startup chatter",()=>sandbox(async root=>{
  await seed(root);
  const input=new PassThrough(),output=new PassThrough();let text="";
  output.on("data",c=>{text+=c.toString("utf8");});
  const running=runStdio({root,input,output,now:()=>4000});
  input.write(JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/list"})+"\n");
  input.write(JSON.stringify({jsonrpc:"2.0",method:"notifications/initialized"})+"\n");
  input.end();await running;
  const lines=text.trim().split("\n");
  assert.equal(lines.length,1);
  assert.equal(JSON.parse(lines[0]).result.tools.length,4);
}));

test("private dependency preflight evidence is sanitized and never grants Factory authority",()=>sandbox(async root=>{
 await seed(root);
 const file=path.join(root,"dependency-preflight-result.json");
 const valid={schemaVersion:1,state:"BLOCKED",code:"NPM_NETWORK_UNAVAILABLE",
   sourceHead:OLD,observedAt:2345,modelInvoked:false,issueReserved:false,
   privatePath:"C:/Users/secret/.npmrc",stderr:"Bearer hidden-secret",token:"my-api-key"};
 assert.equal((await factoryStatus({root,now:()=>4000})).dependencyPreflight,null);
 await writeFile(file,JSON.stringify(valid));
 let result=(await factoryStatus({root,now:()=>5000}));
 assert.deepEqual(result.dependencyPreflight,{
   state:"BLOCKED",code:"NPM_NETWORK_UNAVAILABLE",
   sourceHead:OLD,observedAt:2345,issueReserved:false,modelInvoked:false,
 });
 assert.equal(JSON.stringify(result).includes("Bearer"),false);
 assert.equal(JSON.stringify(result).includes("secret"),false);
 assert.equal(JSON.stringify(result).includes(".npmrc"),false);
 assert.deepEqual(sanitizeDependencyPreflight({...valid,state:"INSTALL_PREFLIGHT_READY",code:"NPM_CI_VERIFIED"}),{
   state:"INSTALL_PREFLIGHT_READY",code:"NPM_CI_VERIFIED",sourceHead:OLD,
   observedAt:2345,issueReserved:false,modelInvoked:false,
 });
 for(const code of ["GIT_PROBE_FAILED","MANIFEST_READ_FAILED","PROBE_DIRECTORY_UNAVAILABLE",
   "WORKTREE_PATH_BLOCKED","WORKTREE_LOCKED","WORKTREE_FILE_ACCESS",
   "WORKTREE_ADD_FAILED","PROOF_WRITE_FAILED"]){
   const safe=sanitizeDependencyPreflight({...valid,code,stderr:"C:/Users/private"});
   assert.equal(safe.code,code);
   assert.equal(JSON.stringify(safe).includes("C:/Users"),false);
 }
 for(const patch of [
   {code:"C:/Users/owner/private"},
   {state:"RUNNING"},{sourceHead:"/private/story"},
   {modelInvoked:true},{issueReserved:true},
   {observedAt:-1},{schemaVersion:2},
 ]){
   await writeFile(file,JSON.stringify({...valid,...patch}));
   assert.equal((await factoryStatus({root,now:()=>5000})).dependencyPreflight,null);
 }
 await writeFile(file,"\{INVALID JSON");
 assert.equal((await factoryStatus({root})).dependencyPreflight,null);
 await writeFile(file,"X".repeat(3000));
 assert.equal((await factoryStatus({root})).dependencyPreflight,null);
 await rm(file);
 const shadow=path.join(root,"shadow-secret.json");
 await writeFile(shadow,JSON.stringify(valid));
 // Windows accounts without symlink privileges (e.g. Developer Mode disabled)
 // must still exercise all non-symlink sanitization assertions above.
 // Where creation is permitted, keep enforcing rejection of linked evidence.
 let linkCreated=false;
 try {
   await symlink(shadow,file);
   linkCreated=true;
 } catch(error) {
   if(process.platform!=="win32"||
      !["EPERM","EACCES","ENOTSUP"].includes(error?.code))throw error;
 }
 if(linkCreated) {
   assert.equal((await factoryStatus({root})).dependencyPreflight,null);
 }
}));

test("MCP recognizes blocked dependency wait as a real state, not a model-run success",()=>sandbox(async root=>{
 await seed(root);
 await writeFile(path.join(root,"heartbeat.json"),JSON.stringify({
   schemaVersion:1,state:"WAITING_FOR_DEPENDENCIES",issueNumber:3164,at:3000,
 }));
 const status=await factoryStatus({root,now:()=>4000});
 assert.equal(status.state,"WAITING_FOR_DEPENDENCIES");
 assert.equal(status.agentVerified,false);
 assert.equal(status.productGateVerified,false);
 assert.equal(status.activeIssue,3164);
}));

test("MCP write tools are hidden without paired authentication and reject replay",()=>sandbox(async root=>{
 await seed(root);
 const token="T".repeat(64);
 assert.equal(controlTokenMatches(token,token),true);
 assert.equal(controlTokenMatches("wrong",token),false);
 assert.equal(controlTokenMatches(token,"short"),false);
 assert.equal(MCP_CONTROL_TOOLS.map(x=>x.name).join(","),
   "factory_run_dependency_preflight,factory_admit_issues,factory_run_named_test,factory_control_receipt");
 let preflightCalls=0,admissionCalls=0,publishCalls=0;
 const ops={
   preflight:async()=>{preflightCalls++;return {state:"INSTALL_PREFLIGHT_READY",
     code:"NPM_CI_VERIFIED",sourceHead:OLD};},
   publish:async()=>{publishCalls++;},
   proof:async({expectedHead})=>{
     assert.equal(expectedHead,OLD);
     return {ready:true,code:"NPM_PREFLIGHT_VERIFIED"};
   },
   admit:async({issues,consent})=>{
     assert.deepEqual(issues,[3164]);
     assert.equal(consent,"PLOTPICKLE_AUTONOMOUS_ENGINEERING");
     admissionCalls++;return {state:"ISSUES_ADMITTED",issueCount:2};
   },
 };
 const server=createLocalMcpHttpServer({root,controlToken:token,controlOps:ops,
   github:{exactHead:async()=>OLD},now:()=>100000});
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
   const url="http://127.0.0.1:"+server.address().port+"/mcp";
   const headers={"content-type":"application/json","accept":"application/json, text/event-stream"};
   let seq=0;
   const call=async(name,args,headerToken)=>{
     const body={jsonrpc:"2.0",id:++seq,method:"tools/call",
       params:{name,arguments:args}};
     const reply=await fetch(url,{method:"POST",headers:{
       ...headers,...(headerToken?{"x-plotpickle-factory-control-token":headerToken}:{})},
       body:JSON.stringify(body)});
     return (await reply.json());
   };
   const list=async(headerToken)=>{
     const reply=await fetch(url,{method:"POST",headers:{
       ...headers,...(headerToken?{"x-plotpickle-factory-control-token":headerToken}:{})},
       body:JSON.stringify({jsonrpc:"2.0",id:++seq,method:"tools/list"})});
     return (await reply.json()).result.tools.map(x=>x.name);
   };
   assert.equal((await list()).length,4);
   assert.equal((await list(token)).length,8);
   assert.equal((await list("invalid")).length,4);
   const preArgs={requestId:"1".repeat(32),expectedHead:OLD};
   assert.equal((await call("factory_run_dependency_preflight",preArgs)).error.code,-32001);
   assert.equal((await call("factory_run_dependency_preflight",preArgs,"invalid")).error.code,-32001);
   assert.equal((await call("factory_run_dependency_preflight",
     {...preArgs,shell:"powershell"},token)).error.code,-32602);
   assert.equal(preflightCalls,0);
   const performed=await call("factory_run_dependency_preflight",preArgs,token);
   assert.equal(performed.result.structuredContent.state,"INSTALL_PREFLIGHT_READY");
   assert.equal(preflightCalls,1);
   assert.equal(publishCalls,1);
   assert.equal((await call("factory_run_dependency_preflight",preArgs,token))
     .result.structuredContent.state,"DUPLICATE_OR_UNVERIFIABLE_REQUEST");
   assert.equal(preflightCalls,1);
   await writeFile(path.join(root,"dependency-preflight.json"),
     JSON.stringify({npmCiVerified:true,sourceHead:OLD}));
   const adArgs={requestId:"2".repeat(32),expectedHead:OLD,issues:[3164]};
   assert.equal((await call("factory_admit_issues",adArgs,token))
     .result.structuredContent.state,"ISSUES_ADMITTED");
   assert.equal(admissionCalls,1);
   assert.equal((await call("factory_control_receipt",{requestId:adArgs.requestId},token))
     .result.structuredContent.issueCount,2);
   assert.equal((await call("factory_control_receipt",{requestId:preArgs.requestId},token))
     .result.structuredContent.code,"NPM_CI_VERIFIED");
   assert.equal((await call("factory_control_receipt",{requestId:"f".repeat(32)},token))
     .result.structuredContent.state,"NO_REQUEST");
   assert.equal((await call("factory_control_receipt",{requestId:adArgs.requestId})).error.code,-32001);
   const controlFile=await readFile(path.join(root,"mcp-control-requests",preArgs.requestId+".json"),"utf8");
   assert.equal(controlFile.includes(token),false);
   assert.equal(controlFile.includes("issue-3141"),false);
 }finally{await new Promise(resolve=>server.close(resolve));}
}));
test("MCP control denies stale head and held worker without consuming a request ID",()=>sandbox(async root=>{
 await seed(root);
 let called=0;
 const ops={preflight:async()=>{called++;throw Error("must never invoke");}};
 const args={requestId:"3".repeat(32),expectedHead:OLD};
 let github={exactHead:async()=>NEW};
 const stale=await import("../scripts/engineering-team/mcp/factory-readonly-server.mjs");
 let result=await stale.factoryControlAction("factory_run_dependency_preflight",args,{root,github,ops});
 assert.equal(result.code,"EXACT_HEAD_MISMATCH");
 assert.equal(called,0);
 assert.equal((await factoryControlReceipt({root,requestId:args.requestId})).state,"NO_REQUEST");
 await writeFile(path.join(root,"service.lock"),JSON.stringify({pid:1234}));
 github={exactHead:async()=>OLD};
 result=await stale.factoryControlAction("factory_run_dependency_preflight",args,{root,github,ops});
 assert.equal(result.code,"STOP_FACTORY_FIRST");
 assert.equal(called,0);
 assert.equal((await factoryControlReceipt({root,requestId:args.requestId})).state,"NO_REQUEST");
 await rm(path.join(root,"service.lock"));
 const uncertain=await stale.factoryControlAction("factory_run_dependency_preflight",args,{
   root,github,ops:{preflight:async()=>{throw Error("unknown whether native install ran");}},
 });
 assert.equal(uncertain.state,"STARTED_UNCONFIRMED");
 assert.equal((await factoryControlReceipt({root,requestId:args.requestId})).state,"STARTED_UNCONFIRMED");
 const retry=await stale.factoryControlAction("factory_run_dependency_preflight",args,{root,github,ops});
 assert.equal(retry.state,"DUPLICATE_OR_UNVERIFIABLE_REQUEST");
}));

test("Factory Observer reports queue evidence without invoking Pi or certifying ChatGPT",()=>sandbox(async root=>{
  const jobs=await seed(root);
  const original=await readFile(path.join(jobs,"result-3141.json"),"utf8");
  const snapshot=await factoryObserver({root,now:()=>4000});
  assert.equal(snapshot.schemaVersion,1);
  assert.equal(snapshot.architecture,"NODE_JS_WINDOWS");
  assert.equal(snapshot.state,"SNAPSHOT_ONLY");
  assert.equal(snapshot.factory.online,true);
  assert.equal(snapshot.factory.processOwnershipVerified,false);
  assert.equal(snapshot.queue.approvedCount,1);
  assert.equal(snapshot.queue.reservedCount,1);
  assert.equal(snapshot.queue.blockedCount,1);
  assert.equal(snapshot.queue.unknownCount,0);
  assert.equal(snapshot.queue.jobs[0].issueNumber,3141);
  assert.equal(snapshot.queue.jobs[0].state,"BLOCKED");
  assert.equal(snapshot.queue.jobs[0].replayAuthorized,false);
  assert.equal(snapshot.chatgptEngineering.nativeDispatcher,"PI_LEGACY");
  assert.equal(snapshot.chatgptEngineering.ready,false);
  assert.equal(snapshot.chatgptEngineering.admissionRecommended,false);
  assert.equal(snapshot.assurance.backgroundChatgptTurnVerified,false);
  assert.equal(snapshot.assurance.productGateVerified,false);
  assert.equal(JSON.stringify(snapshot).includes("SECRET_PRIVATE"),false);
  const read=await handleRpc({jsonrpc:"2.0",id:11,method:"tools/call",
    params:{name:"factory_observer",arguments:{}}},{root,now:()=>4000});
  assert.deepEqual(read.result.structuredContent,snapshot);
  const offline=await factoryObserver({root,now:()=>999_999});
  assert.equal(offline.factory.online,false);
  assert.equal(offline.factory.stalled,true);
  assert.equal(offline.chatgptEngineering.ready,false);
  assert.equal(await readFile(path.join(jobs,"result-3141.json"),"utf8"),original);
}));
