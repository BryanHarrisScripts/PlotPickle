#!/usr/bin/env node
/* Sanitized, single-comment GitHub heartbeat for the opt-in local factory. */
import { execFile } from "node:child_process";
import { readFile,writeFile,lstat } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import process from "node:process";
const exec=promisify(execFile);
const REPO="BryanHarrisScripts/PlotPickle";
const ISSUE=3110;
const RATE_MS=15*60_000;
const STATES=new Set(["OFFLINE","RUNNING","IDLE","BLOCKED","WAITING_FOR_EXACT_CLEAN_MAIN",
  "WAITING_FOR_ELIGIBLE_ISSUE","WAITING_FOR_PR_VERIFICATION","WAITING_FOR_PROVIDER","WAITING_FOR_PRODUCT_UAT","PR_OPEN","MERGED","OFF"]);
async function readPrivate(file){
  try{
    const s=await lstat(file);
    if(!s.isFile()||s.isSymbolicLink()||s.size>8192)throw Error("Invalid telemetry marker");
    return JSON.parse(await readFile(file,"utf8"));
  }catch(e){if(e?.code==="ENOENT")return null;throw e;}
}
export function renderFactoryHeartbeat(value,now=Date.now()){
 const state=STATES.has(value?.state)?value.state:"OFFLINE";
 const issue=Number.isSafeInteger(value?.issueNumber)&&value.issueNumber>0?value.issueNumber:null;
 const sha=/^[a-f0-9]{40}$/.test(value?.head||"")?value.head:null;
 return `<!-- plotpickle-autonomous-factory-heartbeat:v1 -->
**PLOTPICKLE SOFTWARE FACTORY — ${state}**

- Updated UTC: ${new Date(now).toISOString()}
- Active/last issue: ${issue?"#"+issue:"none"}
- Exact source head: ${sha? "`"+sha+"`":"unknown"}
- Local worker self-report: ${state} (not independently verified by GitHub)
- Automatic merge: DISABLED
- Model route: approved local-only
- Browser Product Gate: UNPROVEN
- Independent on-device proof: UNPROVEN

A heartbeat proves only that the opted-in Windows worker posted this report. An absent or stale update means OFFLINE/UNKNOWN, never PASS. Task progress requires a separate immutable source/PR/CI receipt.`;
}
export async function publishFactoryHeartbeat({root,status,now=Date.now,force=false,run=exec,repoRoot=process.cwd()}){
 if(!root||typeof root!=="string"||!path.isAbsolute(root))throw Error("Private telemetry root required.");
 const marker=path.join(root,"telemetry.json");
 const old=await readPrivate(marker);
 if(!force&&old&&now()-old.at<RATE_MS&&old.state===status.state&&old.issueNumber===status.issueNumber)
   return {state:"UNCHANGED",posted:false};
 const body=renderFactoryHeartbeat(status,now());
 const pathApi=old?.commentId&&Number.isSafeInteger(old.commentId)
   ? `repos/${REPO}/issues/comments/${old.commentId}`
   : `repos/${REPO}/issues/${ISSUE}/comments`;
 const verb=old?.commentId?"PATCH":"POST";
 const result=await run("gh",["api","--method",verb,pathApi,"-f","body="+body],{
   cwd:repoRoot,windowsHide:true,encoding:"utf8",timeout:25_000,maxBuffer:131072
 });
 const json=JSON.parse(String(result.stdout||"{}"));
 if(!Number.isSafeInteger(json.id)||json.id<1)throw Error("GitHub heartbeat receipt missing comment identity.");
 await writeFile(marker,JSON.stringify({schemaVersion:1,commentId:json.id,at:now(),state:status.state,
   issueNumber:status.issueNumber||null})+"\n",{flag:"w",mode:0o600});
 return {state:"PUBLISHED",posted:true,commentId:json.id};
}
