import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { plotpickleLaunchIdentity } from "../modules/intent/model/launch-identity.mjs";
import { createPlotpickleAppController } from "../scripts/engineering-team/mcp/plotpickle-app-lifecycle.mjs";
import { prepareStagedHumanCandidate } from "../scripts/engineering-team/mcp/candidate/plotpickle-candidate-source.mjs";
import { inspectFactoryCandidatePr } from "../scripts/engineering-team/mcp/factory-named-tests.mjs";
import { handleRpc, MCP_CONTROL_TOOLS } from "../scripts/engineering-team/mcp/factory-readonly-server.mjs";
import { readFile } from "node:fs/promises";

const MAIN="1".repeat(40),OLD="0".repeat(40),PR="2".repeat(40);
const STAGE="a".repeat(32);
const requestId=n=>n.toString(16).padStart(32,"0");
const receipt={state:"TEST_PASSED",code:"CANDIDATE_STATIC_STAGED",
  sourceHead:MAIN,candidateHead:PR,candidatePrNumber:3219,stageId:STAGE};

test("#3222 version label recognizes only source-matched launch contracts; otherwise UNVERIFIED",()=>{
  const marker=head=>`plotpickle-startup-v4-${head}-normal-local-human-vite-source`;
  assert.equal(plotpickleLaunchIdentity({
    PLOTPICKLE_LAUNCH_CHANNEL:"main",PLOTPICKLE_LAUNCH_SOURCE_HEAD:MAIN,
    PLOTPICKLE_STARTUP_CONTRACT:marker(MAIN),
  }).label,`MAIN · MERGED · ${MAIN.slice(0,12)}`);
  assert.equal(plotpickleLaunchIdentity({
    PLOTPICKLE_LAUNCH_CHANNEL:"pr-test",PLOTPICKLE_LAUNCH_PR_NUMBER:"3219",
    PLOTPICKLE_LAUNCH_SOURCE_HEAD:PR,
    PLOTPICKLE_STARTUP_CONTRACT:marker(PR),
  }).label,`PR #3219 · TEST / UNMERGED · ${PR.slice(0,12)}`);
  for(const extra of [
    {PLOTPICKLE_LAUNCH_CHANNEL:"main"},
    {PLOTPICKLE_LAUNCH_CHANNEL:"pr-test",PLOTPICKLE_LAUNCH_PR_NUMBER:"0"},
    {PLOTPICKLE_LAUNCH_CHANNEL:"pr-test",PLOTPICKLE_LAUNCH_PR_NUMBER:"3219",
      PLOTPICKLE_STARTUP_CONTRACT:marker(MAIN)},
  ]){
    assert.equal(plotpickleLaunchIdentity({PLOTPICKLE_LAUNCH_SOURCE_HEAD:PR,
      ...extra}).channel,"UNVERIFIED");
  }
});

test("#3222 root layout keeps launch label visible across locked profile gate and Reports",async()=>{
  const layout=await readFile(new URL("../app/layout.tsx",import.meta.url),"utf8");
  const ui=await readFile(new URL("../scripts/engineering-team/mcp/plotpickle-app-lifecycle.mjs",import.meta.url),"utf8");
  assert.match(layout,/plotpickleLaunchIdentity\(process\.env\)/u);
  assert.match(layout,/data-plotpickle-launch-channel/u);
  assert.match(layout,/data-plotpickle-launch-head/u);
  assert.ok(layout.indexOf("data-plotpickle-launch-channel")<layout.indexOf("<ProfileAccessRouter"));
  assert.match(ui,/data-plotpickle-launch-channel/u);
  assert.match(ui,/data-plotpickle-launch-head/u);
  assert.doesNotMatch(layout,/query\\.channel|searchParams\\.get\\("channel"\\)/u);
});

test("#3222 older draft PR base needs independently verified ancestry of clean current main",async()=>{
  let checked=false;
  const run=async(exe,args)=>{
    if(exe==="gh")return {stdout:JSON.stringify({number:3219,state:"OPEN",
      baseRefName:"main",baseRefOid:OLD,headRefOid:PR})};
    assert.equal(exe,"git");
    assert.deepEqual(args,["merge-base","--is-ancestor",OLD,MAIN]);
    checked=true;
    return {stdout:""};
  };
  const args={prNumber:3219,candidateHead:PR,expectedHead:MAIN,
    platform:"win32",verifyHead:async()=>MAIN,run};
  const pass=await inspectFactoryCandidatePr(args);
  assert.equal(pass.code,"CANDIDATE_HEAD_VERIFIED");
  assert.equal(checked,true);
  const denied=await inspectFactoryCandidatePr({...args,
    run:async(exe,argv)=>exe==="gh"?run(exe,argv):Promise.reject(Error("not ancestor"))});
  assert.equal(denied.code,"CANDIDATE_BASE_MISMATCH");
});

function stagedFixture(overrides={}){
  const calls=[],stage=path.join(os.tmpdir(),"pp-fixture-private","chat-candidate-stages",STAGE);
  let marker="identical";
  const options={
    root:path.join(os.tmpdir(),"pp-fixture-private"),sourceRequestId:STAGE,expectedHead:MAIN,
    candidateHead:PR,candidatePrNumber:3219,stageReceipt:receipt,
    repoRoot:path.join(os.tmpdir(),"pp-fixture-main"),platform:"win32",
    verifyHead:async()=>MAIN,
    inspectPr:async()=>({state:"TEST_PASSED",code:"CANDIDATE_HEAD_VERIFIED"}),
    fileOps:{
      lstat:async()=>({isDirectory:()=>true,isSymbolicLink:()=>false}),
      readFile:async p=>Buffer.from(p.endsWith("package.json")?marker:"locked"),
      existsSync:p=>p.endsWith("vite.js"),
    },
    run:async(program,args)=>{
      calls.push({program,args});
      if(args[0]==="rev-parse")return {stdout:PR+"\n"};
      if(args[0]==="status")return {stdout:""};
      throw Error("unexpected process");
    },
    ...overrides,
  };
  return {options,calls,stage};
}
test("#3222 private exact PR candidate requires stage receipt, clean head and locked dependencies",async()=>{
  const x=stagedFixture();
  const pass=await prepareStagedHumanCandidate(x.options);
  assert.equal(pass.code,"APP_CANDIDATE_PREPARED");
  assert.equal(pass.repoRoot,x.stage);
  assert.equal(x.calls.length,2);
  assert.equal((await prepareStagedHumanCandidate({...x.options,
    stageReceipt:{...receipt,stageId:requestId(98)}})).code,
    "APP_CANDIDATE_RECEIPT_INVALID");
  assert.equal((await prepareStagedHumanCandidate({...x.options,
    fileOps:{...x.options.fileOps,lstat:async()=>({isDirectory:()=>true,
      isSymbolicLink:()=>true})}})).code,"APP_CANDIDATE_STAGE_INVALID");
  assert.equal((await prepareStagedHumanCandidate({...x.options,
    run:async(program,args)=>args[0]==="rev-parse"?{stdout:OLD}:{stdout:""}})).code,
    "APP_CANDIDATE_SOURCE_CHANGED");
  assert.equal((await prepareStagedHumanCandidate({...x.options,
    fileOps:{...x.options.fileOps,readFile:async p=>Buffer.from(p.startsWith(path.join(os.tmpdir(),"pp-fixture-main"))?"a":"b")}})).code,
    "APP_CANDIDATE_DEPENDENCY_DRIFT");
});

test("#3222 only stopped port and exact private worktree can become PR TEST",async()=>{
  let port=false,spawned=null,stopped=0;
  const controller=createPlotpickleAppController({
    platform:"win32",repoRoot:"C:\\main",verifyHead:async()=>MAIN,
    portOccupied:async()=>port,hasFile:()=>true,
    prepareCandidate:async args=>{
      assert.equal(args.candidatePrNumber,3219);
      assert.deepEqual(args.stageReceipt,receipt);
      return {state:"TEST_PASSED",code:"APP_CANDIDATE_PREPARED",
        repoRoot:"C:\\isolated-3219",sourceHead:PR};
    },
    launch:(exe,args,opts)=>{
      assert.equal(opts.cwd,"C:\\isolated-3219");
      assert.equal(opts.env.PLOTPICKLE_LAUNCH_CHANNEL,"pr-test");
      assert.equal(opts.env.PLOTPICKLE_LAUNCH_SOURCE_HEAD,PR);
      assert.equal(opts.env.PLOTPICKLE_LAUNCH_PR_NUMBER,"3219");
      assert.equal(opts.env.PLOTPICKLE_FACTORY_MCP_CONTROL_TOKEN,undefined);
      assert.equal(opts.shell,false);
      port=true;
      return spawned=Object.assign(new EventEmitter(),{pid:8271,exitCode:null,signalCode:null});
    },
    probe:async(head,channel,pr)=>{
      assert.deepEqual([head,channel,pr],[PR,"PR_TEST",3219]);
      return true;
    },
    stopTree:async child=>{assert.equal(child,spawned);stopped++;child.exitCode=0;port=false;},
    delay:async()=>{},now:()=>1000,
  });
  const args={action:"candidate-start",expectedHead:MAIN,
    root:"C:\\private",candidatePrNumber:3219,candidateHead:PR,
    sourceRequestId:STAGE,stageReceipt:receipt};
  port=true;
  assert.equal((await controller.control(args)).code,"APP_PORT_OCCUPIED");
  port=false;
  const pass=await controller.control(args);
  assert.equal(pass.code,"APP_CANDIDATE_STARTED_VERIFIED");
  const status=await controller.status();
  assert.deepEqual([status.sourceHead,status.channel,status.candidatePrNumber,status.ready],
    [PR,"PR_TEST",3219,true]);
  assert.equal((await controller.control({action:"restart",expectedHead:MAIN})).code,
    "APP_CANDIDATE_RESTART_REQUIRED");
  assert.equal((await controller.control({action:"stop",expectedHead:MAIN})).code,
    "APP_STOPPED_VERIFIED");
  assert.equal(stopped,1);
  assert.equal((await controller.status()).state,"NOT_RUNNING");
});

test("#3222 MCP candidate request is six fixed fields with immutable stage identity; no arbitrary commands",async()=>{
  const tool=MCP_CONTROL_TOOLS.find(x=>x.name==="factory_run_named_test");
  assert.equal(MCP_CONTROL_TOOLS.length,4);
  assert.ok(tool.inputSchema.properties.suite.enum.includes("plotpickle-app-candidate-start"));
  const root=await mkdtemp(path.join(os.tmpdir(),"pp-candidate-control-"));
  try{
    const privateDir=path.join(root,"mcp-control-requests");
    await mkdir(privateDir,{recursive:true});
    const source=STAGE;
    await writeFile(path.join(privateDir,source+".json"),JSON.stringify({
      schemaVersion:1,requestId:source,operation:"factory_run_named_test",
      expectedHead:MAIN})+"\n");
    await writeFile(path.join(privateDir,source+"-result.json"),JSON.stringify({
      requestId:source,state:"TEST_PASSED",code:"CANDIDATE_STATIC_STAGED",
      sourceHead:MAIN,suite:"factory-pr-stage",stageId:source,
      candidatePrNumber:3219,candidateHead:PR})+"\n");
    let called=0;
    const controlOps={testHead:async()=>MAIN,
      appControl:async args=>{
        called++;
        assert.equal(args.action,"candidate-start");
        assert.deepEqual([args.candidateHead,args.candidatePrNumber],[PR,3219]);
        assert.equal(args.stageReceipt.code,"CANDIDATE_STATIC_STAGED");
        return {state:"TEST_PASSED",code:"APP_CANDIDATE_STARTED_VERIFIED",sourceHead:PR};
      }};
    const invoke=(args,authorized=true)=>handleRpc({jsonrpc:"2.0",id:1,
      method:"tools/call",params:{name:"factory_run_named_test",arguments:args}},
      {root,controlAuthenticated:authorized,controlOps});
    const args={requestId:requestId(921),expectedHead:MAIN,
      suite:"plotpickle-app-candidate-start",candidatePrNumber:3219,
      candidateHead:PR,sourceRequestId:source};
    assert.equal((await invoke(args,false)).error.code,-32001);
    for(const [field,value] of [["pid",8271],["path","C:\\unauthorized"],
      ["url","https://unexpected"],["command","powershell"]]){
      assert.equal((await invoke({...args,[field]:value})).error.code,-32602);
    }
    const pass=await invoke(args);
    assert.equal(pass.result.structuredContent.code,"APP_CANDIDATE_STARTED_VERIFIED");
    assert.equal(pass.result.structuredContent.candidatePrNumber,3219);
    assert.equal(pass.result.structuredContent.candidateHead,PR);
    assert.equal(called,1);
    assert.equal((await invoke(args)).result.structuredContent.state,
      "DUPLICATE_OR_UNVERIFIABLE_REQUEST");
  }finally{await rm(root,{recursive:true,force:true});}
});
