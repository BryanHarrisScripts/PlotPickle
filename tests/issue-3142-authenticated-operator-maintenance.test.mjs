import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {inspectOwnerWorkerOperations,requestOwnerSupervisorMigration}
  from "../scripts/engineering-team/mcp/engineering/operations/factory-operator-maintenance.mjs";
import {factoryStatus,handleRpc,MCP_CONTROL_TOOLS}
  from "../scripts/engineering-team/mcp/factory-readonly-server.mjs";

const HEAD="b".repeat(40),OLD="a".repeat(40);
const task={state:"OBSERVATION_ONLY",reviewer:"NOT_INSTALLED",tasks:[
 {name:"PlotPickleCodingDispatcher",state:"Ready",processVerified:false},
 {name:"PlotPickleCodingWorker1",state:"Disabled",processVerified:false},
 {name:"PlotPickleCodingWorker2",state:"Disabled",processVerified:false},
]};
const opts=()=>({
 platform:"win32",verifyHead:async()=>HEAD,
 run:async(cmd,args,options)=>{
   assert.equal(cmd,"powershell.exe");
   assert.deepEqual(args.slice(0,4),["-NoProfile","-NonInteractive","-File",
     args[3]]);
   assert.ok(args[3].endsWith("Install-PlotPickleFactoryWorkers.ps1"));
   assert.deepEqual(args.slice(4),["-Status"]);
   assert.equal(options.shell,false);
   assert.ok(options.timeout<=20000);
   return {stdout:JSON.stringify(task)};
 },
 dispatcherStatus:async()=>({state:"BLOCKED",code:"DISPATCH_OFFLINE_OR_UNVERIFIABLE",
   pid:8675309,privateData:"SECRET_DISPATCH"}),
 workerStatus:async()=>({state:"RELEASE_GATED",sourceHead:HEAD,
   pilotSupervisorObservedOnExactHead:true,privateData:"SECRET_WORKER"})
});

test("#3142 fixed operator read-only status reuses existing commands without leaking private data",async()=>{
 const r=await inspectOwnerWorkerOperations(opts());
 assert.equal(r.state,"OBSERVATION_ONLY");
 assert.equal(r.sourceHead,HEAD);
 assert.equal(r.reviewer,"NOT_INSTALLED");
 assert.deepEqual(r.tasks.map(x=>x.state),["Ready","Disabled","Disabled"]);
 assert.equal(r.dispatcher.onlineObserved,false);
 assert.equal(r.workerFleet.state,"RELEASE_GATED");
 assert.equal(r.workerFleet.pilotSupervisorObservedOnExactHead,true);
 assert.equal(r.workerFleet.automaticMergeEnabled,false);
 assert.doesNotMatch(JSON.stringify(r),/SECRET_|8675309|powershell.exe/);
});
test("#3142 operator status fails closed on platform, dirty head, bad task and source drift",async()=>{
 assert.equal((await inspectOwnerWorkerOperations({...opts(),platform:"linux"})).state,"BLOCKED");
 assert.equal((await inspectOwnerWorkerOperations({...opts(),verifyHead:async()=>null})).code,"EXACT_MAIN_UNVERIFIED");
 assert.equal((await inspectOwnerWorkerOperations({...opts(),
   run:async()=>({stdout:JSON.stringify({...task,tasks:[]})})})).code,"WORKER_STATUS_UNVERIFIED");
 assert.equal((await inspectOwnerWorkerOperations({...opts(),
   workerStatus:async()=>({state:"RELEASE_GATED",sourceHead:OLD})})).code,"WORKER_STATUS_UNVERIFIED");
 let reads=0;
 assert.equal((await inspectOwnerWorkerOperations({...opts(),
   verifyHead:async()=>++reads===1?HEAD:OLD})).code,"EXACT_MAIN_CHANGED");
});
test("#3142 migration uses existing one-way API only while supervisor is OFFLINE on old head",async()=>{
 let calls=0;
 const migrate=async options=>{
   calls++;
   assert.deepEqual(Object.keys(options).sort(),["consent","fromHead","platform"]);
   assert.equal(options.fromHead,OLD);
   assert.equal(options.platform,"win32");
   assert.equal(options.consent,"ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR");
   return {state:"HEAD_MIGRATED_NOT_RUNNING",exactSha:HEAD,
     workerProcessVerified:false,issueReplayed:false,automaticMergeEnabled:false};
 };
 const base={expectedHead:HEAD,platform:"win32",verifyHead:async()=>HEAD,
   readStatus:async()=>({state:"OFFLINE",exactSha:OLD,pauseAcknowledged:false}),migrate};
 const success=await requestOwnerSupervisorMigration(base);
 assert.equal(success.state,"TEST_PASSED");
 assert.equal(success.code,"SUPERVISOR_HEAD_MIGRATED_NOT_RUNNING");
 assert.equal(success.modelInvoked,false);
 assert.equal(success.replayAuthorized,false);
 assert.equal(calls,1);
 for(const status of [
   {state:"RUNNING",exactSha:OLD},
   {state:"PAUSED",exactSha:OLD},
   {state:"STOP_REQUESTED",exactSha:OLD},
   {state:"OFFLINE",exactSha:HEAD},
   {state:"OFFLINE",exactSha:"garbage"},
   {state:"OFFLINE",exactSha:OLD,pauseAcknowledged:true}
 ])assert.equal((await requestOwnerSupervisorMigration({...base,readStatus:async()=>status})).state,"BLOCKED");
 assert.equal(calls,1);
 assert.equal((await requestOwnerSupervisorMigration({...base,platform:"linux"})).state,"BLOCKED");
 assert.equal((await requestOwnerSupervisorMigration({...base,verifyHead:async()=>OLD})).state,"BLOCKED");
 assert.equal(calls,1);
 assert.equal((await requestOwnerSupervisorMigration({...base,
   migrate:async()=>{throw Error("PRIVATE_ERROR")}})).code,"SUPERVISOR_MIGRATION_UNVERIFIED");
});
test("#3142 immutable authenticated MCP migration rejects guest, wrong fields and duplicate ID",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"pp-ops-mcp-"));
 try{
   const args={requestId:"c".repeat(32),expectedHead:HEAD,suite:"factory-supervisor-migrate"};
   let calls=0;
   const invoke=(given,auth)=>handleRpc({jsonrpc:"2.0",id:55,method:"tools/call",
     params:{name:"factory_run_named_test",arguments:given}},{
       root,controlAuthenticated:auth,controlOps:{
         testHead:async()=>HEAD,
         supervisorMigrate:async({expectedHead})=>{
           calls++;assert.equal(expectedHead,HEAD);
           return {state:"TEST_PASSED",code:"SUPERVISOR_HEAD_MIGRATED_NOT_RUNNING",
             sourceHead:HEAD,secret:"PRIVATE_NEVER_ECHO"};
         }
       }
     });
   assert.equal((await invoke(args,false)).error.code,-32001);
   assert.equal((await invoke({...args,command:"powershell"},true)).error.code,-32602);
   assert.equal(calls,0);
   const passed=(await invoke(args,true)).result.structuredContent;
   assert.equal(passed.state,"TEST_PASSED");
   assert.equal(passed.code,"SUPERVISOR_HEAD_MIGRATED_NOT_RUNNING");
   assert.equal(passed.independentVerification,false);
   assert.equal(passed.replayAuthorized,false);
   assert.doesNotMatch(JSON.stringify(passed),/PRIVATE_NEVER_ECHO/);
   assert.equal(calls,1);
   assert.equal((await invoke(args,true)).result.structuredContent.state,
     "DUPLICATE_OR_UNVERIFIABLE_REQUEST");
   assert.equal(calls,1);
 } finally{await rm(root,{recursive:true,force:true});}
});
test("#3142 established status includes worker diagnostics only with authenticated injected reader",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"pp-ops-status-"));
 try{
   const guest=await factoryStatus({root});
   assert.equal(Object.hasOwn(guest,"workerOperations"),false);
   const authorized=await factoryStatus({root,
     readWorkerOperations:()=>inspectOwnerWorkerOperations(opts())});
   assert.equal(authorized.workerOperations.reviewer,"NOT_INSTALLED");
   assert.equal(authorized.workerOperations.workerFleet.state,"RELEASE_GATED");
 } finally{await rm(root,{recursive:true,force:true});}
});
test("#3142 no new public or authenticated MCP tool name",()=>{
 assert.equal(MCP_CONTROL_TOOLS.some(x=>x.name==="factory_run_named_test"),true);
 const named=MCP_CONTROL_TOOLS.find(x=>x.name==="factory_run_named_test");
 assert.equal(named.inputSchema.properties.suite.enum.includes("factory-supervisor-migrate"),true);
 assert.equal(MCP_CONTROL_TOOLS.some(x=>x.name==="execute-powershell"),false);
});
