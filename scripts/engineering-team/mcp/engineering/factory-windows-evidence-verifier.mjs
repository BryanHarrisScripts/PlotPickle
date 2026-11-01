/**
 * #3303: trusted read-back and deterministic evaluation of owner-Windows
 * Factory acceptance. Candidate code cannot nominate trusted artifact refs.
 * This is an owner-supervised product proof, NOT an F00 signature or an
 * autonomous merge permission.
 */
import {createHash,timingSafeEqual} from "node:crypto";
import {lstat,readFile} from "node:fs/promises";
import path from "node:path";

const SHA=/^[a-f0-9]{40}$/u;
const REQUEST=/^[a-f0-9]{32}$/u;
const DIGEST=/^[a-f0-9]{64}$/u;
const PROOF="windows-factory-acceptance";
const SESSION="factory-operations-v1";
const deny=(code,state="UNPROVEN")=>Object.freeze({state,code,
  proofId:PROOF,independentVerification:false,automaticMergeAuthorized:false,
  replayAuthorized:false});

function equalDigest(a,b) {
  if(!DIGEST.test(a||"")||!DIGEST.test(b||""))return false;
  return timingSafeEqual(Buffer.from(a,"hex"),Buffer.from(b,"hex"));
}

export function verifyFactoryWindowsEvidence({
  evidence,artifactBytes,artifactDigest,requestId,expectedHead,
  candidateHead,candidatePrNumber,stageRequestId,verifierSourceHead,
  currentHost,artifactReadByTrustedVerifier=false,
}={}) {
  if(!REQUEST.test(requestId||"")||!REQUEST.test(stageRequestId||"")||
     !SHA.test(expectedHead||"")||!SHA.test(candidateHead||"")||
     !SHA.test(verifierSourceHead||"")||
     !Number.isSafeInteger(candidatePrNumber)||candidatePrNumber<1)
    return deny("PRODUCT_GATE_IDENTITY_INVALID","BLOCKED");
  if(!artifactReadByTrustedVerifier || !Buffer.isBuffer(artifactBytes))
    return deny("PRODUCT_GATE_EVIDENCE_NOT_INDEPENDENTLY_READ");
  const actual=createHash("sha256").update(artifactBytes).digest("hex");
  if(!equalDigest(artifactDigest,actual))return deny("PRODUCT_GATE_EVIDENCE_DIGEST_INVALID","BLOCKED");
  let raw;
  try{raw=JSON.parse(artifactBytes.toString("utf8"));}catch{
    return deny("PRODUCT_GATE_EVIDENCE_INVALID","BLOCKED");
  }
  if(JSON.stringify(raw)!==JSON.stringify(evidence) ||
     raw?.schemaVersion!==1||raw?.session!==SESSION||
     raw?.requestId!==requestId||raw?.stageRequestId!==stageRequestId||
     raw?.candidatePrNumber!==candidatePrNumber||
     raw?.candidateHead!==candidateHead||raw?.sourceHead!==expectedHead||
     raw?.verifierSourceHead!==verifierSourceHead||
     raw?.proofId!==PROOF||raw?.platform!=="win32"||
     raw?.simulated!==false||raw?.replayAuthorized!==false)
    return deny("PRODUCT_GATE_EVIDENCE_IDENTITY_MISMATCH","BLOCKED");
  if(!Number.isSafeInteger(raw.observedAt)||raw.observedAt<=0||
     !Array.isArray(raw.checks)||raw.checks.length!==7||
     raw.checks.some(c=>!c||typeof c.id!=="string"||
       !["PASS","FAIL","UNPROVEN"].includes(c.result))||
     new Set(raw.checks.map(c=>c.id)).size!==7)
    return deny("PRODUCT_GATE_EVIDENCE_SCHEMA_INVALID","BLOCKED");
  const required=[
    "native-windows","candidate-isolated","authenticated-status",
    "guest-denied","migration-denied-running",
    "supervisor-unchanged","source-unchanged",
  ];
  if(required.some(k=>!raw.checks.some(c=>c.id===k)))
    return deny("PRODUCT_GATE_EVIDENCE_SCOPE_INVALID","BLOCKED");
  if(currentHost?.sourceHead!==expectedHead||
     currentHost?.state!=="EXACT_CLEAN_MAIN"||
     currentHost?.supervisorState!=="RUNNING"||
     currentHost?.supervisorFresh!==true||
     currentHost?.pauseAcknowledged!==false)
    return deny("PRODUCT_GATE_CURRENT_HOST_UNVERIFIED","BLOCKED");
  if(raw.checks.some(c=>c.result==="FAIL"))
    return deny("PRODUCT_GATE_BEHAVIOR_FAILED","FAIL");
  if(raw.checks.some(c=>c.result!=="PASS"))
    return deny("PRODUCT_GATE_BEHAVIOR_UNPROVEN");
  return Object.freeze({state:"PASS",code:"PRODUCT_GATE_OWNER_WINDOWS_OBSERVED",
    proofId:PROOF,sourceHead:expectedHead,candidateHead,candidatePrNumber,
    artifactDigest:actual,independentVerification:false,
    automaticMergeAuthorized:false,replayAuthorized:false});
}

/** Read the fixed request file separately from the candidate and rehash bytes. */
export async function readAndVerifyFactoryWindowsEvidence({
  root,requestId,expectedHead,candidateHead,candidatePrNumber,
  stageRequestId,verifierSourceHead,currentHost,expectedDigest,
  fs={lstat,readFile},
}={}) {
  if(typeof root!=="string"||!path.isAbsolute(root)||
     !REQUEST.test(requestId||""))
    return deny("PRODUCT_GATE_ARTIFACT_SELECTION_INVALID","BLOCKED");
  const filename=path.join(root,"product-gate-evidence",requestId+".json");
  let bytes;
  try{
    const stat=await fs.lstat(filename);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size<32||stat.size>8192)
      return deny("PRODUCT_GATE_ARTIFACT_UNVERIFIED","BLOCKED");
    bytes=await fs.readFile(filename);
    if(!Buffer.isBuffer(bytes)||bytes.length!==stat.size)
      return deny("PRODUCT_GATE_ARTIFACT_UNVERIFIED","BLOCKED");
  }catch{return deny("PRODUCT_GATE_ARTIFACT_MISSING","BLOCKED");}
  let evidence;
  try{evidence=JSON.parse(bytes.toString("utf8"));}catch{
    return deny("PRODUCT_GATE_ARTIFACT_UNVERIFIED","BLOCKED");}
  return verifyFactoryWindowsEvidence({evidence,artifactBytes:bytes,
    artifactDigest:expectedDigest,requestId,expectedHead,candidateHead,
    candidatePrNumber,stageRequestId,verifierSourceHead,currentHost,
    artifactReadByTrustedVerifier:true});
}
