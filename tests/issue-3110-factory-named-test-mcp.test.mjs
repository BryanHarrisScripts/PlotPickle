import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { allowedFactoryTestNames, readFactoryVerificationHead,
  runFactoryNamedTest,inspectFactoryCandidatePr } from "../scripts/engineering-team/mcp/factory-named-tests.mjs";
import { factoryControlAction, factoryControlReceipt, handleRpc, MCP_CONTROL_TOOLS,
} from "../scripts/engineering-team/mcp/factory-readonly-server.mjs";
const HEAD="a".repeat(40),OTHER="b".repeat(40);
async function privateRoot(callback){
 const root=await mkdtemp(path.join(os.tmpdir(),"pp-native-test-mcp-"));
 try{return await callback(root);}finally{await rm(root,{recursive:true,force:true});}
}
test("named Factory suite is fixed, no arbitrary commands, untrusted inputs or shell",async()=>{
 assert.deepEqual(allowedFactoryTestNames(),["factory-mcp","factory-qa-handoff"]);
 assert.equal(MCP_CONTROL_TOOLS.some(x=>x.name==="factory_run_named_test"),true);
 assert.equal((await runFactoryNamedTest({suite:"../../private",expectedHead:HEAD,
   platform:"win32",verifyHead:async()=>HEAD})).code,"TEST_SELECTION_INVALID");
 assert.equal((await runFactoryNamedTest({suite:"factory-mcp",expectedHead:HEAD,
   platform:"linux",verifyHead:async()=>{throw Error("must not execute");}})).code,"WINDOWS_ONLY");
 const calls=[];
 const result=await runFactoryNamedTest({suite:"factory-mcp",expectedHead:HEAD,
   platform:"win32",verifyHead:async()=>HEAD,
   run:async(program,args,options)=>{
     calls.push({program,args,cwd:options.cwd});
     assert.equal(args[0],"--test");
     assert.equal(args[1],"tests/issue-3154-chatgpt-factory-mcp.test.mjs");
     assert.equal(Object.hasOwn(options,"shell"),false);
     assert.ok(options.timeout>0);
     return {stdout:"PASS"};
   }});
 assert.equal(result.state,"TEST_PASSED");
 assert.equal(result.code,"NODE_TEST_PASS");
 assert.equal(result.sourceHead,HEAD);
 assert.equal(calls.length,1);
});
test("exact-head native test refuses dirty main, wrong branch, changed or stale source",async()=>{
 const responses=new Map([
   ["rev-parse HEAD",HEAD],["rev-parse origin/main",HEAD],
   ["branch --show-current","main"],["status --porcelain --untracked-files=no",""],
 ]);
 const fake=async(program,args)=>{
   assert.equal(program,"git");
   return {stdout:responses.get(args.join(" "))??""};
 };
 assert.equal(await readFactoryVerificationHead({run:fake}),HEAD);
 responses.set("status --porcelain --untracked-files=no"," M app.tsx");
 assert.equal(await readFactoryVerificationHead({run:fake}),null);
 responses.set("status --porcelain --untracked-files=no","");
 responses.set("branch --show-current","production");
 assert.equal(await readFactoryVerificationHead({run:fake}),null);
 responses.set("branch --show-current","main");
 responses.set("rev-parse origin/main",OTHER);
 assert.equal(await readFactoryVerificationHead({run:fake}),null);
 let runCount=0;
 const stale=await runFactoryNamedTest({suite:"factory-mcp",expectedHead:HEAD,
   platform:"win32",verifyHead:async()=>OTHER,
   run:async()=>{runCount++;}});
 assert.equal(stale.code,"EXACT_HEAD_MISMATCH");
 assert.equal(runCount,0);
});
test("native pass is rejected when source HEAD drifts during execution",async()=>{
 let probes=0;
 const result=await runFactoryNamedTest({
   suite:"factory-mcp",expectedHead:HEAD,platform:"win32",
   verifyHead:async()=>++probes===1?HEAD:OTHER,
   run:async()=>({stdout:"all tests passed"}),
 });
 assert.equal(probes,2);
 assert.equal(result.state,"BLOCKED");
 assert.equal(result.code,"EXACT_HEAD_MISMATCH");
 assert.equal(result.sourceHead,OTHER);
});
test("native failed or timed-out test is typed without leaking stderr",async()=>{
 for(const [reason,code] of [[Error("MY_PRIVATE_TOKEN"),"NODE_TEST_FAILED"],
   [Object.assign(Error("C:/users/private/.npmrc"),{killed:true}),"NODE_TEST_TIMEOUT"]]){
   const result=await runFactoryNamedTest({suite:"factory-qa-handoff",expectedHead:HEAD,
     platform:"win32",verifyHead:async()=>HEAD,run:async()=>{throw reason;}});
   assert.equal(result.state,"TEST_FAILED");
   assert.equal(result.code,code);
   assert.equal(result.suite,"factory-qa-handoff");
   assert.equal(JSON.stringify(result).includes("PRIVATE"),false);
 }}
);
test("authenticated MCP named test produces one immutable bounded receipt; no duplicate execution",()=>privateRoot(async root=>{
 let runs=0;
 const ops={testHead:async()=>HEAD,runTest:async({suite,expectedHead})=>{
   assert.equal(suite,"factory-mcp");
   assert.equal(expectedHead,HEAD);
   runs++;
   return {state:"TEST_PASSED",code:"NODE_TEST_PASS",
     sourceHead:HEAD,privatePath:"C:/private",token:"SECRET"};
 }};
 const args={requestId:"1".repeat(32),expectedHead:HEAD,suite:"factory-mcp"};
 const call=(name,input,auth)=>handleRpc({jsonrpc:"2.0",id:1,method:"tools/call",
   params:{name,arguments:input}},{root,controlAuthenticated:auth,controlOps:ops});
 assert.equal((await call("factory_run_named_test",args,false)).error.code,-32001);
 assert.equal((await call("factory_run_named_test",{...args,suite:"powershell"},true)).error.code,-32602);
 assert.equal((await call("factory_run_named_test",{...args,command:"shutdown"},true)).error.code,-32602);
 assert.equal(runs,0);
 const first=await call("factory_run_named_test",args,true);
 const result=first.result.structuredContent;
 assert.equal(result.state,"TEST_PASSED");
 assert.equal(result.code,"NODE_TEST_PASS");
 assert.equal(result.sourceHead,HEAD);
 assert.equal(result.suite,"factory-mcp");
 assert.equal(result.independentVerification,false);
 assert.equal(result.modelInvoked,false);
 assert.equal(runs,1);
 assert.equal((await call("factory_run_named_test",args,true))
   .result.structuredContent.state,"DUPLICATE_OR_UNVERIFIABLE_REQUEST");
 assert.equal(runs,1);
 assert.equal((await factoryControlReceipt({root,requestId:args.requestId})).code,"NODE_TEST_PASS");
 const reservation=await readFile(path.join(root,"mcp-control-requests",args.requestId+".json"),"utf8");
 assert.equal(reservation.includes("SECRET"),false);
 assert.equal(JSON.stringify(first).includes("privatePath"),false);
 assert.equal(JSON.stringify(first).includes("SECRET"),false);
}));
test("Chat-authored candidate PR is attested by exact GitHub metadata without executing PR files",async()=>{
 let index=0;
 const expected={number:3191,state:"OPEN",baseRefName:"main",baseRefOid:HEAD,headRefOid:OTHER};
 const run=async(program,args,opts)=>{
   index++;
   assert.equal(program,"gh");
   assert.deepEqual(args,["pr","view","3191","--repo","BryanHarrisScripts/PlotPickle",
     "--json","number,state,baseRefName,baseRefOid,headRefOid"]);
   assert.equal(opts.shell,undefined);
   assert.ok(opts.timeout<=30_000);
   return {stdout:JSON.stringify(expected)};
 };
 const opts={prNumber:3191,candidateHead:OTHER,expectedHead:HEAD,
   platform:"win32",verifyHead:async()=>HEAD,run};
 const passed=await inspectFactoryCandidatePr(opts);
 assert.deepEqual(passed,{
   state:"TEST_PASSED",code:"CANDIDATE_HEAD_VERIFIED",sourceHead:HEAD,
   candidatePrNumber:3191,candidateHead:OTHER,
   modelInvoked:false,issueReserved:false,windowsUatVerified:false,
 });
 assert.equal(index,1);
 const cases=[
   [{...expected,state:"CLOSED"},"CANDIDATE_NOT_OPEN"],
   [{...expected,number:3192},"CANDIDATE_NOT_OPEN"],
   [{...expected,baseRefName:"release"},"CANDIDATE_BASE_MISMATCH"],
   [{...expected,baseRefOid:OTHER},"CANDIDATE_BASE_MISMATCH"],
   [{...expected,headRefOid:HEAD},"CANDIDATE_HEAD_MISMATCH"],
 ];
 for(const [response,code] of cases){
   const result=await inspectFactoryCandidatePr({...opts,
     run:async()=>({stdout:JSON.stringify(response)})});
   assert.equal(result.code,code);
   assert.equal(result.state,"BLOCKED");
   assert.equal(JSON.stringify(result).includes("PRIVATE"),false);
 }
 assert.equal((await inspectFactoryCandidatePr({...opts,platform:"linux",run:async()=>{
   throw Error("should never call gh");
 }})).code,"WINDOWS_ONLY");
 assert.equal((await inspectFactoryCandidatePr({...opts,prNumber:";rm -rf"})).code,
   "CANDIDATE_SELECTION_INVALID");
 assert.equal((await inspectFactoryCandidatePr({...opts,candidateHead:"PRIVATE"})).code,
   "CANDIDATE_SELECTION_INVALID");
 assert.equal((await inspectFactoryCandidatePr({...opts,verifyHead:async()=>null})).code,
   "EXACT_HEAD_MISMATCH");
 assert.equal((await inspectFactoryCandidatePr({...opts,run:async()=>{
   throw Error("PRIVATE_TOKEN");
 }})).code,"GITHUB_PR_UNAVAILABLE");
 let count=0;
 assert.equal((await inspectFactoryCandidatePr({...opts,verifyHead:async()=>
   ++count===1?HEAD:OTHER})).code,"EXACT_HEAD_MISMATCH");
 assert.equal(count,2);
});

test("existing authenticated named-test tool accepts metadata-only PR check with non-replayable receipt",()=>privateRoot(async root=>{
 let inspected=0;
 const args={requestId:"4".repeat(32),expectedHead:HEAD,suite:"factory-pr-head",
   candidatePrNumber:3191,candidateHead:OTHER};
 const ops={testHead:async()=>HEAD,inspectPr:async({prNumber,candidateHead,expectedHead})=>{
   inspected++;
   assert.deepEqual([prNumber,candidateHead,expectedHead],[3191,OTHER,HEAD]);
   return {state:"TEST_PASSED",code:"CANDIDATE_HEAD_VERIFIED",
     sourceHead:HEAD,candidatePrNumber:3191,candidateHead:OTHER};
 }};
 const send=(params,auth=true)=>handleRpc({jsonrpc:"2.0",id:11,
   method:"tools/call",params:{name:"factory_run_named_test",arguments:params}},
   {root,controlAuthenticated:auth,controlOps:ops});
 assert.equal((await send(args,false)).error.code,-32001);
 assert.equal((await send({...args,candidateHead:"BAD_SHA"})).error.code,-32602);
 assert.equal((await send({...args,suite:"factory-mcp"})).error.code,-32602);
 assert.equal((await send({...args,cmd:"powershell"})).error.code,-32602);
 assert.equal((await send({...args,candidatePrNumber:0})).error.code,-32602);
 assert.equal(inspected,0);
 const outcome=(await send(args)).result.structuredContent;
 assert.equal(outcome.state,"TEST_PASSED");
 assert.equal(outcome.code,"CANDIDATE_HEAD_VERIFIED");
 assert.equal(outcome.candidateHead,OTHER);
 assert.equal(outcome.candidatePrNumber,3191);
 assert.equal(outcome.independentVerification,false);
 assert.equal(outcome.modelInvoked,false);
 assert.equal(outcome.replayAuthorized,false);
 assert.equal(inspected,1);
 assert.equal((await send(args)).result.structuredContent.state,
   "DUPLICATE_OR_UNVERIFIABLE_REQUEST");
 assert.equal(inspected,1);
 const receipt=await factoryControlReceipt({root,requestId:args.requestId});
 assert.equal(receipt.candidateHead,OTHER);
 assert.equal(receipt.candidatePrNumber,3191);
 const reservation=await readFile(path.join(root,"mcp-control-requests",args.requestId+".json"),"utf8");
 assert.equal(JSON.parse(reservation).candidateHead,OTHER);
 assert.equal(JSON.parse(reservation).candidatePrNumber,3191);
 assert.equal(JSON.stringify([outcome,receipt]).includes("C:/private"),false);
}));
test("native lock and stale source block execution; uncertain runs never silently replay",()=>privateRoot(async root=>{
 const args={requestId:"2".repeat(32),expectedHead:HEAD,suite:"factory-mcp"};
 let executed=0;
 const ops={testHead:async()=>OTHER,runTest:async()=>{executed++;return {state:"TEST_PASSED",code:"NODE_TEST_PASS",sourceHead:OTHER};}};
 const stale=await factoryControlAction("factory_run_named_test",args,{root,ops});
 assert.equal(stale.code,"EXACT_HEAD_MISMATCH");
 assert.equal((await factoryControlReceipt({root,requestId:args.requestId})).state,"NO_REQUEST");
 ops.testHead=async()=>HEAD;
 const dir=path.join(root,"mcp-control-requests");
 await mkdir(dir,{recursive:true});
 await writeFile(path.join(dir,"named-test-active.lock"),"prior-process");
 const busy=await factoryControlAction("factory_run_named_test",args,{root,ops});
 assert.equal(busy.code,"TEST_LOCKED");
 assert.equal(executed,0);
 assert.equal((await factoryControlReceipt({root,requestId:args.requestId})).state,"BLOCKED");
 await rm(path.join(dir,"named-test-active.lock"));
 const retry=await factoryControlAction("factory_run_named_test",args,{root,ops});
 assert.equal(retry.state,"DUPLICATE_OR_UNVERIFIABLE_REQUEST");
 const unknownArgs={requestId:"3".repeat(32),expectedHead:HEAD,suite:"factory-mcp"};
 ops.runTest=async()=>{throw Error("may already have executed");};
 const unknown=await factoryControlAction("factory_run_named_test",unknownArgs,{root,ops});
 assert.equal(unknown.state,"STARTED_UNCONFIRMED");
 assert.equal((await factoryControlReceipt({root,requestId:unknownArgs.requestId})).state,"STARTED_UNCONFIRMED");
 assert.equal((await factoryControlAction("factory_run_named_test",unknownArgs,{root,ops})).state,
   "DUPLICATE_OR_UNVERIFIABLE_REQUEST");
}));
