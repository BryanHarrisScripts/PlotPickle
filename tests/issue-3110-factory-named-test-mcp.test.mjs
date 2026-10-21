import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import { EventEmitter } from "node:events";
import path from "node:path";
import { allowedFactoryTestNames, readFactoryVerificationHead,
  runFactoryNamedTest,inspectFactoryCandidatePr,stageFactoryCandidatePr,
  inspectFactorySyncSource,syncFactoryMain,
  runFactoryStoryUat,executeOwnedFactoryStoryUat } from "../scripts/engineering-team/mcp/factory-named-tests.mjs";
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
test("Chat candidate stage fetches a pinned PR SHA into a separate worktree without running candidate code",()=>privateRoot(async root=>{
 const seen=[];
 let metadataCalls=0;
 const runner=async(program,args,opts)=>{
   assert.ok(["git","gh"].includes(program));
   assert.equal(opts.shell,undefined);
   if(program==="git"){
     assert.equal(opts.env.GIT_CONFIG_COUNT,"1");
     assert.equal(opts.env.GIT_CONFIG_KEY_0,"core.longpaths");
     assert.equal(opts.env.GIT_CONFIG_VALUE_0,"true");
     assert.equal(opts.env.GIT_LFS_SKIP_SMUDGE,"1");
     assert.equal(opts.env.GIT_TERMINAL_PROMPT,"0");
   }
   seen.push({program,args,cwd:opts.cwd});
   if(program==="gh"){
     metadataCalls++;
     return {stdout:JSON.stringify({number:3192,state:"OPEN",
       baseRefName:"main",baseRefOid:HEAD,headRefOid:OTHER})};
   }
   if(args[0]==="fetch"){
     assert.equal(args[3],"https://github.com/BryanHarrisScripts/PlotPickle.git");
     assert.equal(args[4],"refs/pull/3192/head");
     return {stdout:""};
   }
   if(args[0]==="rev-parse"&&args[1]==="FETCH_HEAD")return {stdout:OTHER+"\n"};
   if(args[0]==="-c"&&args[2]==="worktree"){
     assert.ok(args[1].startsWith("core.hooksPath="));
     assert.equal(args[3],"add");
     assert.equal(args[4],"--detach");
     assert.equal(args[6],OTHER);
     assert.equal(opts.timeout,120_000);
     return {stdout:""};
   }
   if(args[0]==="rev-parse"&&args[1]==="HEAD")return {stdout:OTHER+"\n"};
   if(args[0]==="status"&&args[1]==="--porcelain")return {stdout:""};
   if(args[0]==="diff"&&args[1]==="--name-only")
     return {stdout:"app/index.tsx\0tests/candidate.test.mjs\0"};
   if(args[0]==="diff"&&args[1]==="--check")return {stdout:""};
   throw Error("Unexpected git command");
 };
 const opts={prNumber:3192,candidateHead:OTHER,expectedHead:HEAD,
   requestId:"8".repeat(32),root,platform:"win32",repoRoot:root,
   verifyHead:async()=>HEAD,run:runner};
 const result=await stageFactoryCandidatePr(opts);
 assert.deepEqual(result,{
   state:"TEST_PASSED",code:"CANDIDATE_STATIC_STAGED",sourceHead:HEAD,
   candidateHead:OTHER,candidatePrNumber:3192,changedFileCount:2,
   stageId:"8".repeat(32),sourceExecuted:false,modelInvoked:false,
   issueReserved:false,windowsUatVerified:false,
 });
 assert.equal(metadataCalls,2);
 assert.ok(seen.every(x=>x.program!=="node"&&x.program!=="npm"&&x.program!=="powershell"));
 assert.equal(seen.filter(x=>x.program==="git"&&x.args[0]==="diff").length,2);
 assert.equal((await stageFactoryCandidatePr({...opts,
   fileOps:{mkdir:async()=>{},lstat:async()=>({isDirectory:()=>true,isSymbolicLink:()=>false})}})).code,
   "CANDIDATE_STAGE_EXISTS");
}));

test("isolated candidate stage rejects changed PR, incorrect fetch, dirty main and static-check failure",()=>privateRoot(async root=>{
 const candidate={number:3193,state:"OPEN",baseRefName:"main",
   baseRefOid:HEAD,headRefOid:OTHER};
 const base={prNumber:3193,candidateHead:OTHER,expectedHead:HEAD,
   requestId:"9".repeat(32),root,platform:"win32",repoRoot:root,
   verifyHead:async()=>HEAD};
 let activity=[];
 const run=async(program,args)=>{
   activity.push(program+" "+args.join(" "));
   if(program==="gh")return {stdout:JSON.stringify(candidate)};
   if(args[0]==="fetch")return {stdout:""};
   if(args[1]==="FETCH_HEAD")return {stdout:HEAD};
   throw Error("A worktree must not be staged with a different fetched commit");
 };
 assert.equal((await stageFactoryCandidatePr({...base,run})).code,"CANDIDATE_FETCH_MISMATCH");
 assert.equal(activity.some(x=>x.includes("worktree")),false);
 assert.equal((await stageFactoryCandidatePr({...base,platform:"linux",run})).code,"WINDOWS_ONLY");
 assert.equal((await stageFactoryCandidatePr({...base,requestId:"../../private",run})).code,
   "CANDIDATE_SELECTION_INVALID");
 assert.equal((await stageFactoryCandidatePr({...base,verifyHead:async()=>null,run})).code,
   "EXACT_HEAD_MISMATCH");
 const errorRun=async(program,args)=>{
   if(program==="gh")return {stdout:JSON.stringify(candidate)};
   if(args[0]==="fetch")throw Error("PRIVATE_REMOTE_CREDENTIALS");
   throw Error("must not execute");
 };
 const error=await stageFactoryCandidatePr({...base,requestId:"a".repeat(32),run:errorRun});
 assert.equal(error.code,"CANDIDATE_STAGE_FETCH_FAILED");
 assert.equal(JSON.stringify(error).includes("PRIVATE"),false);
 const checkoutRun=async(program,args,opts)=>{
   if(program==="git"){
     assert.equal(opts.env.GIT_CONFIG_KEY_0,"core.longpaths");
     assert.equal(opts.env.GIT_CONFIG_VALUE_0,"true");
   }
   if(program==="gh")return {stdout:JSON.stringify(candidate)};
   if(args[0]==="fetch")return {stdout:""};
   if(args[0]==="rev-parse"&&args[1]==="FETCH_HEAD")return {stdout:OTHER};
   if(args[0]==="-c"&&args[2]==="worktree")
     throw Object.assign(Error("PRIVATE_CHECKOUT_PATH"),{code:"EPERM"});
   throw Error("Stage did not reach this command");
 };
 const checkoutError=await stageFactoryCandidatePr({...base,
   requestId:"f".repeat(32),run:checkoutRun});
 assert.equal(checkoutError.code,"CANDIDATE_STAGE_WORKTREE_ADD_FAILED");
 assert.equal(checkoutError.state,"BLOCKED");
 assert.equal(JSON.stringify(checkoutError).includes("PRIVATE"),false);
}));

test("staged candidate must be clean before and after remote identity recheck",()=>privateRoot(async root=>{
  const info={number:3193,state:"OPEN",baseRefName:"main",
    baseRefOid:HEAD,headRefOid:OTHER};
  const build=(requestId,statuses,stagedHeads=[OTHER,OTHER])=>{
    let statusIndex=0,checkedDiff=0,prChecks=0,stageHeadIndex=0;
    const run=async(program,args)=>{
      if(program==="gh"){prChecks++;return {stdout:JSON.stringify(info)};}
      if(args[0]==="fetch"||args[0]==="-c")return {stdout:""};
      if(args[0]==="rev-parse")return {stdout:args[1]==="HEAD"
        ? (stagedHeads[stageHeadIndex++] ?? OTHER) : OTHER};
      if(args[0]==="status"){
        assert.deepEqual(args,["status","--porcelain","--untracked-files=normal",
          "--ignore-submodules=none"]);
        return {stdout:statuses[statusIndex++]||""};
      }
      if(args[0]==="diff"){
        checkedDiff++;
        return {stdout:args[1]==="--name-only"?"src/repaired.mjs\0":""};
      }
      throw Error("unexpected candidate staging command");
    };
    return {requestId,run,stats:()=>({statusIndex,checkedDiff,prChecks})};
  };
  const base={prNumber:3193,candidateHead:OTHER,expectedHead:HEAD,root,
    platform:"win32",verifyHead:async()=>HEAD};
  const first=build("c".repeat(32),[" M src/repaired.mjs"]);
  const dirty=await stageFactoryCandidatePr({...base,...first});
  assert.equal(dirty.code,"CANDIDATE_STAGE_DIRTY");
  assert.equal(dirty.state,"BLOCKED");
  assert.equal(first.stats().statusIndex,1);
  assert.equal(first.stats().checkedDiff,0);
  const late=build("d".repeat(32),["","?? new-untrusted-file.js"]);
  const raced=await stageFactoryCandidatePr({...base,...late});
  assert.equal(raced.code,"CANDIDATE_STAGE_DIRTY");
  assert.equal(raced.state,"BLOCKED");
  assert.equal(late.stats().statusIndex,2);
  assert.equal(late.stats().checkedDiff,2);
  assert.equal(late.stats().prChecks,2);
  // A clean reset after the first HEAD check must never attest a different commit.
  const reset=build("e".repeat(32),["",""],[OTHER,HEAD]);
  const changed=await stageFactoryCandidatePr({...base,...reset});
  assert.equal(changed.state,"BLOCKED");
  assert.equal(changed.code,"CANDIDATE_STAGE_MISMATCH");
  assert.equal(reset.stats().statusIndex,2);
  assert.equal(reset.stats().prChecks,2);
  assert.equal(JSON.stringify([dirty,raced,changed]).includes("src/repaired"),false);
}));

test("authenticated existing tool writes one static-candidate-stage receipt and refuses replay",()=>privateRoot(async root=>{
 let calls=0;
 const args={requestId:"7".repeat(32),expectedHead:HEAD,suite:"factory-pr-stage",
   candidatePrNumber:3192,candidateHead:OTHER};
 const ops={testHead:async()=>HEAD,stagePr:async({prNumber,candidateHead,expectedHead,requestId,root:calledRoot})=>{
   calls++;
   assert.deepEqual([prNumber,candidateHead,expectedHead,requestId,calledRoot],
     [3192,OTHER,HEAD,args.requestId,root]);
   return {state:"TEST_PASSED",code:"CANDIDATE_STATIC_STAGED",
     sourceHead:HEAD,candidatePrNumber:3192,candidateHead:OTHER,
     changedFileCount:3,stageId:args.requestId,
     privatePath:"C:/SECRET_PRIVATE_PATH",windowsUatVerified:false};
 }};
 const invoke=(data,auth=true)=>handleRpc({jsonrpc:"2.0",id:15,
   method:"tools/call",params:{name:"factory_run_named_test",arguments:data}},
   {root,controlAuthenticated:auth,controlOps:ops});
 assert.equal((await invoke(args,false)).error.code,-32001);
 assert.equal((await invoke({...args,cmd:"ls"})).error.code,-32602);
 assert.equal((await invoke({...args,suite:"factory-qa-handoff"})).error.code,-32602);
 assert.equal(calls,0);
 const response=(await invoke(args)).result.structuredContent;
 assert.equal(response.code,"CANDIDATE_STATIC_STAGED");
 assert.equal(response.candidatePrNumber,3192);
 assert.equal(response.candidateHead,OTHER);
 assert.equal(response.stageId,args.requestId);
 assert.equal(response.changedFileCount,3);
 assert.equal(response.independentVerification,false);
 assert.equal(response.modelInvoked,false);
 assert.equal(response.replayAuthorized,false);
 assert.equal(calls,1);
 assert.equal((await invoke(args)).result.structuredContent.state,
   "DUPLICATE_OR_UNVERIFIABLE_REQUEST");
 assert.equal(calls,1);
 assert.deepEqual(await factoryControlReceipt({root,requestId:args.requestId}),response);
 assert.equal(JSON.stringify(response).includes("SECRET"),false);
}));

test("source-bound Windows sync verifies origin, tracked-clean main and exact head",async()=>{
 const calls=[];
 const local={head:HEAD,branch:"main",dirty:"",origin:
   "https://github.com/BryanHarrisScripts/PlotPickle.git",fetched:OTHER};
 const run=async(program,args,opts)=>{
   assert.equal(program,"git");
   assert.equal(Object.hasOwn(opts,"shell"),false);
   calls.push(args.join(" "));
   switch(args.join(" ")){
     case "rev-parse HEAD":return {stdout:local.head};
     case "branch --show-current":return {stdout:local.branch};
     case "status --porcelain --untracked-files=no":return {stdout:local.dirty};
     case "remote get-url origin":return {stdout:local.origin};
     default:throw Error("unexpected git probe");
   }
 };
 const opts={run,platform:"win32"};
 assert.equal((await inspectFactorySyncSource(opts)).code,"SYNC_SOURCE_VERIFIED");
 assert.equal((await inspectFactorySyncSource({...opts,platform:"linux"})).code,"WINDOWS_ONLY");
 local.branch="feature";
 assert.equal((await inspectFactorySyncSource(opts)).code,"SYNC_MAIN_NOT_CLEAN");
 local.branch="main";local.dirty=" M src/working.js";
 assert.equal((await inspectFactorySyncSource(opts)).code,"SYNC_MAIN_NOT_CLEAN");
 local.dirty="";local.origin="https://github.com/someone/other.git";
 assert.equal((await inspectFactorySyncSource(opts)).code,"SYNC_ORIGIN_UNVERIFIED");
 local.origin="https://github.com/BryanHarrisScripts/PlotPickle.git";
 assert.equal((await inspectFactorySyncSource(opts)).state,"TEST_PASSED");
 assert.ok(calls.every(x=>!x.includes("clean -fd")&&!x.includes("reset --hard")));
});

test("authenticated main sync fetches only checked origin/main, then pins fast-forward SHA",()=>privateRoot(async root=>{
 const state={head:HEAD,remote:OTHER,dirty:"",origin:
   "https://github.com/BryanHarrisScripts/PlotPickle.git",operations:[]};
 const run=async(program,args,opts)=>{
   assert.equal(program,"git");
   assert.equal(Object.hasOwn(opts,"shell"),false);
   state.operations.push({args,opts});
   if(args[0]==="rev-parse")return {stdout:args[1]==="HEAD"?state.head:state.remote};
   if(args[0]==="branch")return {stdout:"main"};
   if(args[0]==="status")return {stdout:state.dirty};
   if(args[0]==="remote")return {stdout:state.origin};
   assert.equal(opts.env.GIT_CONFIG_KEY_0,"core.longpaths");
   assert.equal(opts.env.GIT_CONFIG_VALUE_0,"true");
   assert.equal(opts.env.GIT_TERMINAL_PROMPT,"0");
   if(args[0]==="fetch"){
     assert.deepEqual(args,["fetch","--no-tags","--no-recurse-submodules",
       "origin","refs/heads/main:refs/remotes/origin/main"]);
     return {stdout:""};
   }
   if(args[0]==="merge-base"){
     assert.deepEqual(args,["merge-base","--is-ancestor",HEAD,OTHER]);
     return {stdout:""};
   }
   if(args[0]==="-c"&&args[2]==="merge"){
     assert.ok(args[1].startsWith("core.hooksPath="));
     assert.deepEqual(args.slice(2),["merge","--ff-only",OTHER]);
     assert.equal(opts.timeout,120000);
     state.head=OTHER;
     return {stdout:""};
   }
   throw Error("Unexpected Git invocation");
 };
 const opts={root,repoRoot:root,platform:"win32",expectedHead:HEAD,run};
 assert.equal((await syncFactoryMain({...opts,platform:"linux"})).code,"WINDOWS_ONLY");
 assert.equal((await syncFactoryMain({...opts,expectedHead:"bad"})).code,
   "SYNC_SELECTION_INVALID");
 const success=await syncFactoryMain(opts);
 assert.equal(success.state,"TEST_PASSED");
 assert.equal(success.code,"SOURCE_SYNCED");
 assert.equal(success.sourceHead,OTHER);
 assert.equal(success.issueReserved,false);
 assert.equal(success.modelInvoked,false);
 assert.equal(state.operations.filter(x=>x.args[0]==="fetch").length,1);
 assert.equal(state.operations.filter(x=>x.args.includes("merge")).length,1);
 assert.ok(state.operations.every(x=>!x.args.includes("--hard")&&
   !x.args.includes("clean")&&!x.args.includes("stash")));
 state.remote=OTHER;
 assert.equal((await syncFactoryMain({...opts,expectedHead:OTHER})).code,
   "SOURCE_ALREADY_CURRENT");
 assert.equal(state.operations.filter(x=>x.args.includes("merge")).length,1);
}));

test("sync denies divergent, drifting and uncertain checkout without false PASS",()=>privateRoot(async root=>{
 const base={root,repoRoot:root,platform:"win32",expectedHead:HEAD};
 const build=(mode)=>{
   let head=HEAD,remote=OTHER,merges=0;
   const run=async(_program,args)=>{
     if(args[0]==="rev-parse"&&args[1]==="HEAD")return {stdout:head};
     if(args[0]==="rev-parse"&&args[1]==="FETCH_HEAD")return {stdout:remote};
     if(args[0]==="branch")return {stdout:"main"};
     if(args[0]==="status")return {stdout:mode==="final-dirty"&&head===OTHER?" M src/a.mjs":""};
     if(args[0]==="remote")return {stdout:"https://github.com/BryanHarrisScripts/PlotPickle.git"};
     if(args[0]==="fetch"){
       if(mode==="fetch-fail")throw Error("PRIVATE_REMOTE_CREDENTIAL");
       if(mode==="drift")head=OTHER;
       return {stdout:""};
     }
     if(args[0]==="merge-base"){
       if(mode==="diverged")throw Object.assign(Error("NON_FAST_FORWARD"),{code:1});
       return {stdout:""};
     }
     if(args[0]==="-c"){
       merges++;
       if(mode==="merge-fail")throw Error("SECRET_CONFLICT_PATH");
       head=OTHER;return {stdout:""};
     }
     throw Error("unsupported git command");
   };
   return {run,count:()=>merges};
 };
 for(const [mode,code,mergeCount] of [
   ["fetch-fail","SYNC_FETCH_FAILED",0],
   ["diverged","SYNC_NOT_FAST_FORWARD",0],
   ["drift","SYNC_SOURCE_CHANGED",0],
   ["merge-fail","SYNC_MERGE_UNVERIFIED",1],
   ["final-dirty","SYNC_OUTCOME_UNVERIFIED",1],
 ]){
   const x=build(mode);
   const result=await syncFactoryMain({...base,run:x.run});
   assert.equal(result.state,"BLOCKED");
   assert.equal(result.code,code);
   assert.equal(x.count(),mergeCount);
   assert.equal(JSON.stringify(result).includes("SECRET"),false);
   assert.equal(JSON.stringify(result).includes("PRIVATE"),false);
 }
}));

test("MCP sync reuses one authenticated tool and immutable receipt; no replay",()=>privateRoot(async root=>{
 const args={requestId:"6".repeat(32),expectedHead:HEAD,suite:"factory-sync-main"};
 let executed=0;
 const ops={inspectSyncSource:async()=>({state:"TEST_PASSED",
   code:"SYNC_SOURCE_VERIFIED",sourceHead:HEAD}),
   syncMain:async({expectedHead,root:receivedRoot})=>{
     executed++;assert.equal(expectedHead,HEAD);
     assert.equal(receivedRoot,root);
     return {state:"TEST_PASSED",code:"SOURCE_SYNCED",
       sourceHead:OTHER,privatePath:"C:/SECRET"};
   }};
 const invoke=(body,authenticated=true)=>handleRpc({jsonrpc:"2.0",id:21,
   method:"tools/call",params:{name:"factory_run_named_test",arguments:body}},
   {root,controlAuthenticated:authenticated,controlOps:ops});
 assert.equal((await invoke(args,false)).error.code,-32001);
 assert.equal((await invoke({...args,command:"git pull"})).error.code,-32602);
 assert.equal((await invoke({...args,suite:"factory-arbitrary"})).error.code,-32602);
 assert.equal(executed,0);
 const first=(await invoke(args)).result.structuredContent;
 assert.equal(first.state,"TEST_PASSED");
 assert.equal(first.code,"SOURCE_SYNCED");
 assert.equal(first.suite,"factory-sync-main");
 assert.equal(first.sourceHead,OTHER);
 assert.equal(first.modelInvoked,false);
 assert.equal(first.replayAuthorized,false);
 assert.equal(executed,1);
 assert.equal((await invoke(args)).result.structuredContent.state,
   "DUPLICATE_OR_UNVERIFIABLE_REQUEST");
 assert.deepEqual(await factoryControlReceipt({root,requestId:args.requestId}),first);
 assert.equal(JSON.stringify(first).includes("SECRET"),false);
 const stale=await invoke({...args,requestId:"5".repeat(32),expectedHead:OTHER});
 assert.equal(stale.result.structuredContent.code,"EXACT_HEAD_MISMATCH");
 assert.equal(executed,1);
}));


test("fixed Windows real browser UAT child cannot run arbitrary paths or a shell",async()=>{
 const args=[];
 const result=await executeOwnedFactoryStoryUat({
   repoRoot:"C:/PlotPickle-fixture",env:{GITHUB_SHA:HEAD},
   timeoutMs:200,launch:(program,argv,opts)=>{
     args.push({program,argv,opts});
     const child=new EventEmitter();
     child.exitCode=null;child.signalCode=null;
     queueMicrotask(()=>{child.exitCode=0;child.emit("close",0);});
     return child;
   },
 });
 assert.deepEqual(result,{exitCode:0});
 assert.equal(args.length,1);
 assert.equal(args[0].program,process.execPath);
 assert.deepEqual(args[0].argv,["scripts/verification-webmcp-live.mjs"]);
 assert.equal(args[0].opts.shell,false);
 assert.equal(args[0].opts.cwd,"C:/PlotPickle-fixture");
 assert.equal(args[0].opts.env.GITHUB_SHA,HEAD);
 const timed=await executeOwnedFactoryStoryUat({
   repoRoot:"C:/PlotPickle-fixture",env:{GITHUB_SHA:HEAD},timeoutMs:5,
   launch:()=>{
     const child=new EventEmitter();
     child.pid=99999;child.exitCode=null;child.signalCode=null;
     return child;
   },
   stop:async child=>{child.signalCode="SIGTERM";},
 });
 assert.equal(timed.timedOut,true);
 assert.equal(timed.stopUnverified,false);
});

test("Story UAT receipt needs real-browser, request-correlated LOCAL-mode success",()=>privateRoot(async root=>{
 const requestId="7".repeat(32);
 const report=path.join(root,".artifacts","verification-live","webmcp-live.json");
 await mkdir(path.dirname(report),{recursive:true});
 const allowed={schemaVersion:"1.0",observer:"webmcp-live",
   status:"pass",factoryUatRequestId:requestId,exactHead:HEAD,
   authority:"read-only-observer",externalProviderCalls:false,
   secretsAccessed:false,
   storyMode:{mode:"local",providerSpendAllowed:false},
   mindWorldAcceptance:{status:"PASS"},
   storyFactoryAcceptance:{status:"PASS",mutationAuthority:false,providerSpendAllowed:false},
 };
 let result={exitCode:0};
 const evidence=async(value=allowed)=>{await writeFile(report,JSON.stringify(value));};
 const opts={root,repoRoot:root,platform:"win32",requestId,expectedHead:HEAD,
   verifyHead:async()=>HEAD,
   execute:async({repoRoot,env})=>{
     assert.equal(repoRoot,root);
     assert.equal(env.GITHUB_SHA,HEAD);
     assert.equal(env.PLOTPICKLE_FACTORY_UAT_REQUEST_ID,requestId);
     assert.ok(env.RUNNER_TEMP.endsWith(requestId));
     assert.equal(env.PLOTPICKLE_PI_ALLOW_CLOUD,"0");
     return result;
   },
 };
 assert.equal((await runFactoryStoryUat({...opts,platform:"linux"})).code,"WINDOWS_ONLY");
 assert.equal((await runFactoryStoryUat({...opts,requestId:"wrong"})).code,
   "PRODUCT_UAT_SELECTION_INVALID");
 assert.equal((await runFactoryStoryUat({...opts,verifyHead:async()=>OTHER})).code,
   "EXACT_HEAD_MISMATCH");
 assert.equal((await runFactoryStoryUat(opts)).code,"PRODUCT_UAT_EVIDENCE_UNVERIFIED");
 await evidence();
 const pass=await runFactoryStoryUat(opts);
 assert.deepEqual(pass,{state:"TEST_PASSED",code:"PRODUCT_UAT_OBSERVED_PASS",
   sourceHead:HEAD,modelInvoked:false,issueReserved:false,
   independentVerification:false});
 await evidence({...allowed,factoryUatRequestId:"8".repeat(32)});
 assert.equal((await runFactoryStoryUat(opts)).code,"PRODUCT_UAT_EVIDENCE_UNVERIFIED");
 await evidence({...allowed,storyMode:{mode:"cloud",providerSpendAllowed:true}});
 assert.equal((await runFactoryStoryUat(opts)).code,"PRODUCT_UAT_EVIDENCE_UNVERIFIED");
 await evidence({...allowed,storyFactoryAcceptance:{status:"FAIL",mutationAuthority:false,providerSpendAllowed:false}});
 assert.equal((await runFactoryStoryUat(opts)).code,"PRODUCT_UAT_EVIDENCE_UNVERIFIED");
 await evidence({...allowed,externalProviderCalls:true});
 assert.equal((await runFactoryStoryUat(opts)).code,"PRODUCT_UAT_EVIDENCE_UNVERIFIED");
 await evidence(allowed);
 result={exitCode:1};
 assert.equal((await runFactoryStoryUat(opts)).code,"PRODUCT_UAT_FAILED");
 result={timedOut:true};
 assert.equal((await runFactoryStoryUat(opts)).code,"PRODUCT_UAT_TIMEOUT");
 result={timedOut:true,stopUnverified:true};
 assert.equal((await runFactoryStoryUat(opts)).code,"PRODUCT_UAT_STOP_UNVERIFIED");
 let checked=0;
 assert.equal((await runFactoryStoryUat({...opts,
   verifyHead:async()=>++checked===1?HEAD:OTHER})).code,"EXACT_HEAD_MISMATCH");
}));

test("authenticated Story Factory browser UAT refuses unauthenticated or replayed controls",()=>privateRoot(async root=>{
 const requestId="9".repeat(32);
 const args={requestId,expectedHead:HEAD,suite:"factory-story-uat"};
 let runs=0;
 const controlOps={testHead:async()=>HEAD,
   storyUat:async({expectedHead,root:owned,requestId:id})=>{
     runs++;assert.equal(expectedHead,HEAD);
     assert.equal(owned,root);assert.equal(id,requestId);
     return {state:"TEST_FAILED",code:"PRODUCT_UAT_FAILED",sourceHead:HEAD};
   }};
 const rpc=(body,auth=true)=>handleRpc({jsonrpc:"2.0",id:62,
   method:"tools/call",params:{name:"factory_run_named_test",arguments:body}},
   {root,controlAuthenticated:auth,controlOps});
 assert.equal((await rpc(args,false)).error.code,-32001);
 assert.equal((await rpc({...args,arbitraryPath:"C:/owner"})).error.code,-32602);
 assert.equal(runs,0);
 const fail=(await rpc(args)).result.structuredContent;
 assert.equal(fail.state,"TEST_FAILED");
 assert.equal(fail.code,"PRODUCT_UAT_FAILED");
 assert.equal(fail.suite,"factory-story-uat");
 assert.equal(fail.independentVerification,false);
 assert.equal(fail.modelInvoked,false);
 assert.equal(fail.replayAuthorized,false);
 assert.equal(runs,1);
 assert.equal((await rpc(args)).result.structuredContent.state,
   "DUPLICATE_OR_UNVERIFIABLE_REQUEST");
 assert.deepEqual(await factoryControlReceipt({root,requestId}),fail);
 assert.equal(runs,1);
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
