import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import http from "node:http";
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  privateFactoryRoot, sanitizeReceipt, factoryStatus, factoryEvidence,
  factoryIssuePreview, executeMcpRequest, handleRpc, MCP_TOOLS,
  createLocalMcpHttpServer, runStdio,
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
  assert.deepEqual(MCP_TOOLS.map(x=>x.name),["factory_status","factory_evidence","factory_issue_preview"]);
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
test("read-only newest-first preview cannot enable queues or dispatch jobs",async()=>{
  let calls=0;
  const github={issues:async()=>{
    calls++;return [
      {number:3142,state:"OPEN",title:"C",labels:[]},
      {number:3148,state:"OPEN",title:"B",labels:[]},
      {number:3141,state:"OPEN",title:"A",labels:[]},
      {number:3100,state:"OPEN",title:"[HOLD] skip",labels:[]},
    ];
  }};
  const proposed=await factoryIssuePreview({github});
  assert.deepEqual(proposed.proposedIssues.map(x=>x.number),[3148,3142,3141]);
  assert.equal(proposed.queueModified,false);
  assert.equal(proposed.workerStarted,false);
  assert.equal(proposed.approvalRequired,true);
  assert.equal(calls,1);
  assert.equal((await factoryIssuePreview({github:{issues:async()=>{throw Error("API token leaked");}}})).state,"GITHUB_UNAVAILABLE");
});
test("protocol initialization, tool schemas, denylist and malformed args fail closed",()=>sandbox(async root=>{
  await seed(root);
  const init=await executeMcpRequest({jsonrpc:"2.0",method:"initialize",id:1});
  assert.equal(init.result.serverInfo.name,"plotpickle-factory-readonly");
  assert.equal(init.result.capabilities.tools.listChanged,false);
  const listed=await executeMcpRequest({jsonrpc:"2.0",method:"tools/list",id:2});
  assert.equal(listed.result.tools.length,3);
  const request=(name,args)=>handleRpc({jsonrpc:"2.0",id:3,method:"tools/call",params:{name,arguments:args}},{root,now:()=>4000});
  assert.equal((await request("factory_status",{})).result.structuredContent.lastOutcome.phase,"RUN_LOCAL_PI");
  assert.equal((await request("factory_evidence",{issueNumber:3141,attempt:2})).result.structuredContent.record.attempt,2);
  for(const args of [{issueNumber:"3141"},{issueNumber:3141,attempt:4},
    {issueNumber:3141,attempt:2,root:"/etc/shadow"},{issueNumber:3142,attempt:2}]){
    assert.equal((await request("factory_evidence",args)).error.code,-32602);
  }
  for(const op of ["factory_run_tests","factory_execute","factory_stop","factory_retry",
    "factory_merge","shell","queue_enable"]){
    assert.equal((await request(op,{})).error.code,-32601);
  }
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
    assert.equal((await tools.json()).result.tools.length,3);
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
  assert.equal(JSON.parse(lines[0]).result.tools.length,3);
}));
