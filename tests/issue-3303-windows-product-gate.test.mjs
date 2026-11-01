import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,readFile,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {observeFactoryWindowsProductGate,evaluateFactoryWindowsProductEvidence,
  validateFactoryProductGateSelection} from "../scripts/engineering-team/mcp/engineering/factory-windows-product-gate.mjs";
import {handleRpc,MCP_CONTROL_TOOLS} from "../scripts/engineering-team/mcp/factory-readonly-server.mjs";

const MAIN="a".repeat(40),CANDIDATE="b".repeat(40);
const STAGE="c".repeat(32),REQ="d".repeat(32);
const selection={requestId:REQ,expectedHead:MAIN,candidatePrNumber:3362,
  candidateHead:CANDIDATE,sourceRequestId:STAGE};
const stageReceipt={state:"TEST_PASSED",code:"CANDIDATE_STATIC_STAGED",
  stageId:STAGE,sourceHead:MAIN,candidatePrNumber:3362,candidateHead:CANDIDATE};
const supervisor=()=>({state:"RUNNING",exactSha:MAIN,checkedAt:Date.now(),
  pauseAcknowledged:false});
const observed=()=>({state:"OBSERVED",source:"OWNER_WINDOWS_NATIVE",candidateHead:CANDIDATE,
  authStatusVerified:true,guestDenied:true,migrationDeniedWhileRunning:true,
  processIsolationVerified:true,stopUnchanged:true});
const sandbox=async fn=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"pp-3303-gate-"));
  try{await mkdir(path.join(root,"mcp-control-requests"));return await fn(root);}
  finally{await rm(root,{recursive:true,force:true});}
};
const options=(root)=>({selection,root,repoRoot:root,stageReceipt,platform:"win32",
  verifyHead:async()=>MAIN,readSupervisor:async()=>supervisor(),
  inspectPr:async()=>({state:"TEST_PASSED",code:"CANDIDATE_HEAD_VERIFIED"}),
  attestStage:async()=>true});

test("#3303 exact bound selection rejects injected commands and replay identifier",()=>{
  assert.equal(validateFactoryProductGateSelection(selection),true);
  for(const bad of [{...selection,command:"powershell.exe"},
    {...selection,sourceRequestId:REQ},{...selection,candidateHead:"bad"},
    {...selection,candidatePrNumber:-1},{...selection,requestId:"bad"}])
    assert.equal(validateFactoryProductGateSelection(bad),false);
  const spec=MCP_CONTROL_TOOLS.find(x=>x.name==="factory_run_named_test");
  assert.equal(spec.inputSchema.properties.suite.enum.includes("factory-windows-product-gate"),true);
  assert.equal(MCP_CONTROL_TOOLS.some(x=>/exec|shell|arbitrary/.test(x.name)),false);
});
test("#3303 default installed runner refuses to invent a native Windows observation",()=>sandbox(async root=>{
  const r=await observeFactoryWindowsProductGate(options(root));
  assert.equal(r.state,"BLOCKED");
  assert.equal(r.code,"PRODUCT_GATE_NATIVE_PROBE_UNVERIFIED");
  assert.equal(r.replayAuthorized,false);
  assert.equal(r.ownerMachineObserved,false);
  assert.equal(r.independentVerification,false);
}));
test("#3303 native runner rejects stale head, wrong stage, PAUSE and foreign platform",()=>sandbox(async root=>{
  assert.equal((await observeFactoryWindowsProductGate({...options(root),platform:"linux"})).code,"WINDOWS_ONLY");
  assert.equal((await observeFactoryWindowsProductGate({...options(root),
    stageReceipt:{...stageReceipt,candidateHead:MAIN}})).code,"PRODUCT_GATE_STAGE_UNVERIFIED");
  assert.equal((await observeFactoryWindowsProductGate({...options(root),
    verifyHead:async()=>CANDIDATE})).code,"PRODUCT_GATE_HOST_UNVERIFIED");
  assert.equal((await observeFactoryWindowsProductGate({...options(root),
    readSupervisor:async()=>({...supervisor(),pauseAcknowledged:true})})).code,"PRODUCT_GATE_HOST_UNVERIFIED");
  assert.equal((await observeFactoryWindowsProductGate({...options(root),
    attestStage:async()=>false})).code,"PRODUCT_GATE_STAGE_UNVERIFIED");
  assert.equal((await observeFactoryWindowsProductGate({...options(root),
    inspectPr:async()=>({state:"BLOCKED"})})).code,"PRODUCT_GATE_CANDIDATE_UNVERIFIED");
}));
test("#3303 trusted witness evidence is immutable, exact-bound and independently hash-read",()=>sandbox(async root=>{
  const r=await observeFactoryWindowsProductGate({...options(root),nativeProbe:async()=>observed()});
  assert.equal(r.state,"TEST_PASSED");
  assert.equal(r.code,"PRODUCT_GATE_OBSERVED_NOT_RELEASED");
  assert.equal(r.independentVerification,false);
  const bytes=await readFile(path.join(root,"mcp-control-requests",REQ+"-evidence.json"));
  const input={receipt:r,evidenceBytes:bytes,expectedHead:MAIN,candidateHead:CANDIDATE,
    candidatePrNumber:3362,stageRequestId:STAGE};
  assert.equal(evaluateFactoryWindowsProductEvidence(input).state,"OBSERVATION_VERIFIED");
  assert.equal(evaluateFactoryWindowsProductEvidence(input).releaseAuthorized,false);
  assert.equal(evaluateFactoryWindowsProductEvidence({...input,candidateHead:MAIN}).state,"UNPROVEN");
  assert.equal(evaluateFactoryWindowsProductEvidence({...input,stageRequestId:REQ}).state,"UNPROVEN");
  assert.equal(evaluateFactoryWindowsProductEvidence({...input,
    requestedProofs:["windows-release-authority"]}).state,"UNPROVEN");
  assert.equal(evaluateFactoryWindowsProductEvidence({...input,
    receipt:{...r,evidenceDigest:"0".repeat(64)}}).state,"UNPROVEN");
  assert.equal(evaluateFactoryWindowsProductEvidence({...input,
    receipt:{...r,independentVerification:true,requestId:"f".repeat(32)}}).state,"UNPROVEN");
  assert.equal(evaluateFactoryWindowsProductEvidence({...input,
    evidenceBytes:Buffer.from(bytes.toString().replace('"guestDenied":true','"guestDenied":false'))}).state,"UNPROVEN");
  const duplicate=await observeFactoryWindowsProductGate({...options(root),nativeProbe:async()=>observed()});
  assert.equal(duplicate.code,"PRODUCT_GATE_EVIDENCE_UNVERIFIED");
}));
test("#3303 guest and forged control arguments never execute Product Gate",()=>sandbox(async root=>{
  let calls=0;
  const call=(args,authorized)=>handleRpc({jsonrpc:"2.0",id:99,method:"tools/call",
    params:{name:"factory_run_named_test",arguments:args}},
    {root,controlAuthenticated:authorized,controlOps:{
      testHead:async()=>MAIN,productGate:async()=>{calls++;
        return {state:"BLOCKED",code:"PRODUCT_GATE_NATIVE_PROBE_UNVERIFIED"};}
    }});
  const args={...selection,suite:"factory-windows-product-gate"};
  assert.equal((await call(args,false)).error.code,-32001);
  assert.equal((await call({...args,command:"Get-Process"},true)).error.code,-32602);
  assert.equal(calls,0);
  const first=await call(args,true);
  assert.equal(first.result.structuredContent.state,"BLOCKED");
  assert.equal(first.result.structuredContent.independentVerification,false);
  assert.equal(calls,1);
  assert.equal((await call(args,true)).result.structuredContent.state,
    "DUPLICATE_OR_UNVERIFIABLE_REQUEST");
  assert.equal(calls,1);
}));
