import assert from "node:assert/strict";
import test from "node:test";
import { validateVerificationRequest } from "../core/sidecars/contract.ts";
import { LocalSidecarSupervisor } from "../core/sidecars/local-supervisor.ts";

test("#2669 request contract is bounded and rejects arbitrary operations", () => {
  assert.equal(validateVerificationRequest({ requestId: "r1", operation: "health" }).operation, "health");
  assert.throws(() => validateVerificationRequest({ requestId: "r2", operation: "shell" }), /not permitted/);
});

test("#2669 disabled or missing sidecar is non-blocking and unavailable", () => {
  const supervisor = new LocalSidecarSupervisor();
  assert.equal(supervisor.start({ id: "optional", command: "never-run", enabled: false }).state, "unavailable");
});

test("#2669 failed sidecar does not throw through product supervisor", async () => {
  const supervisor = new LocalSidecarSupervisor();
  supervisor.start({ id: "bad", command: "__plotpickle_missing_sidecar__" });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(supervisor.status("bad").state, "failed");
});
