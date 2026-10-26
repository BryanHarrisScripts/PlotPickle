import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, lstat, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { authenticDispatcherToken, dispatcherAction, dispatcherRpc } from
  "../scripts/engineering-team/mcp/dispatcher/engineering-dispatcher-plugin.mjs";

const HEAD="a".repeat(40), TOKEN="c".repeat(64);
const id=n=>n.toString(16).padStart(32,"0");
const args={requestId:id(1),expectedHead:HEAD,codingGrantId:id(2),publicationId:id(3)};
const harness=async fn=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"dispatcher-mcp-"));
  try {await fn(root);}finally{await rm(root,{recursive:true,force:true});}
};
const services=(root,execute)=>({
  root,enabled:true,platform:"win32",
  source:async()=>({head:HEAD,channel:"main"}),execute,now:()=>1792980000000,
});

test("second plugin denies missing/wrong token and hides all tool definitions",async()=>{
  assert.equal(authenticDispatcherToken(TOKEN,TOKEN),true);
  assert.equal(authenticDispatcherToken("d".repeat(64),TOKEN),false);
  assert.equal(authenticDispatcherToken(TOKEN,"short"),false);
  const list=await dispatcherRpc({jsonrpc:"2.0",id:1,method:"tools/list"},{authenticated:false});
  assert.deepEqual(list.result.tools,[]);
  const result=await dispatcherRpc({jsonrpc:"2.0",id:2,method:"tools/call",
    params:{name:"engineering_execute_once",arguments:args}},
    {authenticated:false});
  assert.equal(result.error.code,-32001);
});

test("one authorized request calls only the fixed worker and returns no merge authority",async()=>{
  await harness(async root=>{
    let calls=0;
    const options=services(root,async selection=>{
      calls++;
      assert.deepEqual(selection,{grantId:id(2),publicationId:id(3)});
      return {state:"DRAFT_PR_CREATED",prNumber:3333,remoteCommit:"b".repeat(40),
        grantId:id(2),publicationId:id(3),sourceHead:HEAD,pullRequestCreated:true,
        engineeringReceiptId:"d".repeat(64),focusedTestExecuted:false,
        independentVerification:false,automaticMergeAuthorized:false,
        replayAuthorized:false};
    });
    const out=await dispatcherAction("engineering_execute_once",args,options);
    assert.equal(out.state,"DRAFT_PR_CREATED");
    assert.equal(out.prNumber,3333);
    assert.equal(out.independentVerification,false);
    assert.equal(out.automaticMergeAuthorized,false);
    assert.equal(calls,1);
    const again=await dispatcherAction("engineering_execute_once",args,options);
    assert.equal(again.code,"REQUEST_ALREADY_RESERVED_NO_REPLAY");
    assert.equal(calls,1);
    const saved=await dispatcherAction("engineering_dispatch_receipt",{requestId:id(1)},options);
    assert.equal(saved.state,"DRAFT_PR_CREATED");
    const entry=JSON.parse(await readFile(path.join(root,"engineering-dispatcher",
      "requests",id(1)+".reserved.json"),"utf8"));
    assert.equal(entry.expectedHead,HEAD);
    await assert.rejects(()=>lstat(path.join(root,"engineering-dispatcher","running.lock")),
      {code:"ENOENT"});
  });
});

test("stale source, disabled and non-Windows always refuse to invoke model",async()=>{
  await harness(async root=>{
    let calls=0;const execute=async()=>{calls++;throw Error("must not run");};
    let opts=services(root,execute);
    assert.equal((await dispatcherAction("engineering_execute_once",args,
      {...opts,enabled:false})).code,"DISPATCH_NOT_ENABLED");
    assert.equal((await dispatcherAction("engineering_execute_once",args,
      {...opts,platform:"linux"})).code,"DISPATCH_NOT_ENABLED");
    assert.equal((await dispatcherAction("engineering_execute_once",args,
      {...opts,source:async()=>({head:"b".repeat(40),channel:"main"})})).code,
      "EXACT_CLEAN_MAIN_REQUIRED");
    assert.equal((await dispatcherAction("engineering_execute_once",{...args,
      command:"powershell.exe"},opts)).code,"INVALID_EXECUTION_SELECTION");
    assert.equal(calls,0);
  });
});

test("STOP is durable and blocks later admissions; does not claim running tree STOP",async()=>{
  await harness(async root=>{
    const opts=services(root,async()=>{throw Error("must not invoke");});
    const stop=await dispatcherAction("engineering_dispatch_stop",{requestId:id(10)},opts);
    assert.equal(stop.state,"STOP_REQUESTED");
    assert.equal(stop.inFlightMayContinue,true);
    const state=await dispatcherAction("engineering_dispatch_status",{},opts);
    assert.equal(state.stopRequested,true);
    assert.equal(state.queueConnected,false);
    const result=await dispatcherAction("engineering_execute_once",args,opts);
    assert.equal(result.code,"INTENTIONAL_STOP_OR_PAUSE");
    const duplicate=await dispatcherAction("engineering_dispatch_stop",{requestId:id(11)},opts);
    assert.equal(duplicate.state,"STOP_ALREADY_REQUESTED_OR_UNVERIFIABLE");
  });
});

test("STOP during source preflight preserves STOP without stranding an unused lock",async()=>{
  await harness(async root=>{
    let calls=0;
    const opts=services(root,async()=>{calls++;throw Error("worker must not run");});
    const outcome=await dispatcherAction("engineering_execute_once",args,{
      ...opts,source:async()=>{
        const dir=path.join(root,"engineering-dispatcher");
        await mkdir(dir,{recursive:true});
        await writeFile(path.join(dir,"stop-request.json"),
          JSON.stringify({state:"STOP_REQUESTED"})+"\\n");
        return {head:HEAD,channel:"main"};
      }
    });
    assert.equal(outcome.code,"INTENTIONAL_STOP_OR_PAUSE");
    assert.equal(calls,0);
    await assert.rejects(()=>lstat(path.join(root,"engineering-dispatcher",
      "running.lock")),{code:"ENOENT"});
    const status=await dispatcherAction("engineering_dispatch_status",{},opts);
    assert.equal(status.stopRequested,true);
    const receipt=await dispatcherAction("engineering_dispatch_receipt",
      {requestId:id(1)},opts);
    assert.equal(receipt.state,"NO_RESERVATION");
  });
});

test("uncertain execution is never retried and retains lock for owner review",async()=>{
  await harness(async root=>{
    let calls=0;
    const opts=services(root,async()=>{calls++;throw Error("network ambiguous");});
    const outcome=await dispatcherAction("engineering_execute_once",args,opts);
    assert.equal(outcome.state,"STARTED_UNCONFIRMED");
    const receipt=await dispatcherAction("engineering_dispatch_receipt",{requestId:id(1)},opts);
    assert.equal(receipt.state,"STARTED_UNCONFIRMED");
    assert.equal((await dispatcherAction("engineering_execute_once",args,opts)).code,
      "REQUEST_ALREADY_RESERVED_NO_REPLAY");
    assert.equal((await dispatcherAction("engineering_execute_once",
      {...args,requestId:id(4)},opts)).code,"ACTIVE_OR_STALE_EXECUTION_LOCK");
    assert.equal(calls,1);
  });
});

test("MCP call has a bounded input surface and independent service injection",async()=>{
  await harness(async root=>{
    let calls=0;const options=services(root,async()=>{
      calls++;return {state:"DRAFT_PR_CREATED",prNumber:3,remoteCommit:"b".repeat(40),
        grantId:id(2),publicationId:id(3),sourceHead:HEAD,pullRequestCreated:true,
        engineeringReceiptId:"d".repeat(64),focusedTestExecuted:false,
        independentVerification:false,automaticMergeAuthorized:false,
        replayAuthorized:false};
    });
    const call=await dispatcherRpc({jsonrpc:"2.0",id:"1",method:"tools/call",
      params:{name:"engineering_execute_once",arguments:args}},
      {authenticated:true,...options});
    assert.equal(call.result.structuredContent.state,"DRAFT_PR_CREATED");
    assert.equal(calls,1);
    const list=await dispatcherRpc({jsonrpc:"2.0",id:"2",method:"tools/list"},
      {authenticated:true,...options});
    assert.equal(list.result.tools.length,4);
    assert.equal(list.result.tools.some(x=>x.name.includes("merge")),false);
  });
});

test("a draft PR-like result without a correlated engineering receipt is never success",async()=>{
  await harness(async root=>{
    const opts=services(root,async()=>({state:"DRAFT_PR_CREATED",
      prNumber:123,remoteCommit:"b".repeat(40),engineeringReceiptId:null}));
    const result=await dispatcherAction("engineering_execute_once",args,opts);
    assert.equal(result.state,"BLOCKED");
    assert.equal(result.code,"ENGINEERING_OR_PUBLICATION_RECEIPT_UNVERIFIED");
    const saved=await dispatcherAction("engineering_dispatch_receipt",{requestId:id(1)},opts);
    assert.equal(saved.state,"BLOCKED");
    assert.equal(saved.independentVerification,false);
    assert.equal((await dispatcherAction("engineering_execute_once",args,opts)).code,
      "REQUEST_ALREADY_RESERVED_NO_REPLAY");
    // An uncertain remote PR must retain the exclusion for reconciliation.
    const lock=JSON.parse(await readFile(path.join(root,"engineering-dispatcher",
      "running.lock"),"utf8"));
    assert.equal(lock.requestId,id(1));
  });
});
