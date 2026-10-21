/**
 * #3110 — authenticated Factory MCP named native-test adapter.
 * Only preselected test targets on a clean exact main revision are executable.
 * No shell, arbitrary path/argv, writing to source, Pi/Cline, or merge route.
 * A native Node test PASS does not certify the Windows Product Gate.
 */
import { execFile } from "node:child_process";
import { mkdir, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import process from "node:process";
const exec=promisify(execFile);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..","..");
const SHA=/^[a-f0-9]{40}$/;
const TESTS=Object.freeze({
  "factory-mcp":"tests/issue-3154-chatgpt-factory-mcp.test.mjs",
  "factory-qa-handoff":"tests/issue-3110-synthetic-qa-factory-monitor.test.mjs",
});
const GIT_OPTIONS={windowsHide:true,encoding:"utf8",timeout:30_000,maxBuffer:32_768};
const TEST_TIMEOUT_MS=120_000;

export function allowedFactoryTestNames(){return Object.keys(TESTS);}
export async function readFactoryVerificationHead({
  repoRoot=ROOT,run=exec,
}={}) {
  try {
    const [head,origin,branch,status]=await Promise.all([
      ["rev-parse","HEAD"],["rev-parse","origin/main"],
      ["branch","--show-current"],["status","--porcelain","--untracked-files=no"],
    ].map(async args=>{
      const result=await run("git",args,{...GIT_OPTIONS,cwd:repoRoot});
      return String(result?.stdout||"").trim();
    }));
    if(!SHA.test(head)||head!==origin||branch!=="main"||status!=="")return null;
    return head;
  }catch{return null;}
}
/**
 * ChatGPT-authored candidate identity verification on the paired Windows host.
 * Metadata-only: never fetch/checkout an untrusted PR or execute candidate code.
 * The authenticated caller must supply the EXACT PR number, SHA and clean main.
 * gh CLI is pinned to this repository and returns bounded parsed JSON only.
 */
export async function inspectFactoryCandidatePr({
  prNumber,candidateHead,expectedHead,repoRoot=ROOT,
  platform=process.platform,verifyHead=readFactoryVerificationHead,run=exec,
}={}) {
  if(platform!=="win32")return Object.freeze({
    state:"BLOCKED",code:"WINDOWS_ONLY",sourceHead:null});
  if(!Number.isSafeInteger(prNumber)||prNumber<1||prNumber>9999999||
     !SHA.test(candidateHead||"")||!SHA.test(expectedHead||""))
    return Object.freeze({state:"BLOCKED",code:"CANDIDATE_SELECTION_INVALID",sourceHead:null});
  const initial=await verifyHead({repoRoot});
  if(initial!==expectedHead)return Object.freeze({
    state:"BLOCKED",code:"EXACT_HEAD_MISMATCH",sourceHead:SHA.test(initial||"")?initial:null});
  let metadata;
  try {
    const result=await run("gh",[
      "pr","view",String(prNumber),"--repo","BryanHarrisScripts/PlotPickle",
      "--json","number,state,baseRefName,baseRefOid,headRefOid",
    ],{...GIT_OPTIONS,cwd:repoRoot});
    if(Buffer.byteLength(String(result.stdout||""),"utf8")>GIT_OPTIONS.maxBuffer)
      throw Error("Oversize GitHub metadata");
    metadata=JSON.parse(String(result.stdout||""));
  }catch {
    return Object.freeze({state:"BLOCKED",code:"GITHUB_PR_UNAVAILABLE",sourceHead:initial});
  }
  // A remote PR may change while the request is running; reconfirm local main.
  const after=await verifyHead({repoRoot});
  if(after!==expectedHead)return Object.freeze({
    state:"BLOCKED",code:"EXACT_HEAD_MISMATCH",sourceHead:SHA.test(after||"")?after:null});
  if(metadata?.number!==prNumber||metadata?.state!=="OPEN")
    return Object.freeze({state:"BLOCKED",code:"CANDIDATE_NOT_OPEN",sourceHead:initial});
  if(metadata.baseRefName!=="main"||metadata.baseRefOid!==expectedHead)
    return Object.freeze({state:"BLOCKED",code:"CANDIDATE_BASE_MISMATCH",sourceHead:initial});
  if(metadata.headRefOid!==candidateHead)
    return Object.freeze({state:"BLOCKED",code:"CANDIDATE_HEAD_MISMATCH",sourceHead:initial});
  return Object.freeze({
    state:"TEST_PASSED",code:"CANDIDATE_HEAD_VERIFIED",
    sourceHead:initial,candidatePrNumber:prNumber,candidateHead,
    modelInvoked:false,issueReserved:false,windowsUatVerified:false,
  });
}


/**
 * Owner-Windows PR snapshot: fetch exact GitHub PR ref, compare the fetched
 * object with the attested commit, and isolate it in a private detached worktree.
 * Only fixed git subcommands; DO NOT run npm, Node, scripts or candidate tools.
 * No cleanup on uncertainty: preserve staged evidence for manual review.
 */
export async function stageFactoryCandidatePr({
  prNumber,candidateHead,expectedHead,requestId,root,repoRoot=ROOT,
  platform=process.platform,verifyHead=readFactoryVerificationHead,
  inspectPr=inspectFactoryCandidatePr,run=exec,
  fileOps={mkdir,lstat},
}={}) {
  if(platform!=="win32")return Object.freeze({
    state:"BLOCKED",code:"WINDOWS_ONLY",sourceHead:null});
  if(!Number.isSafeInteger(prNumber)||prNumber<1||prNumber>9999999||
     !SHA.test(candidateHead||"")||!SHA.test(expectedHead||"")||
     !/^[a-f0-9]{32}$/.test(requestId||"")||
     typeof root!=="string"||!path.isAbsolute(root))
    return Object.freeze({state:"BLOCKED",code:"CANDIDATE_SELECTION_INVALID",sourceHead:null});
  const identity=await inspectPr({prNumber,candidateHead,expectedHead,repoRoot,
    platform,verifyHead,run});
  if(identity?.state!=="TEST_PASSED"||identity.code!=="CANDIDATE_HEAD_VERIFIED")
    return identity;
  const base=path.join(root,"chat-candidate-stages");
  const stage=path.join(base,requestId);
  try {
    await fileOps.mkdir(base,{recursive:true,mode:0o700});
    const rootInfo=await fileOps.lstat(base);
    if(!rootInfo.isDirectory()||rootInfo.isSymbolicLink())
      return Object.freeze({state:"BLOCKED",code:"CANDIDATE_STAGE_PATH_BLOCKED",sourceHead:expectedHead});
    try {
      await fileOps.lstat(stage);
      return Object.freeze({state:"BLOCKED",code:"CANDIDATE_STAGE_EXISTS",sourceHead:expectedHead});
    }catch(error){
      if(error?.code!=="ENOENT")
        return Object.freeze({state:"BLOCKED",code:"CANDIDATE_STAGE_PATH_BLOCKED",sourceHead:expectedHead});
    }
  }catch {
    return Object.freeze({state:"BLOCKED",code:"CANDIDATE_STAGE_PATH_BLOCKED",sourceHead:expectedHead});
  }
  const read=async(args,cwd=repoRoot)=>String((await run("git",args,{
    ...GIT_OPTIONS,cwd,
    env:{...process.env,GIT_LFS_SKIP_SMUDGE:"1",GIT_TERMINAL_PROMPT:"0"},
  }))?.stdout||"").trim();
  try {
    // Pin the remote repository and PR ref: no caller-controlled URLs or argv.
    await read(["fetch","--no-tags","--no-recurse-submodules",
      "https://github.com/BryanHarrisScripts/PlotPickle.git",
      "refs/pull/"+String(prNumber)+"/head"]);
    const fetched=await read(["rev-parse","FETCH_HEAD"]);
    if(fetched!==candidateHead)
      return Object.freeze({state:"BLOCKED",code:"CANDIDATE_FETCH_MISMATCH",sourceHead:expectedHead});
    // Disable checkout hooks from either local .git or the fetched candidate.
    // The worktree is private; neither main nor the user's normal source tree
    // is checked out, reset or overwritten.
    await read(["-c","core.hooksPath="+path.join(base,"hooks-disabled"),
      "worktree","add","--detach",stage,candidateHead]);
    const checked=await read(["rev-parse","HEAD"],stage);
    if(checked!==candidateHead)
      return Object.freeze({state:"BLOCKED",code:"CANDIDATE_STAGE_MISMATCH",sourceHead:expectedHead});
    // The commit hash alone does not prove a clean staged worktree. Checkout
    // filters or external processes may alter files without moving HEAD.
    const stageStatus=await read(["status","--porcelain","--untracked-files=normal",
      "--ignore-submodules=none"],stage);
    if(stageStatus!=="")
      return Object.freeze({state:"BLOCKED",code:"CANDIDATE_STAGE_DIRTY",sourceHead:expectedHead});
    const diff=await read(["diff","--name-only","--no-renames","-z",
      expectedHead,candidateHead]);
    const fileCount=diff?diff.split("\0").filter(Boolean).length:0;
    if(fileCount<1||fileCount>500)
      return Object.freeze({state:"BLOCKED",code:"CANDIDATE_DIFF_UNVERIFIED",sourceHead:expectedHead});
    await read(["diff","--check",expectedHead,candidateHead]);
    const finalHead=await verifyHead({repoRoot});
    if(finalHead!==expectedHead)
      return Object.freeze({state:"BLOCKED",code:"EXACT_HEAD_MISMATCH",sourceHead:SHA.test(finalHead||"")?finalHead:null});
    const finalIdentity=await inspectPr({prNumber,candidateHead,expectedHead,repoRoot,
      platform,verifyHead,run});
    if(finalIdentity?.code!=="CANDIDATE_HEAD_VERIFIED"||
       finalIdentity?.state!=="TEST_PASSED")
      return Object.freeze({state:"BLOCKED",code:"CANDIDATE_CHANGED_DURING_STAGE",sourceHead:expectedHead});
    // Prevent a race between the initial staged check and final attestation.
    const finalStageStatus=await read(["status","--porcelain","--untracked-files=normal",
      "--ignore-submodules=none"],stage);
    if(finalStageStatus!=="")
      return Object.freeze({state:"BLOCKED",code:"CANDIDATE_STAGE_DIRTY",sourceHead:expectedHead});
    // A reset can move a worktree to a different clean commit between checks.
    // Reattest the exact staged commit at the final evidence boundary.
    const finalStageHead=await read(["rev-parse","HEAD"],stage);
    if(finalStageHead!==candidateHead)
      return Object.freeze({state:"BLOCKED",code:"CANDIDATE_STAGE_MISMATCH",sourceHead:expectedHead});
    return Object.freeze({
      state:"TEST_PASSED",code:"CANDIDATE_STATIC_STAGED",
      sourceHead:expectedHead,candidateHead,candidatePrNumber:prNumber,
      changedFileCount:fileCount,stageId:requestId,
      sourceExecuted:false,modelInvoked:false,issueReserved:false,
      windowsUatVerified:false,
    });
  }catch {
    // Failure may follow a successful worktree checkout. Preserve its contents
    // and worktree registration for on-host review: no silent rollback/replay.
    return Object.freeze({state:"BLOCKED",code:"CANDIDATE_STAGE_UNVERIFIED",
      sourceHead:expectedHead});
  }
}

export async function runFactoryNamedTest({
  suite,expectedHead,repoRoot=ROOT,platform=process.platform,
  verifyHead=readFactoryVerificationHead,run=exec,
}={}) {
  if(platform!=="win32")return Object.freeze({
    state:"BLOCKED",code:"WINDOWS_ONLY",sourceHead:null});
  if(!Object.hasOwn(TESTS,suite)||!SHA.test(expectedHead||""))
    return Object.freeze({state:"BLOCKED",code:"TEST_SELECTION_INVALID",sourceHead:null});
  const actual=await verifyHead({repoRoot});
  if(actual!==expectedHead)return Object.freeze({
    state:"BLOCKED",code:"EXACT_HEAD_MISMATCH",sourceHead:actual&&SHA.test(actual)?actual:null});
  let error=null;
  try {
    await run(process.execPath,["--test",TESTS[suite]],{
      cwd:repoRoot,windowsHide:true,encoding:"utf8",
      timeout:TEST_TIMEOUT_MS,maxBuffer:512_000,
      env:{...process.env,FORCE_COLOR:"0",NO_COLOR:"1"},
    });
  }catch(failure){error=failure;}
  // A test cannot certify its initial HEAD if another process changed it mid-run.
  const after=await verifyHead({repoRoot});
  if(after!==expectedHead)return Object.freeze({
    state:"BLOCKED",code:"EXACT_HEAD_MISMATCH",
    sourceHead:SHA.test(after||"")?after:null,suite});
  if(!error)return Object.freeze({state:"TEST_PASSED",code:"NODE_TEST_PASS",
    sourceHead:actual,suite});
  // No raw stdout/stderr/environment leaks into MCP/issue telemetry.
  const timeout=error?.killed===true||error?.code==="ETIMEDOUT";
  return Object.freeze({state:"TEST_FAILED",
    code:timeout?"NODE_TEST_TIMEOUT":"NODE_TEST_FAILED",
    sourceHead:actual,suite});
}
