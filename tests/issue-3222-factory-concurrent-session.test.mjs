import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  FACTORY_SESSION_ENDPOINT,createFactoryIsolatedSessionController,
  factorySessionEnvironment,
} from "../scripts/engineering-team/mcp/factory-isolated-session.mjs";
import { createPlotpickleAppController } from "../scripts/engineering-team/mcp/plotpickle-app-lifecycle.mjs";
import { handleRpc, MCP_CONTROL_TOOLS } from "../scripts/engineering-team/mcp/factory-readonly-server.mjs";

const MAIN="1".repeat(40),PR="2".repeat(40),STAGE="a".repeat(32);
const stageReceipt={state:"TEST_PASSED",code:"CANDIDATE_STATIC_STAGED",
  stageId:STAGE,sourceHead:MAIN,candidateHead:PR,candidatePrNumber:3248};
const stagedRoot=path.resolve("fixture","stage");
const home=path.resolve("fixture","synthetic-factory-human");
const runtime={home,runtimeEnv:{
  PLOTPICKLE_HOME:home,
  PLOTPICKLE_AUTH_STATE_PATH:path.join(home,"auth","state.json"),
  PLOTPICKLE_ACCESS_MODE:"desktop-loopback",
  PLOTPICKLE_SERVER_NETWORK_ENABLED:"false",
}};
const args={action:"factory-start",expectedHead:MAIN,
  root:path.resolve("fixture","private"),sourceRequestId:STAGE,
  candidateHead:PR,candidatePrNumber:3248,stageReceipt};
const id=n=>n.toString(16).padStart(32,"0");

function fixture(overrides={}) {
  let mainOccupied=false,factoryOccupied=false;
  let head=MAIN,homeTaken=false,stageOk=true,ready=true;
  const mainStopped=[],factoryStopped=[],mainLaunches=[],factoryLaunches=[];
  const fakeChild=n=>Object.assign(new EventEmitter(),
    {pid:n,exitCode:null,signalCode:null});
  const session=createFactoryIsolatedSessionController({
    platform:"win32",repoRoot:path.resolve("fixture","main"),
    verifyHead:async()=>head,
    prepareCandidate:async()=>{
      if(!stageOk)return {state:"BLOCKED",code:"APP_CANDIDATE_SOURCE_CHANGED"};
      return {state:"TEST_PASSED",code:"APP_CANDIDATE_PREPARED",repoRoot:stagedRoot};
    },
    runtimeFor:()=>runtime,
    homeExists:()=>homeTaken,
    hasFile:()=>true,
    portOccupied:async()=>factoryOccupied,
    probe:async()=>ready,
    launch:(exe,argv,opts)=>{
      assert.equal(opts.cwd,stagedRoot);
      assert.equal(opts.shell,false);
      assert.deepEqual(argv.slice(-5),["--host","localhost","--port","4174","--strictPort"]);
      assert.equal(opts.env.PLOTPICKLE_HOME,home);
      assert.equal(opts.env.PLOTPICKLE_AUTH_STATE_PATH,path.join(home,"auth","state.json"));
      assert.equal(opts.env.PLOTPICKLE_LAUNCH_CHANNEL,"pr-test");
      assert.equal(opts.env.PLOTPICKLE_LAUNCH_SOURCE_HEAD,PR);
      assert.equal(opts.env.PLOTPICKLE_FACTORY_MCP_CONTROL_TOKEN,undefined);
      assert.equal(opts.env.OPENAI_API_KEY,undefined);
      const child=fakeChild(9000+factoryLaunches.length);
      factoryLaunches.push(child);factoryOccupied=true;return child;
    },
    stopTree:async child=>{factoryStopped.push(child.pid);child.exitCode=0;factoryOccupied=false;},
    delay:async()=>{},now:()=>1000,
    ...overrides,
  });
  const main=createPlotpickleAppController({
    platform:"win32",repoRoot:path.resolve("fixture","main"),
    verifyHead:async()=>head,isolatedFactoryController:session,
    portOccupied:async()=>mainOccupied,hasFile:()=>true,
    launch:(exe,argv,opts)=>{
      assert.deepEqual(argv.slice(-5),["--host","127.0.0.1","--port","4173","--strictPort"]);
      const child=fakeChild(7000+mainLaunches.length);
      mainLaunches.push(child);mainOccupied=true;return child;
    },
    probe:async()=>true,
    stopTree:async child=>{mainStopped.push(child.pid);child.exitCode=0;mainOccupied=false;},
    delay:async()=>{},now:()=>1000,
  });
  return {session,main,mainStopped,factoryStopped,mainLaunches,factoryLaunches,
    setMainOccupied:v=>mainOccupied=v,setFactoryOccupied:v=>factoryOccupied=v,
    setHead:v=>head=v,setHomeTaken:v=>homeTaken=v,setStageOk:v=>stageOk=v,
    setReady:v=>ready=v};
}

test("#3222 fixed Factory port and synthetic profile cannot inherit MAIN origin or provider secrets",()=>{
  assert.deepEqual(FACTORY_SESSION_ENDPOINT,{
    host:"localhost",port:4174,url:"http://localhost:4174/skin-v1",
  });
  const env=factorySessionEnvironment(runtime,PR,3248,{
    PATH:"C:/Program Files/nodejs",SystemRoot:"C:/Windows",OPENAI_API_KEY:"do-not-copy",
    PLOTPICKLE_FACTORY_MCP_CONTROL_TOKEN:"do-not-copy",PLOTPICKLE_HOME:"C:/real-user",
    LOCALAPPDATA:"C:/real-user/AppData/Local",
  });
  assert.equal(env.PLOTPICKLE_HOME,home);
  assert.equal(env.PLOTPICKLE_AUTH_STATE_PATH,path.join(home,"auth","state.json"));
  assert.equal(env.USERPROFILE,home);
  assert.equal(env.LOCALAPPDATA,path.join(home,"localappdata"));
  assert.equal(env.OPENAI_API_KEY,undefined);
  assert.equal(env.PLOTPICKLE_FACTORY_MCP_CONTROL_TOKEN,undefined);
  assert.equal(env.PLOTPICKLE_LAUNCH_CHANNEL,"pr-test");
  assert.equal(env.PLOTPICKLE_LAUNCH_PR_NUMBER,"3248");
});

test("#3222 owner MAIN and source-bound Factory candidate can coexist; STOP remains channel-scoped",async()=>{
  const x=fixture();
  assert.equal((await x.main.control({action:"start",expectedHead:MAIN})).code,
    "APP_STARTED_VERIFIED");
  assert.equal((await x.main.control(args)).code,"APP_CANDIDATE_STARTED_VERIFIED");
  assert.equal(x.mainLaunches.length,1);
  assert.equal(x.factoryLaunches.length,1);
  assert.deepEqual(x.mainStopped,[]);
  const running=await x.main.status();
  assert.equal(running.state,"OWNED_PROCESS_OBSERVED");
  assert.equal(running.sourceHead,MAIN);
  assert.equal(running.factorySession.state,"OWNED_PROCESS_OBSERVED");
  assert.equal(running.factorySession.sourceHead,PR);
  assert.equal(running.factorySession.url,"http://localhost:4174/skin-v1");
  assert.equal((await x.main.control({action:"factory-stop",expectedHead:MAIN})).code,
    "APP_STOPPED_VERIFIED");
  assert.deepEqual(x.factoryStopped,[9000]);
  assert.deepEqual(x.mainStopped,[]);
  assert.equal((await x.main.status()).state,"OWNED_PROCESS_OBSERVED");
  assert.equal((await x.main.control({action:"stop",expectedHead:MAIN})).code,
    "APP_STOPPED_VERIFIED");
  assert.deepEqual(x.mainStopped,[7000]);
});

test("#3222 never adopts or kills a foreign candidate listener; home reuse is blocked",async()=>{
  const x=fixture();
  x.setFactoryOccupied(true);
  assert.equal((await x.main.control(args)).code,"APP_PORT_OCCUPIED");
  assert.equal((await x.main.control({action:"factory-stop",expectedHead:MAIN})).code,
    "APP_PROCESS_NOT_OWNED");
  assert.deepEqual(x.factoryStopped,[]);
  x.setFactoryOccupied(false);x.setHomeTaken(true);
  assert.equal((await x.main.control(args)).code,"APP_CANDIDATE_HOME_EXISTS");
  assert.equal(x.factoryLaunches.length,0);
  x.setHomeTaken(false);x.setStageOk(false);
  assert.equal((await x.main.control(args)).code,"APP_CANDIDATE_SOURCE_CHANGED");
  assert.equal(x.factoryLaunches.length,0);
  x.setStageOk(true);x.setHead("9".repeat(40));
  assert.equal((await x.main.control(args)).code,"EXACT_HEAD_MISMATCH");
  assert.equal(x.factoryLaunches.length,0);
});

test("#3222 no false Factory startup PASS after exact-head drift or unverified STOP",async()=>{
  const x=fixture();
  let passes=0;
  const session=createFactoryIsolatedSessionController({
    platform:"win32",repoRoot:path.resolve("fixture","main"),
    verifyHead:async()=>MAIN,runtimeFor:()=>runtime,homeExists:()=>false,
    prepareCandidate:async()=>++passes===1
      ?{state:"TEST_PASSED",code:"APP_CANDIDATE_PREPARED",repoRoot:stagedRoot}
      :{state:"BLOCKED",code:"APP_CANDIDATE_SOURCE_CHANGED"},
    hasFile:()=>true,portOccupied:async()=>false,probe:async()=>true,
    launch:()=>Object.assign(new EventEmitter(),{pid:8888,exitCode:null,signalCode:null}),
    stopTree:async child=>{child.exitCode=0;},
    now:()=>1000,delay:async()=>{},
  });
  assert.equal((await session.control(args)).code,"APP_SOURCE_CHANGED");
  assert.equal(x.factoryLaunches.length,0);
  const impossible=fixture({stopTree:async()=>{throw Error("PRIVATE STOP ERROR");}});
  assert.equal((await impossible.main.control(args)).code,"APP_CANDIDATE_STARTED_VERIFIED");
  const denied=await impossible.main.control({action:"factory-stop",expectedHead:MAIN});
  assert.equal(denied.code,"APP_STOP_UNVERIFIED");
  assert.doesNotMatch(JSON.stringify(denied),/PRIVATE STOP ERROR/);
});

test("#3222 MCP authenticated Factory start and stop accept fixed selection, reject extra port/home",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"pp-factory-session-"));
  try{
    const suites=MCP_CONTROL_TOOLS.find(x=>x.name==="factory_run_named_test")
      .inputSchema.properties.suite.enum;
    assert.ok(suites.includes("plotpickle-app-factory-start"));
    assert.ok(suites.includes("plotpickle-app-factory-stop"));
    assert.equal(MCP_CONTROL_TOOLS.length,4);
    const received=[];
    const ops={testHead:async()=>MAIN,appControl:async a=>{
      received.push(a);
      if(a.action==="factory-start")return {state:"TEST_PASSED",
        code:"APP_CANDIDATE_STARTED_VERIFIED",sourceHead:PR,
        candidatePrNumber:3248,candidateHead:PR,sourceRequestId:STAGE};
      return {state:"TEST_PASSED",code:"APP_STOPPED_VERIFIED",sourceHead:PR};
    }};
    const call=(args,auth=true)=>handleRpc({jsonrpc:"2.0",id:1,
      method:"tools/call",params:{name:"factory_run_named_test",arguments:args}},
    {root,controlAuthenticated:auth,controlOps:ops});
    const start={requestId:id(401),expectedHead:MAIN,
      suite:"plotpickle-app-factory-start",sourceRequestId:STAGE,
      candidateHead:PR,candidatePrNumber:3248};
    assert.equal((await call(start,false)).error.code,-32001);
    for(const extra of [{port:4175},{host:"0.0.0.0"},{home:"C:/user/data"},{command:"shell"}]) {
      assert.equal((await call({...start,...extra})).error.code,-32602);
    }
    assert.equal((await call({...start,sourceRequestId:"invalid"})).error.code,-32602);
    assert.equal((await call(start)).result.structuredContent.code,
      "APP_CANDIDATE_STARTED_VERIFIED");
    assert.equal(received[0].action,"factory-start");
    assert.deepEqual([received[0].candidatePrNumber,received[0].candidateHead],[3248,PR]);
    assert.equal(received[0].stageReceipt,null,
      "MCP source receipt must be separately attested before real Factory startup");
    assert.equal((await call(start)).result.structuredContent.state,
      "DUPLICATE_OR_UNVERIFIABLE_REQUEST");
    const stop={requestId:id(402),expectedHead:MAIN,suite:"plotpickle-app-factory-stop"};
    assert.equal((await call({...stop,candidateHead:PR})).error.code,-32602);
    assert.equal((await call(stop)).result.structuredContent.code,"APP_STOPPED_VERIFIED");
    assert.equal(received[1].action,"factory-stop");
  }finally{await rm(root,{recursive:true,force:true});}
});
