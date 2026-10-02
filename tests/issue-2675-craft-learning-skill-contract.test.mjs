import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadAgentSkillRegistry } from "../scripts/agent-skills.mjs";

const readJson = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));

test("#2675 learner metadata is optional and backwards compatible", async () => {
  const registry = await loadAgentSkillRegistry();
  assert.ok(registry.skills.some((skill) => !skill.learning));
  const sage = registry.skills.find((skill) => skill.id === "sage-brinewick");
  assert.deepEqual(sage.learning.actions, ["explain", "diagnose", "exercise", "compare"]);
  assert.equal(sage.learning.visibility, "learner");
  assert.equal(sage.uri, "skill://plotpickle/sage-brinewick");
});

test("#2675 learner metadata cannot grant forbidden authority", async () => {
  const [registry, trust] = await Promise.all([readJson("config/agent-skills.json"), readJson("config/agent-skill-trust.json")]);
  const forbidden = new Set(trust.universalForbiddenCapabilityClasses);
  for (const skill of registry.skills) {
    for (const capability of skill.learning?.contextClasses ?? []) assert.equal(forbidden.has(capability), false);
  }
  assert.ok(forbidden.has("network-egress-by-skill"));
  assert.ok(forbidden.has("credential-read"));
  assert.ok(forbidden.has("provider-selection-by-skill"));
  assert.ok(forbidden.has("ppf-direct-write"));
});

test("#2675 registry and trust records retain exact URI parity", async () => {
  const [registry, trust] = await Promise.all([readJson("config/agent-skills.json"), readJson("config/agent-skill-trust.json")]);
  assert.deepEqual(registry.skills.map((skill) => skill.uri).sort(), trust.records.map((record) => record.uri).sort());
});
