import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPlotpickleAppController } from "../scripts/engineering-team/mcp/plotpickle-app-lifecycle.mjs";
import { handleRpc, factoryControlReceipt, MCP_CONTROL_TOOLS } from "../scripts/engineering-team/mcp/factory-readonly-server.mjs";

const HEAD = "a".repeat(40);
const requestId=n=>n.toString(16).padStart(32,"0");

function fixture(overrides={}) {
  const launches=[],stopped=[];
  let port=false, main=HEAD, available=true, marker=true;
  const options={
    repoRoot:"C:\\PlotPickle-fixture",platform:"win32",
    verifyHead:async()=>main,
    portOccupied:async()=>port,
    hasFile:()=>available,
    launch:(exe,args,opts)=>{
      assert.equal(opts.shell,false);
      assert.equal(opts.cwd,"C:\\PlotPickle-fixture");
      assert.deepEqual(args.slice(-6),["--host","127.0.0.1","--port","4173","--strictPort"]);
      assert.equal(opts.env.PLOTPICKLE_FACTORY_MCP_CONTROL_TOKEN,undefined);
      assert.match(opts.env.PLOTPICKLE_STARTUP_CONTRACT,/plotpickle-startup-v4-a{40}-normal-local-human-vite-source/);
      const child=Object.assign(new EventEmitter(),{pid:4321+launches.length,exitCode:null,signalCode:null});
      launches.push(child);port=true;return child;
    },
    probe:async()=>marker,
    stopTree:async child=>{stopped.push(child.pid);child.exitCode=0;port=false;},
    delay:async()=>{},
    now:()=>10_000,
    ...overrides,
  };
  return {controller:createPlotpickleAppController(options),launches,stopped,
    setPort:v=>{port=v;},setMain:v=>{main=v;},setMarker:v=>{marker=v;},
    setAvailable:v=>{available=v;},
  };
}

test("#3220 normal owner app Start -> Stop -> Restart is exact-main, fixed loopback, no shell",async()=>{
  const x=fixture();
  assert.equal((await x.controller.control({action:"stop",expectedHead:HEAD})).code,"APP_PROCESS_NOT_OWNED");
  assert.equal((await x.controller.control({action:"start",expectedHead:HEAD})).code,"APP_STARTED_VERIFIED");
  assert.equal(x.launches.length,1);
  assert.equal((await x.controller.status()).state,"OWNED_PROCESS_OBSERVED");
  assert.equal((await x.controller.control({action:"start",expectedHead:HEAD})).code,"APP_ALREADY_RUNNING_OWNED");
  assert.equal((await x.controller.control({action:"restart",expectedHead:HEAD})).code,"APP_RESTARTED_VERIFIED");
  assert.deepEqual(x.stopped,[4321]);
  assert.equal(x.launches.length,2);
  assert.equal((await x.controller.control({action:"stop",expectedHead:HEAD})).code,"APP_STOPPED_VERIFIED");
  assert.deepEqual(x.stopped,[4321,4322]);
  assert.equal((await x.controller.status()).state,"NOT_RUNNING");
});

test("#3220 foreign listener or missing exact source/dependency cannot be adopted or killed",async()=>{
  const x=fixture();
  x.setPort(true);
  assert.equal((await x.controller.control({action:"start",expectedHead:HEAD})).code,"APP_PORT_OCCUPIED");
  assert.equal((await x.controller.control({action:"stop",expectedHead:HEAD})).code,"APP_PROCESS_NOT_OWNED");
  assert.deepEqual(x.stopped,[]);
  x.setPort(false);x.setMain("b".repeat(40));
  assert.equal((await x.controller.control({action:"start",expectedHead:HEAD})).code,"EXACT_HEAD_MISMATCH");
  x.setMain(HEAD);x.setAvailable(false);
  assert.equal((await x.controller.control({action:"start",expectedHead:HEAD})).code,"APP_DEPENDENCIES_UNAVAILABLE");
  assert.equal(x.launches.length,0);
  assert.equal((await fixture({platform:"linux"}).controller.control({action:"start",expectedHead:HEAD})).code,"WINDOWS_ONLY");
  assert.equal((await x.controller.control({action:"shell",expectedHead:HEAD})).code,"APP_ACTION_INVALID");
});

test("#3220 no false success after source drift during startup or unverified STOP",async()=>{
  const x=fixture();
  x.setMarker(false);
  const timeout=createPlotpickleAppController({
    repoRoot:"C:\\PlotPickle-fixture",platform:"win32",verifyHead:async()=>HEAD,
    portOccupied:async()=>false,hasFile:()=>true,
    launch:()=>Object.assign(new EventEmitter(),{pid:9001,exitCode:null,signalCode:null}),
    probe:async()=>false,delay:async()=>{},now:(()=>{let n=0;return()=>++n;})(),
    startTimeoutMs:2,stopTree:async child=>{child.exitCode=0;},
  });
  assert.equal((await timeout.control({action:"start",expectedHead:HEAD})).code,"APP_START_TIMEOUT");
  const failStop=fixture({stopTree:async()=>{throw Error("SECRET_NATIVE_KILL_FAILURE");}});
  assert.equal((await failStop.controller.control({action:"start",expectedHead:HEAD})).code,"APP_STARTED_VERIFIED");
  const res=await failStop.controller.control({action:"stop",expectedHead:HEAD});
  assert.equal(res.code,"APP_STOP_UNVERIFIED");
  assert.doesNotMatch(JSON.stringify(res),/SECRET_NATIVE_KILL_FAILURE/);
});

test("#3220 MCP refuses unauthenticated operation, arbitrary input and duplicate request",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"plotpickle-owner-app-"));
  try{
    const allowed=MCP_CONTROL_TOOLS.find(x=>x.name==="factory_run_named_test");
    assert.ok(allowed.inputSchema.properties.suite.enum.includes("plotpickle-app-start"));
    assert.equal(MCP_CONTROL_TOOLS.length,4,"paired owner tunnel still has four authenticated tools");
    const ops={
      testHead:async()=>HEAD,appControl:async({action,expectedHead})=>{
        assert.equal(expectedHead,HEAD);assert.equal(action,"start");
        return {state:"TEST_PASSED",code:"APP_STARTED_VERIFIED",sourceHead:HEAD};
      },
    };
    const invoke=(args,authenticated=true)=>handleRpc({jsonrpc:"2.0",id:1,method:"tools/call",
      params:{name:"factory_run_named_test",arguments:args}},
      {root,controlAuthenticated:authenticated,controlOps:ops});
    const args={requestId:requestId(1),expectedHead:HEAD,suite:"plotpickle-app-start"};
    assert.equal((await invoke(args,false)).error.code,-32001);
    assert.equal((await invoke({...args,pid:1234})).error.code,-32602);
    assert.equal((await invoke({...args,command:"powershell.exe"})).error.code,-32602);
    assert.equal((await invoke({...args,url:"http://foreign/"})).error.code,-32602);
    assert.equal((await invoke({...args,suite:"powershell"})).error.code,-32602);
    const response=await invoke(args,true);
    assert.equal(response.result.structuredContent.code,"APP_STARTED_VERIFIED");
    assert.equal(response.result.structuredContent.state,"TEST_PASSED");
    assert.equal(response.result.structuredContent.modelInvoked,false);
    assert.equal((await invoke(args,true)).result.structuredContent.state,"DUPLICATE_OR_UNVERIFIABLE_REQUEST");
    const receipt=await factoryControlReceipt({root,requestId:requestId(1)});
    assert.equal(receipt.code,"APP_STARTED_VERIFIED");
    assert.equal(receipt.replayAuthorized,false);
  }finally{await rm(root,{recursive:true,force:true});}
});
