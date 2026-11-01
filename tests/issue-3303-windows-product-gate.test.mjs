import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,readFile,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {observeFactoryWindowsProductGate,evaluateFactoryWindowsProductEvidence,
  validateFactoryProductGateSelection,verifyFactoryWindowsProductGateReceipt,
  admissibleFactoryDiagnosticsDiff,attestFactoryDiagnosticsScope} from "../scripts/engineering-team/mcp/engineering/factory-windows-product-gate.mjs";
import {handleRpc,MCP_CONTROL_TOOLS} from "../scripts/engineering-team/mcp/factory-readonly-server.mjs";
import {resolveProofRoute,assessProductProof} from "../lib/verification/development/proof-routing.mjs";

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
  attestStage:async()=>true,attestScope:async()=>true});

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
    attestScope:async()=>false})).code,"PRODUCT_GATE_SCOPE_UNSUPPORTED");
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

test("#3303 risk route is compositional and requires independent privileged evidence",async()=>{
  const config=JSON.parse(await readFile(path.join(process.cwd(),
    "config/development-verification-routing.json"),"utf8"));
  const docs=resolveProofRoute({changedFiles:[
    "docs/developer-briefs/3303-permanent-risk-routed-windows-product-gate.md"],
    contract:config});
  assert.equal(docs.productProofStatus,"NOT_REQUIRED");
  const runtime=resolveProofRoute({changedFiles:[
    "scripts/engineering-team/mcp/engineering/new-status-module.mjs"],
    contract:config});
  assert.ok(runtime.productProofs.includes("windows-factory-acceptance"));
  const mixed=resolveProofRoute({changedFiles:[
    "scripts/engineering-team/mcp/factory-readonly-server.mjs",
    "scripts/engineering-team/windows/workers/Install-PlotPickleFactoryWorkers.ps1"],
    contract:config});
  assert.deepEqual(new Set(mixed.productProofs),
    new Set(["windows-factory-acceptance","windows-release-authority"]));
  const ref="factory-gate:trusted-artifact",partial=[{
    proofId:"windows-factory-acceptance",finding:"supports",
    testedCommit:CANDIDATE,action:"Native owner Windows observation",
    observed:"Verified",artifactRef:ref,
  }];
  const outcome=assessProductProof({route:mixed,evidence:partial,
    testedCommit:CANDIDATE,verifiedArtifactRefs:[ref]});
  assert.equal(outcome.status,"UNPROVEN");
  assert.deepEqual(outcome.missing,["windows-release-authority"]);
  assert.equal(assessProductProof({route:mixed,evidence:partial,
    testedCommit:MAIN,verifiedArtifactRefs:[ref]}).status,"UNPROVEN");
});

test("#3303 native probe scope refuses unrelated or silently expanded PR diffs",async()=>{
  const supported=[
    "config/verification/test-catalog.json",
    "scripts/engineering-team/mcp/engineering/factory-operator-maintenance.mjs",
    "scripts/engineering-team/mcp/factory-readonly-server.mjs",
    "tests/issue-3142-authenticated-operator-maintenance.test.mjs",
  ];
  assert.equal(admissibleFactoryDiagnosticsDiff(supported),true);
  assert.equal(admissibleFactoryDiagnosticsDiff(supported.slice(0,3)),false);
  assert.equal(admissibleFactoryDiagnosticsDiff([...supported,
    "scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs"]),false);
  assert.equal(admissibleFactoryDiagnosticsDiff([...supported.slice(0,3),
    "scripts/engineering-team/gateway/authorized-coding-once.mjs"]),false);
  assert.equal(admissibleFactoryDiagnosticsDiff([...supported.slice(0,3),
    supported[0]]),false);
  assert.equal(await attestFactoryDiagnosticsScope({
    stage:path.resolve(os.tmpdir()),expectedHead:MAIN,candidateHead:CANDIDATE,
    run:async()=>({stdout:supported.join("\n")+"\n"}),
  }),true);
  assert.equal(await attestFactoryDiagnosticsScope({
    stage:path.resolve(os.tmpdir()),expectedHead:MAIN,candidateHead:CANDIDATE,
    run:async()=>({stdout:supported.join("\r\n")+"\r\n"}),
  }),true);
  assert.equal(await attestFactoryDiagnosticsScope({
    stage:path.resolve(os.tmpdir()),expectedHead:MAIN,candidateHead:CANDIDATE,
    run:async()=>({stdout:supported.join("\n")+"\nother.js\n"}),
  }),false);
  assert.equal(await attestFactoryDiagnosticsScope({
    stage:path.resolve(os.tmpdir()),expectedHead:MAIN,candidateHead:CANDIDATE,
    run:async()=>{throw Error("UNTRUSTED_GIT");},
  }),false);
});

test("#3303 real loopback MCP transport enforces synthetic-token authorization without owner credentials",()=>sandbox(async root=>{
  // Integration regression only: this disposable localhost listener is not
  // the independently qualified owner tunnel, and cannot authorize a merge.
  const {randomBytes}=await import("node:crypto");
  const {createLocalMcpHttpServer}=await import(
    "../scripts/engineering-team/mcp/factory-readonly-server.mjs");
  const token=randomBytes(48).toString("base64url");
  const server=createLocalMcpHttpServer({
    root,controlToken:token,engineeringEnabled:true,
  });
  await new Promise((resolve,reject)=>{
    server.once("error",reject);
    server.listen(0,"127.0.0.1",resolve);
  });
  try{
    const address=server.address();
    assert.equal(address.address,"127.0.0.1");
    assert.ok(address.port>0);
    const endpoint="http://127.0.0.1:"+address.port+"/mcp";
    const invoke=async(payload,headers={})=>{
      const response=await fetch(endpoint,{method:"POST",signal:AbortSignal.timeout(8000),
        headers:{"content-type":"application/json",
          accept:"application/json, text/event-stream",...headers},
        body:JSON.stringify({jsonrpc:"2.0",id:7,...payload})});
      return {status:response.status,body:await response.json()};
    };
    const guest=await invoke({method:"tools/list"});
    const forged=await invoke({method:"tools/list"},
      {"x-plotpickle-factory-control-token":randomBytes(48).toString("base64url")});
    const owner=await invoke({method:"tools/list"},
      {"x-plotpickle-factory-control-token":token});
    assert.equal(guest.status,200);
    assert.equal(forged.status,200);
    assert.equal(owner.status,200);
    const suite="factory_run_named_test";
    assert.equal(guest.body.result.tools.some(x=>x.name===suite),false);
    assert.equal(forged.body.result.tools.some(x=>x.name===suite),false);
    assert.equal(owner.body.result.tools.some(x=>x.name===suite),true);
    const call={method:"tools/call",params:{name:suite,arguments:{
      requestId:"f".repeat(32),expectedHead:MAIN,
      suite:"factory-windows-product-gate",candidatePrNumber:3362,
      candidateHead:CANDIDATE,sourceRequestId:STAGE,
      arbitraryCommand:"NEVER_RUN",
    }}};
    assert.equal((await invoke(call)).body.error.code,-32001);
    assert.equal((await invoke(call,
      {"x-plotpickle-factory-control-token":token})).body.error.code,-32602);
    const wrongOrigin=await fetch(endpoint,{method:"POST",signal:AbortSignal.timeout(8000),
      headers:{"content-type":"application/json",
        accept:"application/json, text/event-stream",
        origin:"https://not-the-owner.example"},
      body:JSON.stringify({jsonrpc:"2.0",id:8,method:"tools/list"})});
    assert.equal(wrongOrigin.status,403);
    const wrongMethod=await fetch(endpoint,{method:"GET",signal:AbortSignal.timeout(8000),
      headers:{accept:"application/json, text/event-stream"}});
    assert.equal(wrongMethod.status,405);
  }finally{
    await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  }
}));

test("#3303 permission-restricted native child challenges disposable HTTP control token",()=>{
  // This runs under the real Node permission model, not injected RPC callbacks.
  // It does not contact the owner tunnel or exercise release/merge operations.
  const script=[
    'import {randomBytes} from "node:crypto";',
    'import {createLocalMcpHttpServer} from "./scripts/engineering-team/mcp/factory-readonly-server.mjs";',
    'const guard=process.permission;',
    'if(!guard?.has||guard.has("child")||guard.has("worker")||guard.has("fs.write"))throw Error("PERMISSION_INVALID");',
    'const token=randomBytes(48).toString("base64url");',
    'const server=createLocalMcpHttpServer({root:process.cwd(),controlToken:token,engineeringEnabled:true});',
    'const denied=Number(process.versions.node.split(".")[0])>=25&&guard.has("net")===false;',
    'if(denied){console.log(JSON.stringify({transport:"DENIED_BY_NODE",releaseAuthorized:false}));}',
    'else{await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});try {',
    ' const address=server.address();',
    ' if(address.address!=="127.0.0.1"||address.port<1)throw Error("NOT_LOOPBACK");',
    ' const url="http://127.0.0.1:"+address.port+"/mcp";',
    ' const query=async(headers={})=>{const response=await fetch(url,{method:"POST",signal:AbortSignal.timeout(4000),headers:{"content-type":"application/json",accept:"application/json, text/event-stream",...headers},body:JSON.stringify({jsonrpc:"2.0",id:3,method:"tools/list"})});if(response.status!==200)throw Error("HTTP_UNVERIFIED");return (await response.json())?.result?.tools;};',
    ' const guest=await query();',
    ' const forged=await query({"x-plotpickle-factory-control-token":randomBytes(48).toString("base64url")});',
    ' const owner=await query({"x-plotpickle-factory-control-token":token});',
    ' const allowed=list=>Array.isArray(list)&&list.some(t=>t.name==="factory_run_named_test");',
    ' if(!Array.isArray(guest)||!Array.isArray(forged)||!Array.isArray(owner)||allowed(guest)||allowed(forged)||!allowed(owner))throw Error("AUTH_BOUNDARY_FAILED");',
    ' console.log(JSON.stringify({transport:"LOOPBACK",credential:"DISPOSABLE",guestDenied:true,forgeryDenied:true,ownerAccepted:true,releaseAuthorized:false}));',
    '} finally {await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}}',
  ].join("\n");
  const result=spawnSync(process.execPath,[
    "--no-warnings","--permission",
    "--allow-fs-read="+process.cwd(),
    "--input-type=module","--eval",script,
  ],{cwd:process.cwd(),windowsHide:true,encoding:"utf8",timeout:20000,
    env:Object.fromEntries(Object.entries(process.env).filter(([key])=>
      ["PATH","Path","SystemRoot","WINDIR","PATHEXT","ComSpec","TEMP","TMP"].includes(key)))});
  assert.equal(result.error,undefined);
  assert.equal(result.status,0,result.stderr);
  const observed=JSON.parse(result.stdout.trim());
  if(observed.transport==="DENIED_BY_NODE"){
    assert.ok(Number(process.versions.node.split(".")[0])>=25);
    assert.deepEqual(observed,{transport:"DENIED_BY_NODE",releaseAuthorized:false});
  }else{
    assert.deepEqual(observed,{
      transport:"LOOPBACK",credential:"DISPOSABLE",
      guestDenied:true,forgeryDenied:true,ownerAccepted:true,releaseAuthorized:false,
    });
  }
});
