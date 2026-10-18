import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  parseEngineeringCommand,
  inspectEngineeringCheckout,
  runExplicitEngineeringCampaign,
} from "../scripts/engineering-team/run-local.mjs";

const HEAD = "d".repeat(40);
const OTHER = "f".repeat(40);
const config = () => parseEngineeringCommand([
  "--run", "--head", HEAD, "--task", "pr-3098",
  "--roles", "tester,challenger", "--mode", "lossy",
]);
const source = () => ({ head: HEAD, changedPaths: ["scripts/engineering-team/run-local.mjs"] });
function adapters(calls) {
  return {
    tester: { executorId: "real-uat", async run(request) {
      calls.push(request);
      return { observationId: "one", findingRef: "test-finding", state: "candidate", summary: "Focused contract run had no verified defect.", evidenceRefs: ["receipt:focused"] };
    } },
    challenger: { executorId: "managed-pi-review", async run(request) {
      calls.push(request);
      return { observationId: "two", findingRef: "test-finding", state: "candidate", summary: "Review had no independently verified defect.", evidenceRefs: ["receipt:review"] };
    } },
  };
}
test("CLI requires explicit opt-in, exact head, supported roles and no write role", () => {
  assert.throws(() => parseEngineeringCommand(["--head", HEAD, "--task", "pr-3098"]), /Explicit --run/);
  assert.throws(() => parseEngineeringCommand(["--run", "--head", "main", "--task", "pr-3098"]), /exact --head SHA/);
  assert.throws(() => parseEngineeringCommand(["--run", "--head", HEAD, "--task", "pr-3098", "--roles", "scout,tester"]), /Tester and Challenger/);
  assert.throws(() => parseEngineeringCommand(["--run", "--head", HEAD, "--task", "pr-3098", "--roles", "tester,challenger,repairer"]), /Scout, Tester/);
  assert.throws(() => parseEngineeringCommand(["--run", "--head", HEAD, "--task", "pr-3098", "--unexpected", "1"]), /unsupported/);
  assert.equal(config().mode, "lossy");
  assert.deepEqual(config().roles, ["tester", "challenger"]);
});
test("checkout inspection requires immutable head and clean tracked source", async () => {
  const good = await inspectEngineeringCheckout({
    runGit: async ([cmd]) => {
      if (cmd === "rev-parse") return HEAD + "\n";
      if (cmd === "status") return "\n";
      return "scripts/engineering-team/run-local.mjs\n";
    },
  });
  assert.equal(good.head, HEAD);
  assert.deepEqual(good.changedPaths, ["scripts/engineering-team/run-local.mjs"]);
  await assert.rejects(inspectEngineeringCheckout({ runGit: async ([cmd]) => cmd === "rev-parse" ? HEAD : cmd === "status" ? " M package.json" : "" }), /clean tracked/);
  await assert.rejects(inspectEngineeringCheckout({ runGit: async () => "main" }), /no exact Git commit/);
});
test("explicit execution records role evidence, protects the same attempt from replay and cannot verify itself", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-engineering-"));
  try {
    const calls = [];
    const result = await runExplicitEngineeringCampaign(config(), {
      inspect: source, getExactHead: async () => HEAD, appRoot: root,
      buildAdapters: async () => adapters(calls),
    });
    assert.equal(result.receipt.status, "observed");
    assert.equal(result.receipt.independentlyVerified, false);
    assert.equal(result.receipt.durableRecoveryProven, false);
    assert.equal(result.receipt.mergeEligible, false);
    assert.equal(result.receipt.observations.length, 2);
    assert.equal(result.receipt.handoffs[0].communicationMode, "lossy");
    assert.equal(result.receipt.handoffs[0].evidenceRefs.length, 0);
    assert.deepEqual(calls.map((item) => item.role), ["tester", "challenger"]);
    assert.ok(calls.every((item) => item.permissions.sourceMutationAllowed === false));
    const written = JSON.parse(await readFile(path.join(result.evidenceDirectory, "receipt.json"), "utf8"));
    assert.equal(written.status, "observed");
    await assert.rejects(runExplicitEngineeringCampaign(config(), {
      inspect: source, getExactHead: async () => HEAD, appRoot: root,
      buildAdapters: async () => adapters(calls),
    }), /EEXIST/);
    assert.equal(calls.length, 2, "duplicate attempt must not re-dispatch");
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("stale checkout cannot reserve or call providers", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-engineering-stale-"));
  try {
    let called = false;
    await assert.rejects(runExplicitEngineeringCampaign(config(), {
      inspect: async () => ({ ...source(), head: OTHER }),
      appRoot: root, buildAdapters: async () => { called = true; return adapters([]); },
    }), /differs/);
    assert.equal(called, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("moved head and missing reviewer stay blocked, never silently PASS", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-engineering-blocked-"));
  try {
    const result = await runExplicitEngineeringCampaign(config(), {
      inspect: source, getExactHead: async () => HEAD, appRoot: root,
      buildAdapters: async () => ({ tester: adapters([]).tester }),
    });
    assert.equal(result.receipt.status, "blocked");
    assert.equal(result.receipt.roleResults.at(-1).status, "blocked");
    assert.equal(result.receipt.independentlyVerified, false);
    const moved = await runExplicitEngineeringCampaign(
      parseEngineeringCommand(["--run", "--head", HEAD, "--task", "pr-3098", "--attempt", "2", "--roles", "tester,challenger"]),
      { inspect: source, getExactHead: async () => OTHER, appRoot: root,
        buildAdapters: async () => adapters([]) },
    );
    assert.equal(moved.receipt.status, "stale");
  } finally { await rm(root, { recursive: true, force: true }); }
});
