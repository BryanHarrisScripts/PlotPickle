#!/usr/bin/env node
/**
 * #3162 — owner-invoked, NON-RESERVING Windows dependency proof.
 * A successful npm ci in a detached worktree is required before a native issue
 * reservation. Never invokes Pi, never grants issue/merge authority, never
 * mutates source, and never overwrites an existing job or attempt receipt.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { resolveActiveNpmCommand, runPortableCommand } from "../../pi-worker-runtime.mjs";

const exec=promisify(execFile);
const HERE=path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT=path.resolve(HERE,"..","..","..");
const ROOT=path.join(process.env.LOCALAPPDATA||(process.platform==="win32"
  ?path.join(os.homedir(),"AppData","Local"):path.join(os.homedir(),".local","share")),
  "PlotPickle","engineering-team","autonomous-queue");
const SHA=/^[a-f0-9]{40}$/;
const INSTALL_TIMEOUT_MS=12*60_000;
const NPM_FLAGS=Object.freeze(["ci","--ignore-scripts","--no-audit","--no-fund","--prefer-offline"]);

/** Only the private cache is shared; npm ci still verifies lockfile integrity. */
export function factoryNpmCache(root=ROOT) {
  return path.join(path.resolve(root),"npm-cache");
}
export function factoryNpmInstallArgs(root=ROOT) {
  return [...NPM_FLAGS,"--cache",factoryNpmCache(root)];
}
export function factoryNpmFailureCode(error) {
  const message=String(error?.stderr||"")+"\n"+String(error?.message||"");
  if(error?.killed===true||error?.code==="ETIMEDOUT"||/timed out|timeout of \d+ms exceeded/i.test(message))
    return "NPM_INSTALL_TIMEOUT";
  if(/\b(?:EUSAGE|ELOCKVERIFY)\b|package\.json and package-lock\.json are not in sync/i.test(message))
    return "NPM_LOCKFILE_MISMATCH";
  if(/\b(?:EPERM|EACCES|EBUSY|ENOTEMPTY)\b/.test(message))
    return "NPM_WINDOWS_FILE_ACCESS";
  if(/\b(?:ENOTFOUND|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH)\b/.test(message))
    return "NPM_NETWORK_UNAVAILABLE";
  if(/\b(?:EINTEGRITY|TAR_BAD_ARCHIVE|Z_DATA_ERROR)\b/.test(message))
    return "NPM_INTEGRITY_FAILURE";
  if(/\bENOENT\b/.test(message))return "NPM_FILE_MISSING";
  return "NPM_INSTALL_UNCLASSIFIED";
}
export function factoryDependencyFingerprint({packageText,lockText,nodeVersion=process.version}) {
  if(typeof packageText!=="string"||typeof lockText!=="string"||
     !packageText.length||!lockText.length||!/v\d+\.\d+\.\d+/.test(nodeVersion))
    throw new Error("Dependency proof requires pinned manifests and Node version.");
  return createHash("sha256").update(JSON.stringify({
    schemaVersion:1,packageText:packageText.replace(/\r\n/g,"\n"),
    lockText:lockText.replace(/\r\n/g,"\n"),nodeVersion,
    installFlags:NPM_FLAGS,
  })).digest("hex");
}
async function dependencyFingerprintForRepo(repoRoot,nodeVersion) {
  const [packageText,lockText]=await Promise.all([
    readFile(path.join(repoRoot,"package.json"),"utf8"),
    readFile(path.join(repoRoot,"package-lock.json"),"utf8"),
  ]);
  return factoryDependencyFingerprint({packageText,lockText,nodeVersion});
}
export async function checkFactoryDependencyProof({
  root=ROOT,repoRoot=REPO_ROOT,nodeVersion=process.version,
}={}) {
  let key;
  try{key=await dependencyFingerprintForRepo(repoRoot,nodeVersion);}
  catch{return Object.freeze({ready:false,code:"NPM_PROOF_MANIFEST_UNAVAILABLE"});}
  try{
    const proof=JSON.parse(await readFile(path.join(root,"dependency-preflight.json"),"utf8"));
    if(proof?.schemaVersion===1&&proof?.key===key&&proof?.npmCiVerified===true&&
       proof?.nodeVersion===nodeVersion&&Number.isSafeInteger(proof.verifiedAt)&&proof.verifiedAt>0)
      return Object.freeze({ready:true,code:"NPM_PREFLIGHT_VERIFIED"});
  }catch{
    return Object.freeze({ready:false,code:"NPM_PREFLIGHT_REQUIRED"});
  }
  return Object.freeze({ready:false,code:"NPM_PREFLIGHT_REQUIRED"});
}
async function gitCommand(args,{cwd=REPO_ROOT}={}) {
  const result=await exec("git",args,{cwd,encoding:"utf8",windowsHide:true,timeout:60_000});
  return String(result.stdout||"").trim();
}
export async function installFactoryDependencies({
  cwd,root=ROOT,run=runPortableCommand,npm=resolveActiveNpmCommand,
}={}) {
  await mkdir(factoryNpmCache(root),{recursive:true,mode:0o700});
  return run(npm(),factoryNpmInstallArgs(root),{
    cwd,timeout:INSTALL_TIMEOUT_MS,maxBuffer:512_000,
  });
}
export async function runFactoryDependencyPreflight({
  root=ROOT,repoRoot=REPO_ROOT,platform=process.platform,
  git=gitCommand,install=installFactoryDependencies,
  now=Date.now,nodeVersion=process.version,
}={}) {
  if(platform!=="win32")return Object.freeze({state:"BLOCKED",code:"WINDOWS_ONLY"});
  if(existsSync(path.join(root,"disabled.json")))
    return Object.freeze({state:"BLOCKED",code:"FACTORY_LOCALLY_DISABLED"});
  if(existsSync(path.join(root,"service.lock")))
    return Object.freeze({state:"BLOCKED",code:"STOP_FACTORY_FIRST"});
  const [head,origin,branch,dirty]=await Promise.all([
    git(["rev-parse","HEAD"],{cwd:repoRoot}),
    git(["rev-parse","origin/main"],{cwd:repoRoot}),
    git(["branch","--show-current"],{cwd:repoRoot}),
    git(["status","--porcelain","--untracked-files=no"],{cwd:repoRoot}),
  ]);
  if(!SHA.test(head)||head!==origin||branch!=="main"||dirty)
    return Object.freeze({state:"BLOCKED",code:"EXACT_CLEAN_MAIN_REQUIRED"});
  const existing=await checkFactoryDependencyProof({root,repoRoot,nodeVersion});
  if(existing.ready)return Object.freeze({state:"INSTALL_PREFLIGHT_READY",
    code:"NPM_PREFLIGHT_VERIFIED",sourceHead:head,existing:true});
  const key=await dependencyFingerprintForRepo(repoRoot,nodeVersion);
  await mkdir(path.join(root,"dependency-probes"),{recursive:true,mode:0o700});
  const probe=path.join(root,"dependency-probes",
    "head-"+head.slice(0,10)+"-"+String(now()));
  // An existing probe or a failed install remains untouched, never forced clean.
  if(existsSync(probe))return Object.freeze({state:"BLOCKED",code:"PROBE_ALREADY_EXISTS"});
  await git(["worktree","add","--detach",probe,head],{cwd:repoRoot});
  try{await install({cwd:probe,root});}
  catch(error){
    return Object.freeze({state:"BLOCKED",code:factoryNpmFailureCode(error),
      phase:"INSTALL_DEPENDENCIES",sourceHead:head,probePreserved:true});
  }
  const proof={schemaVersion:1,key,sourceHead:head,nodeVersion,
    npmCiVerified:true,verifiedAt:now(),modelInvoked:false,
    issueReserved:false,automaticMergeAuthorized:false};
  await writeFile(path.join(root,"dependency-preflight.json"),
    JSON.stringify(proof,null,2)+"\n",{flag:"w",mode:0o600});
  return Object.freeze({state:"INSTALL_PREFLIGHT_READY",
    code:"NPM_CI_VERIFIED",sourceHead:head,probePreserved:true,
    issueReserved:false});
}
async function main(){
  if(process.argv.length!==2)throw new Error("Dependency preflight takes no arguments.");
  const result=await runFactoryDependencyPreflight();
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
  if(result.state!=="INSTALL_PREFLIGHT_READY")process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(()=>{process.stderr.write("Dependency preflight blocked; review local install evidence.\n");process.exitCode=1;});
