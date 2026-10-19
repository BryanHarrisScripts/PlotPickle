#!/usr/bin/env node
/**
 * #3110 Opt-in, fail-closed, persistent engineering backlog admission worker.
 * A GitHub issue is NEVER executable code. This worker admits a labeled ticket
 * to a private durable queue and refuses to invent an implementation adapter.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename, lstat, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { fileURLToPath } from "node:url";

const THIS=fileURLToPath(import.meta.url);
const exec=promisify(execFile);
const REPO="BryanHarrisScripts/PlotPickle";
const CONTROL="plotpickle:factory-ready";
const ISSUE=/^[1-9][0-9]{0,7}$/;
const ID=/^[a-f0-9]{64}$/;
const HEARTBEAT_MS=15_000;
const POLL_MS=60_000;
const WAIT=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const root=()=>path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),"AppData","Local"),"PlotPickle","engineering-team","factory");
const digest=(value)=>createHash("sha256").update(value).digest("hex");
const safePath=(base,file)=>path.join(base,file);

async function loadJson(file) {
  try {
    const stat=await lstat(file);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>32768) throw Error("INVALID_PRIVATE_RECORD");
    return JSON.parse(await readFile(file,"utf8"));
  } catch(e) {if(e?.code==="ENOENT")return null;throw e;}
}
async function atomicJson(file,obj) {
  const temp=file+"."+process.pid+".tmp";
  await writeFile(temp,JSON.stringify(obj,null,2)+"\n",{flag:"wx",mode:0o600});
  await rename(temp,file);
}
export function selectFactoryIssue(issues,completed=[]) {
  const seen=new Set(completed);
  return (Array.isArray(issues)?issues:[]).filter(x=>
    ISSUE.test(String(x?.number||"")) && x?.state==="open"
    && Array.isArray(x?.labels)
    && x.labels.some(l=>(typeof l==="string"?l:l?.name)===CONTROL)
    && !x.labels.some(l=>/^(on hold|hold|blocked|parent-only)$/i.test(typeof l==="string"?l:l?.name||""))
    && !seen.has(x.number)
  ).sort((a,b)=>a.number-b.number)[0]||null;
}
export function admissionRecord(issue,head,time=Date.now()) {
  if(!ISSUE.test(String(issue?.number||""))||!ID.test(head))throw Error("INVALID_ADMISSION");
  const id=digest(REPO+":"+issue.number+":"+head);
  return Object.freeze({
    schemaVersion:1,id,issueNumber:issue.number,sourceHead:head,
    admittedAt:new Date(time).toISOString(),state:"WAITING_FOR_IMPLEMENTER",
    modelDispatchAllowed:false,sourceMutationAllowed:false,
    mergeEligible:false,independentVerification:false,attempt:1,
    reason:"AUTONOMOUS_PATCH_ADAPTER_NOT_PROVEN"
  });
}
function allowedArgs(args){
  if(args.length===1 && ["--status","--disable","--enable","--run-once","--run"].includes(args[0]))return args[0];
  throw Error("Expected one of --enable, --disable, --status, --run-once, --run");
}
async function gh(args) {
  const {stdout}=await exec("gh",args,{timeout:20000,maxBuffer:1024*1024,windowsHide:true,shell:false});
  return stdout;
}
async function gitHead(){
  const {stdout}=await exec("git",["rev-parse","HEAD"],{cwd:path.resolve(path.dirname(THIS),"../../.."),timeout:10000,windowsHide:true,shell:false});
  const head=stdout.trim().toLowerCase();if(!/^[a-f0-9]{40}$/.test(head))throw Error("HEAD_UNVERIFIED");return head;
}
async function state(base) {
  const enable=await loadJson(safePath(base,"enabled.json"));
  const disabled=await loadJson(safePath(base,"disabled.json"));
  const current=await loadJson(safePath(base,"current.json"));
  const heartbeat=await loadJson(safePath(base,"heartbeat.json"));
  const live=heartbeat?.at && Date.now()-Date.parse(heartbeat.at)<HEARTBEAT_MS*3;
  return {enabled:enable?.consent==="ENABLE_BOUNDED_FACTORY"&&!disabled,
    state:disabled?"DISABLED":live?"RUNNING":enable?"OFFLINE":"OFF",
    current:current?{issueNumber:current.issueNumber,state:current.state,id:current.id}:null,
    heartbeatAt:heartbeat?.at||null,autonomousPatchEnabled:false};
}
async function tick(base,cli={gh,gitHead}) {
  const status=await state(base);
  if(!status.enabled)return {state:"OFF",reason:"NOT_ENABLED"};
  const current=await loadJson(safePath(base,"current.json"));
  if(current) return {state:current.state,issueNumber:current.issueNumber,reason:current.reason};
  const head=await cli.gitHead();
  const output=await cli.gh(["api",`repos/${REPO}/issues`,"-f","state=open","-f","per_page=100","--method","GET"]);
  const issues=JSON.parse(output);
  const issue=selectFactoryIssue(issues);
  if(!issue)return {state:"WAITING_FOR_ISSUE",reason:"NO_EXPLICITLY_ADMITTED_ISSUE"};
  const receipt=admissionRecord(issue,head);
  await atomicJson(safePath(base,"current.json"),receipt);
  await atomicJson(safePath(base,"admission-"+receipt.id+".json"),receipt);
  return {state:receipt.state,issueNumber:receipt.issueNumber,reason:receipt.reason};
}
async function main() {
  const mode=allowedArgs(process.argv.slice(2)),base=root();
  if(mode==="--status"){process.stdout.write(JSON.stringify(await state(base))+"\n");return;}
  await mkdir(base,{recursive:true,mode:0o700});
  if(mode==="--enable"){
    if(await loadJson(safePath(base,"disabled.json")))throw Error("LOCALLY_DISABLED_CANNOT_REENABLE_SILENTLY");
    await writeFile(safePath(base,"enabled.json"),JSON.stringify({consent:"ENABLE_BOUNDED_FACTORY",at:new Date().toISOString()})+"\n",{flag:"wx",mode:0o600});
    process.stdout.write("ENABLED_ADMISSION_ONLY; no autonomous code mutation or model spend\n");return;
  }
  if(mode==="--disable"){
    await writeFile(safePath(base,"disabled.json"),JSON.stringify({at:new Date().toISOString(),reason:"LOCAL_OPERATOR_STOP"})+"\n",{flag:"wx",mode:0o600});
    process.stdout.write("DISABLED; running loop stops at its next safe boundary\n");return;
  }
  if(mode==="--run-once"){process.stdout.write(JSON.stringify(await tick(base))+"\n");return;}
  const exclusive=safePath(base,"worker.lock");
  const handle=await writeFile(exclusive,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()})+"\n",{flag:"wx",mode:0o600});
  await handle.close();
  try{
    while((await state(base)).enabled){
      await atomicJson(safePath(base,"heartbeat.json"),{at:new Date().toISOString(),pid:process.pid});
      let receipt;try{receipt=await tick(base);}catch{receipt={state:"BLOCKED",reason:"GITHUB_OR_PRIVATE_STATE_UNAVAILABLE"};}
      process.stdout.write(JSON.stringify(receipt)+"\n");
      for(let i=0;i<POLL_MS/HEARTBEAT_MS;i++){
        if(!(await state(base)).enabled)break;
        await WAIT(HEARTBEAT_MS);
        await atomicJson(safePath(base,"heartbeat.json"),{at:new Date().toISOString(),pid:process.pid});
      }
    }
  }finally{
    // Crash leaves lock as a no-replay barrier; operator must diagnose it.
    await atomicJson(safePath(base,"stopped.json"),{at:new Date().toISOString(),reason:"RUNNER_EXITED"});
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===THIS)main().catch(()=>{
  process.stderr.write("Software Factory blocked; inspect private state, do not auto-replay.\n");process.exitCode=1;
});
