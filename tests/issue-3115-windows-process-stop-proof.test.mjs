import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseStopProofArgs, assessWindowsStopFixture, stopOwnedFixture,
} from "../scripts/windows-stop-proof.mjs";

const HEAD = "a".repeat(40);
const id = "12345678-1234-4234-9234-123456789abc";
const token = "b".repeat(64);
const checks = {
  platform: "win32", sourceHeadMatched: true, privateReservation: true,
  parentStarted: true, descendantStarted: true, sentinelStarted: true,
  parentAliveBeforeStop: true, descendantAliveBeforeStop: true,
  sentinelAliveBeforeStop: true, ownedStopSucceeded: true,
  parentExitObserved: true, descendantGoneAfterStop: true,
  unrelatedSentinelSurvived: true, repeatStopWasNoop: true,
};
test("Windows STOP proof CLI takes no PID and requires an exact source commit", () => {
  assert.deepEqual(parseStopProofArgs(["--prove","--head",HEAD]),{mode:"prove",head:HEAD});
  assert.deepEqual(parseStopProofArgs(["--fixture-parent",id,token]),{mode:"parent",id,token});
  assert.deepEqual(parseStopProofArgs(["--fixture-leaf",id,token,"sentinel"]),{
    mode:"leaf", id, token, role:"sentinel",
  });
  for(const args of [
    [], ["--prove"],["--prove","--head","main"],
    ["--prove","--head",HEAD,"--pid","1234"],["--stop","--pid","1234"],
    ["--fixture-parent",id,"bad"],["--fixture-leaf",id,token,"arbitrary"],
    ["--prove","--head",HEAD,"--remote","true"],
  ]) assert.throws(()=>parseStopProofArgs(args));
});
test("proof pass requires actual descendant termination and unrelated sibling survival", () => {
  const x=assessWindowsStopFixture(checks);
  assert.equal(x.result,"verified-fixture");
  assert.equal(x.processTreeTerminationProvenForFixture,true);
  assert.equal(x.productionUatTreeTerminationProven,false);
  assert.equal(x.browserUatProven,false);
  assert.equal(x.remoteControlConnected,false);
  assert.equal(x.independentVerification,false);
  assert.equal(x.mergeEligible,false);
  for(const k of Object.keys(checks)){
    const result=assessWindowsStopFixture({...checks,[k]:false});
    assert.equal(result.result,"blocked","must not overlook "+k);
    assert.equal(result.processTreeTerminationProvenForFixture,false);
  }
});
test("no spoofed, saved or arbitrary PID can reach a kill implementation",async()=>{
  let kills=0;
  const fakeStop=()=>{kills++;return true};
  assert.deepEqual(await stopOwnedFixture({
    child:{pid:1234},state:{exited:false,errored:false},
  },fakeStop),{attempted:false,stopped:false,reason:"NOT_ACTIVE"});
  assert.equal(kills,0);
});
test("non-Windows executes no process-tree fixture and never fabricates success",()=>{
  if(process.platform==="win32") return;
  const script=path.resolve(path.dirname(fileURLToPath(import.meta.url)),
    "../scripts/windows-stop-proof.mjs");
  const result=spawnSync(process.execPath,[script,"--prove","--head",HEAD],{
    timeout:4_000,encoding:"utf8",
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Native Windows-only fixture/);
  assert.doesNotMatch(result.stdout,/verified-fixture/);
});
