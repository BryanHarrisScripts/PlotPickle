/**
 * #3303 trusted fixed entrypoint, executed in the pinned candidate worktree
 * with only sanitized owner-Windows observations. NOT a general script runner.
 *
 * This checks the candidate MCP domain/API behavior against snapshots made
 * by the trusted parent using actual owner Windows commands. It never receives
 * the owner's Factory control token, local profile or signing credentials.
 */
import path from "node:path";
import process from "node:process";
import os from "node:os";
import {mkdtemp,rm} from "node:fs/promises";
import {pathToFileURL} from "node:url";

const SHA=/^[a-f0-9]{40}$/u;
const safe=(state,checks={})=>({state,checks,
  modelInvoked:false,migrationInvoked:false,mergeAuthorized:false});
async function main() {
  if(process.platform!=="win32")return safe("WINDOWS_ONLY");
  let snapshot;
  try{snapshot=JSON.parse(process.env.PLOTPICKLE_GATE_SNAPSHOT||"null");}
  catch{return safe("SNAPSHOT_INVALID");}
  if(snapshot?.schemaVersion!==1||!SHA.test(snapshot?.sourceHead||"")||
     snapshot?.supervisor?.state!=="RUNNING"||
     snapshot?.supervisor?.exactSha!==snapshot.sourceHead||
     !Array.isArray(snapshot?.task?.tasks)||
     snapshot.task.tasks.length!==3||
     !["BLOCKED","ONLINE_OBSERVED"].includes(snapshot?.dispatcher?.state)||
     !["RELEASE_GATED","BLOCKED","READY","PARKED"].includes(snapshot?.worker?.state)||
     snapshot.worker.sourceHead!==snapshot.sourceHead)
    return safe("SNAPSHOT_INVALID");
  const stage=process.cwd();
  let privateRoot;
  try {
    const [ops,mcp]=await Promise.all([
      import(pathToFileURL(path.join(stage,"scripts","engineering-team","mcp",
        "engineering","factory-operator-maintenance.mjs")).href),
      import(pathToFileURL(path.join(stage,"scripts","engineering-team","mcp",
        "factory-readonly-server.mjs")).href),
    ]);
    privateRoot=await mkdtemp(path.join(os.tmpdir(),"pp-gate-3303-"));
    let commandValid=false;
    const observation=await ops.inspectOwnerWorkerOperations({
      platform:"win32",verifyHead:async()=>snapshot.sourceHead,
      run:async(command,args,options)=>{
        commandValid=command==="powershell.exe"&&
          Array.isArray(args)&&args.length===5&&args[0]==="-NoProfile"&&
          args[1]==="-NonInteractive"&&args[2]==="-File"&&
          typeof args[3]==="string"&&
          args[3].endsWith("Install-PlotPickleFactoryWorkers.ps1")&&
          args[4]==="-Status"&&options?.shell===false;
        if(!commandValid)throw Error("COMMAND_MISMATCH");
        return {stdout:JSON.stringify(snapshot.task)};
      },
      dispatcherStatus:async()=>snapshot.dispatcher,
      workerStatus:async()=>snapshot.worker,
    });
    const statusRpc={jsonrpc:"2.0",id:1,method:"tools/call",
      params:{name:"factory_status",arguments:{}}};
    const guest=await mcp.executeMcpRequest(statusRpc,{
      root:privateRoot,controlAuthenticated:false,
      workerOperationsRead:async()=>observation,
    });
    const owner=await mcp.executeMcpRequest(statusRpc,{
      root:privateRoot,controlAuthenticated:true,
      workerOperationsRead:async()=>observation,
    });
    const forbidden=await mcp.executeMcpRequest({
      jsonrpc:"2.0",id:2,method:"tools/call",params:{
        name:"factory_run_named_test",arguments:{
          requestId:"c".repeat(32),expectedHead:snapshot.sourceHead,
          suite:"factory-supervisor-migrate",
        },
      },
    },{root:privateRoot,controlAuthenticated:false});
    let migrationInvoked=false;
    const guarded=await ops.requestOwnerSupervisorMigration({
      platform:"win32",expectedHead:snapshot.sourceHead,
      verifyHead:async()=>snapshot.sourceHead,
      readStatus:async()=>snapshot.supervisor,
      migrate:async()=>{migrationInvoked=true;throw Error("MIGRATION_FORBIDDEN");},
    });
    const checks={
      status:commandValid&&observation?.state==="OBSERVATION_ONLY"&&
        observation.sourceHead===snapshot.sourceHead&&
        observation.tasks?.length===3&&
        observation.dispatcher?.state===snapshot.dispatcher.state&&
        observation.workerFleet?.state===snapshot.worker.state,
      guestDenied:!Object.hasOwn(guest?.result?.structuredContent||{},"workerOperations")&&
        forbidden?.error?.code===-32001,
      authenticated:owner?.result?.structuredContent?.workerOperations?.state===
        "OBSERVATION_ONLY"&&
        owner.result.structuredContent.workerOperations.sourceHead===snapshot.sourceHead,
      migrationDenied:guarded?.state==="BLOCKED"&&!migrationInvoked,
    };
    return safe(Object.values(checks).every(Boolean)?"CANDIDATE_BEHAVIOR_PASSED":
      "CANDIDATE_BEHAVIOR_FAILED",checks);
  }catch{return safe("CANDIDATE_PROBE_UNVERIFIED");}
  finally{if(privateRoot)await rm(privateRoot,{recursive:true,force:true}).catch(()=>{});}
}
const output=await main();
process.stdout.write(JSON.stringify(output)+"\n");
