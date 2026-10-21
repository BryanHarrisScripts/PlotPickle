#!/usr/bin/env node
/**
 * #3154: local-only read-only MCP bridge for ChatGPT -> PlotPickle Factory.
 * No model calls, GitHub mutations, queue authorization, replay, or STOP.
 * Loopback HTTP is for local protocol inspection, NEVER an unauthenticated tunnel.
 */
import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { pathToFileURL } from "node:url";
import {
  readFactoryStatus, planNewestFirst, createQueueGitHubClient, admitFactoryIssues,
} from "../windows/autonomous-queue.mjs";
import { runFactoryDependencyPreflight, checkFactoryDependencyProof,
  publishFactoryDependencyPreflightResult } from "../queue/factory-dependency-preflight.mjs";
import { inspectFactoryServiceLock } from "../queue/factory-service-lock.mjs";
import { summarizeFactoryObserver } from "./factory-observer.mjs";
import { allowedFactoryTestNames, readFactoryVerificationHead,
  runFactoryNamedTest,inspectFactoryCandidatePr,stageFactoryCandidatePr } from "./factory-named-tests.mjs";

export const MCP_PROTOCOL = "2025-06-18";
export const MCP_NAME = "plotpickle-factory-readonly";
const REPOSITORY = "BryanHarrisScripts/PlotPickle";
const HEX_SHA = /^[a-f0-9]{40}$/;
const MAX_BYTES = 65_536;
const states = new Set(["OFF","OFFLINE","IDLE","RUNNING","BLOCKED","PR_OPEN",
  "WAITING_FOR_PROVIDER","WAITING_FOR_DEPENDENCIES","WAITING_FOR_PRODUCT_UAT","WAITING_FOR_PR_VERIFICATION",
  "WAITING_FOR_ELIGIBLE_ISSUE","WAITING_FOR_EXACT_CLEAN_MAIN","WAITING_FOR_RETRY_HEAD_OR_REVIEW",
  "MERGED"]);
const phases = new Set(["INSTALL_DEPENDENCIES","RUN_LOCAL_PI","INSPECT_CANDIDATE_PATCH",
  "CHECK_DIFF","RUN_CONTRACTS_UAT","RUN_PRODUCTION_BUILD","RECHECK_BASE_HEAD",
  "STAGE_CANDIDATE","RECHECK_STAGED_PATHS","COMMIT_CANDIDATE","PUSH_CANDIDATE",
  "CREATE_DRAFT_PR","UNKNOWN_STAGE"]);
const codes = new Set(["SOURCE_OR_BUILD_OR_PROVIDER_FAILURE","EXECUTION_UNCERTAIN",
  "PUSHED_UNCERTAIN","DRAFT_PR_CREATED","PROVIDER_NOT_READY",
  "PI_NOT_INSTALLED","LOCAL_MODEL_UNAVAILABLE","NO_BOUNDED_PATCH",
  "ISSUE_SCOPE_VIOLATION","DISALLOWED_SOURCE_PATH","RETRY_NOT_AUTHORIZED",
  "PI_WRITE_TOOL_NOT_OBSERVED","PI_WRITE_TOOL_FAILED","PI_WRITE_EVENTS_UNVERIFIED"]);
const safeText = (value, allowed) => allowed.has(value) ? value : null;
const safeSha = value => HEX_SHA.test(value || "") ? value : null;
const dependencyStates=new Set(["BLOCKED","INSTALL_PREFLIGHT_READY"]);
const dependencyCodes=new Set([
  "WINDOWS_ONLY","FACTORY_LOCALLY_DISABLED","STOP_FACTORY_FIRST",
  "EXACT_CLEAN_MAIN_REQUIRED","PROBE_ALREADY_EXISTS",
  "NPM_CI_VERIFIED","NPM_PREFLIGHT_VERIFIED",
  "NPM_INSTALL_TIMEOUT","NPM_LOCKFILE_MISMATCH","NPM_WINDOWS_FILE_ACCESS",
  "NPM_NETWORK_UNAVAILABLE","NPM_INTEGRITY_FAILURE","NPM_FILE_MISSING",
  "NPM_INSTALL_UNCLASSIFIED","NPM_PREFLIGHT_UNAVAILABLE",
  "GIT_PROBE_FAILED","MANIFEST_READ_FAILED","PROBE_DIRECTORY_UNAVAILABLE",
  "WORKTREE_PATH_BLOCKED","WORKTREE_LOCKED","WORKTREE_FILE_ACCESS",
  "WORKTREE_ADD_FAILED","PROOF_WRITE_FAILED",
]);
export function sanitizeDependencyPreflight(record) {
  if(record?.schemaVersion!==1||
     !dependencyStates.has(record?.state)||
     !dependencyCodes.has(record?.code)||
     !Number.isSafeInteger(record?.observedAt)||
     record.observedAt<0||
     record?.modelInvoked!==false||
     record?.issueReserved!==false)return null;
  const sourceHead=record.sourceHead===null?null:safeSha(record.sourceHead);
  if(record.sourceHead!==null&&!sourceHead)return null;
  return Object.freeze({
    state:record.state,code:record.code,sourceHead,
    observedAt:record.observedAt,issueReserved:false,modelInvoked:false,
  });
}

export function privateFactoryRoot(env=process.env, platform=process.platform, home=os.homedir()) {
  const base=env.LOCALAPPDATA || (platform==="win32"
    ? path.join(home,"AppData","Local") : path.join(home,".local","share"));
  return path.join(base,"PlotPickle","engineering-team","autonomous-queue");
}

async function privateJson(filename, maximum=MAX_BYTES) {
  try {
    const info=await lstat(filename);
    if(!info.isFile() || info.isSymbolicLink() || info.size>maximum || info.size<2)
      return null;
    return JSON.parse(await readFile(filename,"utf8"));
  } catch(error) {
    if(error?.code==="ENOENT") return null;
    return null; // Corrupt/private records never leak raw exceptions or file paths.
  }
}

function validIssue(value) {
  return Number.isSafeInteger(value) && value>=1 && value<=9999999;
}

export function sanitizeReceipt(receipt,issueNumber,attempt) {
  if(!receipt || receipt.issueNumber!==issueNumber || (attempt===2 && receipt.attempt!==2))
    return null;
  const state=safeText(receipt.state,states);
  const sourceHead=safeSha(receipt.sourceHead)||safeSha(receipt.head);
  if(!state) return null;
  return Object.freeze({
    issueNumber,attempt,state,sourceHead,
    code:safeText(receipt.code,codes),
    phase:safeText(receipt.phase,phases),
    prUrl:typeof receipt.prUrl==="string" &&
      /^https:\/\/github\.com\/BryanHarrisScripts\/PlotPickle\/pull\/\d+$/.test(receipt.prUrl)
      ? receipt.prUrl:null,
    completedAt:Number.isSafeInteger(receipt.reportedAt) && receipt.reportedAt>=0
      ? receipt.reportedAt:null,
    replayAuthorized:false,
  });
}

function receiptName(issueNumber,attempt) {
  return attempt===2?"result-3141-attempt-2.json":"result-"+issueNumber+".json";
}
function reservationName(issueNumber,attempt) {
  return attempt===2?"issue-3141-attempt-2.json":"issue-"+issueNumber+".json";
}

export async function factoryEvidence({root=privateFactoryRoot(),issueNumber,attempt=1}={}) {
  if(!validIssue(issueNumber) || ![1,2].includes(attempt) ||
     (attempt===2 && issueNumber!==3141))
    return {status:"INVALID_SELECTION",record:null};
  const jobs=path.join(root,"jobs");
  const reservation=await privateJson(path.join(jobs,reservationName(issueNumber,attempt)));
  if(!reservation || reservation.issueNumber!==issueNumber || reservation.attempt!==attempt)
    return {status:"NO_RESERVATION",record:null};
  const result=await privateJson(path.join(jobs,receiptName(issueNumber,attempt)));
  if(result) {
    const sanitized=sanitizeReceipt(result,issueNumber,attempt);
    if(!sanitized) return {status:"UNVERIFIABLE_RECEIPT",record:null};
    return {status:"COMPLETED_RECEIPT",record:sanitized};
  }
  return {status:"RESERVED_NO_RESULT",record:{
    issueNumber,attempt,state:"STARTED_UNCONFIRMED",
    sourceHead:safeSha(reservation.sourceHead),replayAuthorized:false,
  }};
}

export async function factoryStatus({root=privateFactoryRoot(),now=Date.now,verifyHead=readFactoryVerificationHead}={}) {
  let raw;
  try { raw=await readFactoryStatus({root,now}); }
  catch { return {state:"UNKNOWN",enabled:null,reason:"PRIVATE_STATE_UNREADABLE",
    agentVerified:false,productGateVerified:false,automaticMergeEnabled:false}; }
  const result={
    state:safeText(raw.state,states)||"UNKNOWN",
    enabled:raw.enabled===true,
    approvedIssueCount:Number.isSafeInteger(raw.issueCount)?raw.issueCount:0,
    activeIssue:validIssue(raw.activeIssue)?raw.activeIssue:null,
    heartbeatAgeSeconds:Number.isFinite(raw.lastHeartbeat)
      ? Math.max(0,Math.floor((now()-raw.lastHeartbeat)/1000)):null,
    heartbeatFresh:raw.state!=="OFFLINE"&&raw.state!=="OFF"&&raw.lastHeartbeat!=null,
    agentVerified:false,productGateVerified:false,
    automaticMergeEnabled:false,documentationAutoMergeEnabled:raw.documentationAutoMergeEnabled===true,
  };
  // Preserve the established 4 public / 8 authenticated MCP tool catalog:
  // the owner's untracked authenticated launcher verifies that contract.
  // Surface independently checked local Git truth in ordinary status instead
  // of adding a fifth public tool that prevents paired tunnel startup.
  result.hostRevision=await factoryHostHead({verify:verifyHead});
  // Fixed private filename only; never expose npm stderr, cache paths or raw proof payload.
  result.dependencyPreflight=sanitizeDependencyPreflight(
    await privateJson(path.join(root,"dependency-preflight-result.json"),2048));
  if(!raw.enabled) {result.reason=raw.reason==="LOCALLY_DISABLED"?"LOCALLY_DISABLED":"NOT_ENABLED";return result;}
  const config=await privateJson(path.join(root,"config.json"),32768);
  if(!config || !Array.isArray(config.issues)) {
    result.reason="CONFIG_UNVERIFIABLE";return result;
  }
  // Only bounded configured issue IDs; no caller-supplied paths or arbitrary directory enumeration.
  const issues=config.issues.filter(validIssue).slice(0,80);
  let last=null;
  for(const n of issues) for(const attempt of n===3141?[1,2]:[1]) {
    const evidence=await factoryEvidence({root,issueNumber:n,attempt});
    if(evidence.status!=="COMPLETED_RECEIPT")continue;
    const record=evidence.record;
    if(!last || (record.completedAt??0)>(last.completedAt??0))last=record;
  }
  result.lastOutcome=last;
  return result;
}

/** Read a bounded monitor-only heartbeat, never infer process ownership. */
export function sanitizeFactoryMonitor(record,now=Date.now()) {
  if(record?.schemaVersion!==1||record?.mode!=="MONITOR_ONLY"||
    !Number.isSafeInteger(record.observedAt)||record.observedAt<0||
    record.modelInvoked!==false||record.sourceModified!==false||
    record.queueModified!==false||record.issueAdmitted!==false||
    record.legacyPiDispatched!==false||record.dispatcherReady!==false||
    record.automaticMerge!==false||record.windowsUatVerified!==false||
    !["PLAN_ONLY","GITHUB_UNAVAILABLE"].includes(record.qaState)||
    !Number.isSafeInteger(record.qaCandidateCount)||record.qaCandidateCount<0||
    record.qaCandidateCount>5||!Array.isArray(record.qaCandidates)||
    record.qaCandidates.length!==record.qaCandidateCount||
    record.qaCandidates.some(n=>!validIssue(n)))return null;
  const age=now-record.observedAt;
  return Object.freeze({
    state:age>=0&&age<=120_000?"HEARTBEAT_OBSERVED":"STALE_OR_UNVERIFIED",
    observedAt:record.observedAt,
    heartbeatFresh:age>=0&&age<=120_000,
    processOwnershipVerified:false,mode:"MONITOR_ONLY",
    qaState:record.qaState,qaCandidateCount:record.qaCandidateCount,
    qaCandidates:record.qaCandidates,
    issueAdmitted:false,modelInvoked:false,windowsUatVerified:false,
  });
}

/** Bounded local observer: zero model calls, shell commands, reservations or edits. */
export async function factoryObserver({root=privateFactoryRoot(),now=Date.now}={}) {
  const status=await factoryStatus({root,now});
  const config=await privateJson(path.join(root,"config.json"),32768);
  const approvedIssues=Array.isArray(config?.issues)?config.issues.slice(0,80):[];
  const evidence=await Promise.all(approvedIssues.map(async issueNumber=>({
    issueNumber,...await factoryEvidence({root,issueNumber,attempt:1}),
  })));
  const observedAt=now();
  const monitorRecord=await privateJson(path.join(root,"observer-monitor.json"),4096);
  const monitor=sanitizeFactoryMonitor(monitorRecord,observedAt)||
    {state:"NOT_OBSERVED",heartbeatFresh:false,processOwnershipVerified:false,
      mode:"MONITOR_ONLY",issueAdmitted:false,modelInvoked:false};
  return Object.freeze({...summarizeFactoryObserver({status,approvedIssues,evidence,now:observedAt}),monitor});
}

export async function factoryIssuePreview({root=privateFactoryRoot(),
  github=createQueueGitHubClient()}={}) {
  try {
    // Never propose existing local approvals, including permanently blocked
    // write-once attempts. A preview is not new dispatch consent.
    const configPath=path.join(root,"config.json");
    const hasConfig=existsSync(configPath);
    const config=hasConfig?await privateJson(configPath,32768):null;
    if(hasConfig && (config?.schemaVersion!==1 ||
        config.repository!==REPOSITORY ||
        !Array.isArray(config.issues) || config.issues.length>80 ||
        !config.issues.every(validIssue))) {
      return {state:"QUEUE_UNVERIFIABLE",queueModified:false,
        workerStarted:false,approvalRequired:true};
    }
    const approved=new Set(config?.issues||[]);
    const issues=await github.issues(); // gh issue list; read only
    if(!Array.isArray(issues))throw Error("Unverified issue list");
    const preview=planNewestFirst(issues.filter(x=>!approved.has(x?.number)),
      {maxIssues:5});
    return {state:"PLAN_ONLY",repository:REPOSITORY,
      listedIssues:issues.length,totalEligible:preview.totalEligible,
      alreadyApprovedCount:issues.filter(x=>approved.has(x?.number)).length,
      proposedIssues:preview.proposedIssues.map(x=>({number:x.number})),
      truncatedAtGithubLimit:issues.length>=100,
      queueModified:false,workerStarted:false,approvalRequired:true};
  } catch {
    return {state:"GITHUB_UNAVAILABLE",queueModified:false,workerStarted:false,approvalRequired:true};
  }
}


/**
 * Read-only, exact-head verification for Chat-led engineering. Separate from
 * heartbeat; no candidate PR, queued attempt, process ownership or Windows
 * Product UAT is established here.
 */
export async function factoryHostHead({verify=readFactoryVerificationHead}={}) {
  let head=null;
  try {head=safeSha(await verify());}catch{head=null;}
  return Object.freeze({
    state:head?"EXACT_CLEAN_MAIN":"NOT_VERIFIED",
    sourceHead:head,branch:head?"main":null,
    sourceMutationAuthorized:false,modelInvoked:false,
    issueReserved:false,windowsUatVerified:false,
  });
}

/**
 * #3154: authenticated, opt-in CONTROL on the existing paired host and ledger.
 * A secure tunnel must inject the owner-only HTTP header; the token is NEVER
 * a model/tool argument or an issue/comment value. Without the header the
 * original read-only MCP contract and all three tools remain unchanged.
 */
const REQUEST_ID=/^[a-f0-9]{32}$/;
const CONTROL_HEAD=/^[a-f0-9]{40}$/;
const CONTROL_TOKEN=/^[A-Za-z0-9_-]{48,128}$/;
const CONTROL_CODES=new Set([...dependencyCodes,
  "ISSUES_ADMITTED","DEPENDENCY_PREFLIGHT_REQUIRED",
  "CONTROL_OPERATION_BLOCKED","EXACT_HEAD_MISMATCH",
  "WINDOWS_ONLY","TEST_SELECTION_INVALID","TEST_LOCKED",
  "NODE_TEST_PASS","NODE_TEST_FAILED","NODE_TEST_TIMEOUT",
  "CANDIDATE_HEAD_VERIFIED","CANDIDATE_SELECTION_INVALID",
  "CANDIDATE_NOT_OPEN","CANDIDATE_HEAD_MISMATCH",
  "CANDIDATE_BASE_MISMATCH","GITHUB_PR_UNAVAILABLE",
  "CANDIDATE_STATIC_STAGED","CANDIDATE_STAGE_UNVERIFIED",
  "CANDIDATE_STAGE_PATH_BLOCKED","CANDIDATE_STAGE_EXISTS",
  "CANDIDATE_FETCH_MISMATCH","CANDIDATE_STAGE_MISMATCH","CANDIDATE_STAGE_DIRTY",
  "CANDIDATE_DIFF_UNVERIFIED","CANDIDATE_CHANGED_DURING_STAGE",
  "CANDIDATE_STAGE_FETCH_FAILED","CANDIDATE_STAGE_WORKTREE_ADD_FAILED"]);
export function controlTokenMatches(presented,configured) {
  if(typeof configured!=="string"||!CONTROL_TOKEN.test(configured)||
     typeof presented!=="string"||!CONTROL_TOKEN.test(presented))return false;
  const a=Buffer.from(presented),b=Buffer.from(configured);
  return a.length===b.length&&timingSafeEqual(a,b);
}
const allowedFactoryControlSuites=()=>[...allowedFactoryTestNames(),"factory-pr-head","factory-pr-stage"];
export const MCP_CONTROL_TOOLS=Object.freeze([
  {name:"factory_run_dependency_preflight",title:"Run Windows Factory dependency preflight",
    description:"On the paired, stopped Windows host, run the non-reserving npm dependency preflight for an exact main SHA. May take several minutes. Never invokes a model or retries an issue.",
    inputSchema:{type:"object",properties:{
      requestId:{type:"string",pattern:"^[a-f0-9]{32}$"},
      expectedHead:{type:"string",pattern:"^[a-f0-9]{40}$"}},
      required:["requestId","expectedHead"],additionalProperties:false}},
  {name:"factory_admit_issues",title:"Admit a bounded fresh Factory issue batch",
    description:"After verified native dependency preflight, append one to five new eligible issues to the existing locally approved queue; never replay reservations, start a worker or grant merge rights.",
    inputSchema:{type:"object",properties:{
      requestId:{type:"string",pattern:"^[a-f0-9]{32}$"},
      expectedHead:{type:"string",pattern:"^[a-f0-9]{40}$"},
      issues:{type:"array",items:{type:"integer",minimum:1,maximum:9999999},minItems:1,maxItems:5,uniqueItems:true}},
      required:["requestId","expectedHead","issues"],additionalProperties:false}},
  {name:"factory_run_named_test",title:"Run allowlisted Factory test or candidate identity check",
    description:"Authenticated Windows-only fixed Node suite, candidate PR metadata check, or isolated static candidate staging. No arbitrary shell, candidate build/test execution, model calls or merge. Never proves Windows Product UAT.",
    inputSchema:{type:"object",properties:{
      requestId:{type:"string",pattern:"^[a-f0-9]{32}$"},
      expectedHead:{type:"string",pattern:"^[a-f0-9]{40}$"},
      suite:{type:"string",enum:allowedFactoryControlSuites()},
      candidatePrNumber:{type:"integer",minimum:1,maximum:9999999},
      candidateHead:{type:"string",pattern:"^[a-f0-9]{40}$"}},
      required:["requestId","expectedHead","suite"],additionalProperties:false}},
  {name:"factory_control_receipt",title:"Read durable Factory control request receipt",
    description:"Read the sanitized immutable outcome of an authenticated control request ID. Missing outcome is uncertain, never green and never retryable with the same ID.",
    inputSchema:{type:"object",properties:{
      requestId:{type:"string",pattern:"^[a-f0-9]{32}$"}},
      required:["requestId"],additionalProperties:false}},
].map(tool=>Object.freeze({...tool,annotations:{
  readOnlyHint:tool.name==="factory_control_receipt",destructiveHint:false,openWorldHint:false,
}})));
function validControlArgs(name,args) {
  const keys=Object.keys(args);
  if(!REQUEST_ID.test(args.requestId||""))return false;
  if(name==="factory_control_receipt")return keys.length===1;
  if(!CONTROL_HEAD.test(args.expectedHead||""))return false;
  if(name==="factory_run_dependency_preflight")
    return keys.length===2;
  if(name==="factory_run_named_test"){
    if(["factory-pr-head","factory-pr-stage"].includes(args.suite))return keys.length===5 &&
      Number.isSafeInteger(args.candidatePrNumber)&&validIssue(args.candidatePrNumber)&&
      CONTROL_HEAD.test(args.candidateHead||"");
    return keys.length===3 && allowedFactoryTestNames().includes(args.suite);
  }
  return name==="factory_admit_issues"&&keys.length===3&&
    Array.isArray(args.issues)&&args.issues.length>=1&&args.issues.length<=5&&
    new Set(args.issues).size===args.issues.length&&
    args.issues.every(n=>validIssue(n));
}
function safeControlReceipt(raw,requestId) {
  if(raw?.requestId!==requestId)return null;
  const state=["BLOCKED","INSTALL_PREFLIGHT_READY","ISSUES_ADMITTED",
    "TEST_PASSED","TEST_FAILED"].includes(raw.state)
    ?raw.state:null;
  const code=safeText(raw.code,CONTROL_CODES);
  if(!state||!code)return null;
  return {requestId,state,code,sourceHead:safeSha(raw.sourceHead),
    suite:allowedFactoryControlSuites().includes(raw.suite)?raw.suite:null,
    candidatePrNumber:["CANDIDATE_HEAD_VERIFIED","CANDIDATE_STATIC_STAGED"].includes(raw.code)&&
      raw.state==="TEST_PASSED"&&validIssue(raw.candidatePrNumber)?raw.candidatePrNumber:null,
    candidateHead:["CANDIDATE_HEAD_VERIFIED","CANDIDATE_STATIC_STAGED"].includes(raw.code)&&
      raw.state==="TEST_PASSED"?safeSha(raw.candidateHead):null,
    stageId:raw.code==="CANDIDATE_STATIC_STAGED"&&raw.state==="TEST_PASSED"&&
      REQUEST_ID.test(raw.stageId||"")?raw.stageId:null,
    changedFileCount:raw.code==="CANDIDATE_STATIC_STAGED"&&raw.state==="TEST_PASSED"&&
      Number.isSafeInteger(raw.changedFileCount)&&raw.changedFileCount>=1&&
      raw.changedFileCount<=500?raw.changedFileCount:null,
    issueCount:Number.isSafeInteger(raw.issueCount)&&raw.issueCount>=0&&raw.issueCount<=80
      ?raw.issueCount:null,modelInvoked:false,replayAuthorized:false,
    independentVerification:false};
}
export async function factoryControlReceipt({root,requestId}){
  const dir=path.join(root,"mcp-control-requests");
  const reservation=await privateJson(path.join(dir,requestId+".json"),4096);
  if(!reservation||reservation.requestId!==requestId)
    return {state:"NO_REQUEST",requestId,replayAuthorized:false};
  const result=await privateJson(path.join(dir,requestId+"-result.json"),4096);
  const receipt=safeControlReceipt(result,requestId);
  return receipt||{state:"STARTED_UNCONFIRMED",requestId,replayAuthorized:false};
}
export async function factoryControlAction(name,args,{
  root=privateFactoryRoot(),github=createQueueGitHubClient(),now=Date.now,
  ops={
    preflight:runFactoryDependencyPreflight,proof:checkFactoryDependencyProof,
    admit:admitFactoryIssues,publish:publishFactoryDependencyPreflightResult,
    testHead:readFactoryVerificationHead,runTest:runFactoryNamedTest,
    inspectPr:inspectFactoryCandidatePr,stagePr:stageFactoryCandidatePr,
  },
}={}) {
  if(name==="factory_control_receipt")return factoryControlReceipt({root,requestId:args.requestId});
  const dir=path.join(root,"mcp-control-requests");
  // Recover an orphaned lock only when the original Windows PID is proved
  // absent. A running worker, invalid lock or uncertain ownership still blocks
  // every control mutation. This does NOT stop/start the scheduled task.
  if(!(await inspectFactoryServiceLock({root})).safeToProceed)
    return {state:"BLOCKED",code:"STOP_FACTORY_FIRST",requestId:args.requestId,
      replayAuthorized:false};
  let head;
  try{head=name==="factory_run_named_test"
    ?await ops.testHead():await github.exactHead();}catch{return {
    state:"BLOCKED",code:"EXACT_HEAD_MISMATCH",requestId:args.requestId,
    replayAuthorized:false};}
  if(head!==args.expectedHead)return {
    state:"BLOCKED",code:"EXACT_HEAD_MISMATCH",requestId:args.requestId,
    replayAuthorized:false};
  await mkdir(dir,{recursive:true,mode:0o700});
  // Write-once reservation BEFORE any possibly irreversible npm or queue call.
  try{
    await writeFile(path.join(dir,args.requestId+".json"),JSON.stringify({
      schemaVersion:1,requestId:args.requestId,operation:name,
      expectedHead:args.expectedHead,
      candidatePrNumber:["factory-pr-head","factory-pr-stage"].includes(args.suite)?args.candidatePrNumber:null,
      candidateHead:["factory-pr-head","factory-pr-stage"].includes(args.suite)?args.candidateHead:null,
      at:now(),replayAuthorized:false,
    })+"\n",{flag:"wx",mode:0o600});
  }catch{return {state:"DUPLICATE_OR_UNVERIFIABLE_REQUEST",requestId:args.requestId,
    replayAuthorized:false};}
  let outcome;
  try{
    if(name==="factory_run_named_test"){
      // A crash preserves a lock for manual review; no auto replay/unlock.
      const lockFile=path.join(dir,"named-test-active.lock");
      let locked=false;
      try{
        await writeFile(lockFile,JSON.stringify({requestId:args.requestId,
          sourceHead:args.expectedHead})+"\\n",{flag:"wx",mode:0o600});
        locked=true;
      }catch{
        outcome={state:"BLOCKED",code:"TEST_LOCKED",sourceHead:args.expectedHead,
          suite:args.suite};
      }
      if(locked){
        try{
          const result=args.suite==="factory-pr-head"
            ?await ops.inspectPr({prNumber:args.candidatePrNumber,
              candidateHead:args.candidateHead,expectedHead:args.expectedHead,
              verifyHead:ops.testHead})
            :args.suite==="factory-pr-stage"
              ?await ops.stagePr({prNumber:args.candidatePrNumber,
                candidateHead:args.candidateHead,expectedHead:args.expectedHead,
                requestId:args.requestId,root,verifyHead:ops.testHead})
              :await ops.runTest({suite:args.suite,
                expectedHead:args.expectedHead,verifyHead:ops.testHead});
          outcome={state:["TEST_PASSED","TEST_FAILED"].includes(result.state)
            ?result.state:"BLOCKED",
            code:safeText(result.code,CONTROL_CODES)||"CONTROL_OPERATION_BLOCKED",
            sourceHead:result.sourceHead,suite:args.suite,
            candidatePrNumber:["CANDIDATE_HEAD_VERIFIED","CANDIDATE_STATIC_STAGED"].includes(result.code)
              ?result.candidatePrNumber:null,
            candidateHead:["CANDIDATE_HEAD_VERIFIED","CANDIDATE_STATIC_STAGED"].includes(result.code)
              ?result.candidateHead:null,
            stageId:result.code==="CANDIDATE_STATIC_STAGED"?result.stageId:null,
            changedFileCount:result.code==="CANDIDATE_STATIC_STAGED"
              ?result.changedFileCount:null};
        }finally{await unlink(lockFile).catch(()=>{});}
      }
    }else if(name==="factory_run_dependency_preflight"){
      const raw=await ops.preflight({root});
      await ops.publish({root,result:raw,now});
      outcome={state:raw.state==="INSTALL_PREFLIGHT_READY"?"INSTALL_PREFLIGHT_READY":"BLOCKED",
        code:safeText(raw.code,dependencyCodes)||"NPM_PREFLIGHT_UNAVAILABLE",
        sourceHead:raw.sourceHead||null};
    }else{
      const proof=await ops.proof({root,expectedHead:args.expectedHead});
      const nativeProof=await privateJson(path.join(root,"dependency-preflight.json"),4096);
      // A cache hit for an unchanged lockfile is not proof for another commit.
      if(proof?.ready!==true||nativeProof?.npmCiVerified!==true||
         nativeProof?.sourceHead!==args.expectedHead)
        outcome={state:"BLOCKED",code:"DEPENDENCY_PREFLIGHT_REQUIRED"};
      else{
        const admitted=await ops.admit({root,issues:args.issues,
          consent:"PLOTPICKLE_AUTONOMOUS_ENGINEERING",github,now});
        outcome={state:admitted?.state==="ISSUES_ADMITTED"?"ISSUES_ADMITTED":"BLOCKED",
          code:admitted?.state==="ISSUES_ADMITTED"?"ISSUES_ADMITTED":"CONTROL_OPERATION_BLOCKED",
          issueCount:admitted?.issueCount};
      }
    }
  }catch{
    // A partial npm/install or queue mutation may have occurred before an error:
    // preserve the original reservation, never write a misleading BLOCKED result.
    return {state:"STARTED_UNCONFIRMED",requestId:args.requestId,replayAuthorized:false};
  }
  const record={requestId:args.requestId,...outcome,
    modelInvoked:false,replayAuthorized:false,independentVerification:false};
  try{
    await writeFile(path.join(dir,args.requestId+"-result.json"),
      JSON.stringify(record)+"\n",{flag:"wx",mode:0o600});
  }catch{
    // The original operation may have happened; do not replay or invent success.
    return {state:"STARTED_UNCONFIRMED",requestId:args.requestId,replayAuthorized:false};
  }
  return safeControlReceipt(record,args.requestId);
}

export const MCP_TOOLS=Object.freeze([
  {name:"factory_status",title:"Read PlotPickle Factory status",
    description:"Read the local Factory heartbeat, approved issue count and sanitized last outcome. Never treats heartbeat as verification.",
    inputSchema:{type:"object",properties:{},additionalProperties:false}},
  {name:"factory_observer",title:"Read deterministic Factory Observer snapshot",
    description:"Read bounded Windows Factory queue, heartbeat and immutable issue receipts. Reports the Pi legacy dispatcher and ChatGPT-MCP engineering as NOT READY. Does not run, admit, modify or retry work.",
    inputSchema:{type:"object",properties:{},additionalProperties:false}},
  {name:"factory_evidence",title:"Read bounded issue attempt evidence",
    description:"Read one already-recorded attempt by numeric issue and attempt; never launches or retries the agent.",
    inputSchema:{type:"object",properties:{
      issueNumber:{type:"integer",minimum:1,maximum:9999999},
      attempt:{type:"integer",enum:[1,2],default:1}},
      required:["issueNumber"],additionalProperties:false}},
  {name:"factory_issue_preview",title:"Preview eligible GitHub issues",
    description:"Read only; proposes newest-first open issues without enabling a queue or authorizing execution.",
    inputSchema:{type:"object",properties:{},additionalProperties:false}},
].map(tool=>Object.freeze({...tool,annotations:{
  readOnlyHint:true,destructiveHint:false,openWorldHint:tool.name==="factory_issue_preview",
}})));

function invalidParams() {return {code:-32602,message:"Invalid tool arguments"};}

export async function executeMcpRequest(request,{root=privateFactoryRoot(),github,
  now=Date.now,controlAuthenticated=false,controlOps}={}) {
  if(!request || request.jsonrpc!=="2.0" || typeof request.method!=="string")
    return {error:{code:-32600,message:"Invalid JSON-RPC request"}};
  switch(request.method) {
    case "initialize":
      return {result:{protocolVersion:MCP_PROTOCOL,
        capabilities:{tools:{listChanged:false}},
        serverInfo:{name:MCP_NAME,version:controlAuthenticated?"0.2.0":"0.1.0"},
        instructions:controlAuthenticated?"Authenticated native dependency preflight and bounded issue admission are available; no unattended Windows start/stop or autonomous merge is implied.":
          "Read-only PlotPickle Factory status, receipts and GitHub queue preview. A heartbeat is never independent proof."}};
    case "ping": return {result:{}};
    case "tools/list": return {result:{tools:controlAuthenticated?[...MCP_TOOLS,...MCP_CONTROL_TOOLS]:MCP_TOOLS}};
    case "tools/call": {
      const name=request.params?.name,args=request.params?.arguments??{};
      if(!args || typeof args!=="object" || Array.isArray(args))
        return {error:invalidParams()};
      const keys=Object.keys(args);
      const isControl=MCP_CONTROL_TOOLS.some(x=>x.name===name);
      if(isControl&&!controlAuthenticated)return {error:{code:-32001,message:"Factory control authorization required"}};
      if(isControl&&!validControlArgs(name,args))return {error:invalidParams()};
      if(!isControl&&name!=="factory_evidence" && keys.length)
        return {error:invalidParams()};
      let value;
      if(name==="factory_status")value=await factoryStatus({root,now});
      else if(name==="factory_observer")value=await factoryObserver({root,now});
      else if(name==="factory_evidence"){
        if(keys.some(k=>!["issueNumber","attempt"].includes(k)) ||
           !validIssue(args.issueNumber) ||
           (args.attempt!==undefined && ![1,2].includes(args.attempt)) ||
           ((args.attempt??1)===2 && args.issueNumber!==3141))
          return {error:invalidParams()};
        value=await factoryEvidence({root,issueNumber:args.issueNumber,attempt:args.attempt??1});
      }else if(name==="factory_issue_preview")value=await factoryIssuePreview({github});
      else if(isControl)value=await factoryControlAction(name,args,{root,github,now,ops:controlOps});
      else return {error:{code:-32601,message:"Unknown tool"}};
      return {result:{structuredContent:value,
        content:[{type:"text",text:JSON.stringify(value)}],isError:false}};
    }
    default:return {error:{code:-32601,message:"Unknown method"}};
  }
}

export async function handleRpc(payload,services) {
  if(!payload || Array.isArray(payload) || typeof payload!=="object" ||
     payload.jsonrpc!=="2.0" || typeof payload.method!=="string")
    return {jsonrpc:"2.0",id:null,error:{code:-32600,message:"Invalid request"}};
  // Notifications must never trigger tools; only initialized notification is admitted.
  if(!Object.hasOwn(payload,"id")){
    if(payload.method==="notifications/initialized")return null;
    return null;
  }
  if(typeof payload.id!=="string" && typeof payload.id!=="number")
    return {jsonrpc:"2.0",id:null,error:{code:-32600,message:"Invalid id"}};
  try{
    const response=await executeMcpRequest(payload,services);
    return {jsonrpc:"2.0",id:payload.id,...response};
  }catch{
    return {jsonrpc:"2.0",id:payload.id,error:{code:-32603,message:"Factory evidence unavailable"}};
  }
}

export function createLocalMcpHttpServer({root=privateFactoryRoot(),github,now=Date.now,
  controlToken=process.env.PLOTPICKLE_FACTORY_MCP_CONTROL_TOKEN,controlOps}={}) {
  return http.createServer(async(req,res)=>{
    const target=req.url||"";
    const host=String(req.headers.host||"").toLowerCase();
    const allowedHost=/^(?:127\.0\.0\.1|localhost):\d+$/.test(host);
    const origin=req.headers.origin;
    const allowedOrigin=!origin || origin==="http://"+host;
    if(!allowedHost || !allowedOrigin) {
      res.writeHead(403,{"content-type":"application/json"});
      return res.end(JSON.stringify({error:"LOCAL_ONLY"}));
    }
    if(target!=="/mcp") {
      res.writeHead(404);return res.end();
    }
    if(req.method!=="POST") {
      res.writeHead(405,{allow:"POST"});return res.end();
    }
    if(!String(req.headers["content-type"]||"").startsWith("application/json")) {
      res.writeHead(415);return res.end();
    }
    const accept=String(req.headers.accept||"");
    if(!accept.includes("application/json") || !accept.includes("text/event-stream")) {
      res.writeHead(406);return res.end();
    }
    let size=0,chunks=[];
    try{
      for await(const chunk of req){
        size+=chunk.length;if(size>MAX_BYTES) {
          res.writeHead(413);return res.end();
        }
        chunks.push(chunk);
      }
      let parsed;
      try {parsed=JSON.parse(Buffer.concat(chunks).toString("utf8"));}
      catch {res.writeHead(400);return res.end();}
      const controlAuthenticated=controlTokenMatches(
        req.headers["x-plotpickle-factory-control-token"],controlToken);
      const answer=await handleRpc(parsed,{root,github,now,controlAuthenticated,controlOps});
      if(answer===null){res.writeHead(202);return res.end();}
      res.writeHead(200,{"content-type":"application/json; charset=utf-8",
        "cache-control":"no-store","mcp-protocol-version":MCP_PROTOCOL});
      res.end(JSON.stringify(answer));
    }catch{
      if(!res.headersSent)res.writeHead(500);
      res.end();
    }
  });
}

export async function runStdio({root=privateFactoryRoot(),input=process.stdin,
  output=process.stdout,github,now=Date.now}={}) {
  const lines=readline.createInterface({input,crlfDelay:Infinity});
  for await(const line of lines){
    if(Buffer.byteLength(line,"utf8")>MAX_BYTES)continue;
    let data;try{data=JSON.parse(line);}catch{continue;}
    const answer=await handleRpc(data,{root,github,now});
    if(answer!==null)output.write(JSON.stringify(answer)+"\n");
  }
}

async function main(argv=process.argv.slice(2)) {
  if(argv.length===1 && argv[0]==="--stdio"){
    await runStdio();return;
  }
  if(argv.length!==1 || argv[0]!=="--http")
    throw new Error("Use exactly --stdio (Desktop local) or --http (loopback test only).");
  const server=createLocalMcpHttpServer();
  await new Promise((resolve,reject)=>{
    server.once("error",reject);
    server.listen(43115,"127.0.0.1",resolve);
  });
  process.stdout.write("PlotPickle Factory MCP READ ONLY — http://127.0.0.1:43115/mcp (LOCAL TEST ONLY)\n");
  process.stdout.write("Not reachable from ChatGPT web without an authenticated HTTPS connection or supported Secure MCP Tunnel.\n");
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(()=>{process.stderr.write("PlotPickle MCP startup blocked. No changes made.\n");process.exitCode=1;});
