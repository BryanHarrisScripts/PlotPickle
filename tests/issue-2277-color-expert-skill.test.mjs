import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { selectRelevantSkillIds } from "../Utilities/DeveloperWorkbench/pi-review-instructions.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const json = async (path) => JSON.parse(await read(path));

test("#2277 registers Color Expert as a bounded removable Agent Skill", async () => {
  const [registry, trust, skill, notice, oss] = await Promise.all([
    json("config/agent-skills.json"),
    json("config/agent-skill-trust.json"),
    read(".agents/skills/color-expert/SKILL.md"),
    read(".agents/skills/color-expert/NOTICE.md"),
    json("config/third-party-oss.json"),
  ]);

  const entry = registry.skills.find((item) => item.id === "color-expert");
  assert.ok(entry);
  assert.equal(entry.uri, "skill://plotpickle/color-expert");
  assert.equal(entry.entry, ".agents/skills/color-expert/SKILL.md");
  assert.equal(entry.primaryWorker, "host");
  assert.equal(entry.localOnly, true);
  assert.equal(entry.mcpReady, true);
  for (const consumer of ["visual-director", "visual-qa", "visual-contract", "pi", "developer-worker"]) {
    assert.ok(entry.consumers.includes(consumer), consumer);
  }

  const record = trust.records.find((item) => item.uri === entry.uri);
  assert.ok(record);
  assert.equal(record.evalStatus, "covered");
  assert.equal(record.lastEvaluatedRevision, "issue-2277");
  assert.ok(record.requestedCapabilityClasses.includes("color-analysis"));

  assert.match(skill, /advisory/i);
  assert.match(skill, /does not replace Skin V1 tokens, Visual Director, Visual QA, Human approval/i);
  assert.match(skill, /reference color -> semantic role -> component usage/i);
  assert.match(skill, /OKLAB \/ OKLCH/u);
  assert.match(skill, /WCAG 2\.2 AA/u);
  assert.match(skill, /APCA may be reported as supplemental evidence/u);
  assert.match(skill, /cannot:[\s\S]*create or replace the Skin V1 palette authority/u);
  assert.match(skill, /cannot:[\s\S]*mutate CSS or token files/u);
  assert.match(skill, /cannot:[\s\S]*select providers/u);
  assert.match(skill, /cannot:[\s\S]*read credentials/u);

  assert.match(notice, /meodai\/skill\.color-expert/u);
  assert.match(notice, /28e49f7457d7aa92010688e69975c16d2ffe4b01/u);
  assert.match(notice, /does not vendor the upstream reference corpus/u);

  const upstream = oss.systems.find((item) => item.id === "color-expert-skill");
  assert.ok(upstream);
  assert.equal(upstream.revision, "28e49f7457d7aa92010688e69975c16d2ffe4b01");
  assert.equal(upstream.usage, "reference-only");
  assert.match(upstream.license, /CC BY 4\.0/u);
  assert.match(upstream.plotpickleUse, /does not vendor the upstream reference corpus/u);
});

test("#2277 package has no executable scripts or copied upstream reference corpus", async () => {
  const root = new URL("../.agents/skills/color-expert/", import.meta.url);
  const entries = await readdir(root, { withFileTypes: true });
  const names = entries.map((entry) => entry.name).sort();

  assert.deepEqual(names, ["NOTICE.md", "SKILL.md", "evals"]);
  assert.equal(entries.some((entry) => entry.name === "scripts"), false);
  assert.equal(entries.some((entry) => entry.name === "references"), false);

  const evals = await json(".agents/skills/color-expert/evals/trigger-evals.json");
  assert.ok(evals.shouldTrigger.length >= 5);
  assert.ok(evals.shouldNotTrigger.length >= 5);
});

test("#2277 Developer Workbench loads Color Expert for color work but not geometry-only work", async () => {
  const registry = await json("config/agent-skills.json");

  const colorTask = {
    issue: {
      title: "Normalize Skin V1 palette contrast",
      body: "Check OKLCH gamut and contrast between selected and hover states.",
    },
    pullRequest: { files: [{ path: "app/skin-v1-definition.css" }], checks: [] },
  };
  const selected = selectRelevantSkillIds(colorTask, registry);
  assert.ok(selected.includes("color-expert"));
  assert.ok(selected.includes("visual-contract"));
  assert.ok(selected.includes("visual-qa"));

  const geometryTask = {
    issue: {
      title: "Fix frame overlap",
      body: "The right edge exceeds the shell by 17 pixels.",
    },
    pullRequest: { files: [{ path: "app/skin-v1-surface-orchestrator.css" }], checks: [] },
  };
  const geometrySelected = selectRelevantSkillIds(geometryTask, registry);
  assert.equal(geometrySelected.includes("color-expert"), false);
});

test("#2277 Visual QA and Visual Contract keep Color Expert progressive and advisory", async () => {
  const [qa, contract] = await Promise.all([
    read(".agents/skills/visual-qa/SKILL.md"),
    read(".agents/skills/visual-contract/SKILL.md"),
  ]);
  assert.match(qa, /progressively load `skill:\/\/plotpickle\/color-expert`/u);
  assert.match(qa, /Color Expert is advisory only/u);
  assert.match(contract, /progressively load `skill:\/\/plotpickle\/color-expert`/u);
  assert.match(contract, /does not change reference authority, provider selection/u);
});
