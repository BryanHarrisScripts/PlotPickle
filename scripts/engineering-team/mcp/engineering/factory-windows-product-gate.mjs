/**
 * #3303 Permanent owner-Windows Product Gate: trusted, bounded admission and
 * separately verifiable evidence. This module executes from installed MAIN,
 * NEVER from the candidate under review.
 *
 * Native candidate probing is an explicit trusted host callback. Without a
 * reviewed physical candidate probe the result is UNPROVEN, not success.
 */
import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {lstat,realpath,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import process from "node:process";
import {promisify} from "node:util";
import {readFactoryVerificationHead,inspectFactoryCandidatePr} from "../factory-named-tests.mjs";
import {supervisorStatus} from "../../windows/supervisor/unattended-supervisor.mjs";
import {probeFactoryWindowsCandidate} from "./factory-windows-product-gate-native.mjs";

const exec=promisify(execFile);
const SHA=/^[a-f0-9]{40}$/u, ID=/^[a-f0-9]{32}$/u;
const blocked=(code,sourceHead=null)=>Object.freeze({
  state:"BLOCKED",code,sourceHead,replayAuthorized:false,
  independentVerification:false,ownerMachineObserved:false,modelInvoked:false,
});
const sha256=value=>createHash("sha256").update(value).digest("hex");
const VERIFIER_SOURCE_PATH=fileURLToPath(import.meta.url);
export async function readFactoryGateVerifierDigest(){
  return sha256(await readFile(VERIFIER_SOURCE_PATH));
}
const knownProofs=new Set(["windows-factory-acceptance"]);
const jsonBytes=value=>Buffer.from(JSON.stringify(value)+"\n","utf8");
// This first fixed probe only covers the #3362 diagnostics/migration edition.
// Later Factory change types require their own trusted, source-reviewed probe.
const DIAGNOSTICS_PROBE_FILES=new Set([
  "config/verification/test-catalog.json",
  "scripts/engineering-team/mcp/engineering/operations/factory-operator-maintenance.mjs",
  "scripts/engineering-team/mcp/factory-readonly-server.mjs",
  "tests/issue-3142-authenticated-operator-maintenance.test.mjs",
]);
export function admissibleFactoryDiagnosticsDiff(files){
  return Array.isArray(files)&&files.length===DIAGNOSTICS_PROBE_FILES.size&&
    new Set(files).size===files.length&&files.every(file=>
      typeof file==="string"&&DIAGNOSTICS_PROBE_FILES.has(file));
}
export async function attestFactoryDiagnosticsScope({
  stage,expectedHead,candidateHead,run=exec,
}={}){
  if(typeof stage!=="string"||!path.isAbsolute(stage)||
    !SHA.test(expectedHead||"")||!SHA.test(candidateHead||""))return false;
  try{
    const result=await run("git",[
      "diff","--name-only","--no-ext-diff",expectedHead,candidateHead,"--",
    ],{cwd:stage,windowsHide:true,encoding:"utf8",
      timeout:30000,maxBuffer:8192});
    const raw=String(result.stdout||"");
    const normalized=raw.replaceAll("\r\n","\n");
    if(raw.length>4096||normalized.includes("\0")||normalized.includes("\r")||
      !normalized.endsWith("\n"))return false;
    return admissibleFactoryDiagnosticsDiff(normalized.trimEnd().split("\n"));
  }catch{return false;}
}
const cleanStage=async({stage,candidateHead,run=exec,fs={lstat,realpath}})=>{
  const [entry,actual,head,status]=await Promise.all([
      fs.lstat(stage),fs.realpath(stage),
      run("git",["rev-parse","HEAD"],{cwd:stage,windowsHide:true,encoding:"utf8",timeout:30000,maxBuffer:8192}),
      run("git",["status","--porcelain","--untracked-files=no"],{cwd:stage,windowsHide:true,encoding:"utf8",timeout:30000,maxBuffer:8192}),
    ]);
    return entry.isDirectory()&&!entry.isSymbolicLink()&&
      path.normalize(actual).toLowerCase()===path.normalize(stage).toLowerCase()&&
      String(head.stdout||"").trim()===candidateHead&&
      String(status.stdout||"").trim()==="";
};
const running=(s,head)=>s?.state==="RUNNING" && s.exactSha===head &&
  s.pauseAcknowledged!==true && Number.isSafeInteger(s.checkedAt) &&
  s.checkedAt>=0 && Date.now()-s.checkedAt>=0 &&
  Date.now()-s.checkedAt<=180000;
export function validateFactoryProductGateSelection(a){
  return a && typeof a==="object"&&Object.keys(a).sort().join(",")===
      "candidateHead,candidatePrNumber,expectedHead,requestId,sourceRequestId" &&
    SHA.test(a.expectedHead||"")&&SHA.test(a.candidateHead||"")&&
    ID.test(a.sourceRequestId||"")&&ID.test(a.requestId||"")&&
    a.requestId!==a.sourceRequestId&&Number.isSafeInteger(a.candidatePrNumber)&&
    a.candidatePrNumber>0&&a.candidatePrNumber<=9999999;
}

/** A native probe is not automatically a release witness. */
export async function observeFactoryWindowsProductGate({
  selection,root,repoRoot,stageReceipt,
  platform=process.platform,verifyHead=readFactoryVerificationHead,
  inspectPr=inspectFactoryCandidatePr,readSupervisor=supervisorStatus,
  attestStage=cleanStage,attestScope=attestFactoryDiagnosticsScope,
  nativeProbe=probeFactoryWindowsCandidate,
  fs={writeFile,readFile},now=Date.now,
}={}){
  const a=selection;
  if(!validateFactoryProductGateSelection(a))return blocked("PRODUCT_GATE_SELECTION_INVALID");
  if(platform!=="win32")return blocked("WINDOWS_ONLY");
  if(typeof root!=="string"||!path.isAbsolute(root)||!repoRoot||!path.isAbsolute(repoRoot))
    return blocked("PRODUCT_GATE_STAGE_UNVERIFIED");
  if(stageReceipt?.state!=="TEST_PASSED"||
    stageReceipt.code!=="CANDIDATE_STATIC_STAGED"||
    stageReceipt.sourceHead!==a.expectedHead||
    stageReceipt.candidatePrNumber!==a.candidatePrNumber||
    stageReceipt.candidateHead!==a.candidateHead||
    stageReceipt.stageId!==a.sourceRequestId)
    return blocked("PRODUCT_GATE_STAGE_UNVERIFIED");
  const stage=path.join(root,"chat-candidate-stages",a.sourceRequestId);
  let first,supervisorBefore;
  try{
    [first,supervisorBefore]=await Promise.all([
      verifyHead({repoRoot}),readSupervisor(),
    ]);
  }catch{return blocked("PRODUCT_GATE_HOST_UNVERIFIED");}
  if(first!==a.expectedHead||!running(supervisorBefore,a.expectedHead))
    return blocked("PRODUCT_GATE_HOST_UNVERIFIED",first===a.expectedHead?first:null);
  const pr=await inspectPr({prNumber:a.candidatePrNumber,
    candidateHead:a.candidateHead,expectedHead:a.expectedHead,
    repoRoot,platform,verifyHead});
  if(pr?.state!=="TEST_PASSED"||pr.code!=="CANDIDATE_HEAD_VERIFIED")
    return blocked("PRODUCT_GATE_CANDIDATE_UNVERIFIED",a.expectedHead);
  let stageReady;
  try{stageReady=await attestStage({stage,candidateHead:a.candidateHead});}
  catch{return blocked("PRODUCT_GATE_STAGE_UNVERIFIED",a.expectedHead);}
  if(!stageReady)return blocked("PRODUCT_GATE_STAGE_UNVERIFIED",a.expectedHead);
  if(!await attestScope({stage,expectedHead:a.expectedHead,candidateHead:a.candidateHead}))
    return blocked("PRODUCT_GATE_SCOPE_UNSUPPORTED",a.expectedHead);
  // Bind the verifier edition before executing candidate code. This is not
  // an F00 signature; source authority still comes from clean trusted MAIN.
  let verifierSourceDigest;
  try{verifierSourceDigest=await readFactoryGateVerifierDigest();}
  catch{return blocked("PRODUCT_GATE_EVIDENCE_UNVERIFIED",a.expectedHead);}
  // The trusted probe receives a fixed selection, never a caller command.
  // It must observe actual candidate behavior on Windows, not a mock test.
  let observation;
  try{observation=await nativeProbe(Object.freeze({
    stage,expectedHead:a.expectedHead,candidateHead:a.candidateHead,
    candidatePrNumber:a.candidatePrNumber,
    supervisorBefore:Object.freeze({state:supervisorBefore.state,
      exactSha:supervisorBefore.exactSha}),
  }));}catch{return blocked("PRODUCT_GATE_NATIVE_PROBE_UNVERIFIED",a.expectedHead);}
  if(observation?.state!=="OBSERVED"||observation?.source!=="OWNER_WINDOWS_NATIVE"||
     observation?.candidateHead!==a.candidateHead ||
     observation?.authStatusVerified!==true||
     observation?.guestDenied!==true||
     observation?.migrationDeniedWhileRunning!==true||
     observation?.processIsolationVerified!==true||
     observation?.stopUnchanged!==true)
    return blocked("PRODUCT_GATE_NATIVE_PROBE_UNVERIFIED",a.expectedHead);
  let last,supervisorAfter;
  try{[last,supervisorAfter]=await Promise.all([verifyHead({repoRoot}),readSupervisor()]);}
  catch{return blocked("PRODUCT_GATE_HOST_CHANGED",a.expectedHead);}
  let stageAfter;
  try{stageAfter=await attestStage({stage,candidateHead:a.candidateHead});}
  catch{return blocked("PRODUCT_GATE_HOST_CHANGED",a.expectedHead);}
  if(last!==a.expectedHead||!running(supervisorAfter,a.expectedHead)||!stageAfter)
    return blocked("PRODUCT_GATE_HOST_CHANGED",a.expectedHead);
  if(!await attestScope({stage,expectedHead:a.expectedHead,candidateHead:a.candidateHead}))
    return blocked("PRODUCT_GATE_SCOPE_UNSUPPORTED",a.expectedHead);
  const evidence=Object.freeze({
    schemaVersion:1,requestId:a.requestId,sourceHead:a.expectedHead,
    verifierSourceHead:a.expectedHead,verifierSourceDigest,
    candidateHead:a.candidateHead,candidatePrNumber:a.candidatePrNumber,
    stageRequestId:a.sourceRequestId,source:"OWNER_WINDOWS_NATIVE",
    proofIds:["windows-factory-acceptance"],
    action:"AUTHENTICATED_FACTORY_STATUS_AND_RUNNING_MIGRATION_DENIAL",
    authStatusVerified:true,guestDenied:true,migrationDeniedWhileRunning:true,
    processIsolationVerified:true,stopUnchanged:true,
    supervisorStateBefore:"RUNNING",supervisorStateAfter:"RUNNING",
    executedAt:now(),replayAuthorized:false,automaticMergeEnabled:false,
  });
  const bytes=jsonBytes(evidence),digest=sha256(bytes);
  const filename=path.join(root,"mcp-control-requests",a.requestId+"-evidence.json");
  try{
    await fs.writeFile(filename,bytes,{flag:"wx",mode:0o600});
    const reread=await fs.readFile(filename);
    if(!reread.equals(bytes)||sha256(reread)!==digest)
      return blocked("PRODUCT_GATE_EVIDENCE_UNVERIFIED",a.expectedHead);
  }catch{return blocked("PRODUCT_GATE_EVIDENCE_UNVERIFIED",a.expectedHead);}
  return Object.freeze({
    state:"TEST_PASSED",code:"PRODUCT_GATE_OBSERVED_NOT_RELEASED",
    requestId:a.requestId,sourceHead:a.expectedHead,candidateHead:a.candidateHead,
    candidatePrNumber:a.candidatePrNumber,sourceRequestId:a.sourceRequestId,
    proofIds:["windows-factory-acceptance"],evidenceDigest:digest,
    verifierSourceDigest,
    ownerMachineObserved:true,independentVerification:false,
    modelInvoked:false,replayAuthorized:false,automaticMergeEnabled:false,
  });
}

/** Separate read-back. Caller must independently fetch source/PR/CI too. */
export function evaluateFactoryWindowsProductEvidence({
  evidenceBytes,receipt,expectedHead,candidateHead,candidatePrNumber,
  requestedProofs=["windows-factory-acceptance"],stageRequestId,
  verifierSourceDigest,
}={}){
  if(!Buffer.isBuffer(evidenceBytes)||evidenceBytes.length<100||evidenceBytes.length>8192||
    !SHA.test(expectedHead||"")||!SHA.test(candidateHead||"")||
    !/^[a-f0-9]{64}$/.test(verifierSourceDigest||"")||
    !ID.test(stageRequestId||"")||
    !Array.isArray(requestedProofs)||requestedProofs.length===0||
    requestedProofs.some(p=>!knownProofs.has(p)))
    return Object.freeze({state:"UNPROVEN",code:"PRODUCT_GATE_EVIDENCE_UNVERIFIED"});
  let artifact;
  try{artifact=JSON.parse(evidenceBytes.toString("utf8"));}catch{
    return Object.freeze({state:"UNPROVEN",code:"PRODUCT_GATE_EVIDENCE_UNVERIFIED"});
  }
  const pass=receipt?.state==="TEST_PASSED" &&
    receipt.code==="PRODUCT_GATE_OBSERVED_NOT_RELEASED" &&
    receipt.sourceHead===expectedHead&&receipt.candidateHead===candidateHead&&
    receipt.candidatePrNumber===candidatePrNumber &&
    receipt.sourceRequestId===stageRequestId &&
    SHA.test(artifact.sourceHead||"")&&artifact.sourceHead===expectedHead&&
    artifact.candidateHead===candidateHead&&
    artifact.candidatePrNumber===candidatePrNumber&&
    artifact.stageRequestId===stageRequestId&&
    artifact.requestId===receipt.requestId&&
    artifact.schemaVersion===1&&
    artifact.verifierSourceHead===expectedHead&&
    artifact.verifierSourceDigest===verifierSourceDigest&&
    receipt.verifierSourceDigest===verifierSourceDigest&&
    artifact.source==="OWNER_WINDOWS_NATIVE"&&
    artifact.action==="AUTHENTICATED_FACTORY_STATUS_AND_RUNNING_MIGRATION_DENIAL"&&
    artifact.authStatusVerified===true&&artifact.guestDenied===true&&
    artifact.migrationDeniedWhileRunning===true&&
    artifact.processIsolationVerified===true&&artifact.stopUnchanged===true&&
    artifact.supervisorStateBefore==="RUNNING"&&
    artifact.supervisorStateAfter==="RUNNING"&&
    artifact.replayAuthorized===false&&artifact.automaticMergeEnabled===false&&
    Array.isArray(artifact.proofIds)&&
    requestedProofs.every(p=>artifact.proofIds.includes(p))&&
    sha256(evidenceBytes)===receipt.evidenceDigest;
  return Object.freeze(pass?
    {state:"OBSERVATION_VERIFIED",code:"PRODUCT_GATE_EVIDENCE_MATCHED",
      candidateHead,proofIds:requestedProofs,releaseAuthorized:false,
      independentVerification:false}:
    {state:"UNPROVEN",code:"PRODUCT_GATE_EVIDENCE_UNVERIFIED",
      releaseAuthorized:false,independentVerification:false});
}

/**
 * Read-only second-phase verifier. A verified observation is NOT a merge
 * authorization and is not a separately credentialed F00 reviewer.
 */
export async function verifyFactoryWindowsProductGateReceipt({
  selection,root,repoRoot,platform=process.platform,
  verifyHead=readFactoryVerificationHead,inspectPr=inspectFactoryCandidatePr,
  readControlReceipt,fs={lstat,readFile},
}={}){
  const a=selection;
  if(!validateFactoryProductGateSelection(a))return blocked("PRODUCT_GATE_SELECTION_INVALID");
  if(platform!=="win32")return blocked("WINDOWS_ONLY");
  if(typeof root!=="string"||!path.isAbsolute(root)||
    typeof repoRoot!=="string"||!path.isAbsolute(repoRoot)||
    typeof readControlReceipt!=="function")return blocked("PRODUCT_GATE_EVIDENCE_UNVERIFIED");
  let head,receipt,identity;
  try{
    [head,receipt]=await Promise.all([
      verifyHead({repoRoot}),readControlReceipt(a.sourceRequestId),
    ]);
  }catch{return blocked("PRODUCT_GATE_EVIDENCE_UNVERIFIED");}
  if(head!==a.expectedHead||receipt?.state!=="TEST_PASSED"||
    receipt?.code!=="PRODUCT_GATE_OBSERVED_NOT_RELEASED"||
    receipt.requestId!==a.sourceRequestId||
    receipt.candidateHead!==a.candidateHead||
    receipt.candidatePrNumber!==a.candidatePrNumber||
    receipt.sourceHead!==a.expectedHead)
    return blocked("PRODUCT_GATE_EVIDENCE_UNVERIFIED",a.expectedHead);
  try{identity=await inspectPr({prNumber:a.candidatePrNumber,
    candidateHead:a.candidateHead,expectedHead:a.expectedHead,
    repoRoot,platform,verifyHead});}
  catch{return blocked("PRODUCT_GATE_CANDIDATE_UNVERIFIED",a.expectedHead);}
  if(identity?.state!=="TEST_PASSED"||identity.code!=="CANDIDATE_HEAD_VERIFIED")
    return blocked("PRODUCT_GATE_CANDIDATE_UNVERIFIED",a.expectedHead);
  let bytes;
  try{
    const filename=path.join(root,"mcp-control-requests",
      a.sourceRequestId+"-evidence.json");
    const stat=await fs.lstat(filename);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size<100||stat.size>8192)
      return blocked("PRODUCT_GATE_EVIDENCE_UNVERIFIED",a.expectedHead);
    bytes=await fs.readFile(filename);
    if(bytes.length!==stat.size)return blocked("PRODUCT_GATE_EVIDENCE_UNVERIFIED",a.expectedHead);
  }catch{return blocked("PRODUCT_GATE_EVIDENCE_UNVERIFIED",a.expectedHead);}
  let verifierSourceDigest;
  try{verifierSourceDigest=await readFactoryGateVerifierDigest();}
  catch{return blocked("PRODUCT_GATE_EVIDENCE_UNVERIFIED",a.expectedHead);}
  const checked=evaluateFactoryWindowsProductEvidence({
    evidenceBytes:bytes,receipt,expectedHead:a.expectedHead,
    candidateHead:a.candidateHead,candidatePrNumber:a.candidatePrNumber,
    stageRequestId:receipt.sourceRequestId,
    verifierSourceDigest,requestedProofs:["windows-factory-acceptance"],
  });
  try{if(checked.state!=="OBSERVATION_VERIFIED"||
    await verifyHead({repoRoot})!==a.expectedHead)
    return blocked("PRODUCT_GATE_EVIDENCE_UNVERIFIED",a.expectedHead);}
  catch{return blocked("PRODUCT_GATE_EVIDENCE_UNVERIFIED",a.expectedHead);}
  return Object.freeze({
    state:"TEST_PASSED",code:"PRODUCT_GATE_EVIDENCE_MATCHED",
    requestId:a.requestId,sourceRequestId:a.sourceRequestId,
    sourceHead:a.expectedHead,candidateHead:a.candidateHead,
    candidatePrNumber:a.candidatePrNumber,evidenceDigest:receipt.evidenceDigest,
    verifierSourceDigest,
    proofIds:["windows-factory-acceptance"],ownerMachineObserved:true,
    independentVerification:false,releaseAuthorized:false,
    automaticMergeEnabled:false,replayAuthorized:false,modelInvoked:false,
  });
}
