#!/usr/bin/env node
/**
 * #3110: opt-in durable Windows engineering queue. No agent/model is launched
 * on import, status, install, disabled state, or without a local issue allowlist.
 * A reserved uncertain attempt is never replayed, even after a host restart.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, lstat, unlink, rename } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { publishFactoryHeartbeat } from "./autonomous-telemetry.mjs";
import { versionAtLeast } from "../../pi-version.mjs";
import { reconcileApprovedDocsPRs } from "./autonomous-pr-review.mjs";
import { checkFactoryDependencyProof } from "../queue/factory-dependency-preflight.mjs";

const runFile = promisify(execFile);
const THIS = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(THIS), "..", "..", "..");
const ROOT = path.join(process.env.LOCALAPPDATA || (process.platform === "win32"
  ? path.join(os.homedir(), "AppData", "Local")
  : path.join(os.homedir(), ".local", "share")), "PlotPickle", "engineering-team", "autonomous-queue");
const REPOSITORY = "BryanHarrisScripts/PlotPickle";
const CONSENT = "PLOTPICKLE_AUTONOMOUS_ENGINEERING";
const SHA = /^[a-f0-9]{40}$/;
const MAX_ISSUES = 80;
const MAX_ADMISSION_BATCH = 5;
const MIN_FACTORY_PI_VERSION = "1.3.0";
const POLL_MS = 60_000;
const SHA256 = (value) => createHash("sha256").update(value).digest("hex");

export function parseQueueCommand(argv) {
  const modes = ["--enable", "--admit", "--disable", "--status", "--once", "--serve", "--preview", "--plan-latest", "--authorize-retry"];
  const selected = modes.filter(flag => argv.includes(flag));
  if (selected.length !== 1 || argv.filter(x => x === selected[0]).length !== 1) {
    throw new Error("Exactly one queue operation is required.");
  }
  const values = {};
  for (let i=0;i<argv.length;i++) {
    if (selected.includes(argv[i])) continue;
    const key=argv[i];
    if (key==="--merge-docs"){
      if(values[key]!==undefined)throw new Error("Duplicate merge policy.");
      values[key]=true;continue;
    }
    if (!["--issues","--consent","--issue","--base"].includes(key) || values[key] !== undefined || !argv[i+1] || argv[i+1].startsWith("--")) {
      throw new Error("Unknown, repeated or missing queue argument.");
    }
    values[key]=argv[++i];
  }
  const mode=selected[0].slice(2);
  if (mode !== "enable" && mode !== "admit" && mode !== "authorize-retry" && Object.keys(values).length)
    throw new Error("Only local authorization commands accept extra options.");
  if ((mode === "enable" || mode === "admit") && (values["--issue"] || values["--base"]))throw new Error("Unknown issue authorization option.");
  if (mode === "admit" && values["--merge-docs"]) throw new Error("Admitting issues cannot change merge authority.");
  if (mode === "authorize-retry" &&
    (Object.keys(values).length!==3 || values["--issue"]!=="3141" ||
      !SHA.test(values["--base"]||"") || values["--consent"]!==CONSENT ||
      values["--issues"] || values["--merge-docs"])) {
    throw new Error("Retry requires explicit --issue 3141 --base SHA and local consent.");
  }
  if ((mode === "enable" || mode === "admit") && values["--consent"] !== CONSENT)
    throw new Error("Explicit local autonomous engineering consent is required.");
  const items = mode === "enable" || mode === "admit" ? String(values["--issues"] || "").split(",") : [];
  const issues=items.map(x=>Number(x));
  if ((mode === "enable" || mode === "admit") && (!items.length || items.length > (mode === "admit" ? MAX_ADMISSION_BATCH : MAX_ISSUES) || new Set(issues).size !== issues.length
    || issues.some((n,i)=> !/^\d{1,7}$/.test(items[i]) || !Number.isSafeInteger(n) || n < 1))) {
    throw new Error("A finite, unique CSV issue allowlist is required; max 80.");
  }
  return Object.freeze({mode, issues,mergeDocsOnly:values["--merge-docs"]===true,
    retryIssue:mode==="authorize-retry"?3141:null,
    retryBase:mode==="authorize-retry"?values["--base"]:null});
}

async function ordinaryJson(file, max=32_768) {
  const info=await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 2 || info.size > max) throw new Error("Nonordinary or oversized private factory file.");
  return JSON.parse(await readFile(file,"utf8"));
}

async function safeJson(file) {
  try { return await ordinaryJson(file); }
  catch(e) { if(e?.code==="ENOENT") return null; throw e; }
}

async function record(root, filename, value, flag="wx") {
  await mkdir(root,{recursive:true,mode:0o700});
  await writeFile(path.join(root,filename),JSON.stringify(value,null,2)+"\n",{flag,mode:0o600});
}

export function eligibleIssue(issue, allowed) {
  const n=Number(issue?.number);
  if(!Number.isSafeInteger(n) || !allowed.includes(n) || issue?.state !== "OPEN") return false;
  const title=String(issue?.title||"");
  if(!title || title.length>240 || /^(?:\[ON HOLD\]|\[HOLD\]|\[BLOCKED\]|HOLD:|\[OSS RADAR\])/i.test(title)) return false;
  const labels=(issue?.labels||[]).map(l=>String(typeof l==="string"?l:l?.name||"").toLowerCase());
  return !labels.some(l=>l==="hold"||l==="on hold"||l==="factory:blocked");
}

export function pickNextIssue(issues, allowed, reserved=[]) {
  for(const number of allowed) {
    if(reserved.includes(number))continue;
    const issue=issues.find(x=>Number(x.number)===number);
    if(eligibleIssue(issue,allowed))return Object.freeze({number,title:issue.title});
  }
  return null;
}

/** A public GitHub issue listing is a proposal, never an execution grant. */
export function planNewestFirst(issues,{maxIssues=MAX_ISSUES}={}) {
  if(!Array.isArray(issues)||!Number.isSafeInteger(maxIssues)||maxIssues<1||maxIssues>MAX_ISSUES)
    throw new Error("Finite read-only issue list and capacity required.");
  const seen=new Set(),eligible=[],excluded=[];
  for(const issue of issues) {
    const number=Number(issue?.number);
    if(!Number.isSafeInteger(number)||number<1||seen.has(number)) {
      excluded.push({number:Number.isSafeInteger(number)?number:null,reason:"INVALID_OR_DUPLICATE"});
      continue;
    }
    seen.add(number);
    if(!eligibleIssue(issue,[number])) {
      excluded.push({number,reason:"CLOSED_HOLD_OR_BLOCKED"});
      continue;
    }
    eligible.push({number,title:String(issue.title).slice(0,120)});
  }
  eligible.sort((a,b)=>b.number-a.number);
  const selected=eligible.slice(0,maxIssues);
  return Object.freeze({
    state:"PLAN_ONLY",order:"NEWEST_ISSUE_NUMBER_FIRST",
    listedIssues:issues.length,totalEligible:eligible.length,
    proposedCount:selected.length,
    truncatedAtGithubLimit:issues.length>=100,
    exceedsSingleApproval:eligible.length>maxIssues,
    proposedIssues:selected,excluded,
    issuesCsv:selected.map(x=>x.number).join(","),
    userApprovalRequired:true,queueModified:false,workerStarted:false,
  });
}

export async function readFactoryStatus({root=ROOT,now=Date.now}={}) {
  if(existsSync(path.join(root,"disabled.json")))return Object.freeze({state:"OFF",enabled:false,reason:"LOCALLY_DISABLED"});
  const config=await safeJson(path.join(root,"config.json"));
  if(!config)return Object.freeze({state:"OFF",enabled:false,reason:"NOT_ENABLED"});
  if(!config.enabled || config.schemaVersion!==1 || config.repository!==REPOSITORY)throw new Error("Factory configuration malformed.");
  const heartbeat=await safeJson(path.join(root,"heartbeat.json"));
  const fresh=Number.isFinite(heartbeat?.at)&&heartbeat.at<=now()+2_000&&now()-heartbeat.at<=120_000;
  return Object.freeze({state:fresh?heartbeat.state:"OFFLINE",enabled:true,
    issueCount:config.issues.length,activeIssue:fresh?heartbeat.issueNumber||null:null,
    lastHeartbeat:heartbeat?.at||null,localAgentProven:false,productGateProven:false,
    automaticMergeEnabled:false,
    documentationAutoMergeEnabled:config.mergeDocsOnly===true});
}

export async function enableFactory({root=ROOT,issues,mergeDocsOnly=false,now=Date.now}={}) {
  if(!Array.isArray(issues)||issues.length<1||issues.length>MAX_ISSUES||new Set(issues).size!==issues.length
    ||issues.some(x=>!Number.isSafeInteger(x)||x<1))throw new Error("Valid local issue allowlist required.");
  if(existsSync(path.join(root,"disabled.json")))throw new Error("Factory has been locally disabled; resetting requires review.");
  await record(root,"config.json",{schemaVersion:1,enabled:true,repository:REPOSITORY,
    issues,localOnly:true,maxCloudCostUsd:0,automaticMergeEnabled:false,
    mergeDocsOnly:mergeDocsOnly===true,createdAt:now()}, "wx");
  return readFactoryStatus({root,now});
}

/**
 * Append a finite, owner-approved batch without changing any existing job,
 * retry ledger, merge authority or original allowlist order. Must run while
 * the Windows worker is stopped. Never infer execution consent from issue text.
 */
export async function admitFactoryIssues({root=ROOT,issues,consent,github=createQueueGitHubClient(),now=Date.now}={}) {
  if(consent!==CONSENT)throw new Error("Explicit local owner consent is required for each admission batch.");
  if(!Array.isArray(issues)||!issues.length||issues.length>MAX_ADMISSION_BATCH||
    new Set(issues).size!==issues.length||issues.some(n=>!Number.isSafeInteger(n)||n<1))
    throw new Error("Admission requires 1-5 unique numeric issue IDs.");
  if(existsSync(path.join(root,"disabled.json")))throw new Error("Local STOP is active; admission denied.");
  if(existsSync(path.join(root,"service.lock")))
    throw new Error("Stop the Windows Factory worker before admitting new issues.");
  const configFile=path.join(root,"config.json");
  const config=await ordinaryJson(configFile);
  if(config.schemaVersion!==1||config.repository!==REPOSITORY||config.enabled!==true||
    config.localOnly!==true||config.maxCloudCostUsd!==0||
    config.automaticMergeEnabled!==false||config.mergeDocsOnly===true||
    !Array.isArray(config.issues)||config.issues.length<1||
    !config.issues.every(n=>Number.isSafeInteger(n)&&n>0)||
    !Array.isArray(config.admissions||[]) || (config.admissions||[]).length>MAX_ISSUES)
    throw new Error("Factory permission policy is unexpected; manual review required.");
  if(config.issues.length+issues.length>MAX_ISSUES||
    issues.some(n=>config.issues.includes(n)))
    throw new Error("Issue already admitted or queue capacity exceeded.");
  const jobs=path.join(root,"jobs");
  for(const n of issues){
    if(existsSync(path.join(jobs,"issue-"+n+".json"))||
       existsSync(path.join(jobs,"result-"+n+".json")))
      throw new Error("Existing job evidence cannot be replayed or overwritten.");
  }
  const live=await github.issues();
  if(!Array.isArray(live)||issues.some(n=>!live.some(issue=>eligibleIssue(issue,[n]))))
    throw new Error("Every admitted issue must be open, unblocked and independently listed by GitHub.");
  const entry={at:now(),issues:[...issues],consent:"LOCAL_OWNER",mergingAuthorized:false};
  const next={...config,issues:[...config.issues,...issues],
    admissions:[...(config.admissions||[]),entry]};
  const temporary=path.join(root,"config-admission-"+process.pid+"-"+String(entry.at)+".tmp");
  await writeFile(temporary,JSON.stringify(next,null,2)+"\n",{flag:"wx",mode:0o600});
  try{await rename(temporary,configFile);}
  finally{await unlink(temporary).catch(()=>{});}
  return Object.freeze({state:"ISSUES_ADMITTED",added:[...issues],
    issueCount:next.issues.length,workerStarted:false,priorReceiptsPreserved:true,
    automaticMergeEnabled:false,documentationAutoMergeEnabled:false});
}

export async function disableFactory({root=ROOT,now=Date.now}={}) {
  const config=await safeJson(path.join(root,"config.json"));
  if(!config)return Object.freeze({state:"OFF",enabled:false,reason:"NOT_ENABLED"});
  if(!existsSync(path.join(root,"disabled.json")))
    await record(root,"disabled.json",{schemaVersion:1,disabledAt:now(),enabled:false},"wx");
  return readFactoryStatus({root,now});
}

/**
 * A recovered attempt is NEVER a replay. Inspection is source-/branch-bound
 * and reads the original isolated worktree without changing/deleting it.
 */
async function inspectFailedFactoryWorktree({root,original}) {
  const directory=path.join(root,"worktrees",
    "issue-3141-"+original.sourceHead.slice(0,10));
  const stat=await lstat(directory);
  if(!stat.isDirectory()||stat.isSymbolicLink())
    throw new Error("Original isolated worktree is not an ordinary directory.");
  const options={cwd:REPO_ROOT,encoding:"utf8",windowsHide:true,maxBuffer:65536,timeout:30000};
  const status=await runFile("git",["-C",directory,"status","--porcelain","--untracked-files=all"],options);
  if(String(status.stdout||"").trim())
    throw new Error("Original worktree contains unreviewed changes; retry denied.");
  const oldBranch="factory/issue-3141-"+original.sourceHead.slice(0,10);
  const remote=await runFile("git",["ls-remote","--heads","origin",oldBranch],options);
  if(String(remote.stdout||"").trim())
    throw new Error("An original attempt branch exists remotely; retry denied.");
  const prs=await runFile("gh",["pr","list","--repo",REPOSITORY,
    "--state","all","--head",oldBranch,"--json","number"],options);
  if(JSON.parse(String(prs.stdout||"[]")).length)
    throw new Error("An earlier factory PR is discoverable; retry denied.");
  return true;
}

/** Authorize a distinct attempt #2, without replacing original job or STOP evidence. */
export async function authorizeFactoryRetry({root=ROOT,issueNumber=3141,expectedHead,
  github=createQueueGitHubClient(),inspect=inspectFailedFactoryWorktree,
  now=Date.now}={}) {
  if(issueNumber!==3141||!SHA.test(expectedHead||""))
    throw new Error("Retry restricted to issue #3141 and an exact 40-character main head.");
  if(existsSync(path.join(root,"disabled.json")))
    throw new Error("A local STOP exists. No retry authorization permitted.");
  const config=await ordinaryJson(path.join(root,"config.json"));
  if(config?.schemaVersion!==1||config.repository!==REPOSITORY||config.enabled!==true ||
    config.mergeDocsOnly===true||config.automaticMergeEnabled===true ||
    config.issues?.length!==1||config.issues[0]!==3141)
    throw new Error("Retry requires the original single-issue, no-auto-merge permission.");
  const lock=await safeJson(path.join(root,"service.lock"));
  if(lock){
    if(!Number.isSafeInteger(lock.pid)||lock.pid<1)
      throw new Error("Unverifiable service process lock; retry denied.");
    let stillRunning=false;
    try {process.kill(lock.pid,0);stillRunning=true;}
    catch(error) {
      if(error?.code!=="ESRCH")
        throw new Error("Worker process ownership uncertain; retry denied.");
    }
    if(stillRunning)
      throw new Error("Factory worker still alive; stop scheduled task before approval.");
  }
  const jobs=path.join(root,"jobs");
  const original=await ordinaryJson(path.join(jobs,"issue-3141.json"));
  const result=await ordinaryJson(path.join(jobs,"result-3141.json"));
  if(original.issueNumber!==3141||original.attempt!==1||!SHA.test(original.sourceHead||"") ||
    original.replayAuthorized!==false||result.issueNumber!==3141 ||
    result.head!==original.sourceHead||result.state!=="BLOCKED" ||
    result.code!=="SOURCE_OR_BUILD_OR_PROVIDER_FAILURE" ||
    result.replayAuthorized!==false||result.prUrl!==null)
    throw new Error("Original failed attempt has unverified or uncertain outcomes.");
  if(original.sourceHead===expectedHead)
    throw new Error("Retry must use a new independently checked main head.");
  if(existsSync(path.join(jobs,"issue-3141-attempt-2.json")) ||
    existsSync(path.join(jobs,"result-3141-attempt-2.json")))
    throw new Error("Second attempt is already reserved or completed.");
  await inspect({root,original,result});
  const exact=await github.exactHead();
  if(exact!==expectedHead)
    throw new Error("Fresh clean main did not match approved retry head.");
  const approval={schemaVersion:1,issueNumber:3141,attempt:2,
    priorHead:original.sourceHead,sourceHead:expectedHead,
    approvedAt:now(),originalJobPreserved:true,allowMerge:false,localOnly:true};
  await record(jobs,"retry-authorized-3141.json",approval,"wx");
  return Object.freeze({state:"RETRY_AUTHORIZED",issueNumber:3141,attempt:2,
    priorHead:original.sourceHead,sourceHead:expectedHead,
    workerStarted:false,originalJobPreserved:true,automaticMergeAuthorized:false});
}

export function createQueueGitHubClient({repoRoot=REPO_ROOT,exec=runFile}={}) {
  async function call(program,args,timeout=30_000) {
    const x=await exec(program,args,{cwd:repoRoot,encoding:"utf8",windowsHide:true,maxBuffer:512_000,timeout});
    return String(x.stdout||"").trim();
  }
  return Object.freeze({
    async exactHead() {
      const [before,branch,dirty]=await Promise.all([
        call("git",["rev-parse","HEAD"]),call("git",["branch","--show-current"]),
        call("git",["status","--porcelain","--untracked-files=no"])
      ]);
      if(!SHA.test(before)||branch!=="main"||dirty)return null;
      // After an authorized merge, follow main automatically. Never reset or
      // rewrite local work; a non-fast-forward becomes WAITING rather than a force.
      await call("git",["fetch","origin","main"],45_000);
      await call("git",["merge","--ff-only","origin/main"],45_000);
      const head=await call("git",["rev-parse","HEAD"]);
      return SHA.test(head)?head:null;
    },
    async issues() {
      const raw=await call("gh",["issue","list","--repo",REPOSITORY,"--state","open","--limit","100",
        "--json","number,title,labels,state"]);
      return JSON.parse(raw);
    },
    async pendingFactoryPRs() {
      const raw=await call("gh",["pr","list","--repo",REPOSITORY,"--state","open","--limit","100",
        "--json","headRefName,isDraft,number"]);
      const prs=JSON.parse(raw);
      if(!Array.isArray(prs))throw new Error("Factory PR list malformed.");
      return prs.filter(p=>/^factory\/issue-\d+-[a-f0-9]{10}(?:-a2)?$/.test(p.headRefName||"")).length;
    }
  });
}

/** Guard the Pi virtual-model extension API before reserving an irreversible job. */
export function factoryPiVersionGate(pi) {
  if(pi?.ready!==true)return Object.freeze({ready:false,code:"PI_NOT_INSTALLED"});
  const version=String(pi.version||"").trim();
  if(!/^\d+\.\d+\.\d+(?:$|[-+])/u.test(version)||
     !versionAtLeast(version,MIN_FACTORY_PI_VERSION))
    return Object.freeze({ready:false,code:"PI_VERSION_UNSUPPORTED"});
  return Object.freeze({ready:true,code:"PI_VERSION_ACCEPTED"});
}

export async function probeLocalCoderRoute() {
  if(process.platform!=="win32")return Object.freeze({ready:false,code:"WINDOWS_ONLY"});
  try{
    const {resolvePiExecutable,resolvePiLocalRuntime}=await import("../../pi-worker-runtime.mjs");
    const pi=await resolvePiExecutable();
    const versionGate=factoryPiVersionGate(pi);
    if(!versionGate.ready)return versionGate;
    await resolvePiLocalRuntime();
    return Object.freeze({ready:true,code:"READY_LOCAL_ONLY"});
  }catch{return Object.freeze({ready:false,code:"APPROVED_LOCAL_MODEL_UNAVAILABLE"});}
}

export async function runFactoryCycle({root=ROOT,github=createQueueGitHubClient(),dispatch,
  preflight=probeLocalCoderRoute,publish=publishFactoryHeartbeat,
  reconcile=reconcileApprovedDocsPRs,now=Date.now,
  dependencyPreflight=process.platform==="win32"&&root===ROOT?checkFactoryDependencyProof:null}={}) {
  const state=await readFactoryStatus({root,now});
  if(!state.enabled)return Object.freeze({state:"OFF",processed:0});
  const config=await ordinaryJson(path.join(root,"config.json"));
  const head=await github.exactHead();
  if(!head)return Object.freeze({state:"WAITING_FOR_EXACT_CLEAN_MAIN",processed:0});
  // Merge is narrowly restricted to pure docs with individually proven exact
  // GitHub CI and a second explicit local opt-in; code Product Gate stays red.
  if(config.mergeDocsOnly===true){
    const merged=await reconcile({issueNumbers:config.issues,exactBase:head,repoRoot:REPO_ROOT});
    if(merged?.state==="MERGED")return Object.freeze({
      state:"MERGED",processed:0,issueNumber:merged.issueNumber,
      mergeSha:merged.mergeSha,prNumber:merged.prNumber});
  }
  // Do not flood reviewers/CI with unlimited draft PRs while real Product
  // Gate and native-owned STOP remain separately unproven.
  if(typeof github.pendingFactoryPRs==="function"){
    const pending=await github.pendingFactoryPRs();
    if(!Number.isSafeInteger(pending)||pending<0)
      throw new Error("Pending factory PR count not trustworthy.");
    if(pending>=2)return Object.freeze({state:"WAITING_FOR_PR_VERIFICATION",
      processed:0,pendingPRs:pending});
  }
  const jobs=path.join(root,"jobs");await mkdir(jobs,{recursive:true,mode:0o700});
  const issues=await github.issues();
  if(!Array.isArray(issues))throw new Error("GitHub queue response malformed.");
  const reserved=[];
  for(const issueNumber of config.issues){
    if(existsSync(path.join(jobs,"issue-"+issueNumber+".json")))reserved.push(issueNumber);
  }
  let issue=pickNextIssue(issues,config.issues,reserved);
  let attempt=1;
  if(!issue && config.issues.length===1 && config.issues[0]===3141 &&
    reserved.includes(3141)) {
    const approval=await safeJson(path.join(jobs,"retry-authorized-3141.json"));
    if(approval) {
      const original=await ordinaryJson(path.join(jobs,"issue-3141.json"));
      const result=await ordinaryJson(path.join(jobs,"result-3141.json"));
      if(approval.schemaVersion!==1||approval.issueNumber!==3141||approval.attempt!==2 ||
        approval.sourceHead!==head||approval.priorHead!==original.sourceHead ||
        approval.originalJobPreserved!==true||approval.localOnly!==true ||
        approval.allowMerge!==false||result.state!=="BLOCKED" ||
        result.code!=="SOURCE_OR_BUILD_OR_PROVIDER_FAILURE" ||
        result.replayAuthorized!==false||result.prUrl!==null) {
        return Object.freeze({state:"WAITING_FOR_RETRY_HEAD_OR_REVIEW",processed:0});
      }
      if(!existsSync(path.join(jobs,"issue-3141-attempt-2.json")) &&
        !existsSync(path.join(jobs,"result-3141-attempt-2.json"))) {
        const candidate=issues.find(x=>Number(x.number)===3141);
        if(eligibleIssue(candidate,config.issues)) {
          issue=Object.freeze({number:3141,title:candidate.title});
          attempt=2;
        }
      }
    }
  }
  if(!issue)return Object.freeze({state:"WAITING_FOR_ELIGIBLE_ISSUE",processed:0,
    reserved:reserved.length,approved:config.issues.length});
  // A missing provider must not consume the irreversible issue attempt.
  // Preflight does not install a model, perform paid inference or mutate code.
  const readiness=await preflight();
  if(readiness?.ready!==true)return Object.freeze({
    state:"WAITING_FOR_PROVIDER",issueNumber:issue.number,processed:0,
    code:String(readiness?.code||"LOCAL_ROUTE_UNAVAILABLE").slice(0,80)});
  // Native scheduled worker only: prove npm ci in a detached diagnostic
  // worktree BEFORE the irreversible issue job is reserved. Synthetic tests
  // use private roots and cannot accidentally install real dependencies.
  if(typeof dependencyPreflight==="function"){
    const dependencies=await dependencyPreflight({root,repoRoot:REPO_ROOT,expectedHead:head});
    if(!dependencies?.ready)return Object.freeze({
      state:"WAITING_FOR_DEPENDENCIES",issueNumber:issue.number,processed:0,
      code:String(dependencies?.code||"NPM_PREFLIGHT_UNAVAILABLE").slice(0,80),
    });
  }
  const job={schemaVersion:1,issueNumber:issue.number,sourceHead:head,
    taskId:SHA256(REPOSITORY+":"+issue.number+":"+head+":"+attempt),state:"STARTED_UNCONFIRMED",
    reservedAt:now(),attempt,replayAuthorized:false,modelRoute:"local-only",
    cloudCostAllowed:false,modelDispatchAuthorized:true,automaticMergeAuthorized:false};
  const jobName=attempt===2?"issue-3141-attempt-2.json":"issue-"+issue.number+".json";
  const resultName=attempt===2?"result-3141-attempt-2.json":"result-"+issue.number+".json";
  await record(jobs,jobName,job,"wx");
  await record(root,"heartbeat.json",{schemaVersion:1,state:"RUNNING",issueNumber:issue.number,at:now()},"w");
  let result;
  const heartbeat=async()=>{
    if(existsSync(path.join(root,"disabled.json")))return;
    await record(root,"heartbeat.json",{schemaVersion:1,state:"RUNNING",issueNumber:issue.number,at:now()},"w");
    await publish({root,status:{state:"RUNNING",issueNumber:issue.number,head},now})
      .catch(()=>{}); // Missing GitHub reporting is not evidence of worker failure.
  };
  await heartbeat();
  const ticker=setInterval(()=>{void heartbeat().catch(()=>{});},15_000);
  ticker.unref?.();
  try{
    if(typeof dispatch!=="function")throw new Error("No approved engineering executor configured.");
    result=await dispatch({issueNumber:issue.number,head,root,job,attempt});
    if(!["PR_OPEN","WAITING_FOR_PROVIDER","WAITING_FOR_PRODUCT_UAT","BLOCKED"].includes(result?.state)){
      throw new Error("Executor produced an unsupported result.");
    }
  }catch(error){
    result={state:"BLOCKED",code:"EXECUTION_UNCERTAIN",detailStored:false,
      mayReplay:false};
  }finally{
    clearInterval(ticker);
  }
  const terminal={schemaVersion:1,issueNumber:issue.number,attempt,head,state:result.state,
    code:String(result.code||"").slice(0,80),
    // A fixed local stage enum, never raw stderr, model transcript or private path.
    phase:/^(?:INSTALL_DEPENDENCIES|RUN_LOCAL_PI|INSPECT_CANDIDATE_PATCH|CHECK_DIFF|RUN_CONTRACTS_UAT|RUN_PRODUCTION_BUILD|RECHECK_BASE_HEAD|STAGE_CANDIDATE|RECHECK_STAGED_PATHS|COMMIT_CANDIDATE|PUSH_CANDIDATE|CREATE_DRAFT_PR|UNKNOWN_STAGE)$/.test(result.phase||"")?result.phase:null,
    prUrl:/^https:\/\/github\.com\/BryanHarrisScripts\/PlotPickle\/pull\/\d+$/.test(result.prUrl||"")?result.prUrl:null,
    reportedAt:now(),replayAuthorized:false,
    browserUatProven:false,independentVerification:false,mergeEligible:false};
  await record(jobs,resultName,terminal,"wx");
  await record(root,"heartbeat.json",{schemaVersion:1,state:terminal.state,
    issueNumber:issue.number,at:now()},"w");
  await publish({root,status:{state:terminal.state,issueNumber:issue.number,head},now})
    .catch(()=>{});
  return Object.freeze({state:terminal.state,processed:1,issueNumber:issue.number,prUrl:terminal.prUrl});
}

export async function serveFactory({root=ROOT,cycle,publish=publishFactoryHeartbeat,
  now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}) {
  const state=await readFactoryStatus({root,now});
  if(!state.enabled)throw new Error("Factory is OFF; it cannot serve.");
  const lock=path.join(root,"service.lock");
  const lockBody=()=>JSON.stringify({schemaVersion:1,pid:process.pid,at:now()})+"\n";
  try{await writeFile(lock,lockBody(),{flag:"wx",mode:0o600});}
  catch(error){
    if(error?.code!=="EEXIST")throw error;
    // A crash/reboot must not permanently stop the queue. Never disturb a
    // living service; an old lock may be quarantined only if that PID is gone.
    const old=await ordinaryJson(lock,8192);
    if(!Number.isSafeInteger(old.pid)||old.pid<1)throw new Error("Invalid worker identity; manual review required.");
    let gone=false;
    try{process.kill(old.pid,0);}catch(e){if(e?.code==="ESRCH")gone=true;else throw e;}
    if(!gone)throw new Error("Another factory worker may be active; refusing duplicate.");
    await rename(lock,path.join(root,"service-stale-"+String(old.at||"unknown")+".json"));
    await writeFile(lock,lockBody(),{flag:"wx",mode:0o600});
  }
  try{
    for(;;){
      if(existsSync(path.join(root,"disabled.json")))return Object.freeze({state:"OFF",reason:"LOCALLY_DISABLED"});
      await record(root,"heartbeat.json",{schemaVersion:1,state:"IDLE",issueNumber:null,at:now()},"w");
      try{
        const outcome=await (cycle||(()=>runFactoryCycle({root,now,dispatch:dispatchIssue})))();
        await record(root,"heartbeat.json",{schemaVersion:1,state:outcome?.state||"OFFLINE",
          issueNumber:outcome?.issueNumber||null,at:now()},"w");
        await publish({root,status:{state:outcome?.state||"OFFLINE",
          issueNumber:outcome?.issueNumber||null,head:null},now}).catch(()=>{});
      }catch{
        await record(root,"heartbeat.json",{schemaVersion:1,state:"BLOCKED",
          issueNumber:null,at:now()},"w");
        await publish({root,status:{state:"BLOCKED",issueNumber:null,head:null},now}).catch(()=>{});
      }
      await sleep(POLL_MS);
    }
  }finally{await unlink(lock).catch(()=>{});}
}

async function dispatchIssue({issueNumber,head,root,attempt=1}) {
  const {runPortableCommand}=await import("../../pi-worker-runtime.mjs");
  const result=await runPortableCommand(process.execPath,[
    path.join(path.dirname(THIS),"autonomous-issue-coder.mjs"),
    "--issue",String(issueNumber),"--head",head,"--root",root,
    ...(attempt===2?["--attempt","2"]:[])
  ],{cwd:REPO_ROOT,timeout:45*60_000,maxBuffer:32768});
  const receipt=JSON.parse(String(result.stdout||"").trim());
  return receipt;
}

async function main() {
  const cmd=parseQueueCommand(process.argv.slice(2));
  let output;
  if(cmd.mode==="enable")output=await enableFactory({issues:cmd.issues,mergeDocsOnly:cmd.mergeDocsOnly});
  else if(cmd.mode==="admit")output=await admitFactoryIssues({issues:cmd.issues,consent:CONSENT});
  else if(cmd.mode==="authorize-retry") output=await authorizeFactoryRetry({
    issueNumber:cmd.retryIssue,expectedHead:cmd.retryBase});
  else if(cmd.mode==="disable")output=await disableFactory();
  else if(cmd.mode==="status")output=await readFactoryStatus();
  else if(cmd.mode==="once")output=await runFactoryCycle({dispatch:dispatchIssue});
  else if(cmd.mode==="serve")output=await serveFactory();
  else{
    const github=createQueueGitHubClient();
    const issues=await github.issues();
    if(cmd.mode==="plan-latest") output=planNewestFirst(issues);
    else output={state:"PREVIEW_ONLY",openIssues:issues.length,eligible:issues
      .filter(x=>!/^\[ON HOLD\]|^\[HOLD\]|^HOLD:/i.test(x.title||""))
      .map(x=>({number:x.number,title:String(x.title||"").slice(0,120)})).slice(0,100)};
  }
  process.stdout.write(JSON.stringify(output,null,2)+"\n");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(err=>{process.stderr.write("Autonomous factory BLOCKED: "+String(err?.message||"unknown").slice(0,180)+"\n");process.exitCode=1;});
