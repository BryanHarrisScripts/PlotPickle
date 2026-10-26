#!/usr/bin/env node
/**
 * #3142: separate, owner-authenticated MCP execution surface for the existing
 * one-shot coding + draft PR worker. This is NOT a resident dispatcher.
 * Deliberately no issue-text commands, grant issuance, queue replay or merge.
 */
import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { lstat, mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gatewayAppSource, privateGatewayRoot } from "../../gateway/gateway-host.mjs";
import { runOwnerCodingAndPublishOnce } from "../../gateway/authorized-coding-once.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const ID = /^[a-f0-9]{32}$/;
const SHA = /^[a-f0-9]{40}$/;
const MAX_BODY = 8192;
const PROTOCOL = "2025-06-18";
const TOOL_DEFINITIONS = Object.freeze([
  { name: "engineering_dispatch_status", description: "Read local execution grant/STOP/lock readiness. Does not claim the Factory is online.", inputSchema: {type:"object",properties:{},additionalProperties:false} },
  { name: "engineering_execute_once", description: "On the paired Windows owner host, consume TWO existing separate owner grants to execute one coding request and publish only a draft PR. Exact clean main, STOP and write-once no-replay checks apply; no tests or merge are implied.", inputSchema: {type:"object",properties:{
    requestId:{type:"string",pattern:"^[a-f0-9]{32}$"},
    expectedHead:{type:"string",pattern:"^[a-f0-9]{40}$"},
    codingGrantId:{type:"string",pattern:"^[a-f0-9]{32}$"},
    publicationId:{type:"string",pattern:"^[a-f0-9]{32}$"}
  },required:["requestId","expectedHead","codingGrantId","publicationId"],additionalProperties:false} },
  { name: "engineering_dispatch_receipt", description: "Read a reserved/result receipt; missing outcome is uncertain and NEVER replayable.", inputSchema: {type:"object",properties:{requestId:{type:"string",pattern:"^[a-f0-9]{32}$"}},required:["requestId"],additionalProperties:false} },
  { name: "engineering_dispatch_stop", description: "Write irreversible local STOP admission marker. Prevents NEW dispatch; cannot claim termination of a running model or owned process tree.", inputSchema: {type:"object",properties:{requestId:{type:"string",pattern:"^[a-f0-9]{32}$"}},required:["requestId"],additionalProperties:false} },
].map(x => Object.freeze({ ...x, annotations:{readOnlyHint:x.name.endsWith("status")||x.name.endsWith("receipt"),destructiveHint:false,openWorldHint:false} })));

export function authenticDispatcherToken(provided, configured) {
  if (typeof provided!=="string" || typeof configured!=="string" ||
      !/^[a-zA-Z0-9_-]{48,128}$/.test(configured) ||
      !/^[a-zA-Z0-9_-]{48,128}$/.test(provided)) return false;
  const a=Buffer.from(provided), b=Buffer.from(configured);
  return a.length===b.length && timingSafeEqual(a,b);
}
function exact(value, required) {
  return value!==null && typeof value==="object" && !Array.isArray(value) &&
    Object.keys(value).length===required.length && required.every(k=>Object.hasOwn(value,k));
}
function locations(root) {
  const dir=path.join(root,"engineering-dispatcher");
  return { dir, receipts:path.join(dir,"requests"),
    lock:path.join(dir,"running.lock"),stop:path.join(dir,"stop-request.json"),
    supervisorStop:path.resolve(root,"..","supervisor","stop-request.json"),
    supervisorPause:path.resolve(root,"..","supervisor","pause-request.json") };
}
async function exists(filename) {
  try { await lstat(filename);return true; }
  catch(e) { if(e?.code==="ENOENT")return false;return true; }
}
async function writeOnce(filename, value) {
  let handle;
  try {
    handle=await open(filename,"wx",0o600);
    await handle.writeFile(JSON.stringify(value)+"\n","utf8");
    await handle.sync();
    return true;
  } catch { return false; }
  finally { await handle?.close().catch(()=>{}); }
}
async function safeRecord(file) {
  try {
    const st=await lstat(file);
    if(!st.isFile()||st.isSymbolicLink()||st.size>4096||st.size<2)return null;
    return JSON.parse(await readFile(file,"utf8"));
  }catch{return null;}
}
const blocked=(code,requestId=null)=>({state:"BLOCKED",code,requestId,
  replayAuthorized:false,independentVerification:false,automaticMergeAuthorized:false});
async function stopped(p) {
  return await exists(p.stop)||await exists(p.supervisorStop)||await exists(p.supervisorPause);
}
async function receipt(root,id) {
  if(!ID.test(id||""))return blocked("INVALID_REQUEST_ID");
  const p=locations(root), reservationFile=path.join(p.receipts,id+".reserved.json");
  const reserved=await safeRecord(reservationFile);
  if(reserved?.requestId!==id) {
    // A missing reservation is different from an unreadable/corrupted one.
    // The latter may represent real work; never report it as never started.
    if(await exists(reservationFile))return {state:"STARTED_UNCONFIRMED",
      requestId:id,replayAuthorized:false,independentVerification:false,
      automaticMergeAuthorized:false};
    return {state:"NO_RESERVATION",requestId:id,replayAuthorized:false};
  }
  const result=await safeRecord(path.join(p.receipts,id+".result.json"));
  const validPublished=result?.requestId===id && result.state==="DRAFT_PR_CREATED" &&
    Number.isSafeInteger(result.prNumber) && result.prNumber>=1 &&
    result.prNumber<=9_999_999 && SHA.test(result.candidateHead||"") &&
    /^[a-f0-9]{64}$/.test(result.engineeringReceiptId||"") &&
    result.focusedTestExecuted===false && result.replayAuthorized===false &&
    result.independentVerification===false && result.automaticMergeAuthorized===false;
  const validBlocked=result?.requestId===id && result.state==="BLOCKED" &&
    typeof result.code==="string" && /^[A-Z0-9_]{3,100}$/.test(result.code) &&
    result.replayAuthorized===false && result.independentVerification===false &&
    result.automaticMergeAuthorized===false;
  if(validPublished||validBlocked)
    return {...result,replayAuthorized:false,independentVerification:false,
      automaticMergeAuthorized:false};
  return {state:"STARTED_UNCONFIRMED",requestId:id,replayAuthorized:false,
    independentVerification:false,automaticMergeAuthorized:false};
}

/** Separate control surface; only a locally provisioned owner grant can authorize work. */
export async function dispatcherAction(name,args={},{
  root=privateGatewayRoot(),platform=process.platform,
  enabled=process.env.PLOTPICKLE_ENGINEERING_DISPATCH_ENABLED==="1",
  source=()=>gatewayAppSource({repoRoot:REPO}),
  execute=runOwnerCodingAndPublishOnce,now=Date.now,
}={}) {
  const p=locations(root);
  if(name==="engineering_dispatch_status" && exact(args,[]))return {
    state:"ONE_SHOT_BRIDGE_ONLY",enabled:enabled&&platform==="win32",
    stopRequested:await stopped(p),runningOrStaleLock:await exists(p.lock),
    queueConnected:false,independentVerification:false,automaticMergeAuthorized:false };
  if(name==="engineering_dispatch_receipt"&&exact(args,["requestId"]))
    return receipt(root,args.requestId);
  if(name==="engineering_dispatch_stop"&&exact(args,["requestId"])&&ID.test(args.requestId)) {
    if(platform!=="win32"||!enabled)return blocked("DISPATCH_NOT_ENABLED",args.requestId);
    try {await mkdir(p.dir,{recursive:true,mode:0o700});}
    catch {return blocked("STOP_STORAGE_UNVERIFIABLE",args.requestId);}
    if(!await writeOnce(p.stop,{schemaVersion:1,requestId:args.requestId,
      requestedAt:now(),state:"STOP_REQUESTED"}))
      return {state:"STOP_ALREADY_REQUESTED_OR_UNVERIFIABLE",replayAuthorized:false,
        inFlightMayContinue:true};
    return {state:"STOP_REQUESTED",replayAuthorized:false,inFlightMayContinue:true};
  }
  if(name!=="engineering_execute_once"||!exact(args,
    ["requestId","expectedHead","codingGrantId","publicationId"])||
      !ID.test(args.requestId||"")||!SHA.test(args.expectedHead||"")||
      !ID.test(args.codingGrantId||"")||!ID.test(args.publicationId||"")||
      args.codingGrantId===args.publicationId)return blocked("INVALID_EXECUTION_SELECTION");
  if(platform!=="win32"||!enabled)return blocked("DISPATCH_NOT_ENABLED",args.requestId);
  if(await stopped(p))return blocked("INTENTIONAL_STOP_OR_PAUSE",args.requestId);
  let verified;
  try { verified=await source(); }catch{return blocked("SOURCE_UNVERIFIABLE",args.requestId);}
  if(verified?.head!==args.expectedHead||verified?.channel!=="main")
    return blocked("EXACT_CLEAN_MAIN_REQUIRED",args.requestId);
  try {
    await mkdir(p.receipts,{recursive:true,mode:0o700});
    const st=await lstat(p.receipts);
    if(!st.isDirectory()||st.isSymbolicLink())return blocked("RECEIPT_STORAGE_UNVERIFIABLE",args.requestId);
  }catch{return blocked("RECEIPT_STORAGE_UNVERIFIABLE",args.requestId);}
  if(await exists(path.join(p.receipts,args.requestId+".reserved.json")))
    return blocked("REQUEST_ALREADY_RESERVED_NO_REPLAY",args.requestId);
  if(!await writeOnce(p.lock,{requestId:args.requestId,sourceHead:verified.head,at:now()}))
    return blocked("ACTIVE_OR_STALE_EXECUTION_LOCK",args.requestId);
  let complete=false, stoppedBeforeReservation=false;
  try {
    // STOP after preflight but before reservation is a known no-work outcome.
    // Release only our lock; the durable STOP marker remains authoritative.
    if(await stopped(p)) {
      stoppedBeforeReservation=true;
      return blocked("INTENTIONAL_STOP_OR_PAUSE",args.requestId);
    }
    if(!await writeOnce(path.join(p.receipts,args.requestId+".reserved.json"),{
      schemaVersion:1,requestId:args.requestId,expectedHead:args.expectedHead,
      codingGrantId:args.codingGrantId,publicationId:args.publicationId,
      reservedAt:now(),state:"RESERVED_NO_REPLAY"}))
      return blocked("REQUEST_ALREADY_RESERVED_NO_REPLAY",args.requestId);
    let result;
    try {
      // No arguments derived from GitHub issue text; worker checks BOTH private
      // grants independently, and cannot perform automatic merge.
      result=await execute({grantId:args.codingGrantId,publicationId:args.publicationId});
    }catch{return {state:"STARTED_UNCONFIRMED",requestId:args.requestId,replayAuthorized:false};}
    // Success requires the verified TWO-grant publication and a correlated
    // durable engineering receipt. A PR-like model response is not evidence.
    const published=result?.state==="DRAFT_PR_CREATED" &&
      result.grantId===args.codingGrantId &&
      result.publicationId===args.publicationId &&
      result.sourceHead===args.expectedHead &&
      Number.isSafeInteger(result.prNumber) &&
      result.prNumber>=1 && result.prNumber<=9_999_999 &&
      SHA.test(result.remoteCommit||"") &&
      /^[a-f0-9]{64}$/.test(result.engineeringReceiptId||"") &&
      result.pullRequestCreated===true &&
      result.focusedTestExecuted===false &&
      result.independentVerification===false &&
      result.automaticMergeAuthorized===false &&
      result.replayAuthorized===false;
    const value=published ? {
      state:"DRAFT_PR_CREATED",requestId:args.requestId,prNumber:result.prNumber,
      candidateHead:result.remoteCommit,engineeringReceiptId:result.engineeringReceiptId,
      focusedTestExecuted:false,replayAuthorized:false,independentVerification:false,
      automaticMergeAuthorized:false
    } : blocked("ENGINEERING_OR_PUBLICATION_RECEIPT_UNVERIFIED",args.requestId);
    if(!await writeOnce(path.join(p.receipts,args.requestId+".result.json"),value))
      return {state:"STARTED_UNCONFIRMED",requestId:args.requestId,replayAuthorized:false};
    complete=value.state==="DRAFT_PR_CREATED";
    return value;
  } finally {
    // Ambiguous work retains the lock. A STOP before reservation cannot have
    // invoked the worker, so release only our owned lock while preserving STOP.
    // Never clean uncertain worktrees, grants, branches, or reservations.
    if(complete||stoppedBeforeReservation) {
      const lock=await safeRecord(p.lock);
      if(lock?.requestId===args.requestId)await unlink(p.lock).catch(()=>{});
    }
  }
}
export async function dispatcherRpc(message,{
  authenticated=false,root,platform,enabled,source,execute,now,
}={}) {
  if(message?.jsonrpc!=="2.0"||!Object.hasOwn(message,"id"))
    return {jsonrpc:"2.0",id:null,error:{code:-32600,message:"Invalid request"}};
  const id=typeof message.id==="string"||typeof message.id==="number"?message.id:null;
  if(id===null)return {jsonrpc:"2.0",id:null,error:{code:-32600,message:"Invalid id"}};
  if(message.method==="initialize")return {jsonrpc:"2.0",id,result:{
    protocolVersion:PROTOCOL,capabilities:{tools:{listChanged:false}},
    serverInfo:{name:"plotpickle-engineering-dispatcher",version:"0.1.0"},
    instructions:"Separate owner-authenticated one-shot coding and draft-PR bridge. No unattended queue, live verification, or merge authority."}};
  if(message.method==="ping")return {jsonrpc:"2.0",id,result:{}};
  if(message.method==="tools/list")return {jsonrpc:"2.0",id,result:{
    tools:authenticated?TOOL_DEFINITIONS:[]}};
  if(message.method!=="tools/call")return {jsonrpc:"2.0",id,error:{code:-32601,message:"Unknown method"}};
  if(!authenticated)return {jsonrpc:"2.0",id,error:{code:-32001,message:"Owner dispatch authorization required"}};
  const name=message.params?.name,args=message.params?.arguments??{};
  if(!TOOL_DEFINITIONS.some(x=>x.name===name)||!args||typeof args!=="object")
    return {jsonrpc:"2.0",id,error:{code:-32602,message:"Invalid tool selection"}};
  const output=await dispatcherAction(name,args,{root,platform,enabled,source,execute,now});
  return {jsonrpc:"2.0",id,result:{structuredContent:output,
    content:[{type:"text",text:JSON.stringify(output)}],isError:false}};
}
export function createDispatcherServer({
  token=process.env.PLOTPICKLE_ENGINEERING_DISPATCH_TOKEN,options={},
}={}) {
  return http.createServer(async(req,res)=>{
    const host=String(req.headers.host||"").toLowerCase();
    if(req.url!=="/mcp"||req.method!=="POST"||
       !/^(?:127\.0\.0\.1|localhost):\d+$/.test(host)||
       (req.headers.origin&&req.headers.origin!=="http://"+host)) {
      res.writeHead(403);return res.end();
    }
    if(!String(req.headers["content-type"]||"").startsWith("application/json")) {
      res.writeHead(415);return res.end();
    }
    let bytes=0,parts=[];
    try {
      for await(const chunk of req) {
        bytes+=chunk.length;if(bytes>MAX_BODY){res.writeHead(413);return res.end();}
        parts.push(chunk);
      }
      const message=JSON.parse(Buffer.concat(parts).toString("utf8"));
      const provided=req.headers["x-plotpickle-engineering-dispatch-token"];
      const answer=await dispatcherRpc(message,{...options,
        authenticated:authenticDispatcherToken(provided,token)});
      res.writeHead(200,{"content-type":"application/json; charset=utf-8",
        "cache-control":"no-store","mcp-protocol-version":PROTOCOL});
      return res.end(JSON.stringify(answer));
    }catch {
      if(!res.headersSent)res.writeHead(400);
      return res.end();
    }
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  if(process.argv.length!==3||process.argv[2]!=="--http")
    throw Error("DISPATCH_PLUGIN_HTTP_ONLY");
  createDispatcherServer().listen(43116,"127.0.0.1");
}
