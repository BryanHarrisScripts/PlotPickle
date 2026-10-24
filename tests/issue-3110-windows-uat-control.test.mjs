import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { terminateVerificationProcessTree } from "../scripts/full-verification-process.mjs";
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
  const start = await startWindowsUat(cfg,{appRoot:root,inspect:checkout,preflight:()=>({ready:true}),launch:workerStub});
  return start.scope;
}
function childFixture(callback) {
  const emitter = new EventEmitter();
  emitter.pid = 3210;
  emitter.exitCode = null;
  emitter.signalCode = null;
  emitter.once("exit", (code, signal) => {
    emitter.exitCode = typeof code === "number" ? code : null;
    emitter.signalCode = signal || (code === null ? "SIGTERM" : null);
    queueMicrotask(() => emitter.emit("close", code, signal));
  });
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
  const first=await startWindowsUat(cfg,{appRoot:root,inspect:checkout,preflight:()=>({ready:true}),launch:fakeLaunch});
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
  await assert.rejects(startWindowsUat(cfg,{appRoot:root,inspect:checkout,preflight:()=>({ready:true}),launch:fakeLaunch}),/EEXIST/);
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
  assert.equal(request.stopDisposition,"STOP_REQUESTED_UNCONFIRMED");
  assert.equal(request.ownedDescendantsVerifiedGone,false);
  const duplicate=await requestStopWindowsUat(scope,{appRoot:root});
  assert.equal(duplicate.state,"stop-requested");
  assert.equal(duplicate.stopDisposition,"STOP_REQUESTED_UNCONFIRMED");
  assert.equal((await statusWindowsUat(scope,{appRoot:root})).mergeEligible,false);
  const result=await driveWindowsUat(scope,{appRoot:root,inspect:checkout,preflight:()=>({ready:true}),launch:()=>{throw Error("No UAT should launch")}});
  assert.equal(result.state,"cancelled-child-exited");
  assert.equal(result.cancellationAcknowledged,true);
  assert.equal(result.childExitObserved,false);
  await assert.rejects(driveWindowsUat(scope,{appRoot:root,inspect:checkout}),/EEXIST/);
  const terminalStop=await requestStopWindowsUat(scope,{appRoot:root});
  assert.equal(terminalStop.state,"cancelled-child-exited");
  assert.equal(terminalStop.stopDisposition,"ALREADY_TERMINAL_NOOP");
  assert.equal(terminalStop.ownedDescendantsVerifiedGone,false);
}));
test("a fresh actual contracts-only report with matching subprocess exit becomes observed but never full browser UAT",()=>sandbox(async root=>{
  const scope=await reserve(root);
  let emitted=0;
  const result=await driveWindowsUat(scope,{
    appRoot:root,inspect:checkout,preflight:()=>({ready:true}),pollMs:5,
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
  const stopAfterCompletion=await requestStopWindowsUat(scope,{appRoot:root});
  assert.equal(stopAfterCompletion.state,"observed-pass");
  assert.equal(stopAfterCompletion.childExitObserved,true);
  assert.equal(stopAfterCompletion.cancellationAcknowledged,false);
  assert.equal(stopAfterCompletion.stopDisposition,"ALREADY_TERMINAL_NOOP");
  assert.equal(stopAfterCompletion.ownedDescendantsVerifiedGone,false);
}));
test("spoofed success without fresh report fails closed, and an interrupted worker cannot replay",()=>sandbox(async root=>{
  const scope=await reserve(root);
  const result=await driveWindowsUat(scope,{appRoot:root,inspect:checkout,preflight:()=>({ready:true}),pollMs:5,
    launch:()=>childFixture(emitter=>emitter.emit("exit",0))});
  assert.equal(result.state,"blocked");
  assert.equal(result.evidenceSha256,null);
  assert.equal(result.mergeEligible,false);
  await assert.rejects(driveWindowsUat(scope,{appRoot:root,inspect:checkout}),/EEXIST/);
}));
test("live stop kills only launched UAT child, then observes child exit before confirming cancellation",()=>sandbox(async root=>{
  const scope=await reserve(root);
  let killed=false;
  const running=driveWindowsUat(scope,{appRoot:root,inspect:checkout,preflight:()=>({ready:true}),pollMs:5,
    launch:()=>childFixture(emitter=>{
      emitter.kill=()=>{killed=true;setImmediate(()=>emitter.emit("exit",null));return true};
    }),
  });
  // A fixed 45ms delay could race worker initialization on loaded native
  // Windows runners. Observe the actual owned-worker heartbeat before STOP;
  // if startup is terminal/blocked, report that failure instead of guessing.
  const deadline=Date.now()+5000;
  let preStop=await statusWindowsUat(scope,{appRoot:root});
  while(preStop.state==="unconfirmed" && Date.now()<deadline){
    await new Promise(resolve=>setTimeout(resolve,10));
    preStop=await statusWindowsUat(scope,{appRoot:root});
  }
  assert.equal(preStop.state,"running-heartbeat",
    "STOP fixture must first observe a live owned worker, not assume readiness from elapsed time");
  const requested=await requestStopWindowsUat(scope,{appRoot:root});
  assert.equal(requested.state,"stop-requested");
  assert.equal(requested.cancellationAcknowledged,false);
  assert.equal(requested.stopDisposition,"STOP_REQUESTED_UNCONFIRMED");
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
  await assert.rejects(startWindowsUat(config(),{appRoot:root,inspect:checkout,preflight:()=>({ready:true}),launch:workerStub}),
    /private ordinary directory/);
  await assert.rejects(statusWindowsUat(scope,{appRoot:root}),/private ordinary directory/);
}));

test("#3135 STOP failures cannot publish cancellation or silently claim descendant termination", () => sandbox(async root => {
  const scope = await reserve(root);
  // Keep polling faster than production's 400ms but avoid a 5ms Windows
  // file-handle race between heartbeat replacement and STOP receipt reads.
  const running = driveWindowsUat(scope, {
    appRoot: root, inspect: checkout, preflight: () => ({ ready: true }), pollMs: 40,
    launch: () => childFixture(() => {}),
    stopOwnedTree: async () => { throw new Error("disposable fixture STOP failure"); },
  });
  // Prove the owned worker heartbeat before asking for STOP. A fixed sleep
  // can race worker initialization on loaded native Windows CI runners.
  const deadline=Date.now()+5000;
  let beforeStop=await statusWindowsUat(scope,{appRoot:root});
  while(beforeStop.state==="unconfirmed" && Date.now()<deadline){
    await new Promise(resolve=>setTimeout(resolve,10));
    beforeStop=await statusWindowsUat(scope,{appRoot:root});
  }
  assert.equal(beforeStop.state,"running-heartbeat",
    "STOP-failure fixture must observe a live owned child before cancellation");
  const requested = await requestStopWindowsUat(scope, { appRoot: root });
  // The worker may publish its STOP failure while the request reads back the
  // receipt. Both observations preserve uncertainty; neither is cancellation.
  if (requested.state === "stop-requested") {
    assert.equal(requested.stopDisposition, "STOP_REQUESTED_UNCONFIRMED");
  } else {
    assert.equal(requested.state, "blocked");
    assert.equal(requested.stopDisposition, "TERMINAL_DURING_REQUEST_UNPROVEN");
  }
  assert.equal(requested.cancellationAcknowledged, false);
  assert.equal(requested.ownedDescendantsVerifiedGone, false);
  const outcome = await running;
  assert.equal(outcome.state, "blocked");
  assert.equal(outcome.cancellationAcknowledged, false);
  assert.equal(outcome.ownedDescendantsVerifiedGone, false);
  const record = JSON.parse(await readFile(path.join(controlFolder(root, scope), "terminal.json"), "utf8"));
  assert.equal(record.code, "OWNED_TREE_STOP_FAILED");
}));

test("#3135 worker timeout must remain BLOCKED even when owned child exits after STOP", () => sandbox(async root => {
  const scope = await reserve(root);
  let stopCalls = 0;
  const result = await driveWindowsUat(scope, {
    appRoot: root, inspect: checkout, preflight: () => ({ ready: true }),
    maxDurationMs: -1, pollMs: 5,
    launch: () => childFixture(() => {}),
    stopOwnedTree: async child => { stopCalls++; child.kill("SIGTERM"); },
  });
  assert.equal(stopCalls, 1);
  assert.equal(result.state, "blocked");
  assert.equal(result.cancellationAcknowledged, false);
  assert.equal(result.ownedDescendantsVerifiedGone, false);
  const terminal = JSON.parse(await readFile(path.join(controlFolder(root, scope), "terminal.json"), "utf8"));
  assert.equal(terminal.code, "TIME_BUDGET_EXCEEDED");
}));

async function ephemeralPort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const port = listener.address().port;
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return port;
}
async function portIsFree(port) {
  return new Promise((resolve, reject) => {
    const listener = createServer();
    listener.once("error", error => error.code === "EADDRINUSE" ? resolve(false) : reject(error));
    listener.listen(port, "127.0.0.1", () => {
      listener.close(error => error ? reject(error) : resolve(true));
    });
  });
}
async function waitFor(predicate, attempts = 120, delayMs = 50) {
  for (let i = 0; i < attempts; i++) {
    if (await predicate()) return true;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return false;
}

test("#3135 native Windows live worker STOP terminates owned listening descendant, not unrelated sentinel", {
  skip: process.platform !== "win32" || process.env.PLOTPICKLE_NATIVE_UAT_STOP_FIXTURE !== "1",
  timeout: 45_000,
}, () => sandbox(async root => {
  assert.equal(
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim().toLowerCase(),
    process.env.PLOTPICKLE_PROOF_SOURCE_HEAD,
    "native Windows fixture must execute at exact PR head",
  );
  const port = await ephemeralPort();
  const scope = await reserve(root);
  const leaf = [
    'const net=require("node:net");',
    'net.createServer().listen(' + port + ',"127.0.0.1");',
    'setInterval(()=>{},1000);',
  ].join("\n");
  const parent = [
    'const {spawn}=require("node:child_process");',
    'spawn(process.execPath,["-e",' + JSON.stringify(leaf) + '],',
    '{stdio:"ignore",shell:false,windowsHide:true});',
    'setInterval(()=>{},1000);',
  ].join("\n");
  const sentinel = spawn(process.execPath, ["-e", 'setInterval(()=>{},1000)'], {
    stdio: "ignore", shell: false, windowsHide: true,
  });
  let owned = null;
  try {
    const running = driveWindowsUat(scope, {
      appRoot: root, inspect: checkout, preflight: () => ({ ready: true }),
      pollMs: 25, maxDurationMs: 20_000,
      launch: () => {
        owned = spawn(process.execPath, ["-e", parent], {
          stdio: "ignore", shell: false, windowsHide: true,
        });
        return owned;
      },
    });
    const realRunning = await waitFor(async () =>
      owned?.pid && !(await portIsFree(port))
        && (await statusWindowsUat(scope, { appRoot: root })).state === "running-heartbeat");
    assert.equal(realRunning, true, "worker and owned descendant must be live before STOP");
    const request = await requestStopWindowsUat(scope, { appRoot: root });
    assert.equal(request.state, "stop-requested");
    assert.equal(request.stopDisposition, "STOP_REQUESTED_UNCONFIRMED");
    assert.equal(request.ownedDescendantsVerifiedGone, false);
    const terminal = await running;
    assert.equal(terminal.state, "cancelled-child-exited");
    assert.equal(terminal.childExitObserved, true);
    assert.equal(terminal.ownedDescendantsVerifiedGone, false, "production worker cannot self-attest descendant absence");
    assert.equal(await waitFor(() => portIsFree(port)), true, "independent listening descendant must be gone");
    assert.equal(sentinel.exitCode, null, "unrelated sentinel remains alive");
    assert.equal(sentinel.signalCode, null);
    const post = await requestStopWindowsUat(scope, { appRoot: root });
    assert.equal(post.stopDisposition, "ALREADY_TERMINAL_NOOP");
  } finally {
    if (owned?.exitCode === null && owned?.signalCode === null) await terminateVerificationProcessTree(owned);
    if (sentinel.exitCode === null && sentinel.signalCode === null) sentinel.kill();
  }
}));
