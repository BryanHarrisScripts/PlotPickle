#!/usr/bin/env node
/**
 * #3154: local-only read-only MCP bridge for ChatGPT -> PlotPickle Factory.
 * No model calls, GitHub mutations, queue authorization, replay, or STOP.
 * Loopback HTTP is for local protocol inspection, NEVER an unauthenticated tunnel.
 */
import http from "node:http";
import { existsSync } from "node:fs";
import { lstat, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { pathToFileURL } from "node:url";
import {
  readFactoryStatus, planNewestFirst, createQueueGitHubClient,
} from "../windows/autonomous-queue.mjs";

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
  "ISSUE_SCOPE_VIOLATION","DISALLOWED_SOURCE_PATH","RETRY_NOT_AUTHORIZED"]);
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

export async function factoryStatus({root=privateFactoryRoot(),now=Date.now}={}) {
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

export async function factoryIssuePreview({github=createQueueGitHubClient()}={}) {
  try {
    const issues=await github.issues(); // gh issue list; read only
    const preview=planNewestFirst(issues);
    return {state:"PLAN_ONLY",repository:REPOSITORY,
      listedIssues:preview.listedIssues,totalEligible:preview.totalEligible,
      proposedIssues:preview.proposedIssues.map(x=>({number:x.number})),
      truncatedAtGithubLimit:preview.truncatedAtGithubLimit,
      queueModified:false,workerStarted:false,approvalRequired:true};
  } catch {
    return {state:"GITHUB_UNAVAILABLE",queueModified:false,workerStarted:false,approvalRequired:true};
  }
}

export const MCP_TOOLS=Object.freeze([
  {name:"factory_status",title:"Read PlotPickle Factory status",
    description:"Read the local Factory heartbeat, approved issue count and sanitized last outcome. Never treats heartbeat as verification.",
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
  now=Date.now}={}) {
  if(!request || request.jsonrpc!=="2.0" || typeof request.method!=="string")
    return {error:{code:-32600,message:"Invalid JSON-RPC request"}};
  switch(request.method) {
    case "initialize":
      return {result:{protocolVersion:MCP_PROTOCOL,
        capabilities:{tools:{listChanged:false}},
        serverInfo:{name:MCP_NAME,version:"0.1.0"},
        instructions:"Read-only PlotPickle Factory status, receipts and GitHub queue preview. This bridge cannot authorize, start, stop, mutate, retry or merge anything. A heartbeat is never independent proof."}};
    case "ping": return {result:{}};
    case "tools/list": return {result:{tools:MCP_TOOLS}};
    case "tools/call": {
      const name=request.params?.name,args=request.params?.arguments??{};
      if(!args || typeof args!=="object" || Array.isArray(args))
        return {error:invalidParams()};
      const keys=Object.keys(args);
      if(name!=="factory_evidence" && keys.length)
        return {error:invalidParams()};
      let value;
      if(name==="factory_status")value=await factoryStatus({root,now});
      else if(name==="factory_evidence"){
        if(keys.some(k=>!["issueNumber","attempt"].includes(k)) ||
           !validIssue(args.issueNumber) ||
           (args.attempt!==undefined && ![1,2].includes(args.attempt)) ||
           ((args.attempt??1)===2 && args.issueNumber!==3141))
          return {error:invalidParams()};
        value=await factoryEvidence({root,issueNumber:args.issueNumber,attempt:args.attempt??1});
      }else if(name==="factory_issue_preview")value=await factoryIssuePreview({github});
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

export function createLocalMcpHttpServer({root=privateFactoryRoot(),github,now=Date.now}={}) {
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
      const answer=await handleRpc(parsed,{root,github,now});
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
