/**
 * #3222 - Only a previously attested, isolated #3219-style staged worktree
 * may become a Human PR-test runtime. No caller-selected files, ports, shell,
 * npm scripts, images, passphrases, or Git branch mutations.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { inspectFactoryCandidatePr } from "../factory-named-tests.mjs";

const exec=promisify(execFile);
const SHA=/^[a-f0-9]{40}$/u;
const RID=/^[a-f0-9]{32}$/u;
const blocked=(code,sourceHead=null)=>Object.freeze({
  state:"BLOCKED",code,sourceHead,modelInvoked:false,issueReserved:false,
  independentVerification:false,
});
const digest=b=>createHash("sha256").update(b).digest("hex");
const fixedOptions={windowsHide:true,encoding:"utf8",timeout:60_000,maxBuffer:64_000};
export async function prepareStagedHumanCandidate({
  root,sourceRequestId,expectedHead,candidateHead,candidatePrNumber,
  stageReceipt,repoRoot,verifyHead,inspectPr=inspectFactoryCandidatePr,
  run=exec,fileOps={lstat,readFile,existsSync},nodePath=process.execPath,
  platform=process.platform,
}={}){
  if(platform!=="win32")return blocked("WINDOWS_ONLY");
  if(typeof root!=="string"||!path.isAbsolute(root)||!SHA.test(expectedHead||"")||
    !SHA.test(candidateHead||"")||!RID.test(sourceRequestId||"")||
    !Number.isInteger(candidatePrNumber)||candidatePrNumber<1||candidatePrNumber>9999999)
    return blocked("APP_CANDIDATE_INVALID");
  if(stageReceipt?.state!=="TEST_PASSED"||
    stageReceipt?.code!=="CANDIDATE_STATIC_STAGED"||
    stageReceipt?.stageId!==sourceRequestId||
    stageReceipt?.sourceHead!==expectedHead||
    stageReceipt?.candidateHead!==candidateHead||
    stageReceipt?.candidatePrNumber!==candidatePrNumber)
    return blocked("APP_CANDIDATE_RECEIPT_INVALID");
  const stage=path.join(root,"chat-candidate-stages",sourceRequestId);
  const base=path.dirname(stage);
  try{
    const [baseStat,stageStat]=await Promise.all([fileOps.lstat(base),fileOps.lstat(stage)]);
    if(!baseStat.isDirectory()||baseStat.isSymbolicLink()||
      !stageStat.isDirectory()||stageStat.isSymbolicLink())
      return blocked("APP_CANDIDATE_STAGE_INVALID");
  }catch{return blocked("APP_CANDIDATE_STAGE_INVALID");}
  const identity=async()=>{
    if(await verifyHead({repoRoot})!==expectedHead)return false;
    const pr=await inspectPr({prNumber:candidatePrNumber,candidateHead,
      expectedHead,repoRoot,platform,verifyHead});
    if(pr?.state!=="TEST_PASSED"||pr?.code!=="CANDIDATE_HEAD_VERIFIED")
      return false;
    const options={...fixedOptions,cwd:stage};
    try{
      const head=String((await run("git",["rev-parse","HEAD"],options)).stdout??"").trim();
      const status=String((await run("git",["status","--porcelain",
        "--untracked-files=no"],options)).stdout??"").trim();
      return head===candidateHead&&status==="";
    }catch{return false;}
  };
  if(!await identity())return blocked("APP_CANDIDATE_SOURCE_CHANGED",candidateHead);
  // Code execution from a candidate must NEVER introduce a different npm
  // dependency graph or install scripts. The owner opted into exact PR code,
  // not arbitrary dependencies or lifecycle install commands.
  try{
    for(const name of ["package.json","package-lock.json"]){
      const [canonical,candidate]=await Promise.all([
        fileOps.readFile(path.join(repoRoot,name)),
        fileOps.readFile(path.join(stage,name)),
      ]);
      if(digest(canonical)!==digest(candidate))
        return blocked("APP_CANDIDATE_DEPENDENCY_DRIFT",candidateHead);
    }
  }catch{return blocked("APP_CANDIDATE_DEPENDENCY_DRIFT",candidateHead);}
  const vite=path.join(stage,"node_modules","vite","bin","vite.js");
  if(!fileOps.existsSync(vite)){
    const npmCli=path.join(path.dirname(nodePath),"node_modules","npm","bin","npm-cli.js");
    if(!fileOps.existsSync(npmCli))return blocked("APP_CANDIDATE_NPM_UNAVAILABLE",candidateHead);
    try{
      await run(nodePath,[npmCli,"ci","--ignore-scripts","--include=dev",
        "--no-audit","--no-fund"],{
        ...fixedOptions,cwd:stage,timeout:240_000,maxBuffer:128_000,
        env:{...process.env,npm_config_audit:"false",npm_config_fund:"false",
          GIT_TERMINAL_PROMPT:"0"},
      });
    }catch{return blocked("APP_CANDIDATE_DEPENDENCIES_FAILED",candidateHead);}
  }
  if(!fileOps.existsSync(vite))return blocked("APP_CANDIDATE_DEPENDENCIES_FAILED",candidateHead);
  if(!await identity())return blocked("APP_CANDIDATE_SOURCE_CHANGED",candidateHead);
  return Object.freeze({state:"TEST_PASSED",code:"APP_CANDIDATE_PREPARED",
    sourceHead:candidateHead,repoRoot:stage,candidatePrNumber,candidateHead,
    sourceRequestId,modelInvoked:false,issueReserved:false,independentVerification:false});
}
