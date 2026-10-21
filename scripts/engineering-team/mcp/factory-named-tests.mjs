/**
 * #3110 — authenticated Factory MCP named native-test adapter.
 * Only preselected test targets on a clean exact main revision are executable.
 * No shell, arbitrary path/argv, writing to source, Pi/Cline, or merge route.
 * A native Node test PASS does not certify the Windows Product Gate.
 */
import { execFile, spawn } from "node:child_process";
import { mkdir, lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import process from "node:process";
import { terminateVerificationProcessTree } from "../../full-verification-process.mjs";
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
  const read=async(args,cwd=repoRoot,timeout=GIT_OPTIONS.timeout)=>String((await run("git",args,{
    ...GIT_OPTIONS,cwd,timeout,
    env:{
      ...process.env,GIT_LFS_SKIP_SMUDGE:"1",GIT_TERMINAL_PROMPT:"0",
      // Command-scope Git for Windows long path support. It applies to
      // checkout AND status/diff; never modify the user's local/global config.
      GIT_CONFIG_COUNT:"1",GIT_CONFIG_KEY_0:"core.longpaths",
      GIT_CONFIG_VALUE_0:"true",
    },
  }))?.stdout||"").trim();
  // Report only the bounded failing command class, never raw exceptions.
  let failureCode="CANDIDATE_STAGE_FETCH_FAILED";
  try {
    // Pin the remote repository and PR ref: no caller-controlled URLs or argv.
    await read(["fetch","--no-tags","--no-recurse-submodules",
      "https://github.com/BryanHarrisScripts/PlotPickle.git",
      "refs/pull/"+String(prNumber)+"/head"]);
    const fetched=await read(["rev-parse","FETCH_HEAD"]);
    if(fetched!==candidateHead)
      return Object.freeze({state:"BLOCKED",code:"CANDIDATE_FETCH_MISMATCH",sourceHead:expectedHead});
    // Full Windows checkout may need longer than a metadata probe.
    // Keep checkout bounded; no candidate scripts or npm are executed.
    failureCode="CANDIDATE_STAGE_WORKTREE_ADD_FAILED";
    // Disable checkout hooks from either local .git or the fetched candidate.
    // The worktree is private; neither main nor the user's normal source tree
    // is checked out, reset or overwritten.
    await read(["-c","core.hooksPath="+path.join(base,"hooks-disabled"),
      "worktree","add","--detach",stage,candidateHead],repoRoot,120_000);
    failureCode="CANDIDATE_STAGE_UNVERIFIED";
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
    return Object.freeze({state:"BLOCKED",code:failureCode,
      sourceHead:expectedHead});
  }
}


/**
 * The only supported Windows checkout maintenance operation: advance an
 * unchanged tracked-clean main using the canonical PlotPickle GitHub main.
 * Locally owned untracked files are ignored, never cleaned/stashed/deleted.
 * Do not use this for arbitrary shell commands, branches or PR checkout.
 */
const FACTORY_ORIGIN="https://github.com/BryanHarrisScripts/PlotPickle.git";
const TRUSTED_ORIGINS=new Set([FACTORY_ORIGIN,
  "https://github.com/BryanHarrisScripts/PlotPickle",
  "git@github.com:BryanHarrisScripts/PlotPickle.git",
  "git@github.com:BryanHarrisScripts/PlotPickle"]);
export async function inspectFactorySyncSource({
  repoRoot=ROOT,platform=process.platform,run=exec,
}={}) {
  if(platform!=="win32")return Object.freeze({state:"BLOCKED",
    code:"WINDOWS_ONLY",sourceHead:null});
  const git=async(args)=>String((await run("git",args,{
    ...GIT_OPTIONS,cwd:repoRoot,
  }))?.stdout||"").trim();
  let head,branch,dirty,origin;
  try{
    [head,branch,dirty,origin]=await Promise.all([
      git(["rev-parse","HEAD"]),git(["branch","--show-current"]),
      git(["status","--porcelain","--untracked-files=no"]),
      git(["remote","get-url","origin"]),
    ]);
  }catch{return Object.freeze({state:"BLOCKED",code:"SYNC_SOURCE_UNVERIFIED",
    sourceHead:null});}
  if(!SHA.test(head)||branch!=="main"||dirty!=="")
    return Object.freeze({state:"BLOCKED",code:"SYNC_MAIN_NOT_CLEAN",
      sourceHead:SHA.test(head)?head:null});
  if(!TRUSTED_ORIGINS.has(origin))return Object.freeze({
    state:"BLOCKED",code:"SYNC_ORIGIN_UNVERIFIED",sourceHead:head});
  return Object.freeze({state:"TEST_PASSED",code:"SYNC_SOURCE_VERIFIED",
    sourceHead:head});
}
export async function syncFactoryMain({
  expectedHead,root,repoRoot=ROOT,platform=process.platform,
  inspect=inspectFactorySyncSource,run=exec,
}={}) {
  if(platform!=="win32")return Object.freeze({state:"BLOCKED",
    code:"WINDOWS_ONLY",sourceHead:null});
  if(!SHA.test(expectedHead||"")||typeof root!=="string"||
     !path.isAbsolute(root))return Object.freeze({state:"BLOCKED",
      code:"SYNC_SELECTION_INVALID",sourceHead:null});
  const initial=await inspect({repoRoot,platform,run});
  if(initial?.state!=="TEST_PASSED")return initial;
  if(initial.sourceHead!==expectedHead)return Object.freeze({state:"BLOCKED",
    code:"EXACT_HEAD_MISMATCH",sourceHead:initial.sourceHead});
  // No shell and no persistent git-config changes. Windows long paths are
  // required for checkout and subsequent status; hooks cannot execute.
  const git=async(args,timeout=60_000)=>String((await run("git",args,{
    ...GIT_OPTIONS,cwd:repoRoot,timeout,
    env:{...process.env,GIT_TERMINAL_PROMPT:"0",GIT_LFS_SKIP_SMUDGE:"1",
      GIT_CONFIG_COUNT:"1",GIT_CONFIG_KEY_0:"core.longpaths",
      GIT_CONFIG_VALUE_0:"true"},
  }))?.stdout||"").trim();
  let targetHead;
  try{
    await git(["fetch","--no-tags","--no-recurse-submodules",
      "origin","refs/heads/main:refs/remotes/origin/main"]);
    targetHead=await git(["rev-parse","FETCH_HEAD"]);
  }catch{return Object.freeze({state:"BLOCKED",code:"SYNC_FETCH_FAILED",
    sourceHead:expectedHead});}
  if(!SHA.test(targetHead))return Object.freeze({state:"BLOCKED",
    code:"SYNC_FETCH_UNVERIFIED",sourceHead:expectedHead});
  const beforeMerge=await inspect({repoRoot,platform,run});
  if(beforeMerge?.state!=="TEST_PASSED"||
     beforeMerge.sourceHead!==expectedHead)
    return Object.freeze({state:"BLOCKED",code:"SYNC_SOURCE_CHANGED",
      sourceHead:SHA.test(beforeMerge?.sourceHead||"")?
        beforeMerge.sourceHead:null});
  if(targetHead===expectedHead)return Object.freeze({
    state:"TEST_PASSED",code:"SOURCE_ALREADY_CURRENT",sourceHead:expectedHead,
    modelInvoked:false,issueReserved:false});
  try{await git(["merge-base","--is-ancestor",expectedHead,targetHead]);}
  catch{return Object.freeze({state:"BLOCKED",code:"SYNC_NOT_FAST_FORWARD",
    sourceHead:expectedHead});}
  // Pin the fetched SHA itself; FETCH_HEAD can move in concurrent Git use.
  try{
    await git(["-c","core.hooksPath="+path.join(root,"hooks-disabled"),
      "merge","--ff-only",targetHead],120_000);
  }catch{
    // An error may leave partial checkout state: do not auto replay/repair.
    return Object.freeze({state:"BLOCKED",code:"SYNC_MERGE_UNVERIFIED",
      sourceHead:expectedHead});
  }
  const final=await inspect({repoRoot,platform,run});
  if(final?.state!=="TEST_PASSED"||final.sourceHead!==targetHead)
    return Object.freeze({state:"BLOCKED",code:"SYNC_OUTCOME_UNVERIFIED",
      sourceHead:SHA.test(final?.sourceHead||"")?final.sourceHead:null});
  return Object.freeze({state:"TEST_PASSED",code:"SOURCE_SYNCED",
    sourceHead:targetHead,modelInvoked:false,issueReserved:false});
}


/**
 * #3118: execute the existing genuine browser Story Factory acceptance in an
 * isolated synthetic-Human profile. Only fixed, reviewed source on exact clean
 * main; never run candidate PR code, a user project or arbitrary arguments.
 * The existing runner owns port and server/browser cleanup. On an outer timeout,
 * terminate only the direct child and its owned tree, never any guessed port PID.
 */
export async function executeOwnedFactoryStoryUat({
  repoRoot=ROOT,env,timeoutMs=25*60_000,launch=spawn,
  stop=terminateVerificationProcessTree,
}={}) {
  let child;
  try{
    child=launch(process.execPath,["scripts/verification-webmcp-live.mjs"],{
      cwd:repoRoot,env,windowsHide:true,shell:false,stdio:"ignore",
    });
  }catch{return {failed:true};}
  return new Promise(resolve=>{
    let done=false;
    const settle=(value)=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
    const timer=setTimeout(async()=>{
      if(done)return;
      // The timeout never certifies STOP merely from a signal/request.
      try {await stop(child,{stderr:{write(){}}});}
      catch { settle({timedOut:true,stopUnverified:true});return;}
      settle({timedOut:true,stopUnverified:
        child?.exitCode===null && child?.signalCode===null});
    },timeoutMs);
    child.once("error",()=>settle({failed:true}));
    child.once("close",code=>settle({exitCode:code}));
  });
}

/**
 * Real Windows browser/UAT evidence, distinct from a contracts-only Node
 * fixture PASS. The runner's exit 0 is necessary but not sufficient:
 * correlated exact-head and LOCAL-mode Story Factory checkpoints must PASS.
 * Even then, independentVerification remains a separate gate.
 */
export async function runFactoryStoryUat({
  expectedHead,requestId,root,repoRoot=ROOT,
  platform=process.platform,verifyHead=readFactoryVerificationHead,
  execute=executeOwnedFactoryStoryUat,
  read=readFile,stat=lstat,
}={}) {
  if(platform!=="win32")return Object.freeze({
    state:"BLOCKED",code:"WINDOWS_ONLY",sourceHead:null});
  if(!SHA.test(expectedHead||"")||!/^[a-f0-9]{32}$/.test(requestId||"")||
     typeof root!=="string"||!path.isAbsolute(root))
    return Object.freeze({state:"BLOCKED",code:"PRODUCT_UAT_SELECTION_INVALID",sourceHead:null});
  const first=await verifyHead({repoRoot});
  if(first!==expectedHead)return Object.freeze({state:"BLOCKED",
    code:"EXACT_HEAD_MISMATCH",sourceHead:SHA.test(first||"")?first:null});
  const runnerTemp=path.join(root,"mcp-story-uat",requestId);
  try {await mkdir(runnerTemp,{recursive:true,mode:0o700});}
  catch{return Object.freeze({state:"BLOCKED",code:"PRODUCT_UAT_PRIVATE_ROOT_BLOCKED",
    sourceHead:expectedHead});}
  let observed;
  try{
    observed=await execute({repoRoot,env:{
      ...process.env,GITHUB_SHA:expectedHead,
      RUNNER_TEMP:runnerTemp,PLOTPICKLE_FACTORY_UAT_REQUEST_ID:requestId,
      PLOTPICKLE_PI_ALLOW_CLOUD:"0",PLOTPICKLE_PI_ROUTE:"local",
    }});
  }catch{observed={failed:true};}
  const final=await verifyHead({repoRoot});
  if(final!==expectedHead)return Object.freeze({state:"BLOCKED",
    code:"EXACT_HEAD_MISMATCH",sourceHead:SHA.test(final||"")?final:null});
  if(observed?.stopUnverified)return Object.freeze({state:"BLOCKED",
    code:"PRODUCT_UAT_STOP_UNVERIFIED",sourceHead:expectedHead});
  if(observed?.timedOut)return Object.freeze({state:"TEST_FAILED",
    code:"PRODUCT_UAT_TIMEOUT",sourceHead:expectedHead});
  if(observed?.exitCode!==0)return Object.freeze({state:"TEST_FAILED",
    code:"PRODUCT_UAT_FAILED",sourceHead:expectedHead});
  const report=path.join(repoRoot,".artifacts","verification-live","webmcp-live.json");
  let evidence;
  try{
    const info=await stat(report);
    if(!info.isFile()||info.isSymbolicLink()||info.size<16||info.size>32768)
      throw Error("Report not a bounded regular file");
    evidence=JSON.parse(await read(report,"utf8"));
  }catch{return Object.freeze({state:"BLOCKED",
    code:"PRODUCT_UAT_EVIDENCE_UNVERIFIED",sourceHead:expectedHead});}
  if(evidence?.schemaVersion!=="1.0"||
     evidence.observer!=="webmcp-live"||
     evidence.factoryUatRequestId!==requestId||
     evidence.exactHead!==expectedHead||
     evidence.status!=="pass"||
     evidence.authority!=="read-only-observer"||
     evidence.externalProviderCalls!==false||
     evidence.secretsAccessed!==false||
     evidence.storyMode?.mode!=="local"||
     evidence.storyMode?.providerSpendAllowed!==false||
     evidence.mindWorldAcceptance?.status!=="PASS"||
     evidence.storyFactoryAcceptance?.status!=="PASS"||
     evidence.storyFactoryAcceptance?.mutationAuthority!==false||
     evidence.storyFactoryAcceptance?.providerSpendAllowed!==false)
    return Object.freeze({state:"BLOCKED",
      code:"PRODUCT_UAT_EVIDENCE_UNVERIFIED",sourceHead:expectedHead});
  return Object.freeze({state:"TEST_PASSED",
    code:"PRODUCT_UAT_OBSERVED_PASS",sourceHead:expectedHead,
    modelInvoked:false,issueReserved:false,
    independentVerification:false});
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
