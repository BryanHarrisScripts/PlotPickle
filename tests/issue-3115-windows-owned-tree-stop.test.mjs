import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { assessWindowsStopFixture, parseStopProofArgs, stopOwnedFixture } from "../scripts/windows-stop-proof.mjs";

const HEAD = "c".repeat(40);
const full = {
  platform: "win32", sourceHeadMatched: true, privateReservation: true,
  parentStarted: true, descendantStarted: true, sentinelStarted: true,
  parentAliveBeforeStop: true, descendantAliveBeforeStop: true, sentinelAliveBeforeStop: true,
  ownedStopSucceeded: true, parentExitObserved: true, descendantGoneAfterStop: true,
  unrelatedSentinelSurvived: true, repeatStopWasNoop: true,
};
test("only exact-head local fixture invocation allowed; external PID/name/kill/remote commands rejected", () => {
  assert.deepEqual(parseStopProofArgs(["--prove","--head",HEAD]), { mode:"prove",head:HEAD });
  for(const argv of [
    [],["--prove"],["--prove","--head","main"],["--prove","--head",HEAD,"--pid","21"],
    ["--pid","1234"],["--kill","1234"],["--stop","--pid","1234"],
    ["--prove","--head",HEAD,"--remote"],["--prove","--head",HEAD,"--head",HEAD],
    ["--fixture-parent","some-id","some-token"],
    ["--fixture-leaf","../../x","2".repeat(64),"descendant"],
  ]) assert.throws(() => parseStopProofArgs(argv), /Expected --prove/);
});
test("process-tree acceptance never passes without every owned descendant exit and sentinel survival", () => {
  const success=assessWindowsStopFixture(full);
  assert.equal(success.result,"verified-fixture");
  assert.equal(success.processTreeTerminationProvenForFixture,true);
  for(const property of Object.keys(full)){
    const changes={...full,[property]:property==="platform"?"linux":false};
    const failed=assessWindowsStopFixture(changes);
    assert.equal(failed.result,"blocked", property);
    assert.equal(failed.processTreeTerminationProvenForFixture,false, property);
    assert.equal(failed.mergeEligible,false,property);
  }
});
test("passing isolated fixture cannot claim production Windows PID safety, browser UAT, inference, or merge eligibility",()=>{
  const result=assessWindowsStopFixture(full);
  assert.equal(result.productionUatTreeTerminationProven,false);
  assert.equal(result.browserUatProven,false);
  assert.equal(result.independentVerification,false);
  assert.equal(result.remoteControlConnected,false);
  assert.equal(result.modelDispatchAllowed,false);
  assert.equal(result.mergeEligible,false);
  assert.equal(result.schemaVersion,1);
});
test("unknown, stale and synthetic externally supplied PID handles are refused without signaling process",async()=>{
  let calls=0;
  const fake=async()=>{calls++; return true;};
  for(const handle of [
    undefined,null,{}, {child:{pid:process.pid},state:{exited:false,errored:false}},
    {child:{pid:0},state:{exited:false,errored:false}},
    {child:{pid:process.pid},state:{exited:true,errored:false}},
  ]){
    const result=await stopOwnedFixture(handle,fake);
    assert.equal(result.attempted,false);
    assert.equal(result.reason,"NOT_ACTIVE");
  }
  assert.equal(calls,0);
});
test("one-shot fixture deliberately separates in-memory spawned ownership and timed stop; no unrelated process-name kill",async()=>{
  const p=fileURLToPath(new URL("../scripts/windows-stop-proof.mjs",import.meta.url));
  const source=await readFile(p,"utf8");
  for(const expected of [
    "spawnedHandles.add(handle)",
    "spawnedHandles.has(handle)",
    'exec("taskkill.exe", ["/PID", String(pid), "/T", "/F"]',
    "descendantGoneAfterStop",
    "unrelatedSentinelSurvived",
    "repeatStopWasNoop",
    "FIXTURE_LIFETIME_MS",
    "windowsHide: true",
    "remoteControlConnected: false",
  ]) assert.ok(source.includes(expected),expected);
  assert.equal(source.includes("exec(\"taskkill.exe\", [\"/IM\""),false);
});
test("fixture stop never runs on other OSes, without treating a Linux CI run as Windows proof",()=>{
  const unsupported=assessWindowsStopFixture({...full,platform:"linux"});
  assert.equal(unsupported.result,"blocked");
  assert.equal(unsupported.checks.nativeWindows,false);
});
