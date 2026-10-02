import assert from "node:assert/strict";
import test from "node:test";
import {
  assertReplayAllowed,
  deterministicAuthorityEnvelope,
  normalizeDurableTask,
} from "../core/sidecars/durable-execution-contract.mjs";
import {
  DisabledDurableAdapter,
  PI_DURABLE_MINIMUM_NODE,
  PI_DURABLE_RUNTIME_VERSION,
  createPiDurableAdapter,
} from "../core/sidecars/pi-durable-adapter.mjs";

class FakeDriver {
  constructor() { this.tasks = new Map(); }
  async start(task) {
    this.tasks.set(task.id, { task, state: "running" });
    return { taskId: task.id, state: "running", runtime: "fake-pi-durable", resumable: true, humanApprovalRef: task.humanApprovalRef };
  }
  async resume(id) { const item = this.tasks.get(id); item.state = "running"; return { taskId:id,state:"running",runtime:"fake-pi-durable",resumable:true,humanApprovalRef:item.task.humanApprovalRef }; }
  async cancel(id) { const item = this.tasks.get(id); item.state = "cancelled"; return { taskId:id,state:"cancelled",runtime:"fake-pi-durable",resumable:false,humanApprovalRef:item.task.humanApprovalRef }; }
  async status(id) { const item=this.tasks.get(id); return { taskId:id,state:item?.state ?? "unavailable",runtime:"fake-pi-durable",resumable:Boolean(item),humanApprovalRef:item?.task.humanApprovalRef ?? "" }; }
  async result(id) { return deterministicAuthorityEnvelope({ taskId:id,status:"done",runtime:"fake-pi-durable" }); }
  async evidence(id) { const item=this.tasks.get(id); return deterministicAuthorityEnvelope({ taskId:id,humanApprovalRef:item.task.humanApprovalRef,extensions:item.task.extensions,tools:item.task.tools }); }
}

const task=(id,replayPolicy="safe")=>({id,prompt:"Run bounded verification.",humanApprovalRef:`human:${id}`,replayPolicy,extensions:["verification"],tools:["read"]});

test("#2672 PlotPickle contract, not Pi types, governs start/status/resume/cancel/evidence", async () => {
  const driver=new FakeDriver(); const adapter=createPiDurableAdapter(driver);
  assert.equal((await adapter.start(task("a"))).state,"running");
  assert.equal((await adapter.status("a")).state,"running");
  assert.equal((await adapter.cancel("a")).state,"cancelled");
  assert.equal((await adapter.resume("a")).humanApprovalRef,"human:a");
  const evidence=await adapter.evidence("a");
  assert.deepEqual(evidence.extensions,["verification"]);
  assert.deepEqual(evidence.tools,["read"]);
  assert.equal(evidence.canMergeCode,false);
});

test("#2672 concurrent durable tasks remain isolated", async () => {
  const driver=new FakeDriver(); const adapter=createPiDurableAdapter(driver);
  await Promise.all([adapter.start(task("alpha")),adapter.start(task("beta"))]);
  await adapter.cancel("alpha");
  assert.equal((await adapter.status("alpha")).state,"cancelled");
  assert.equal((await adapter.status("beta")).state,"running");
  assert.equal((await adapter.evidence("beta")).humanApprovalRef,"human:beta");
});

test("#2672 interrupted non-idempotent work cannot silently replay", () => {
  assert.doesNotThrow(()=>assertReplayAllowed(task("safe","safe"),{interrupted:true}));
  assert.throws(()=>assertReplayAllowed(task("mutating","non-replayable"),{interrupted:true}),/Human re-authorization/);
});

test("#2672 Pi Durable cannot acquire DSDD/canon/merge authority", () => {
  const result=deterministicAuthorityEnvelope({status:"done"});
  assert.equal(result.canApproveCanon,false);
  assert.equal(result.canMergeCode,false);
  assert.equal(result.canOverrideDeterministicFailure,false);
});

test("#2672 baseline fallback works with Pi Durable absent", async () => {
  const adapter=new DisabledDurableAdapter();
  assert.equal((await adapter.start(task("optional"))).state,"unavailable");
  assert.equal((await adapter.result("optional")).canOverrideDeterministicFailure,false);
});

test("#2672 prototype pins upstream runtime facts behind adapter seam", () => {
  assert.equal(PI_DURABLE_RUNTIME_VERSION,"1.0.0");
  assert.equal(PI_DURABLE_MINIMUM_NODE,"22.19.0");
  assert.deepEqual(normalizeDurableTask(task("bounded")).tools,["read"]);
});
