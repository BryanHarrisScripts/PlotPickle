import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  parseWindowsUatCommand, windowsUatScope, startWindowsUat, statusWindowsUat,
  requestStopWindowsUat, driveWindowsUat,
} from "../scripts/windows-uat-control.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);
const config = (attempt=1) => parseWindowsUatCommand([
  "--start", "--head", HEAD, "--base", BASE, "--task", "issue-3110", "--attempt", String(attempt),
]);
const checkout = async () => ({ head: HEAD, changedPaths: ["scripts/windows-uat-control.mjs"] });
const controlFolder = (root, scope) => path.join(root,"engineering-team","windows-uat-control",scope);
async function sandbox(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(),"plotpickle-3110-local-"));
  try { return await fn(root); } finally { await rm(root,{recursive:true,force:true}); }
}
const workerStub = () => ({ pid: 1234, unref() {} });
async function reserve(root, cfg=config()) {
  const start = await startWindowsUat(cfg,{appRoot:root,inspect:checkout,launch:workerStub});
  return start.scope;
}
function childFixture(callback) {
  const emitter = new EventEmitter();
  emitter.pid = 3210;
  emitter.kill = (_signal) => { queueMicrotask(() => emitter.emit("exit",null)); return true; };
  queueMicrotask(() => callback(emitter));
  return emitter;
}
test("local task command only allows explicit exact-head scoped start/status/stop", () => {
  assert.equal(config().mode,"start");
  assert.equal(config().attempt,1);
  const scope=windowsUatScope(config());
  assert.match(scope,/^[a-f0-9]{64}$/);
  assert.notEqual(scope,windowsUatScope(config(2)));
  assert.equal(parseWindowsUatCommand(["--stop","--scope",scope]).scope,scope);
  assert.equal(parseWindowsUatCommand(["--status","--scope",scope]).mode,"status");
  for(const argv of [
    [], ["--start","--stop"],["--status","--scope","../../x"],
    ["--start","--head","main","--base",BASE,"--task","issue-3110"],
    ["--start","--head",HEAD,"--base",HEAD,"--task","issue-3110"],
    ["--start","--head",HEAD,"--base",BASE,"--task","a","--attempt","20"],
    ["--start","--head",HEAD,"--base",BASE,"--task","issue-3110","--remote","github"],
    ["--start","--head",HEAD,"--base",BASE,"--task","issue-3110","--start"],
    ["--stop","--scope",scope,"--task","issue-3110"],
  ])assert.throws(()=>parseWindowsUatCommand(argv));
});
test("start accepts local checkout only and reserves before creating a child; duplicate never replays",()=>sandbox(async root=>{
  const cfg=config(), launched=[];
  const fakeLaunch=(args,options)=>{launched.push({args,options});return workerStub()};
  const first=await startWindowsUat(cfg,{appRoot:root,inspect:checkout,launch:fakeLaunch});
  assert.equal(first.status,"dispatched-unconfirmed");
  assert.equal(first.remoteDispatchAuthorized,false);
  assert.equal(first.mergeEligible,false);
  const reservation=JSON.parse(await readFile(path.join(controlFolder(root,first.scope),"reservation.json"),"utf8"));
  assert.equal(reservation.head,HEAD);
  assert.equal(reservation.mode,"contracts-only");
  assert.equal(reservation.modelDispatchAuthorized,false);
  assert.equal(launched.length,1);
  assert.equal(launched[0].args[0].endsWith("windows-uat-control.mjs"),true);
  assert.equal(launched[0].options.shell,undefined);
  await assert.rejects(startWindowsUat(cfg,{appRoot:root,inspect:checkout,launch:fakeLaunch}),/EEXIST/);
  assert.equal(launched.length,1);
  assert.equal((await statusWindowsUat(first.scope,{appRoot:root})).state,"unconfirmed");
  await assert.rejects(startWindowsUat(config(2),{appRoot:root,
    inspect:async()=>({head:BASE}),launch:fakeLaunch}),/exact authorized head/);
  assert.equal(launched.length,1);
}));
test("stop is idempotent and never fabricates a terminated worker acknowledgement",()=>sandbox(async root=>{
  const scope=await reserve(root);
  const request=await requestStopWindowsUat(scope,{appRoot:root});
  assert.equal(request.state,"stop-requested");
  assert.equal(request.cancellationAcknowledged,false);
  const duplicate=await requestStopWindowsUat(scope,{appRoot:root});
  assert.equal(duplicate.state,"stop-requested");
  assert.equal((await statusWindowsUat(scope,{appRoot:root})).mergeEligible,false);
  const result=await driveWindowsUat(scope,{appRoot:root,inspect:checkout,launch:()=>{throw Error("No UAT should launch")}});
  assert.equal(result.state,"cancelled-child-exited");
  assert.equal(result.cancellationAcknowledged,true);
  assert.equal(result.childExitObserved,false);
  await assert.rejects(driveWindowsUat(scope,{appRoot:root,inspect:checkout}),/EEXIST/);
  assert.equal((await requestStopWindowsUat(scope,{appRoot:root})).state,"cancelled-child-exited");
}));
test("a fresh actual contracts-only report with matching subprocess exit becomes observed but never full browser UAT",()=>sandbox(async root=>{
  const scope=await reserve(root);
  let emitted=0;
  const result=await driveWindowsUat(scope,{
    appRoot:root,inspect:checkout,pollMs:5,
    launch:(args,opts)=>childFixture(async emitter=>{
      assert.ok(args.includes("--contracts-only"));
      assert.equal(opts.shell,false);
      const folder=args[args.indexOf("--artifact-root")+1];
      await mkdir(folder,{recursive:true});
      await writeFile(path.join(folder,"autopilot-report.json"),JSON.stringify({
        mode:"contracts-only",generatedAt:new Date().toISOString(),overall:"PASS",
        contracts:{code:0,failures:[]},
      }));
      emitted++;
      emitter.emit("exit",0);
    }),
  });
  assert.equal(emitted,1);
  assert.equal(result.state,"observed-pass");
  assert.equal(result.childExitObserved,true);
  assert.match(result.evidenceSha256,/^[a-f0-9]{64}$/);
  assert.equal(result.browserUatProven,false);
  assert.equal(result.independentVerification,false);
  assert.equal(result.mergeEligible,false);
  assert.equal((await statusWindowsUat(scope,{appRoot:root})).state,"observed-pass");
}));
test("spoofed success without fresh report fails closed, and an interrupted worker cannot replay",()=>sandbox(async root=>{
  const scope=await reserve(root);
  const result=await driveWindowsUat(scope,{appRoot:root,inspect:checkout,pollMs:5,
    launch:()=>childFixture(emitter=>emitter.emit("exit",0))});
  assert.equal(result.state,"blocked");
  assert.equal(result.evidenceSha256,null);
  assert.equal(result.mergeEligible,false);
  await assert.rejects(driveWindowsUat(scope,{appRoot:root,inspect:checkout}),/EEXIST/);
}));
test("live stop kills only launched UAT child, then observes child exit before confirming cancellation",()=>sandbox(async root=>{
  const scope=await reserve(root);
  let killed=false;
  const running=driveWindowsUat(scope,{appRoot:root,inspect:checkout,pollMs:5,
    launch:()=>childFixture(emitter=>{
      emitter.kill=()=>{killed=true;setImmediate(()=>emitter.emit("exit",null));return true};
    }),
  });
  await new Promise(resolve=>setTimeout(resolve,45));
  const requested=await requestStopWindowsUat(scope,{appRoot:root});
  assert.equal(requested.state,"stop-requested");
  assert.equal(requested.cancellationAcknowledged,false);
  const done=await running;
  assert.equal(killed,true);
  assert.equal(done.state,"cancelled-child-exited");
  assert.equal(done.childExitObserved,true);
  assert.equal(done.browserUatProven,false);
}));
test("scope symlinks and stale SHA remain blocked; no production project files touched",()=>sandbox(async root=>{
  const scope=windowsUatScope(config());
  const parent=path.join(root,"engineering-team","windows-uat-control");
  await mkdir(parent,{recursive:true});
  const outside=path.join(root,"outside");await mkdir(outside);
  await symlink(outside,path.join(parent,scope),"dir");
  await assert.rejects(startWindowsUat(config(),{appRoot:root,inspect:checkout,launch:workerStub}),
    /private ordinary directory/);
  await assert.rejects(statusWindowsUat(scope,{appRoot:root}),/private ordinary directory/);
}));
