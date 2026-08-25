import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadCasebook } from "../scripts/casebook-contract.mjs";
import {
  createBusinessCaseRegistry,
  defineBusinessCaseContribution,
  executeBusinessCaseContributions,
} from "../scripts/casebook/business-case-registry.mjs";
import { installedBusinessCaseContributions } from "../scripts/casebook/installed-contributions.mjs";
import { selectorFromArgs } from "../scripts/run-casebook-business-cases.mjs";

const explicitIds = new Set([
  "buzz-connect-existing-identity",
  "buzz-great-hall-signed-conversation",
  "comfyui-local-image-visible",
]);

function synthetic(id, ownerId, capability) {
  return defineBusinessCaseContribution({
    businessCaseId: id,
    version: "1.0.0",
    title: id,
    ownerId,
    capability,
    prerequisiteCapabilities: [],
    semanticActions: ["act"],
    humanGates: [],
    productionFulfillmentRef: `production.${id}`,
    uatAdapterRef: `uat.${id}`,
    caseDefinition: { id },
  });
}

test("installed Business Cases are discovered through one registry with the first vertical slice promoted to 1:1 contracts", async () => {
  const casebook = await loadCasebook();
  const contributions = installedBusinessCaseContributions(casebook);
  const registry = createBusinessCaseRegistry(contributions);

  assert.equal(registry.list().length, casebook.cases.length);
  assert.deepEqual(new Set(registry.list().map((item) => item.businessCaseId)), new Set(casebook.cases.map((item) => item.id)));
  for (const id of explicitIds) {
    const contribution = registry.get(id);
    assert.ok(contribution, `${id} must be discoverable.`);
    assert.equal(contribution.migrationState, "contract");
    assert.ok(contribution.productionFulfillmentRef);
    assert.ok(contribution.uatAdapterRef);
    assert.ok(contribution.setupRef);
    assert.ok(contribution.cleanupRef);
  }
  assert.ok(registry.list().some((item) => item.migrationState === "legacy"), "Unmigrated Casebook coverage must remain available through compatibility contributions.");
});

test("Business Cases select independently by id, plugin owner, and capability", () => {
  const registry = createBusinessCaseRegistry([
    synthetic("case-a", "plugin.alpha", "capability.alpha"),
    synthetic("case-b", "plugin.alpha", "capability.beta"),
    synthetic("case-c", "plugin.gamma", "capability.gamma"),
  ]);

  assert.deepEqual(registry.list({ businessCaseId: "case-b" }).map((item) => item.businessCaseId), ["case-b"]);
  assert.deepEqual(registry.list({ ownerId: "plugin.alpha" }).map((item) => item.businessCaseId), ["case-a", "case-b"]);
  assert.deepEqual(registry.list({ capability: "capability.gamma" }).map((item) => item.businessCaseId), ["case-c"]);
  assert.deepEqual(selectorFromArgs(["--retry", "case-c"]), { businessCaseId: "case-c", ownerId: "", capability: "" });
  assert.deepEqual(selectorFromArgs(["--plugin", "plugin.alpha", "--capability", "capability.beta"]), { businessCaseId: "", ownerId: "plugin.alpha", capability: "capability.beta" });
});

test("one failed Business Case does not prevent unrelated Cases from executing", async () => {
  const registry = createBusinessCaseRegistry([
    synthetic("case-a", "plugin.alpha", "capability.alpha"),
    synthetic("case-b", "plugin.beta", "capability.beta"),
    synthetic("case-c", "plugin.gamma", "capability.gamma"),
  ]);
  const visited = [];
  const results = await executeBusinessCaseContributions({
    registry,
    execute: async (contribution) => {
      visited.push(contribution.businessCaseId);
      if (contribution.businessCaseId === "case-b") throw new Error("deliberate isolated failure");
      return { status: "pass" };
    },
  });

  assert.deepEqual(visited, ["case-a", "case-b", "case-c"]);
  assert.deepEqual(results.map((item) => item.status), ["pass", "fail", "pass"]);
  assert.match(results[1].error, /deliberate isolated failure/);
});

test("duplicate Business Case ids are rejected and the central runner stays product-agnostic", async () => {
  const registry = createBusinessCaseRegistry([synthetic("case-a", "plugin.alpha", "capability.alpha")]);
  assert.throws(() => registry.register(synthetic("case-a", "plugin.beta", "capability.beta")), /already registered/);

  const runner = await readFile(new URL("../scripts/run-casebook-business-cases.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(runner, /buzz-connect-existing-identity|buzz-great-hall-signed-conversation|comfyui-local-image-visible/);
  assert.doesNotMatch(runner, /querySelector|Playwright|Sage|Great Hall|ComfyUI/);
});
