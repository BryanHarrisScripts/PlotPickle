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

test("combined publication receipts never promote mismatched owner-grant bindings",async()=>{
  await harness(async root=>{
    const opts=services(root,async()=>({
      state:"DRAFT_PR_CREATED",prNumber:3333,remoteCommit:"b".repeat(40),
      grantId:id(2),publicationId:id(3),sourceHead:HEAD,pullRequestCreated:true,
      engineeringReceiptId:"d".repeat(64),focusedTestExecuted:false,
      independentVerification:false,automaticMergeAuthorized:false,
      replayAuthorized:false
    }));
    const published=await dispatcherAction("engineering_execute_once",args,opts);
    assert.equal(published.state,"DRAFT_PR_CREATED");
    const file=path.join(root,"engineering-dispatcher","requests",
      id(1)+".result.json");
    const original=JSON.parse(await readFile(file,"utf8"));
    assert.equal(original.codingGrantId,id(2));
    assert.equal(original.publicationId,id(3));
    assert.equal(original.sourceHead,HEAD);
    const corrupt=[
      {...original,codingGrantId:id(99)},
      {...original,publicationId:id(99)},
      {...original,sourceHead:"b".repeat(40)},
      Object.fromEntries(Object.entries(original).filter(([key])=>
        key!=="codingGrantId"))
    ];
    for(const record of corrupt) {
      await writeFile(file,JSON.stringify(record)+"\\n");
      const observed=await dispatcherAction("engineering_dispatch_receipt",
        {requestId:id(1)},opts);
      assert.equal(observed.state,"STARTED_UNCONFIRMED");
      assert.equal(observed.replayAuthorized,false);
      assert.equal(observed.independentVerification,false);
    }
    await writeFile(file,JSON.stringify(original)+"\\n");
    assert.equal((await dispatcherAction("engineering_dispatch_receipt",
      {requestId:id(1)},opts)).state,"DRAFT_PR_CREATED");
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
    assert.equal(list.result.tools.length,6);
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

test("receipt never promotes damaged reservations or forged draft-PR success",async()=>{
  await harness(async root=>{
    const opts=services(root,async()=>{throw Error("must not invoke");});
    const dir=path.join(root,"engineering-dispatcher","requests");
    await mkdir(dir,{recursive:true});
    const reservation=path.join(dir,id(1)+".reserved.json");
    const result=path.join(dir,id(1)+".result.json");
    assert.equal((await dispatcherAction("engineering_dispatch_receipt",
      {requestId:id(1)},opts)).state,"NO_RESERVATION");
    await writeFile(reservation,"{broken json\\n");
    assert.equal((await dispatcherAction("engineering_dispatch_receipt",
      {requestId:id(1)},opts)).state,"STARTED_UNCONFIRMED");
    await writeFile(reservation,JSON.stringify({requestId:id(1),
      state:"RESERVED_NO_REPLAY"})+"\\n");
    await writeFile(result,JSON.stringify({requestId:id(1),
      state:"DRAFT_PR_CREATED",prNumber:44})+"\\n");
    assert.equal((await dispatcherAction("engineering_dispatch_receipt",
      {requestId:id(1)},opts)).state,"STARTED_UNCONFIRMED");
    await writeFile(result,JSON.stringify({requestId:id(1),
      state:"DRAFT_PR_CREATED",prNumber:44,candidateHead:"b".repeat(40),
      engineeringReceiptId:"d".repeat(64),focusedTestExecuted:false,
      independentVerification:true,automaticMergeAuthorized:false,
      replayAuthorized:false})+"\\n");
    assert.equal((await dispatcherAction("engineering_dispatch_receipt",
      {requestId:id(1)},opts)).state,"STARTED_UNCONFIRMED");
  });
});

test("prepare-only phase reveals an initially unknown commit without publication authority",async()=>{
  await harness(async root=>{
    const commit="f".repeat(40);
    let codingCalls=0,publishingCalls=0;
    const opts={...services(root,async()=>{publishingCalls++;throw Error("must not publish");}),
      prepare:async({grantId})=>{
        codingCalls++;
        assert.equal(grantId,id(2));
        return {state:"LOCAL_COMMIT_PREPARED",
          code:"SYNTAX_CHECK_PASSED_TESTS_PENDING",
          grantId,sourceHead:HEAD,issueNumber:3142,commit,
          branch:"engineering/3142-"+grantId,sourceMutationVerified:true,
          focusedTestExecuted:false,pullRequestCreated:false,
          independentVerification:false,automaticMergeAuthorized:false,
          replayAuthorized:false};
      }};
    const selection={requestId:id(20),expectedHead:HEAD,codingGrantId:id(2)};
    const result=await dispatcherAction("engineering_prepare_once",selection,opts);
    assert.equal(result.state,"LOCAL_COMMIT_PREPARED");
    assert.equal(result.localCommit,commit);
    assert.equal(result.pullRequestCreated,false);
    assert.equal(result.independentVerification,false);
    assert.equal(result.automaticMergeAuthorized,false);
    assert.equal(codingCalls,1);
    assert.equal(publishingCalls,0);
    const receipt=await dispatcherAction("engineering_dispatch_receipt",
      {requestId:id(20)},opts);
    assert.deepEqual(receipt,result);
    assert.equal((await dispatcherAction("engineering_prepare_once",selection,opts)).code,
      "REQUEST_ALREADY_RESERVED_NO_REPLAY");
    assert.equal(codingCalls,1);
    await assert.rejects(()=>lstat(path.join(root,"engineering-dispatcher",
      "running.lock")),{code:"ENOENT"});
    const reservation=JSON.parse(await readFile(path.join(root,"engineering-dispatcher",
      "requests",id(20)+".reserved.json"),"utf8"));
    assert.equal(reservation.phase,"PREPARE");
    assert.equal(Object.hasOwn(reservation,"publicationId"),false);
  });
});

test("prepare-only rejects invented commits, mismatched grants and publication attempts",async()=>{
  await harness(async root=>{
    let calls=0;
    const opts={...services(root,async()=>{throw Error("publication must not run");}),
      prepare:async()=>{calls++;return {state:"LOCAL_COMMIT_PREPARED",
        grantId:id(99),sourceHead:HEAD,issueNumber:3142,commit:"f".repeat(40),
        branch:"engineering/3142-"+id(99),sourceMutationVerified:true,
        code:"SYNTAX_CHECK_PASSED_TESTS_PENDING",focusedTestExecuted:false,
        pullRequestCreated:false,independentVerification:false,
        automaticMergeAuthorized:false,replayAuthorized:false};}};
    const selection={requestId:id(21),expectedHead:HEAD,codingGrantId:id(2)};
    const result=await dispatcherAction("engineering_prepare_once",selection,opts);
    assert.equal(result.code,"PREPARED_CODING_RECEIPT_UNVERIFIED");
    assert.equal((await dispatcherAction("engineering_dispatch_receipt",
      {requestId:id(21)},opts)).state,"BLOCKED");
    assert.equal(calls,1);
    const lock=JSON.parse(await readFile(path.join(root,"engineering-dispatcher",
      "running.lock"),"utf8"));
    assert.equal(lock.requestId,id(21));
    assert.equal((await dispatcherAction("engineering_prepare_once",
      {...selection,requestId:id(22)},opts)).code,"ACTIVE_OR_STALE_EXECUTION_LOCK");
    assert.equal((await dispatcherAction("engineering_prepare_once",
      {...selection,requestId:id(23),publicationId:id(3)},opts)).code,
      "INVALID_EXECUTION_SELECTION");
  });
});

test("damaged prepared receipt never reports a known local commit",async()=>{
  await harness(async root=>{
    const opts=services(root,async()=>{throw Error("must not run");});
    const dir=path.join(root,"engineering-dispatcher","requests");
    await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,id(24)+".reserved.json"),JSON.stringify({
      requestId:id(24),expectedHead:HEAD,codingGrantId:id(2),phase:"PREPARE",
      state:"RESERVED_NO_REPLAY"})+"\\n");
    await writeFile(path.join(dir,id(24)+".result.json"),JSON.stringify({
      requestId:id(24),state:"LOCAL_COMMIT_PREPARED",
      codingGrantId:id(99),sourceHead:HEAD,issueNumber:3142,
      localCommit:"f".repeat(40),branch:"engineering/3142-"+id(99),
      focusedTestExecuted:false,pullRequestCreated:false,
      independentVerification:false,automaticMergeAuthorized:false,
      replayAuthorized:false})+"\\n");
    const result=await dispatcherAction("engineering_dispatch_receipt",
      {requestId:id(24)},opts);
    assert.equal(result.state,"STARTED_UNCONFIRMED");
  });
});

test("a newly discovered commit can be published only after separate exact-commit grant",async()=>{
  await harness(async root=>{
    const commit="f".repeat(40);
    let prepared=false,publications=0;
    const opts={...services(root,async()=>{throw Error("combined path not allowed");}),
      prepare:async({grantId})=>{
        assert.equal(grantId,id(2));
        prepared=true;
        return {state:"LOCAL_COMMIT_PREPARED",
          code:"SYNTAX_CHECK_PASSED_TESTS_PENDING",grantId,
          issueNumber:3142,sourceHead:HEAD,commit,
          branch:"engineering/3142-"+grantId,sourceMutationVerified:true,
          focusedTestExecuted:false,pullRequestCreated:false,
          independentVerification:false,automaticMergeAuthorized:false,
          replayAuthorized:false};
      },
      publish:async({grantId,publicationId})=>{
        publications++;
        assert.equal(prepared,true);
        assert.deepEqual({grantId,publicationId},{grantId:id(2),publicationId:id(3)});
        return {state:"DRAFT_PR_CREATED",prNumber:3315,remoteCommit:"b".repeat(40),
          localCommit:commit,grantId,publicationId,sourceHead:HEAD,
          pullRequestCreated:true,engineeringReceiptId:"d".repeat(64),
          focusedTestExecuted:false,independentVerification:false,
          automaticMergeAuthorized:false,replayAuthorized:false};
      }};
    const selection={requestId:id(31),expectedHead:HEAD,
      preparedRequestId:id(30),codingGrantId:id(2),
      localCommit:commit,publicationId:id(3)};
    const before=await dispatcherAction("engineering_publish_prepared_once",selection,opts);
    assert.equal(before.code,"PREPARED_REQUEST_UNVERIFIABLE");
    assert.equal(publications,0);
    const prep=await dispatcherAction("engineering_prepare_once",
      {requestId:id(30),expectedHead:HEAD,codingGrantId:id(2)},opts);
    assert.equal(prep.state,"LOCAL_COMMIT_PREPARED");
    assert.equal(prep.localCommit,commit);
    const wrong=await dispatcherAction("engineering_publish_prepared_once",
      {...selection,localCommit:"e".repeat(40)},opts);
    assert.equal(wrong.code,"PREPARED_REQUEST_UNVERIFIABLE");
    const wrongGrant=await dispatcherAction("engineering_publish_prepared_once",
      {...selection,codingGrantId:id(99)},opts);
    assert.equal(wrongGrant.code,"PREPARED_REQUEST_UNVERIFIABLE");
    assert.equal(publications,0);
    const published=await dispatcherAction("engineering_publish_prepared_once",selection,opts);
    assert.equal(published.state,"DRAFT_PR_CREATED");
    assert.equal(published.localCommit,commit);
    assert.equal(published.preparedRequestId,id(30));
    assert.equal(published.automaticMergeAuthorized,false);
    assert.equal(published.independentVerification,false);
    assert.equal(publications,1);
    const receipt=await dispatcherAction("engineering_dispatch_receipt",
      {requestId:id(31)},opts);
    assert.deepEqual(receipt,published);
    assert.equal((await dispatcherAction("engineering_publish_prepared_once",
      selection,opts)).code,"REQUEST_ALREADY_RESERVED_NO_REPLAY");
    assert.equal(publications,1);
  });
});

test("publish-prepared rejects an uncorrelated publisher response without replay",async()=>{
  await harness(async root=>{
    let publications=0;
    const opts={...services(root,async()=>{throw Error("combined must not run");}),
      prepare:async({grantId})=>({state:"LOCAL_COMMIT_PREPARED",
        code:"SYNTAX_CHECK_PASSED_TESTS_PENDING",grantId,
        issueNumber:3142,sourceHead:HEAD,commit:"f".repeat(40),
        branch:"engineering/3142-"+grantId,sourceMutationVerified:true,
        focusedTestExecuted:false,pullRequestCreated:false,
        independentVerification:false,automaticMergeAuthorized:false,
        replayAuthorized:false}),
      publish:async({grantId,publicationId})=>{
        publications++;
        return {state:"DRAFT_PR_CREATED",prNumber:3315,remoteCommit:"b".repeat(40),
          localCommit:"e".repeat(40),grantId,publicationId,sourceHead:HEAD,
          pullRequestCreated:true,engineeringReceiptId:"d".repeat(64),
          focusedTestExecuted:false,independentVerification:false,
          automaticMergeAuthorized:false,replayAuthorized:false};
      }};
    await dispatcherAction("engineering_prepare_once",
      {requestId:id(40),expectedHead:HEAD,codingGrantId:id(2)},opts);
    const selection={requestId:id(41),expectedHead:HEAD,
      preparedRequestId:id(40),codingGrantId:id(2),
      localCommit:"f".repeat(40),publicationId:id(3)};
    const result=await dispatcherAction("engineering_publish_prepared_once",selection,opts);
    assert.equal(result.code,"ENGINEERING_OR_PUBLICATION_RECEIPT_UNVERIFIED");
    assert.equal((await dispatcherAction("engineering_dispatch_receipt",
      {requestId:id(41)},opts)).state,"BLOCKED");
    assert.equal((await dispatcherAction("engineering_publish_prepared_once",
      selection,opts)).code,"REQUEST_ALREADY_RESERVED_NO_REPLAY");
    assert.equal(publications,1);
    const lock=JSON.parse(await readFile(path.join(root,"engineering-dispatcher",
      "running.lock"),"utf8"));
    assert.equal(lock.requestId,id(41));
  });
});
