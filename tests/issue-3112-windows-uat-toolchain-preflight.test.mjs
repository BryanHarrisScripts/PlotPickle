import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  checkWindowsUatToolchain, parseWindowsUatCommand, startWindowsUat,
  driveWindowsUat, statusWindowsUat,
} from "../scripts/windows-uat-control.mjs";

const HEAD = "c".repeat(40), BASE = "d".repeat(40);
const cfg = parseWindowsUatCommand(["--start","--head",HEAD,"--base",BASE,"--task","issue-3112"]);
const checkout = async () => ({ head: HEAD });
const ready = () => ({ ready: true, code: "READY" });
const missing = () => ({ ready: false, code: "TYPESCRIPT_NOT_INSTALLED" });

async function fixture(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-3112-preflight-"));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test("non-mutating --doctor is an explicit no-argument mode and never becomes remote dispatch", () => {
  assert.deepEqual(parseWindowsUatCommand(["--doctor"]), {mode:"doctor"});
  for (const args of [
    ["--doctor", "--start", "--head",HEAD,"--base",BASE,"--task","issue-3112"],
    ["--doctor","--task","issue-3112"], ["--doctor","--doctor"],
  ]) assert.throws(() => parseWindowsUatCommand(args));
});
test("dev preflight records exact pinned package version without exposing private filesystem paths", () => {
  const result = checkWindowsUatToolchain({ loadTypeScript: () => ({
    version:"6.0.2", transpileModule() {},
  })});
  assert.deepEqual(result, {
    ready: true, code: "READY", expectedVersion: "6.0.2", observedVersion:"6.0.2",
    source:"locally-installed-dev-toolchain", inferenceStarted:false, installationPerformed:false,
  });
  assert.doesNotMatch(JSON.stringify(result), /Users\\|C:\\|token|private/i);
});
test("missing, invalid and wrong-version TypeScript remain explicitly BLOCKED, never UAT FAIL", () => {
  const unavailable = checkWindowsUatToolchain({ loadTypeScript: () => {
    const error = new Error("Cannot find module 'typescript' from C:\\private\\path");
    error.code = "MODULE_NOT_FOUND";
    throw error;
  }});
  assert.deepEqual(unavailable, {
    ready: false, code: "TYPESCRIPT_NOT_INSTALLED", expectedVersion:"6.0.2",
  });
  assert.deepEqual(checkWindowsUatToolchain({ loadTypeScript:()=>({version:"6.0.2"}) }), {
    ready:false,code:"TYPESCRIPT_UNUSABLE",expectedVersion:"6.0.2",
  });
  assert.deepEqual(checkWindowsUatToolchain({ loadTypeScript:()=>({version:"5.9.3",transpileModule(){}}) }), {
    ready:false,code:"TYPESCRIPT_VERSION_MISMATCH",
    expectedVersion:"6.0.2",observedVersion:"5.9.3",
  });
  const bad = checkWindowsUatToolchain({ loadTypeScript:()=>{throw Error("credential sk-SECRET");} });
  assert.equal(bad.code,"TYPESCRIPT_UNUSABLE");
  assert.doesNotMatch(JSON.stringify(bad), /SECRET|credential|private/i);
});
test("missing preflight prevents any reservation or launch; failure does not consume next attempt",()=>fixture(async appRoot=>{
  let called=0;
  const launch=()=>{ called++; return { pid:1234, unref(){} }; };
  await assert.rejects(startWindowsUat(cfg,{appRoot,inspect:checkout,preflight:missing,launch}),/TYPESCRIPT_NOT_INSTALLED/);
  assert.equal(called,0);
  const folder=path.join(appRoot,"engineering-team","windows-uat-control");
  await assert.rejects(readdir(folder), { code:"ENOENT" });
  const accepted=await startWindowsUat(cfg,{appRoot,inspect:checkout,preflight:ready,launch});
  assert.match(accepted.scope,/^[a-f0-9]{64}$/);
  assert.equal(called,1);
  const ledger=JSON.parse(await readFile(path.join(folder,accepted.scope,"reservation.json"),"utf8"));
  assert.equal(ledger.attempt,1);
  assert.equal(ledger.modelDispatchAuthorized,false);
}));
test("worker reconfirms preflight and fails closed if local toolchain disappears after admission",()=>fixture(async appRoot=>{
  const reserved=await startWindowsUat(cfg,{appRoot,inspect:checkout,preflight:ready,
    launch:()=>({pid:1234,unref(){}})});
  let called=0;
  const terminal=await driveWindowsUat(reserved.scope,{
    appRoot,inspect:checkout,preflight:missing,
    launch:()=>{called++;throw Error("must not launch missing-dependency test suite");},
  });
  assert.equal(called,0);
  assert.equal(terminal.state,"blocked");
  assert.equal(terminal.mergeEligible,false);
  const file=path.join(appRoot,"engineering-team","windows-uat-control",reserved.scope,"terminal.json");
  const evidence=JSON.parse(await readFile(file,"utf8"));
  assert.equal(evidence.code,"TYPESCRIPT_NOT_INSTALLED");
  assert.equal(evidence.childExitObserved,false);
  assert.equal((await statusWindowsUat(reserved.scope,{appRoot})).state,"blocked");
  await assert.rejects(driveWindowsUat(reserved.scope,{appRoot,inspect:checkout,preflight:ready}),/EEXIST/);
}));
