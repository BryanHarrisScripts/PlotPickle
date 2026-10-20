/**
 * #3110 — authenticated Factory MCP named native-test adapter.
 * Only preselected test targets on a clean exact main revision are executable.
 * No shell, arbitrary path/argv, writing to source, Pi/Cline, or merge route.
 * A native Node test PASS does not certify the Windows Product Gate.
 */
import { execFile } from "node:child_process";
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
function normalized(result){return String(result?.stdout||"").trim();}
export function allowedFactoryTestNames(){return Object.keys(TESTS);}
export async function readFactoryVerificationHead({
  repoRoot=ROOT,run=exec,
}={}) {
  try {
    const [[head],[origin],[branch],[status]]=await Promise.all([
      ["rev-parse","HEAD"],["rev-parse","origin/main"],
      ["branch","--show-current"],["status","--porcelain","--untracked-files=no"],
    ].map(async args=>[normalized(await run("git",args,{...GIT_OPTIONS,cwd:repoRoot}))]));
    if(!SHA.test(head)||head!==origin||branch!=="main"||status!=="")return null;
    return head;
  }catch{return null;}
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
  try {
    await run(process.execPath,["--test",TESTS[suite]],{
      cwd:repoRoot,windowsHide:true,encoding:"utf8",
      timeout:TEST_TIMEOUT_MS,maxBuffer:512_000,
      env:{...process.env,FORCE_COLOR:"0",NO_COLOR:"1"},
    });
    return Object.freeze({state:"TEST_PASSED",code:"NODE_TEST_PASS",
      sourceHead:actual,suite});
  }catch(error){
    // No raw stdout/stderr/environment leaks into MCP/issue telemetry.
    const timeout=error?.killed===true||error?.code==="ETIMEDOUT";
    return Object.freeze({state:"TEST_FAILED",
      code:timeout?"NODE_TEST_TIMEOUT":"NODE_TEST_FAILED",
      sourceHead:actual,suite});
  }
}
