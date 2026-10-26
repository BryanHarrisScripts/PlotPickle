/**
 * #3142 ChatGPT-authored, owner-granted, one-shot source edit.
 * Distinct from the OpenAI Responses API worker. A connected chat may propose
 * ONE exact substitution; only a private owner grant authorizes local mutation.
 * No model invocation, generated-code execution, publisher, shell or merge.
 */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, mkdir, open, readFile, writeFile, readdir, statfs, unlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { gatewayAppSource, privateGatewayRoot } from "../gateway-host.mjs";
import { boundedSourceEdit } from "../authorized-coding-once.mjs";
import { appendPrivateJsonOnce } from "../receipts/write-once-json.mjs";

const exec = promisify(execFile);
const ID = /^[a-f0-9]{32}$/, SHA = /^[a-f0-9]{40}$/, DIGEST = /^[a-f0-9]{64}$/;
const SOURCE = /^scripts\/engineering-team\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.mjs$/;
const TEST = /^tests\/issue-[0-9]+-[a-z0-9-]+\.test\.mjs$/;
const CONSENT = "AUTHORIZE_ONE_CHATGPT_SOURCE_EDIT";
const MIN_FREE = 9n * 1024n ** 3n;
const hash = value => createHash("sha256").update(value, "utf8").digest("hex");
const block = code => Object.freeze({ state:"BLOCKED", code, sourceMutationVerified:false,
  pullRequestCreated:false, independentVerification:false, automaticMergeAuthorized:false,
  replayAuthorized:false, modelInvoked:false });
const exact = (v, keys) => v !== null && typeof v === "object" && !Array.isArray(v) &&
  Object.getPrototypeOf(v) === Object.prototype && Object.keys(v).length === keys.length &&
  keys.every(k => Object.hasOwn(v,k));
const safeFile = async (filename, limit=16384) => {
  const s = await lstat(filename);
  if (!s.isFile() || s.isSymbolicLink() || s.size < 1 || s.size > limit) throw Error("UNTRUSTED_FILE");
  return readFile(filename, "utf8");
};
const safeTarget = async (root, relative) => {
  let p=root;
  for (const part of relative.split("/")) {
    p=path.join(p,part);
    const s=await lstat(p);
    if(s.isSymbolicLink()) throw Error("SYMLINK_TARGET");
  }
  return p;
};
export function validateChatEditGrant(grant,source,at) {
  return exact(grant,["schemaVersion","kind","grantId","issueNumber","sourceHead",
    "targetPath","targetDigest","focusedTest","objective","expiresAt","maxRequests","consent"]) &&
    grant.schemaVersion===1 && grant.kind==="engineering-chat-edit-once" &&
    ID.test(grant.grantId||"") && Number.isSafeInteger(grant.issueNumber) &&
    grant.issueNumber>=1 && grant.issueNumber<=9999999 &&
    source?.channel==="main" && SHA.test(source.head||"") &&
    grant.sourceHead===source.head && SOURCE.test(grant.targetPath||"") &&
    DIGEST.test(grant.targetDigest||"") && TEST.test(grant.focusedTest||"") &&
    typeof grant.objective==="string" && grant.objective.length>=16 &&
    grant.objective.length<=1000 &&
    !/(?:sk-[a-z0-9_-]{12,}|ghp_[a-z0-9]{12,}|bearer\s+\S+)/i.test(grant.objective) &&
    Number.isSafeInteger(grant.expiresAt) && grant.expiresAt>at+30000 &&
    grant.expiresAt<=at+3600000 && grant.maxRequests===1 && grant.consent===CONSENT;
}
const validProposal = value => exact(value,["oldText","newText"]) &&
  typeof value.oldText==="string" && value.oldText.length>=8 &&
  value.oldText.length<=3000 && typeof value.newText==="string" &&
  value.newText.length>=1 && value.newText.length<=3000 &&
  value.oldText!==value.newText;
async function safeDirectory(p) {
  const s=await lstat(p);
  if(!s.isDirectory()||s.isSymbolicLink())throw Error("UNTRUSTED_DIRECTORY");
}
/**
 * Testable core: proposal never runs as a command and never chooses a path.
 * Lock is held for the entire edit and preserved if the result is uncertain.
 */
export async function prepareChatEditOnce({repoRoot,privateRoot,source,grant,proposal,
  platform=process.platform,now=Date.now,runGit,syntaxCheck,disk=statfs}={}) {
  const at=now();
  if(platform!=="win32" || !validateChatEditGrant(grant,source,at) ||
     !validProposal(proposal) || !path.isAbsolute(repoRoot||"") ||
     !path.isAbsolute(privateRoot||""))return block("CHAT_GRANT_OR_PROPOSAL_INVALID");
  // The real owner host holds active source and evidence on C:, never G:.
  if(process.platform==="win32" && [repoRoot,privateRoot].some(p=>
      path.parse(p).root.toLowerCase()!=="c:\\"))return block("LIVE_CODE_MUST_REMAIN_ON_C");
  const git=runGit||(async(cwd,args)=>exec("git",args,{
    cwd,windowsHide:true,timeout:30000,maxBuffer:8192}));
  const syntax=syntaxCheck||(async(cwd,file)=>exec(process.execPath,["--check",file],{
    cwd,windowsHide:true,timeout:15000,maxBuffer:8192}));
  let original;
  try {
    original=await safeFile(await safeTarget(repoRoot,grant.targetPath));
    await safeFile(await safeTarget(repoRoot,grant.focusedTest),256000);
  }catch{return block("CHAT_TARGET_UNVERIFIABLE");}
  if(hash(original.replace(/\r\n/g,"\n"))!==grant.targetDigest)
    return block("CHAT_TARGET_DIGEST_MISMATCH");
  const replacement=boundedSourceEdit(original,proposal);
  if(!replacement || Buffer.byteLength(replacement,"utf8")>16384)
    return block("CHAT_REPLACEMENT_UNVERIFIABLE");
  const receipts=path.join(privateRoot,"coding-attempts");
  const stages=path.join(privateRoot,"coding-worktrees");
  try {
    for(const dir of [privateRoot,receipts,stages]) {
      if(dir!==privateRoot)await mkdir(dir,{mode:0o700}).catch(e=>{
        if(e.code!=="EEXIST")throw e;
      });
      await safeDirectory(dir);
    }
  }catch{return block("CHAT_PRIVATE_STORAGE_UNVERIFIABLE");}
  const reservation=path.join(receipts,grant.grantId+".reserved.json");
  const lockPath=path.join(receipts,".coding-stage-budget.lock");
  const stage=path.join(stages,grant.grantId);
  let lock,ready=false,completed=false;
  try {
    lock=await open(lockPath,"wx",0o600);
    await lock.writeFile(JSON.stringify({grantId:grant.grantId,at})+"\n");
    await lock.sync();
    const entries=await readdir(stages,{withFileTypes:true});
    const ids=new Set();
    for(const entry of entries) {
      const marker=/^\.reserved-([a-f0-9]{32})\.json$/.exec(entry.name);
      if(marker&&entry.isFile()&&!entry.isSymbolicLink())ids.add(marker[1]);
      else if(ID.test(entry.name)&&entry.isDirectory()&&!entry.isSymbolicLink())ids.add(entry.name);
      else return block("CHAT_STAGE_INVENTORY_UNVERIFIABLE");
    }
    if(ids.size>4096)return block("CHAT_STAGE_INVENTORY_UNVERIFIABLE");
    const space=await disk(stages,{bigint:true});
    if(BigInt(space.bavail)<0n||BigInt(space.bsize)<=0n)
      return block("CHAT_DISK_UNVERIFIABLE");
    if(BigInt(space.bavail)*BigInt(space.bsize)<MIN_FREE)
      return block("CHAT_DISK_RESOURCE_PRESSURE");
    if(!await appendPrivateJsonOnce(path.join(stages,".reserved-"+grant.grantId+".json"),
      {schemaVersion:1,grantId:grant.grantId,at,state:"RESERVED_NO_REPLAY"}))
      return block("CHAT_STAGE_ALREADY_RESERVED_OR_UNVERIFIABLE");
    if(!await appendPrivateJsonOnce(reservation,{schemaVersion:1,grantId:grant.grantId,
      issueNumber:grant.issueNumber,sourceHead:source.head,at,state:"RESERVED_NO_REPLAY"}))
      return block("CHAT_GRANT_ALREADY_RESERVED_OR_UNVERIFIABLE");
    ready=true;
    const branch="engineering/"+grant.issueNumber+"-"+grant.grantId;
    let value;
    try {
      await git(repoRoot,["-c","core.hooksPath="+path.join(privateRoot,"disabled-hooks"),
        "worktree","add","--detach",stage,source.head]);
      await git(stage,["-c","core.hooksPath="+path.join(privateRoot,"disabled-hooks"),
        "switch","-c",branch]);
      const target=await safeTarget(stage,grant.targetPath);
      const initial=await safeFile(target);
      if(initial.replace(/\r\n/g,"\n")!==original.replace(/\r\n/g,"\n"))
        throw Error("STAGED_SOURCE_CHANGED");
      await writeFile(target,replacement,"utf8");
      await git(stage,["diff","--check"]);
      await syntax(stage,target);
      const changed=String((await git(stage,["diff","--name-only"])).stdout||"").trim();
      if(changed!==grant.targetPath)throw Error("CHANGED_PATH_MISMATCH");
      await git(stage,["add","--",grant.targetPath]);
      await git(stage,["-c","commit.gpgSign=false",
        "-c","core.hooksPath="+path.join(privateRoot,"disabled-hooks"),
        "commit","-m","fix(#"+grant.issueNumber+"): bounded ChatGPT owner-approved edit"]);
      const commit=String((await git(stage,["rev-parse","HEAD"])).stdout||"").trim();
      if(!SHA.test(commit))throw Error("COMMIT_UNVERIFIABLE");
      // Evidence cannot claim an isolated success if the live MAIN changed
      // during the chat-proposed edit, even if the detached commit is valid.
      const mainAfter=String((await git(repoRoot,["rev-parse","HEAD"])).stdout||"").trim();
      const mainDirty=String((await git(repoRoot,
        ["status","--porcelain","--untracked-files=no"])).stdout||"").trim();
      if(mainAfter!==source.head||mainDirty!=="")throw Error("LIVE_MAIN_CHANGED");
      value={state:"LOCAL_COMMIT_PREPARED",code:"SYNTAX_CHECK_PASSED_TESTS_PENDING",
        grantId:grant.grantId,issueNumber:grant.issueNumber,sourceHead:source.head,
        commit,branch,focusedTest:grant.focusedTest,sourceMutationVerified:true,
        focusedTestExecuted:false,pullRequestCreated:false,independentVerification:false,
        automaticMergeAuthorized:false,replayAuthorized:false,modelInvoked:false,
        editOrigin:"authenticated-chat-proposal"};
    } catch {
      value=block("CHAT_EDIT_OUTCOME_UNCERTAIN_REVIEW_STAGE");
    }
    if(!await appendPrivateJsonOnce(path.join(receipts,grant.grantId+".result.json"),value))
      return block("CHAT_RESULT_RECEIPT_UNVERIFIABLE");
    completed=value.state==="LOCAL_COMMIT_PREPARED";
    return value;
  } catch {return block(ready?"CHAT_EXECUTION_OUTCOME_UNCERTAIN":"CHAT_ADMISSION_UNVERIFIABLE");}
  finally {
    if(lock) {
      await lock.close().catch(()=>{});
      // An ambiguous execution preserves the lock and both immutable records.
      if(!ready||completed)await unlink(lockPath).catch(()=>{});
    }
  }
}
export async function runOwnerChatEditOnce({grantId,proposal,repoRoot=process.cwd(),
  env=process.env,platform=process.platform,now=Date.now}={}) {
  if(platform!=="win32" || !ID.test(grantId||""))
    return block("CHAT_WINDOWS_GRANT_REQUIRED");
  const source=await gatewayAppSource({repoRoot,env});
  if(source?.channel!=="main")return block("CHAT_EXACT_CLEAN_MAIN_REQUIRED");
  let grant;
  const privateRoot=privateGatewayRoot(env);
  try {grant=JSON.parse(await safeFile(path.join(privateRoot,"owner-coding-grants",
    grantId+".json"),4096));}
  catch{return block("CHAT_PRIVATE_OWNER_GRANT_REQUIRED");}
  return prepareChatEditOnce({repoRoot,privateRoot,source,grant,proposal,platform,now});
}
