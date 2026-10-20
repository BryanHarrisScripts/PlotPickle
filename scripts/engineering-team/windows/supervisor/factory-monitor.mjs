#!/usr/bin/env node
/**
 * #3110: standalone deterministic Observer. This is NOT the legacy --serve
 * dispatcher: it NEVER admits issues, writes source, launches Pi/Cline or merges.
 * It can run while PlotPickleSoftwareFactory is stopped.
 */
import { execFile } from "node:child_process";
import { mkdir, lstat, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { factoryObserver, privateFactoryRoot } from "../../mcp/factory-readonly-server.mjs";
import { planSyntheticQaHandoff } from "../../queue/synthetic-qa-handoff.mjs";

const exec=promisify(execFile);
const ROOT=privateFactoryRoot();
const REPO="BryanHarrisScripts/PlotPickle";
const INTERVAL_MS=60_000;
export async function listQaIssues() {
  const {stdout}=await exec("gh",[
    "issue","list","--repo",REPO,"--state","open","--limit","100",
    "--json","number,title,body,labels,state"
  ],{windowsHide:true,encoding:"utf8",timeout:30_000,maxBuffer:1_000_000});
  const result=JSON.parse(String(stdout||""));
  if(!Array.isArray(result)||result.length>100)throw Error("GitHub QA issue list is unverified.");
  return result;
}

export async function persistMonitorSnapshot({root,report}) {
  await mkdir(root,{recursive:true,mode:0o700});
  const info=await lstat(root);
  if(!info.isDirectory()||info.isSymbolicLink())throw Error("Observer root must be an ordinary directory.");
  const target=path.join(root,"observer-monitor.json");
  try {
    const old=await lstat(target);
    if(!old.isFile()||old.isSymbolicLink())throw Error("Observer receipt must be an ordinary file.");
  }catch(e){if(e?.code!=="ENOENT")throw e;}
  const temp=path.join(root,".observer-monitor-"+process.pid+"-"+Date.now()+".tmp");
  try {
    await writeFile(temp,JSON.stringify(report)+"\n",{flag:"wx",mode:0o600});
    await rename(temp,target);
  }finally{await rm(temp,{force:true}).catch(()=>{});}
  return report;
}

export async function runFactoryMonitorOnce({
  root=ROOT,now=Date.now,readObserver=factoryObserver,
  listIssues=listQaIssues,persist=persistMonitorSnapshot,
}={}) {
  // Reuse sanitized MCP evidence; do not inspect private prompt/story content.
  const observedAt=now();
  const observer=await readObserver({root,now});
  let qa;
  try {
    const issues=await listIssues();
    qa=planSyntheticQaHandoff({issues,observer,maxIssues:5});
    if(issues.length===100)qa={...qa,githubResultTruncated:true};
  }catch{
    qa={schemaVersion:1,state:"GITHUB_UNAVAILABLE",candidateCount:0,
      candidates:[],admittedCount:0,queueModified:false,workerStarted:false,
      githubResultTruncated:false};
  }
  const report=Object.freeze({
    schemaVersion:1,mode:"MONITOR_ONLY",observedAt,
    factoryState:observer.factory.state,
    originalWorkerHeartbeatFresh:observer.factory.heartbeatFresh,
    blockedAttemptCount:observer.queue.blockedCount,
    historicalReservations:observer.queue.reservedCount,
    qaState:qa.state,qaCandidates:qa.candidates.map(x=>x.issueNumber),
    qaCandidateCount:qa.candidateCount,
    qaGithubTruncated:qa.githubResultTruncated===true,
    engineeringRoute:"CHATGPT_VIA_AUTHENTICATED_MCP",
    dispatcherReady:false,legacyPiDispatched:false,
    modelInvoked:false,sourceModified:false,queueModified:false,
    issueAdmitted:false,automaticMerge:false,windowsUatVerified:false,
  });
  await persist({root,report});
  return report;
}

async function main(argv=process.argv.slice(2)) {
  if(argv.length!==1||!["--once","--watch"].includes(argv[0]))
    throw Error("Usage: node factory-monitor.mjs --once|--watch");
  do {
    const report=await runFactoryMonitorOnce();
    process.stdout.write(JSON.stringify(report)+"\n");
    if(argv[0]==="--once")return;
    await new Promise(resolve=>setTimeout(resolve,INTERVAL_MS));
  }while(true);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(error=>{
    process.stderr.write("MONITOR_BLOCKED: "+String(error?.message||"unknown").slice(0,180)+"\n");
    process.exitCode=1;
  });
}
