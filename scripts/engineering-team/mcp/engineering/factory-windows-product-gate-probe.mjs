#!/usr/bin/env node
/**
 * #3303 Trusted fixed CHILD probe. Run ONLY by reviewed installed gate runner,
 * under Node --permission, with a scrubbed environment and staged PR path.
 *
 * The physical Windows snapshot is collected by the trusted PARENT, never by
 * candidate code. Candidate code can only classify this bounded snapshot.
 * No network, child process, file write or owner token is granted.
 */
import path from "node:path";
import {pathToFileURL} from "node:url";

const SHA=/^[a-f0-9]{40}$/u;
const names=["PlotPickleCodingDispatcher","PlotPickleCodingWorker1","PlotPickleCodingWorker2"];
const fail=()=>{process.stdout.write(JSON.stringify({state:"UNPROVEN"})+"\n");process.exitCode=2;};
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
      "scripts/engineering-team/mcp/engineering/factory-operator-maintenance.mjs")).href);
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
  // Exercise the actual candidate status serialization, not a copied mock.
  let status;
  try{status=await candidate.factoryStatus({
    root:path.join(stage,".artifacts","3303-product-gate-disposable"),
    verifyHead:async()=>mainSha,readWorkerOperations:async()=>diagnostic,
  });}catch{return fail();}
  if(status?.workerOperations?.state!=="OBSERVATION_ONLY"||
     status.workerOperations.sourceHead!==mainSha)return fail();
  // The candidate's unprivileged MCP boundary must still deny fixed tools.
  let guest;
  try{guest=await candidate.executeMcpRequest({
    jsonrpc:"2.0",id:1,method:"tools/call",
    params:{name:"factory_run_named_test",arguments:{
      requestId:"f".repeat(32),expectedHead:mainSha,suite:"factory-supervisor-migrate",
    }}},{root:path.join(stage,".artifacts","3303-product-gate-disposable"),
      controlAuthenticated:false});}catch{return fail();}
  if(guest?.error?.code!==-32001)return fail();
  // Never call migrate: the candidate MUST deny a RUNNING supervisor early.
  let called=false,migration;
  try{migration=await op.requestOwnerSupervisorMigration({
    expectedHead:mainSha,platform:"win32",verifyHead:async()=>mainSha,
    readStatus:async()=>snap.supervisor,migrate:async()=>{called=true;throw Error("UNSAFE");},
  });}catch{return fail();}
  if(called||migration?.state!=="BLOCKED"||
     migration.code!=="SUPERVISOR_MIGRATION_OFFLINE_REQUIRED")return fail();
  process.stdout.write(JSON.stringify({
    state:"OBSERVED",source:"OWNER_WINDOWS_NATIVE",candidateHead:candidateSha,
    authStatusVerified:true,guestDenied:true,migrationDeniedWhileRunning:true,
    processIsolationVerified:true,stopUnchanged:true,
  })+"\n");
}
main().catch(fail);
