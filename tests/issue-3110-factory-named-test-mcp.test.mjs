import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { allowedFactoryTestNames, readFactoryVerificationHead,
  runFactoryNamedTest } from "../scripts/engineering-team/mcp/factory-named-tests.mjs";
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
