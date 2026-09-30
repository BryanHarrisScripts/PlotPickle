import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  loadAgentSkill,
  listAgentSkills,
  materializeAgentSkillRunManifest,
} from "../scripts/agent-skills.mjs";

const readJson = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));

const QUILLAN_SKILLS = [
  "skill://plotpickle/sequence-director",
  "skill://plotpickle/storyboard-frame-director",
];

test("#2614 resolves every Agent Profile skill URI through the canonical skill registry", async () => {
  const [profiles, skills] = await Promise.all([
    readJson("config/agent-profiles.json"),
    listAgentSkills(),
  ]);
  const registered = new Set(skills.map((skill) => skill.uri));

  for (const profile of profiles.profiles) {
    for (const uri of profile.skillUris) {
      assert.ok(registered.has(uri), `${profile.id} references unknown Agent Skill ${uri}`);
    }
  }

  const quillan = profiles.profiles.find((profile) => profile.id === "quillan-reedcloak");
  assert.ok(quillan);
  assert.deepEqual(quillan.skillUris, QUILLAN_SKILLS);
});

test("#2614 registers and materializes both existing Quillan procedures without new authority", async () => {
  const skills = await listAgentSkills();
  const byId = new Map(skills.map((skill) => [skill.id, skill]));

  for (const [id, uri, entry] of [
    ["sequence-director", QUILLAN_SKILLS[0], ".agents/skills/sequence-director/SKILL.md"],
    ["storyboard-frame-director", QUILLAN_SKILLS[1], ".agents/skills/storyboard-frame-director/SKILL.md"],
  ]) {
    const skill = byId.get(id);
    assert.ok(skill);
    assert.equal(skill.uri, uri);
    assert.equal(skill.entry, entry);
    assert.equal(skill.primaryWorker, "mastra");
    assert.deepEqual(skill.consumers, ["creative-director"]);
    assert.equal(skill.localOnly, true);
    assert.equal(skill.mcpReady, true);

    const loaded = await loadAgentSkill(id);
    assert.ok(loaded.content.includes(`name: ${id}`));
  }

  const manifest = await materializeAgentSkillRunManifest(
    "creative-director",
    ["sequence-director", "storyboard-frame-director"],
  );
  assert.deepEqual(manifest.requiredSkillIds, ["sequence-director", "storyboard-frame-director"]);
  assert.deepEqual(manifest.skills.map((skill) => skill.uri), QUILLAN_SKILLS);
});

test("#2614 keeps built-in trust metadata exactly aligned with the expanded skill registry", async () => {
  const [registry, trust] = await Promise.all([
    readJson("config/agent-skills.json"),
    readJson("config/agent-skill-trust.json"),
  ]);
  assert.equal(registry.skills.length, 19);
  assert.equal(trust.records.length, registry.skills.length);
  assert.deepEqual(
    trust.records.map((record) => record.uri).sort(),
    registry.skills.map((skill) => skill.uri).sort(),
  );

  for (const uri of QUILLAN_SKILLS) {
    const record = trust.records.find((entry) => entry.uri === uri);
    assert.ok(record);
    assert.equal(record.evalStatus, "covered");
    assert.ok(record.lastEvaluatedRevision);
  }
});

test("#2614 self-test source checks profile-to-skill integrity before reporting PASS", async () => {
  const source = await readFile(new URL("../scripts/agent-skills.mjs", import.meta.url), "utf8");
  const integrityCheck = source.indexOf("references unknown Agent Skill");
  const passMessage = source.indexOf("PlotPickle agent skills self-test PASS");
  assert.ok(integrityCheck >= 0);
  assert.ok(passMessage > integrityCheck);
});
