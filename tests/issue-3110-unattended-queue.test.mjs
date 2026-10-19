import test from "node:test";
import assert from "node:assert/strict";
import { admitQueueTicket, inspectQueue, runSupervisorOnce } from "../scripts/engineering-team/unattended-queue.mjs";
const head = "a".repeat(40);
const grant = { issue: 3135, head, approved: true, sourceMutationGrant: true, providerGrant: true,
  localExecutionGrant: true, mergeGrant: true, grantRef: "approved-3135" };
test("untrusted GitHub issue content cannot become execution authorization", () => {
  assert.equal(admitQueueTicket({ ...grant, providerGrant: false }).admitted, false);
  assert.equal(admitQueueTicket({ ...grant, head: "main" }).admitted, false);
  assert.equal(admitQueueTicket({ ...grant, grantRef: "abc; rm -rf ." }).admitted, false);
  assert.equal(admitQueueTicket(grant).admitted, true);
});
test("missing queue fails closed", async () => {
  assert.equal((await inspectQueue({ read: async () => { throw Error("missing"); } })).state, "WAITING_FOR_APPROVED_QUEUE");
});
test("duplicate approved issue is blocked", async () => {
  const result = await inspectQueue({ read: async () => JSON.stringify([grant, grant]) });
  assert.equal(result.state, "BLOCKED_DUPLICATE_ISSUE");
});
test("inspection never executes admitted tasks", async () => {
  const result = await runSupervisorOnce({ read: async () => JSON.stringify([grant]), writeStatus: false });
  assert.equal(result.state, "ADMITTED_NOT_EXECUTED");
  assert.equal(result.nextIssue, 3135);
});
