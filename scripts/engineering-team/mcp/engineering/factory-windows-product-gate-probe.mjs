#!/usr/bin/env node
/**
 * #3303 Trusted fixed CHILD probe. Run ONLY by reviewed installed gate runner,
 * under Node --permission, with a scrubbed environment and staged PR path.
 *
 * The physical Windows snapshot is collected by the trusted PARENT, never by
 * candidate code. Candidate code can only classify this bounded snapshot.
 * No child process, file write or owner token is granted. A disposable
 * ephemeral 127.0.0.1 listener is used for actual HTTP authentication proof;
 * Node's permission guard alone does not restrict other network destinations.
 */
import path from "node:path";
import {randomBytes} from "node:crypto";
import {pathToFileURL} from "node:url";

const SHA=/^[a-f0-9]{40}$/u;
const names=["PlotPickleCodingDispatcher","PlotPickleCodingWorker1","PlotPickleCodingWorker2"];
const fail=()=>{process.stdout.write(JSON.stringify({state:"UNPROVEN"})+"\n");process.exitCode=2;};

/**
 * Physically challenge the candidate's loopback MCP HTTP listener with a
 * disposable 384-bit token. This is a bounded behavioral test, not the owner
 * tunnel's credential or an independent signing/release authority.
 */
async function challengeIsolatedLoopback(candidate,stage){
  if(typeof candidate.createLocalMcpHttpServer!=="function")return false;
  const token=randomBytes(48).toString("base64url");
  const root=path.join(stage,".artifacts","3303-product-gate-disposable");
  const server=candidate.createLocalMcpHttpServer({
    root,controlToken:token,engineeringEnabled:true,
  });
  await new Promise((resolve,reject)=>{
    server.once("error",reject);
    server.listen(0,"127.0.0.1",resolve);
  });
  try {
    const addr=server.address();
    if(addr?.address!=="127.0.0.1"||!Number.isInteger(addr.port)||
       addr.port<1)return false;
    const url="http://127.0.0.1:"+addr.port+"/mcp";
    const call=async(headers={})=>{
      const response=await fetch(url,{
        method:"POST",signal:AbortSignal.timeout(4000),
        headers:{"content-type":"application/json",
          accept:"application/json, text/event-stream",...headers},
        body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/list"}),
      });
      if(response.status!==200)return null;
      const payload=await response.json();
      return payload?.result?.tools;
    };
    const guest=await call();
    const forged=await call({
      "x-plotpickle-factory-control-token":randomBytes(48).toString("base64url"),
    });
    const owner=await call({"x-plotpickle-factory-control-token":token});
    const suite="factory_run_named_test";
    if(!Array.isArray(guest)||!Array.isArray(forged)||
       !Array.isArray(owner)||
       guest.some(t=>t.name===suite)||forged.some(t=>t.name===suite)||
       !owner.some(t=>t.name===suite))return false;
    const forbidden=await fetch(url,{
      method:"POST",signal:AbortSignal.timeout(4000),
      headers:{"content-type":"application/json",
        accept:"application/json, text/event-stream",
        origin:"https://external.invalid"},
      body:JSON.stringify({jsonrpc:"2.0",id:2,method:"tools/list"}),
    });
    if(forbidden.status!==403)return false;
    return true;
  }finally {
    await new Promise((resolve,reject)=>
      server.close(error=>error?reject(error):resolve()));
  }
}

async function main(){
  if(process.platform!=="win32"||!process.permission?.has||process.permission.has("child")||
     process.permission.has("worker")||process.permission.has("fs.write"))
    return fail();
  const [stage,mainSha,candidateSha,payload]=process.argv.slice(2);
  if(typeof stage!=="string"||!path.isAbsolute(stage)||!SHA.test(mainSha||"")||
     !SHA.test(candidateSha||"")||typeof payload!=="string"||payload.length>8192)
    return fail();
  let snap;
  try{snap=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));}catch{return fail();}
  if(snap?.sourceHead!==mainSha||snap?.candidateHead!==candidateSha||
     snap?.supervisor?.state!=="RUNNING"||snap.supervisor.exactSha!==mainSha||
     snap?.task?.state!=="OBSERVATION_ONLY"||!Array.isArray(snap.task.tasks)||
     snap.task.tasks.length!==3||snap.task.tasks.some((t,i)=>t.name!==names[i]||
       t.processVerified!==false)||snap?.worker?.sourceHead!==mainSha)
    return fail();
  let candidate,op;
  try{
    op=await import(pathToFileURL(path.join(stage,
      "scripts/engineering-team/mcp/engineering/operations/factory-operator-maintenance.mjs")).href);
    candidate=await import(pathToFileURL(path.join(stage,
      "scripts/engineering-team/mcp/factory-readonly-server.mjs")).href);
  }catch{return fail();}
  if(typeof op.inspectOwnerWorkerOperations!=="function"||
     typeof op.requestOwnerSupervisorMigration!=="function"||
     typeof candidate.factoryStatus!=="function"||
     typeof candidate.executeMcpRequest!=="function")return fail();
  const snapshotRun=async(program,args,options)=>{
    if(program!=="powershell.exe"||args?.at(-1)!=="-Status"||
       options?.shell!==false)throw Error("FORBIDDEN_PROBE_EXEC");
    return {stdout:JSON.stringify(snap.task)};
  };
  let diagnostic;
  try{
    diagnostic=await op.inspectOwnerWorkerOperations({
      platform:"win32",verifyHead:async()=>mainSha,run:snapshotRun,
      workerStatus:async()=>snap.worker,dispatcherStatus:async()=>snap.dispatcher,
    });
  }catch{return fail();}
  if(diagnostic?.state!=="OBSERVATION_ONLY"||
     diagnostic.sourceHead!==mainSha||diagnostic.tasks?.length!==3||
     diagnostic.dispatcher?.processVerified!==false||
     diagnostic.workerFleet?.workerProcessVerified!==false||
     diagnostic.automaticMergeEnabled!==false)return fail();
  // Exercise the actual candidate MCP authorization and status route. The
  // physical snapshot was gathered by trusted MAIN, not by candidate code.
  const request={jsonrpc:"2.0",id:1,method:"tools/call",
    params:{name:"factory_status",arguments:{}}};
  const fakeRoot=path.join(stage,".artifacts","3303-product-gate-disposable");
  let status,guest;
  try{
    const authorized=await candidate.executeMcpRequest(request,{
      root:fakeRoot,controlAuthenticated:true,
      workerOperationsRead:async()=>diagnostic,
      supervisorRead:async()=>snap.supervisor,
      stageBudgetRead:async()=>({state:"UNKNOWN"}),
      stageLockRead:async()=>({state:"ABSENT"}),
    });
    status=authorized?.result?.structuredContent;
    guest=await candidate.executeMcpRequest({...request,id:2},{
      root:fakeRoot,controlAuthenticated:false,
    });
  }catch{return fail();}
  if(status?.workerOperations?.state!=="OBSERVATION_ONLY"||
     status.workerOperations.sourceHead!==mainSha ||
     status?.supervisor?.state!=="RUNNING" ||
     guest?.result?.structuredContent?.workerOperations!==undefined)
    return fail();
  // Unauthenticated users may read public status, but may not invoke controls.
  let guestMutation;
  try{guestMutation=await candidate.executeMcpRequest({
    jsonrpc:"2.0",id:3,method:"tools/call",
    params:{name:"factory_run_named_test",arguments:{
      requestId:"f".repeat(32),expectedHead:mainSha,suite:"factory-supervisor-migrate",
    }}},{root:fakeRoot,controlAuthenticated:false});}
  catch{return fail();}
  if(guestMutation?.error?.code!==-32001)return fail();
  // Never call migrate: the candidate MUST deny a RUNNING supervisor early.
  let called=false,migration;
  try{migration=await op.requestOwnerSupervisorMigration({
    expectedHead:mainSha,platform:"win32",verifyHead:async()=>mainSha,
    readStatus:async()=>snap.supervisor,migrate:async()=>{called=true;throw Error("UNSAFE");},
  });}catch{return fail();}
  if(called||migration?.state!=="BLOCKED"||
     migration.code!=="SUPERVISOR_MIGRATION_OFFLINE_REQUIRED")return fail();
  // No synthetic status callback may substitute for real HTTP authentication.
  if(!await challengeIsolatedLoopback(candidate,stage))return fail();
  process.stdout.write(JSON.stringify({
    state:"OBSERVED",source:"OWNER_WINDOWS_NATIVE",candidateHead:candidateSha,
    authStatusVerified:true,guestDenied:true,migrationDeniedWhileRunning:true,
    processIsolationVerified:true,stopUnchanged:true,
  })+"\n");
}
main().catch(fail);
