#!/usr/bin/env node
/**
 * #3268 owner-Windows *isolated* native acceptance. Creates only a named
 * disposable Test-PlotPickleRecoveryScratchTask task; NEVER stops/starts
 * the production independent supervisor or the paired MCP tunnel.
 * The recovery function's source/task reads are fixture-injected and are
 * NOT independent verification of the production source or task principal.
 */
import assert from "node:assert/strict";
import {execFile as callbackExec} from "node:child_process";
import {promisify} from "node:util";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import {fileURLToPath} from "node:url";
import {recoverSupervisorOnce} from "./supervisor-recovery-agent.mjs";

const exec=promisify(callbackExec);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../../..");
const SCRIPT=path.join(ROOT,"scripts","engineering-team","windows","services","Test-PlotPickleRecoveryScratchTask.ps1");
const STATE=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),"AppData","Local"),
  "PlotPickle","engineering-team","supervisor");
const RECEIPTS=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),"AppData","Local"),
  "PlotPickle","engineering-team","service-manager","supervisor-start");
const BLOCKED=x=>({state:"BLOCKED",code:x});
function assertIsolated(){
  const stage=path.normalize(ROOT).toLowerCase();
  const privateRoot=path.normalize(process.env.LOCALAPPDATA||"").toLowerCase();
  if(process.platform!=="win32"||process.env.PLOTPICKLE_FACTORY_ENGINEERING_STAGE!=="1"||
     !privateRoot.startsWith(stage+path.sep)||!stage.includes("chat-candidate-stages"))
    throw Error("CANDIDATE_STAGE_ISOLATION_REQUIRED");
}
async function task(tag,operation){
  if(!["Setup","Start","Status","Stop","Crash","Cleanup"].includes(operation))
    throw Error("FIXTURE_OPERATION_DENIED");
  const result=await exec("powershell.exe",["-NoProfile","-NonInteractive",
    "-File",SCRIPT,"-"+operation,"-Tag",tag],{
      cwd:ROOT,shell:false,windowsHide:true,timeout:24000,maxBuffer:8192,encoding:"utf8"
    });
  const val=JSON.parse(String(result.stdout||"").trim());
  assert.ok(val&&typeof val==="object"&&!Array.isArray(val));
  return val;
}
async function main() {
  assertIsolated();
  const head=(await exec("git",["rev-parse","HEAD"],{cwd:ROOT,shell:false})).stdout.trim();
  assert.match(head,/^[a-f0-9]{40}$/u);
  const tag=String(process.pid);
  if(!/^[0-9]{2,10}$/u.test(tag))throw Error("PID_TAG_INVALID");
  let started=false,cleanupVerified=false,attempted=0,failed=null;
  try{
    const setup=await task(tag,"Setup");
    assert.equal(setup.state,"INSTALLED_NOT_STARTED");
    started=true;
    assert.equal((await task(tag,"Status")).taskState,"Ready");
    await mkdir(STATE,{recursive:true});
    const now=Date.now();
    await writeFile(path.join(STATE,"enabled.json"),JSON.stringify({testFixture:true}));
    await writeFile(path.join(STATE,"heartbeat.json"),
      JSON.stringify({sourceHead:head,at:now-25*60000,testFixture:true}));
    async function observed() {
      const snap=await task(tag,"Status");
      return snap;
    }
    async function readStatus(file,args) {
      const snap=await observed();
      if(file===process.execPath) {
        return {state:snap.taskState==="Running"&&snap.processObserved===true&&
          Number.isSafeInteger(snap.heartbeatAt)&&Date.now()-snap.heartbeatAt<5000
          ?"RUNNING":"OFFLINE",exactSha:head};
      }
      if(file==="powershell.exe") {
        return {taskInstalled:true,taskState:snap.taskState,sourceHead:head,
          recoveryPolicyVerified:true,processObserved:snap.processObserved===true};
      }
      throw Error("UNEXPECTED_STATUS_READ");
    }
    async function runner(file,args) {
      if(file==="git") {
        if(args.includes("rev-parse"))return head;
        if(args.includes("--show-current"))return "main"; // synthetic isolated MAIN identity
        if(args.includes("--porcelain"))return "";
        throw Error("GIT_SELECTION_DENIED");
      }
      if(file===process.execPath&&args.at(-1)==="--status")
        return JSON.stringify(await readStatus(file,args));
      if(file==="powershell.exe"&&args.includes("-Start")) {
        attempted++;
        return JSON.stringify(await task(tag,"Start"));
      }
      if(file==="powershell.exe"&&args.includes("-Status"))
        return JSON.stringify(await readStatus(file,args));
      throw Error("UNEXPECTED_COMMAND");
    }
    const first=await recoverSupervisorOnce({now,platform:"win32",runner,readJson:readStatus});
    assert.equal(first.state,"RUNNING_OBSERVED",JSON.stringify(first));
    assert.equal(first.code,"START_OBSERVED");
    assert.equal(attempted,1);
    const running=await observed();
    assert.equal(running.taskState,"Running");
    assert.equal(running.processObserved,true);
    assert.ok(Date.now()-running.heartbeatAt<8000);
    // Deliberate STOP remains stronger than a healthy fixture child.
    await writeFile(path.join(STATE,"stop-request.json"),JSON.stringify({testFixture:true}));
    const stop=await recoverSupervisorOnce({now:Date.now(),platform:"win32",runner,readJson:readStatus});
    assert.equal(stop.code,"STOP_PAUSE_OR_CONSENT_UNVERIFIABLE");
    assert.equal(attempted,1);
    const {rm}=await import("node:fs/promises");
    await rm(path.join(STATE,"stop-request.json"));
    await writeFile(path.join(STATE,"pause-request.json"),JSON.stringify({testFixture:true}));
    const pause=await recoverSupervisorOnce({now:Date.now(),platform:"win32",runner,readJson:readStatus});
    assert.equal(pause.code,"STOP_PAUSE_OR_CONSENT_UNVERIFIABLE");
    assert.equal(attempted,1);
    await rm(path.join(STATE,"pause-request.json"));
    // Real native abrupt termination of only the exactly observed scratch PID.
    assert.equal((await task(tag,"Crash")).state,"SCRATCH_CHILD_TERMINATED");
    let offline=false;
    for(let i=0;i<20;i++){
      const snap=await observed();
      if(snap.taskState==="Ready"){offline=true;break;}
      await new Promise(resolve=>setTimeout(resolve,350));
    }
    assert.equal(offline,true,"scratch task did not stop after owned child crash");
    // Native crash must not automatically create a second start request.
    const afterCrash=await recoverSupervisorOnce({now:Date.now(),platform:"win32",runner,readJson:readStatus});
    assert.equal(afterCrash.state,"BLOCKED");
    assert.equal(attempted,1);
    // Persist an uncertain historical result to prove fail-closed no replay.
    const uncertainId=randomUUID(),at=Date.now()-25*60000;
    await writeFile(path.join(RECEIPTS,"attempt-"+uncertainId+".requested.json"),
      JSON.stringify({requestId:uncertainId,head,at}));
    await writeFile(path.join(RECEIPTS,"attempt-"+uncertainId+".result.json"),
      JSON.stringify({requestId:uncertainId,head,at:at+100,outcome:"START_UNCONFIRMED"}));
    const uncertain=await recoverSupervisorOnce({now:Date.now(),platform:"win32",runner,readJson:readStatus});
    assert.equal(uncertain.state,"BLOCKED");
    assert.equal(uncertain.code,"RECOVERY_RECEIPT_UNCERTAIN_OR_BUDGET_EXHAUSTED");
    assert.equal(attempted,1);
    const recordFiles=await readFile(path.join(RECEIPTS,"heartbeat-unused-never-written"),"utf8").catch(()=>null);
    assert.equal(recordFiles,null);
  }catch(e){failed=e;}
  finally{
    if(started) {
      try {
        await task(tag,"Cleanup");
        cleanupVerified=(await task(tag,"Status")).state==="NOT_INSTALLED";
      }catch(e){failed=failed||e;}
    }
  }
  if(failed||!cleanupVerified){
    process.stderr.write("RECOVERY_ACCEPTANCE_BLOCKED:"+String(failed?.message||"CLEANUP_UNVERIFIED").slice(0,350)+"\n");
    process.exitCode=1;return;
  }
  process.stdout.write(JSON.stringify({state:"NATIVE_SCRATCH_ACCEPTANCE_PASSED",
    candidateHead:head,scope:"ISOLATED_WINDOWS_SCHEDULED_TASK_NOT_PRODUCTION_SUPERVISOR",
    taskStartObserved:true,taskHeartbeatObserved:true,ownedChildCrashObserved:true,
    stopBlocks:true,pauseBlocks:true,uncertainReplayBlocked:true,
    taskCleanupObserved:true,productionSupervisorUntouched:true,
    independentProductionAcceptance:false,releaseAuthorized:false})+"\n");
}
main().catch(e=>{process.stderr.write("RECOVERY_ACCEPTANCE_BLOCKED:"+String(e.message).slice(0,300)+"\n");process.exitCode=1;});
