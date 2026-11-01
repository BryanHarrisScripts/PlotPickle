/**
 * #3303 Trusted parent-side native Windows observer for the first fixed
 * authenticated Factory operations gate. This code runs from installed MAIN.
 * The PR is exercised only in a permission-restricted, token-free child.
 */
import {execFile} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
import process from "node:process";
import {promisify} from "node:util";
import {executeOwnedEngineeringCommand} from "./factory-engineering-exec.mjs";
import {inspectOwnerWorkerFleet} from "../../gateway/worker-pool/worker-host.mjs";
import {status as readNativeDispatcherStatus} from "../../gateway/worker-pool/dispatcher/native-dispatcher.mjs";
import {supervisorStatus} from "../../windows/supervisor/unattended-supervisor.mjs";

const exec=promisify(execFile);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..","..","..");
const CHILD=path.join(path.dirname(fileURLToPath(import.meta.url)),"factory-windows-product-gate-probe.mjs");
const SCRIPT=path.join(ROOT,"scripts","engineering-team","windows","workers",
  "Install-PlotPickleFactoryWorkers.ps1");
const SHA=/^[a-f0-9]{40}$/;
const unproven=()=>Object.freeze({state:"UNPROVEN",code:"PRODUCT_GATE_NATIVE_PROBE_UNAVAILABLE"});
const allowedTaskState=new Set(["Ready","Running","Disabled","Queued","Unknown"]);
const allowedWorkerState=new Set(["BLOCKED","RELEASE_GATED","READY","PARKED"]);
const allowedDispatcherState=new Set(["BLOCKED","ONLINE_OBSERVED"]);
const allowedReviewer=new Set(["NOT_INSTALLED","SCM_PRESENT_NOT_QUALIFIED"]);

/** Bounded physical source observation, not a mutable Windows command API. */
export async function collectFactoryWindowsNativeSnapshot({
  expectedHead,candidateHead,repoRoot=ROOT,platform=process.platform,
  run=exec,readWorker=inspectOwnerWorkerFleet,
  readDispatcher=readNativeDispatcherStatus,readSupervisor=supervisorStatus,
}={}){
  if(platform!=="win32"||!SHA.test(expectedHead||"")||!SHA.test(candidateHead||""))
    return null;
  try{
    const [res,w,d,s]=await Promise.all([
      run("powershell.exe",["-NoProfile","-NonInteractive","-File",SCRIPT,"-Status"],{
        cwd:repoRoot,shell:false,windowsHide:true,timeout:20000,maxBuffer:8192,encoding:"utf8",
      }),
      readWorker({repoRoot}),readDispatcher(),readSupervisor(),
    ]);
    const input=JSON.parse(String(res?.stdout||""));
    if(input?.state!=="OBSERVATION_ONLY"||!allowedReviewer.has(input.reviewer)||
       !Array.isArray(input.tasks)||input.tasks.length!==3||
       input.tasks.some((t,i)=>t?.name!==[
         "PlotPickleCodingDispatcher","PlotPickleCodingWorker1","PlotPickleCodingWorker2"][i]||
         !allowedTaskState.has(t.state)||t.processVerified!==false)||
       !allowedWorkerState.has(w?.state)||w.sourceHead!==expectedHead||
       !allowedDispatcherState.has(d?.state)||s?.state!=="RUNNING"||
       s.exactSha!==expectedHead||s.pauseAcknowledged===true)
      return null;
    return Object.freeze({
      sourceHead:expectedHead,candidateHead,
      task:{state:"OBSERVATION_ONLY",reviewer:input.reviewer,
        tasks:input.tasks.map(t=>({name:t.name,state:t.state,processVerified:false}))},
      worker:{state:w.state,sourceHead:w.sourceHead,
        pilotSupervisorObservedOnExactHead:w.pilotSupervisorObservedOnExactHead===true},
      dispatcher:{state:d.state},
      supervisor:{state:"RUNNING",exactSha:expectedHead,pauseAcknowledged:false},
    });
  }catch{return null;}
}

/** Deny unknown candidate behavior; do not add shell or custom scripts. */
export async function probeFactoryWindowsCandidate({
  stage,expectedHead,candidateHead,
  collect=collectFactoryWindowsNativeSnapshot,
  execute=executeOwnedEngineeringCommand,
  nodePath=process.execPath,
  platform=process.platform,
}={}){
  if(platform!=="win32"||typeof stage!=="string"||!path.isAbsolute(stage)||
     !SHA.test(expectedHead||"")||!SHA.test(candidateHead||""))
    return unproven();
  const snapshot=await collect({expectedHead,candidateHead});
  if(!snapshot)return unproven();
  const encoded=Buffer.from(JSON.stringify(snapshot)).toString("base64url");
  if(encoded.length>8192)return unproven();
  // Node Permission Model denies OS process spawning, network and all writes.
  // Only reviewed trusted child and the previously attested stage are readable.
  const result=await execute({
    program:nodePath,cwd:stage,timeoutMs:45000,
    argv:["--no-warnings","--permission",
      "--allow-fs-read="+path.dirname(CHILD),
      "--allow-fs-read="+stage,CHILD,stage,expectedHead,candidateHead,encoded],
  });
  if(result?.timedOut||result?.stopVerified!==true||result?.exitCode!==0)
    return unproven();
  let observation;
  try{observation=JSON.parse(String(result.output||"").trim());}
  catch{return unproven();}
  if(observation?.state!=="OBSERVED"||
     observation.source!=="OWNER_WINDOWS_NATIVE"||
     observation.candidateHead!==candidateHead||
     observation.authStatusVerified!==true||observation.guestDenied!==true||
     observation.migrationDeniedWhileRunning!==true||
     observation.processIsolationVerified!==true||observation.stopUnchanged!==true)
    return unproven();
  return Object.freeze({
    state:"OBSERVED",source:"OWNER_WINDOWS_NATIVE",candidateHead,
    authStatusVerified:true,guestDenied:true,
    migrationDeniedWhileRunning:true,processIsolationVerified:true,
    stopUnchanged:true,
  });
}
