/**
 * #3142: owner-CONSOLE-only grant issuer for the FIRST ChatGPT-native edit.
 * Fixed issue/file/test/objective. Does not call a model API, modify source,
 * execute a candidate, open a listener, publish, sign verification or merge.
 * The immutable pilot admission survives process restart; no uncertain replay.
 */
import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { gatewayAppSource, privateGatewayRoot } from "../gateway-host.mjs";
import { appendPrivateJsonOnce } from "../receipts/write-once-json.mjs";
import { validateChatEditGrant } from "./owner-chat-edit-once.mjs";

const run = promisify(execFile);
const HEAD = /^[a-f0-9]{40}$/, ID = /^[a-f0-9]{32}$/;
const CONSENT = "AUTHORIZE_ONE_CHATGPT_SOURCE_EDIT";
const PILOT = Object.freeze({
  issueNumber:3142,
  targetPath:"scripts/engineering-team/mcp/factory-observer.mjs",
  focusedTest:"tests/issue-3154-chatgpt-factory-mcp.test.mjs",
  objective:"Normalize unrecognized Factory observer states to UNKNOWN while preserving intentional STOP."
});
const blocked = code => ({state:"BLOCKED",code,replayAuthorized:false,
  modelInvoked:false,pullRequestCreated:false,independentVerification:false,
  automaticMergeAuthorized:false});
const exists = async filename => {
  try {await lstat(filename);return true;}
  catch(e){return e.code!=="ENOENT";}
};
async function safeDir(root, segments) {
  let dir=root;
  for(const segment of segments) {
    dir=path.join(dir,segment);
    try {await mkdir(dir,{mode:0o700});}
    catch(e){if(e.code!=="EEXIST")throw e;}
    const s=await lstat(dir);
    if(!s.isDirectory()||s.isSymbolicLink())throw Error("PRIVATE_PATH_UNTRUSTED");
  }
  return dir;
}
async function safeRelativeFile(root, relative, maxBytes) {
  let current=root;
  for(const piece of relative.split("/")) {
    current=path.join(current,piece);
    const st=await lstat(current);
    if(st.isSymbolicLink())throw Error("PILOT_FILE_SYMLINK");
  }
  const s=await lstat(current);
  if(!s.isFile()||s.size<1||s.size>maxBytes)throw Error("PILOT_FILE_UNTRUSTED");
  return readFile(current,"utf8");
}
/**
 * Caller must execute in owner Windows interactive console. Fixture injection
 * is permitted for tests only and cannot alter the fixed production pilot.
 */
export async function issueFirstChatPilotGrant({
  repoRoot=process.cwd(),env=process.env,platform=process.platform,
  interactive=process.stdin.isTTY===true,consent,now=Date.now,
  getSource=()=>gatewayAppSource({repoRoot,env}),
  git=async args=>String((await run("git",args,{cwd:repoRoot,windowsHide:true,
    timeout:8000,maxBuffer:4096})).stdout).trim(),
  privateRoot=privateGatewayRoot(env),
  newId=()=>randomBytes(16).toString("hex")
}={}) {
  if(platform!=="win32"||interactive!==true)return blocked("OWNER_WINDOWS_CONSOLE_REQUIRED");
  if(consent!==CONSENT)return blocked("EXPLICIT_OWNER_EDIT_CONSENT_REQUIRED");
  if(!path.isAbsolute(repoRoot)||!path.isAbsolute(privateRoot))
    return blocked("OWNER_ABSOLUTE_PATHS_REQUIRED");
  if(process.platform==="win32" &&
     [repoRoot,privateRoot].some(p=>path.parse(p).root.toLowerCase()!=="c:\\"))
    return blocked("ACTIVE_CODE_AND_GRANTS_MUST_REMAIN_ON_C");
  let source;
  try {
    const main=await lstat(repoRoot);
    if(!main.isDirectory()||main.isSymbolicLink())
      return blocked("MAIN_DIRECTORY_UNVERIFIABLE");
    source=await getSource();
    if(source?.channel!=="main"||!HEAD.test(source.head||"")||
       await git(["rev-parse","origin/main"])!==source.head)
      return blocked("EXACT_ORIGIN_MAIN_UNVERIFIABLE");
  }catch{return blocked("EXACT_ORIGIN_MAIN_UNVERIFIABLE");}
  const nowMs=now(),grantId=newId();
  if(!Number.isSafeInteger(nowMs)||!ID.test(grantId||""))
    return blocked("PILOT_ID_OR_CLOCK_UNVERIFIABLE");
  let target,test;
  try {
    target=await safeRelativeFile(repoRoot,PILOT.targetPath,16384);
    test=await safeRelativeFile(repoRoot,PILOT.focusedTest,256000);
    if(!test.includes("test("))return blocked("FOCUSED_TEST_UNVERIFIABLE");
  }catch{return blocked("PILOT_TARGET_OR_TEST_UNVERIFIABLE");}
  // STOP and PAUSE admission must be observed BEFORE consuming a pilot.
  const stops=[
    path.join(privateRoot,"engineering-dispatcher","stop-request.json"),
    path.resolve(privateRoot,"..","supervisor","stop-request.json"),
    path.resolve(privateRoot,"..","supervisor","pause-request.json")
  ];
  for(const marker of stops)if(await exists(marker))
    return blocked("INTENTIONAL_STOP_OR_PAUSE");
  const grant={
    schemaVersion:1,kind:"engineering-chat-edit-once",grantId,
    issueNumber:PILOT.issueNumber,sourceHead:source.head,
    targetPath:PILOT.targetPath,
    targetDigest:createHash("sha256").update(target.replace(/\r\n/g,"\n")).digest("hex"),
    focusedTest:PILOT.focusedTest,objective:PILOT.objective,
    expiresAt:nowMs+1800000,maxRequests:1,consent:CONSENT
  };
  if(!validateChatEditGrant(grant,source,nowMs))
    return blocked("CHAT_EDIT_GRANT_CONTRACT_INVALID");
  let dir;
  try {
    const root=await lstat(privateRoot);
    if(!root.isDirectory()||root.isSymbolicLink())
      return blocked("OWNER_PRIVATE_ROOT_UNVERIFIABLE");
    dir=await safeDir(privateRoot,["owner-coding-grants"]);
  }catch{return blocked("OWNER_GRANT_DIRECTORY_UNVERIFIABLE");}
  // Reserved marker is irreversible: an ambiguous disk write is reviewed,
  // NEVER retried under a second grant or given a fabricated success.
  const admitted=await appendPrivateJsonOnce(path.join(dir,".pilot-3142-chat-reserved.json"),{
    schemaVersion:1,kind:"first-chat-pilot-admission",grantId,
    sourceHead:source.head,issueNumber:PILOT.issueNumber,issuedAt:nowMs,
    state:"RESERVED_NO_REPLAY"
  }).catch(()=>false);
  if(!admitted)return blocked("PILOT_ALREADY_RESERVED_OR_UNVERIFIABLE");
  const stored=await appendPrivateJsonOnce(path.join(dir,grantId+".json"),grant).catch(()=>false);
  if(!stored)return blocked("PILOT_GRANT_WRITE_UNCERTAIN_NO_REPLAY");
  return {state:"OWNER_CHAT_GRANT_READY",grantId,issueNumber:PILOT.issueNumber,
    sourceHead:source.head,targetPath:PILOT.targetPath,
    focusedTest:PILOT.focusedTest,expiresAt:grant.expiresAt,
    replayAuthorized:false,modelInvoked:false,sourceMutationVerified:false,
    pullRequestCreated:false,independentVerification:false,
    automaticMergeAuthorized:false};
}
if(process.argv[1] && import.meta.url===new URL("file://"+path.resolve(process.argv[1]).replaceAll("\\","/")).href) {
  const exact=process.argv.length===3 && process.argv[2]===CONSENT;
  const result=await issueFirstChatPilotGrant({
    consent:exact?CONSENT:null
  });
  process.stdout.write(JSON.stringify(result)+"\n");
  if(result.state!=="OWNER_CHAT_GRANT_READY")process.exitCode=1;
}
