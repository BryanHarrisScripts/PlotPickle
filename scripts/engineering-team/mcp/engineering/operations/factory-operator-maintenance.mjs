/**
 * #3142: fixed authenticated operator diagnostics and guarded revision migration.
 * Reuses the installed Worker Task -Status, local dispatcher, worker fleet, and
 * existing supervisor migration; no new accounts, shell input or job grants.
 */
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";
import {readFactoryVerificationHead} from "../../factory-named-tests.mjs";
import {inspectOwnerWorkerFleet} from "../../../gateway/worker-pool/worker-host.mjs";
import {status as readNativeDispatcherStatus} from "../../../gateway/worker-pool/dispatcher/native-dispatcher.mjs";
import {supervisorStatus,migrateSupervisorHead} from "../../../windows/supervisor/unattended-supervisor.mjs";

const exec=promisify(execFile);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..","..","..","..");
const SCRIPT=path.join(ROOT,"scripts","engineering-team","windows","workers","Install-PlotPickleFactoryWorkers.ps1");
const SHA=/^[a-f0-9]{40}$/;
const CONSENT="ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR";
const STATES=new Set(["Ready","Disabled","Running","Queued","Unknown"]);
const REVIEWERS=new Set(["NOT_INSTALLED","SCM_PRESENT_NOT_QUALIFIED"]);
const WORKER_STATES=new Set(["RELEASE_GATED","BLOCKED","READY","PARKED"]);
const DISPATCH_STATES=new Set(["BLOCKED","ONLINE_OBSERVED"]);
const blocked=code=>Object.freeze({state:"BLOCKED",code,processVerified:false,
  modelInvoked:false,replayAuthorized:false,automaticMergeEnabled:false});

/** Read-only, fixed commands, available to authenticated owners via existing status. */
export async function inspectOwnerWorkerOperations({
  platform=process.platform,verifyHead=readFactoryVerificationHead,
  run=exec,workerStatus=inspectOwnerWorkerFleet,dispatcherStatus=readNativeDispatcherStatus,
}={}){
  if(platform!=="win32")return blocked("WINDOWS_ONLY");
  let head;
  try{head=await verifyHead({repoRoot:ROOT});}
  catch{return blocked("EXACT_MAIN_UNVERIFIED");}
  if(!SHA.test(head||""))return blocked("EXACT_MAIN_UNVERIFIED");
  let task,dispatcher,worker;
  try{
    const [result,observedDispatcher,observedWorker]=await Promise.all([
      run("powershell.exe",["-NoProfile","-NonInteractive","-File",SCRIPT,"-Status"],{
        cwd:ROOT,windowsHide:true,shell:false,timeout:20_000,maxBuffer:8192,encoding:"utf8",
      }),dispatcherStatus(),workerStatus({repoRoot:ROOT}),
    ]);
    if(Buffer.byteLength(String(result?.stdout||""),"utf8")>8192)
      return blocked("WORKER_STATUS_UNVERIFIED");
    task=JSON.parse(String(result?.stdout||""));
    dispatcher=observedDispatcher;worker=observedWorker;
  }catch{return blocked("WORKER_STATUS_UNVERIFIED");}
  // Reject foreign/unexpected task names and schemas; never disclose PIDs,
  // Windows usernames, arguments, executable paths, host pairing or secrets.
  const names=["PlotPickleCodingDispatcher","PlotPickleCodingWorker1","PlotPickleCodingWorker2"];
  if(task?.state!=="OBSERVATION_ONLY"||!Array.isArray(task.tasks)||
      task.tasks.length!==3||!task.tasks.every((t,i)=>
        t?.name===names[i]&&STATES.has(t.state)&&t.processVerified===false)||
      !REVIEWERS.has(task.reviewer)||
      !DISPATCH_STATES.has(dispatcher?.state)||
      !WORKER_STATES.has(worker?.state)||worker?.sourceHead!==head)
    return blocked("WORKER_STATUS_UNVERIFIED");
  try{if(await verifyHead({repoRoot:ROOT})!==head)return blocked("EXACT_MAIN_CHANGED");}
  catch{return blocked("EXACT_MAIN_CHANGED");}
  return Object.freeze({state:"OBSERVATION_ONLY",sourceHead:head,
    reviewer:task.reviewer,
    tasks:Object.freeze(task.tasks.map((t,i)=>Object.freeze({name:names[i],state:t.state,processVerified:false}))),
    dispatcher:Object.freeze({state:dispatcher.state,
      code:dispatcher.state==="BLOCKED"?"DISPATCH_OFFLINE_OR_UNVERIFIABLE":null,
      onlineObserved:dispatcher.state==="ONLINE_OBSERVED",
      processVerified:false}),
    workerFleet:Object.freeze({state:worker.state,
      pilotSupervisorObservedOnExactHead:worker.pilotSupervisorObservedOnExactHead===true,
      onlineCodingWorkers:null,workerProcessVerified:false,independentVerification:false,automaticMergeEnabled:false}),
    modelInvoked:false,replayAuthorized:false,automaticMergeEnabled:false});
}

/** One authenticated call replaces a manual --migrate; never starts or replays. */
export async function requestOwnerSupervisorMigration({
  expectedHead,platform=process.platform,verifyHead=readFactoryVerificationHead,
  readStatus=supervisorStatus,migrate=migrateSupervisorHead,
}={}){
  if(platform!=="win32")return blocked("WINDOWS_ONLY");
  if(!SHA.test(expectedHead||""))return blocked("SUPERVISOR_MIGRATION_SOURCE_UNVERIFIED");
  let head,observed;
  try{[head,observed]=await Promise.all([verifyHead({repoRoot:ROOT}),readStatus()]);}
  catch{return blocked("SUPERVISOR_MIGRATION_STATUS_UNVERIFIED");}
  if(head!==expectedHead)return blocked("SUPERVISOR_MIGRATION_SOURCE_UNVERIFIED");
  if(observed?.state!=="OFFLINE"||observed.pauseAcknowledged===true||
     !SHA.test(observed?.exactSha||"")||observed.exactSha===expectedHead)
    return blocked("SUPERVISOR_MIGRATION_OFFLINE_REQUIRED");
  try{if(await verifyHead({repoRoot:ROOT})!==expectedHead)
    return blocked("SUPERVISOR_MIGRATION_SOURCE_UNVERIFIED");}
  catch{return blocked("SUPERVISOR_MIGRATION_SOURCE_UNVERIFIED");}
  let result;
  try{result=await migrate({fromHead:observed.exactSha,consent:CONSENT,platform});}
  catch{return blocked("SUPERVISOR_MIGRATION_UNVERIFIED");}
  if(result?.state!=="HEAD_MIGRATED_NOT_RUNNING"||
     result.exactSha!==expectedHead||result.workerProcessVerified!==false||
     result.issueReplayed!==false||result.automaticMergeEnabled!==false)
    return blocked("SUPERVISOR_MIGRATION_UNVERIFIED");
  try{if(await verifyHead({repoRoot:ROOT})!==expectedHead)
    return blocked("SUPERVISOR_MIGRATION_UNVERIFIED");}
  catch{return blocked("SUPERVISOR_MIGRATION_UNVERIFIED");}
  return Object.freeze({state:"TEST_PASSED",
    code:"SUPERVISOR_HEAD_MIGRATED_NOT_RUNNING",sourceHead:expectedHead,
    workerProcessVerified:false,modelInvoked:false,
    issueReserved:false,replayAuthorized:false,automaticMergeEnabled:false});
}
