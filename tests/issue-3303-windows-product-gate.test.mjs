import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,readFile,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {observeFactoryWindowsProductGate,evaluateFactoryWindowsProductEvidence,
  validateFactoryProductGateSelection,verifyFactoryWindowsProductGateReceipt} from "../scripts/engineering-team/mcp/engineering/factory-windows-product-gate.mjs";
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
    candidatePrNumber:3362,stageRequestId:STAGE,
    verifierSourceDigest:r.verifierSourceDigest};
  assert.equal(evaluateFactoryWindowsProductEvidence(input).state,"OBSERVATION_VERIFIED");
  assert.equal(evaluateFactoryWindowsProductEvidence(input).releaseAuthorized,false);
  assert.equal(evaluateFactoryWindowsProductEvidence({...input,candidateHead:MAIN}).state,"UNPROVEN");
  assert.equal(evaluateFactoryWindowsProductEvidence({...input,
    verifierSourceDigest:"f".repeat(64)}).state,"UNPROVEN");
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
    {root,controlAuthenticated:authorized,engineeringEnabled:true,controlOps:{
      testHead:async()=>MAIN,
      engineering:async()=>({state:"TEST_PASSED",code:"ENGINEERING_TASK_PASSED"}),
      productGate:async()=>{calls++;
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

test("#3303 trusted native probe source is restricted and never elevates a fixture",async()=>{
  const {probeFactoryWindowsCandidate,collectFactoryWindowsNativeSnapshot}=
    await import("../scripts/engineering-team/mcp/engineering/factory-windows-product-gate-native.mjs");
  assert.equal((await probeFactoryWindowsCandidate({
    stage:"/tmp/stage",expectedHead:MAIN,candidateHead:CANDIDATE,platform:"linux"})).state,
    "UNPROVEN");
  const response=await probeFactoryWindowsCandidate({
    stage:path.resolve(os.tmpdir()),expectedHead:MAIN,candidateHead:CANDIDATE,
    platform:"win32",collect:async()=>({sourceHead:MAIN,candidateHead:CANDIDATE}),
    execute:async()=>({exitCode:1,stopVerified:true,timedOut:false}),
  });
  assert.equal(response.state,"UNPROVEN");
  assert.equal((await collectFactoryWindowsNativeSnapshot({
    expectedHead:MAIN,candidateHead:CANDIDATE,platform:"linux"})),null);
});

test("#3303 second-phase readback rechecks current PR and evidence; cannot grant release",()=>sandbox(async root=>{
  const first=await observeFactoryWindowsProductGate({...options(root),
    nativeProbe:async()=>observed()});
  assert.equal(first.code,"PRODUCT_GATE_OBSERVED_NOT_RELEASED");
  const verify={...options(root),selection:{...selection,
    requestId:"e".repeat(32),sourceRequestId:REQ},
    readControlReceipt:async id=>id===REQ?first:null};
  const accepted=await verifyFactoryWindowsProductGateReceipt(verify);
  assert.equal(accepted.state,"TEST_PASSED");
  assert.equal(accepted.code,"PRODUCT_GATE_EVIDENCE_MATCHED");
  assert.equal(accepted.independentVerification,false);
  assert.equal(accepted.releaseAuthorized,false);
  assert.equal(accepted.verifierSourceDigest,first.verifierSourceDigest);
  assert.equal((await verifyFactoryWindowsProductGateReceipt({...verify,
    readControlReceipt:async()=>null})).state,"BLOCKED");
  assert.equal((await verifyFactoryWindowsProductGateReceipt({...verify,
    verifyHead:async()=>CANDIDATE})).code,"PRODUCT_GATE_EVIDENCE_UNVERIFIED");
  assert.equal((await verifyFactoryWindowsProductGateReceipt({...verify,
    inspectPr:async()=>({state:"BLOCKED"})})).code,"PRODUCT_GATE_CANDIDATE_UNVERIFIED");
}));

test("#3303 candidate-executing suite requires the existing owner engineering opt-in",async()=>{
  const {executeMcpRequest}=await import(
    "../scripts/engineering-team/mcp/factory-readonly-server.mjs");
  const listing={jsonrpc:"2.0",method:"tools/list"};
  const disabled=await executeMcpRequest(listing,{
    controlAuthenticated:true,engineeringEnabled:false});
  const disabledSuite=disabled.result.tools.find(t=>t.name==="factory_run_named_test");
  assert.equal(disabledSuite.inputSchema.properties.suite.enum.includes(
    "factory-windows-product-gate"),false);
  assert.equal(disabledSuite.inputSchema.properties.suite.enum.includes(
    "factory-windows-product-gate-verify"),true);
  const enabled=await executeMcpRequest(listing,{
    controlAuthenticated:true,engineeringEnabled:true});
  const enabledSuite=enabled.result.tools.find(t=>t.name==="factory_run_named_test");
  assert.equal(enabledSuite.inputSchema.properties.suite.enum.includes(
    "factory-windows-product-gate"),true);
  const forbidden=await executeMcpRequest({jsonrpc:"2.0",method:"tools/call",
    params:{name:"factory_run_named_test",arguments:{
      ...selection,suite:"factory-windows-product-gate",
    }}},{controlAuthenticated:true,engineeringEnabled:false});
  assert.equal(forbidden.error.code,-32601);
});

test("#3303 real Node permission guardrail denies child, worker, and file writes",()=>{
  const command=[
    "const p=process.permission;",
    "console.log(JSON.stringify({available:!!p,child:p?.has('child'),",
    "worker:p?.has('worker'),write:p?.has('fs.write')}));",
  ].join("");
  const result=spawnSync(process.execPath,["--no-warnings","--permission",
    "--eval",command],{windowsHide:true,encoding:"utf8",timeout:15000});
  assert.equal(result.error,undefined);
  assert.equal(result.status,0,result.stderr);
  const permissions=JSON.parse(result.stdout.trim());
  assert.deepEqual(permissions,{available:true,child:false,worker:false,write:false});
});
