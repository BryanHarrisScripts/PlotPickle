#!/usr/bin/env node
/**
 * #3268 first executable, owner-session recovery slice. This reconciles ONE
 * already-approved Windows Scheduled Task using its reviewed installer.
 * It cannot admit jobs, repair locks, mutate source or authorize a merge.
 *
 * Usage: node supervisor-recovery-agent.mjs --once|--watch
 * No arbitrary paths, task names, commands or caller-supplied source heads.
 */
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {lstat, mkdir, readdir, readFile, writeFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const exec = promisify(execFile);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const SUPERVISOR = path.join(REPO,"scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs");
const INSTALLER = path.join(REPO,"scripts/engineering-team/windows/supervisor/Install-PlotPickleIndependentSupervisor.ps1");
const PRIVATE = path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),"AppData","Local"),
  "PlotPickle","engineering-team");
const SUPERVISOR_STATE = path.join(PRIVATE,"supervisor");
const RECEIPTS = path.join(PRIVATE,"service-manager","supervisor-start");
const SHA = /^[a-f0-9]{40}$/u;
const CONSENT = "ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR";
const blocked = code => Object.freeze({state:"BLOCKED",code,sourceModified:false,
  workerStarted:false,jobReplayed:false,automaticMergeEnabled:false});
const observation = (state,code,extra={}) => Object.freeze({state,code,...extra,
  sourceModified:false,workerStarted:false,jobReplayed:false,automaticMergeEnabled:false});

async function run(file,args,timeout=15000) {
  const {stdout}=await exec(file,args,{cwd:REPO,shell:false,windowsHide:true,
    encoding:"utf8",timeout,maxBuffer:8192});
  if(Buffer.byteLength(stdout||"","utf8")>8192)throw Error("OUTPUT_LIMIT");
  return String(stdout||"").trim();
}
async function readJsonCommand(file,args) {
  const value=JSON.parse(await run(file,args));
  if(!value||typeof value!=="object"||Array.isArray(value))throw Error("NOT_OBJECT");
  return value;
}
async function markerState(file) {
  try {
    const s=await lstat(file);
    return s.isFile()&&!s.isSymbolicLink()?"PRESENT":"UNVERIFIABLE";
  }catch(e){return e?.code==="ENOENT"?"ABSENT":"UNVERIFIABLE";}
}
async function safeDirectory(dir) {
  await mkdir(dir,{recursive:true,mode:0o700});
  const s=await lstat(dir);
  if(!s.isDirectory()||s.isSymbolicLink())throw Error("RECEIPT_ROOT_UNVERIFIABLE");
}
async function safeHistory(now) {
  await safeDirectory(RECEIPTS);
  const files=(await readdir(RECEIPTS)).filter(f=>/^attempt-[a-f0-9-]{36}\.(requested|result)\.json$/u.test(f));
  if(files.length>2000)throw Error("RECEIPT_HISTORY_LIMIT");
  const pending=new Map();
  for(const f of files) {
    const full=path.join(RECEIPTS,f),info=await lstat(full);
    if(!info.isFile()||info.isSymbolicLink()||info.size>2048||info.size<2)
      throw Error("RECEIPT_UNVERIFIABLE");
    const record=JSON.parse(await readFile(full,"utf8"));
    if(!Number.isSafeInteger(record.at)||record.at>now+30000||record.at<0||
       !SHA.test(record.head||""))throw Error("RECEIPT_UNVERIFIABLE");
    const id=f.slice(8,44),kind=f.endsWith(".requested.json")?"requested":"result";
    const e=pending.get(id)||{};
    if(e[kind])throw Error("DUPLICATE_RECEIPT");
    e[kind]=record;pending.set(id,e);
  }
  const records=[...pending.values()];
  if(records.some(r=>!r.requested||(!r.result&&r.requested)))
    return {uncertain:true,attempts:0};
  if(records.some(r=>r.result.requestId!==r.requested.requestId||
    r.result.head!==r.requested.head||
    r.result.at<r.requested.at))throw Error("RECEIPT_MISMATCH");
  const recent=records.filter(r=>r.requested.at>=now-3600000);
  return {uncertain:recent.some(r=>r.result.outcome!=="START_OBSERVED"),
    attempts:recent.length,latestAt:Math.max(0,...recent.map(r=>r.requested.at))};
}
export async function evaluateSupervisorRecovery({platform,head,branch,clean,
  status,task,lock,stop,pause,enabled,history}={}) {
  if(platform!=="win32")return blocked("WINDOWS_ONLY");
  if(!SHA.test(head||"")||branch!=="main"||!clean)return blocked("CLEAN_MAIN_REQUIRED");
  if(!status||status.exactSha!==head)return blocked("SUPERVISOR_SOURCE_MISMATCH");
  if(status.state==="RUNNING")return observation("HEALTHY","SUPERVISOR_HEARTBEAT_PRESENT",{sourceHead:head});
  if(status.state!=="OFFLINE"||status.pauseAcknowledged===true)return blocked("SUPERVISOR_NOT_ELIGIBLE");
  if(!task||task.taskInstalled!==true||task.taskState!=="Ready"||
     task.sourceHead!==head||task.recoveryPolicyVerified!==true)
    return blocked("OWNED_TASK_NOT_READY");
  if(stop!=="ABSENT"||pause!=="ABSENT"||enabled!=="PRESENT")
    return blocked("STOP_PAUSE_OR_CONSENT_UNVERIFIABLE");
  if(lock!=="ABSENT")return blocked("LOCK_PRESENT_REQUIRES_SEPARATE_REVIEW");
  if(!history||history.uncertain||history.attempts>=3)
    return blocked("RECOVERY_RECEIPT_UNCERTAIN_OR_BUDGET_EXHAUSTED");
  if(history.latestAt&&Date.now()-history.latestAt<300000)
    return blocked("RECOVERY_COOLDOWN");
  return observation("ELIGIBLE","REVIEWED_TASK_START_ALLOWED",{sourceHead:head});
}
export async function recoverSupervisorOnce({now=Date.now(),platform=process.platform,
  runner=run}={}) {
  if(platform!=="win32")return blocked("WINDOWS_ONLY");
  let head,branch,clean,status,task,stop,pause,enabled,lock,history;
  try {
    [head,branch]=await Promise.all([
      runner("git",["-C",REPO,"rev-parse","HEAD"]),
      runner("git",["-C",REPO,"branch","--show-current"])
    ]);
    if(!SHA.test(head)||branch!=="main")return blocked("EXACT_MAIN_UNVERIFIED");
    clean=(await runner("git",["-C",REPO,"status","--porcelain","--untracked-files=no"]))==="";
    status=JSON.parse(await runner(process.execPath,[SUPERVISOR,"--status"]));
    task=JSON.parse(await runner("powershell.exe",["-NoProfile","-NonInteractive","-File",INSTALLER,"-Status"]));
    [stop,pause,enabled,lock,history]=await Promise.all([
      markerState(path.join(SUPERVISOR_STATE,"stop-request.json")),
      markerState(path.join(SUPERVISOR_STATE,"pause-request.json")),
      markerState(path.join(SUPERVISOR_STATE,"enabled.json")),
      markerState(path.join(SUPERVISOR_STATE,"running.lock")),
      safeHistory(now)
    ]);
  }catch{return blocked("OBSERVATION_UNVERIFIABLE");}
  const decision=await evaluateSupervisorRecovery({platform,head,branch,clean,
    status,task,stop,pause,enabled,lock,history});
  if(decision.state!=="ELIGIBLE")return decision;
  // Before requesting start, atomically preserve the intent; no uncertain replay.
  let requestId,requestPath;
  try {
    if((await runner("git",["-C",REPO,"rev-parse","HEAD"]))!==head||
       (await runner("git",["-C",REPO,"status","--porcelain","--untracked-files=no"]))!=="")
      return blocked("SOURCE_CHANGED_DURING_RECOVERY");
    if((await markerState(path.join(SUPERVISOR_STATE,"running.lock")))!=="ABSENT"||
       (await markerState(path.join(SUPERVISOR_STATE,"stop-request.json")))!=="ABSENT"||
       (await markerState(path.join(SUPERVISOR_STATE,"pause-request.json")))!=="ABSENT")
      return blocked("RECOVERY_STATE_CHANGED");
    requestId=randomUUID();
    requestPath=path.join(RECEIPTS,"attempt-"+requestId+".requested.json");
    await writeFile(requestPath,JSON.stringify({requestId,at:now,head})+"\n",
      {flag:"wx",mode:0o600});
  }catch{return blocked("RECOVERY_INTENT_UNVERIFIABLE");}
  let outcome="START_UNCONFIRMED";
  try {
    await runner("powershell.exe",["-NoProfile","-NonInteractive","-File",
      INSTALLER,"-Start","-Consent",CONSENT]);
    await new Promise(resolve=>setTimeout(resolve,10000));
    const [current,owned]=await Promise.all([
      readJsonCommand(process.execPath,[SUPERVISOR,"--status"]),
      readJsonCommand("powershell.exe",["-NoProfile","-NonInteractive","-File",INSTALLER,"-Status"])
    ]);
    if(current.state==="RUNNING"&&current.exactSha===head&&
       owned.taskInstalled===true&&owned.taskState==="Running"&&owned.sourceHead===head)
      outcome="START_OBSERVED";
  }catch{ /* uncertainty must be recorded; never silently retry */ }
  try {
    await writeFile(path.join(RECEIPTS,"attempt-"+requestId+".result.json"),
      JSON.stringify({requestId,at:Date.now(),head,outcome})+"\n",
      {flag:"wx",mode:0o600});
  }catch{return blocked("RECOVERY_RESULT_UNPERSISTED_NO_REPLAY");}
  return observation(outcome==="START_OBSERVED"?"RUNNING_OBSERVED":"BLOCKED",
    outcome,{sourceHead:head,processOwnershipVerified:false,
      independentWindowsAcceptance:false});
}
async function persistHeartbeat(result) {
  const root=path.join(PRIVATE,"service-manager");
  await safeDirectory(root);
  const target=path.join(root,"heartbeat.json");
  const before=await markerState(target);
  if(before==="UNVERIFIABLE")throw Error("MANAGER_HEARTBEAT_PATH_UNVERIFIABLE");
  const temp=path.join(root,".heartbeat-"+randomUUID()+".tmp");
  const payload={schemaVersion:1,at:Date.now(),state:result.state,
    code:result.code,sourceHead:SHA.test(result.sourceHead||"")?result.sourceHead:null,
    processOwnershipVerified:false,automaticMergeEnabled:false};
  await writeFile(temp,JSON.stringify(payload)+"\n",{flag:"wx",mode:0o600});
  try {
    const latest=await markerState(target);
    if(latest==="UNVERIFIABLE")throw Error("HEARTBEAT_TARGET_CHANGED");
    const {rename,rm}=await import("node:fs/promises");
    await rename(temp,target);
    return payload;
  }finally{
    const {rm}=await import("node:fs/promises");
    await rm(temp,{force:true}).catch(()=>{});
  }
}
async function main(args=process.argv.slice(2)) {
  if(args.length!==1||!["--once","--watch"].includes(args[0]))
    throw Error("EXACT_RECOVERY_MODE_REQUIRED");
  do {
    const result=await recoverSupervisorOnce();
    await persistHeartbeat(result);
    process.stdout.write(JSON.stringify(result)+"\n");
    if(args[0]==="--once")return;
    await new Promise(resolve=>setTimeout(resolve,60000));
  }while(true);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(()=>{process.stderr.write("SUPERVISOR_RECOVERY_UNVERIFIABLE\n");process.exitCode=1;});
