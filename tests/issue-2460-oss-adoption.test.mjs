import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateRuntimeManifest, createRuntimeSupervisor, planRuntimeStart } from "../core/runtime/managed-runtime-core.mjs";
import { materializeAgentSkillsForRun } from "../lib/agents/agent-skill-materialization.mjs";
import {
  AGENT_RUNTIME_FORBIDDEN_TRACE_CONTENT,
  AGENT_RUNTIME_KINDS,
  AGENT_RUNTIME_PARENT_KIND,
  AGENT_RUNTIME_SAFE_TRACE_FIELDS,
  parentKindForAgentRuntimeKind,
} from "../lib/agents/agent-runtime-vocabulary.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const json = async (path) => JSON.parse(await read(path));

test("#2460 registers stable-diffusion.cpp only as an optional non-default local image runtime", async () => {
  const manifest = validateRuntimeManifest(await json("config/runtime-manifest.json"));
  const comfy = manifest.components.find((component) => component.id === "comfyui-engine");
  const sdCpp = manifest.components.find((component) => component.id === "stable-diffusion-cpp-engine");

  assert.ok(comfy);
  assert.ok(sdCpp);
  assert.equal(comfy.enabled, true);
  assert.equal(sdCpp.enabled, false);
  assert.deepEqual(sdCpp.capabilities, ["image-generation"]);
  assert.equal(sdCpp.launchStrategy, "external-loopback-service");
  assert.equal(sdCpp.healthProbe.kind, "host-owned");
  assert.equal(sdCpp.readinessProbe.kind, "host-owned");
  assert.equal(sdCpp.source.name, "stable-diffusion.cpp");
  assert.equal(sdCpp.source.license, "MIT");
  assert.equal(sdCpp.launcher, null);

  const supervisor = createRuntimeSupervisor(manifest);
  assert.throws(() => planRuntimeStart(supervisor, sdCpp.id), /is disabled/i);
});

test("#2460 materializes Agent Skills deterministically without embedding skill bodies", async () => {
  const registry = await json("config/agent-skills.json");
  const manifest = await materializeAgentSkillsForRun(registry, {
    consumer: "pi",
    requiredSkillIds: ["uat-repair"],
    entryExists: async () => true,
  });

  assert.equal(manifest.consumer, "pi");
  assert.deepEqual(manifest.skills.map((skill) => skill.id), [...manifest.skills.map((skill) => skill.id)].sort());
  assert.ok(manifest.skills.some((skill) => skill.id === "uat-repair"));
  for (const skill of manifest.skills) {
    assert.deepEqual(Object.keys(skill).sort(), [
      "consumers",
      "entry",
      "id",
      "localOnly",
      "mcpReady",
      "name",
      "primaryWorker",
      "roles",
      "uri",
    ]);
    assert.equal("content" in skill, false);
    assert.equal("procedure" in skill, false);
  }
});

test("#2460 fails closed when required Agent Skill materialization is unknown, ineligible or missing", async () => {
  const registry = await json("config/agent-skills.json");

  await assert.rejects(
    () => materializeAgentSkillsForRun(registry, {
      consumer: "pi",
      requiredSkillIds: ["missing-skill"],
      entryExists: async () => true,
    }),
    (error) => error?.code === "UNKNOWN_REQUIRED_SKILL",
  );

  await assert.rejects(
    () => materializeAgentSkillsForRun(registry, {
      consumer: "curriculum-guide",
      requiredSkillIds: ["uat-repair"],
      entryExists: async () => true,
    }),
    (error) => error?.code === "INELIGIBLE_REQUIRED_SKILL",
  );

  await assert.rejects(
    () => materializeAgentSkillsForRun(registry, {
      consumer: "pi",
      requiredSkillIds: ["uat-repair"],
      entryExists: async (entry) => !entry.endsWith("/uat-repair/SKILL.md"),
    }),
    (error) => error?.code === "SKILL_ENTRY_UNAVAILABLE",
  );
});


test("#2460 UAT repair handoff requires and loads the materialized uat-repair skill", async () => {
  const source = await read("scripts/run-uat-repair-agent.mjs");
  const registryScript = await read("scripts/agent-skills.mjs");

  assert.match(source, /materializeAgentSkillRunManifest\(worker, \["uat-repair"\]\)/u);
  assert.match(source, /readAgentSkillProcedure\("uat-repair"\)/u);
  assert.match(source, /skillMaterialization:\s*"failed"/u);
  assert.match(registryScript, /materializeAgentSkillsForRun/u);
  assert.match(registryScript, /--materialize-for/u);
});

test("#2460 defines one privacy-bounded agent/runtime execution vocabulary", () => {
  assert.deepEqual(AGENT_RUNTIME_KINDS, [
    "session",
    "turn",
    "agent-run",
    "provider-request",
    "tool-call",
    "tool-result",
  ]);
  assert.equal(AGENT_RUNTIME_PARENT_KIND.turn, "session");
  assert.equal(AGENT_RUNTIME_PARENT_KIND["agent-run"], "turn");
  assert.equal(AGENT_RUNTIME_PARENT_KIND["provider-request"], "agent-run");
  assert.equal(AGENT_RUNTIME_PARENT_KIND["tool-call"], "agent-run");
  assert.equal(AGENT_RUNTIME_PARENT_KIND["tool-result"], "tool-call");
  assert.equal(parentKindForAgentRuntimeKind("session"), null);
  assert.equal(parentKindForAgentRuntimeKind("tool-result"), "tool-call");

  for (const forbidden of ["prompt", "response", "reasoning", "storyText", "credentials", "secret"]) {
    assert.equal(AGENT_RUNTIME_SAFE_TRACE_FIELDS.includes(forbidden), false);
  }
  for (const category of ["hidden-reasoning", "full-prompt", "private-story-text", "credentials"]) {
    assert.ok(AGENT_RUNTIME_FORBIDDEN_TRACE_CONTENT.includes(category));
  }
});

test("#2460 registers seven-layer ownership for new production contracts", async () => {
  const ownership = await json("config/verification/ownership-map.json");
  const agentRule = ownership.rules.find((rule) => rule.id === "agent-runtime-execution-contracts");
  const runtimeRule = ownership.rules.find((rule) => rule.id === "managed-runtime-manifest");

  assert.equal(agentRule?.ownerLayer, "agent-runtime");
  assert.ok(agentRule?.include.includes("lib/agents/agent-runtime-vocabulary.mjs"));
  assert.ok(agentRule?.include.includes("lib/agents/agent-skill-materialization.mjs"));
  assert.ok(agentRule?.include.includes("scripts/agent-skills.mjs"));
  assert.equal(runtimeRule?.ownerLayer, "provider-runtime");
  assert.deepEqual(runtimeRule?.include, ["config/runtime-manifest.json"]);
});

test("#2460 developer briefs preserve adoption boundaries", async () => {
  const [sd, paperclip, vocabulary] = await Promise.all([
    read("docs/developer-briefs/2460-stable-diffusion-cpp-runtime.md"),
    read("docs/developer-briefs/2460-paperclip-deterministic-skill-materialization.md"),
    read("docs/developer-briefs/2460-agent-runtime-vocabulary.md"),
  ]);

  assert.match(sd, /Do not replace ComfyUI|not to replace ComfyUI/i);
  assert.match(sd, /disabled by default/i);
  assert.match(paperclip, /pattern adaptation, not a Paperclip dependency/i);
  assert.match(paperclip, /progressive disclosure/i);
  assert.match(vocabulary, /Session\s*\n→ Turn\s*\n→ Agent Run/i);
  assert.match(vocabulary, /do not replace narrative uses/i);
});
