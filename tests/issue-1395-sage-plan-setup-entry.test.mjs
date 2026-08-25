import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1395 Setup AI opens the focused Sage and PLAN Settings destination", async () => {
  const [anchor, settings] = await Promise.all([
    read("app/ui-continuity-anchor.tsx"),
    read("app/sage-settings-workspace.tsx"),
  ]);

  assert.match(anchor, /sageSetupNeeded \? "\/\?workspace=settings&settings=sage-plan" : "\/\?workspace=settings"/);
  assert.match(settings, /id: "sage-plan", label: "Sage & PLAN Setup"/);
  assert.match(settings, /case "sage-plan":[\s\S]*<AiComputeWorkspace mode="local" focus="sage-plan" \/>/);
  assert.match(settings, /"settings-sage": "sage-plan"/);
  assert.match(settings, /"settings-plan": "sage-plan"/);
  assert.match(settings, /sage: "sage-plan"/);
  assert.match(settings, /plan: "sage-plan"/);
});

test("#1395 focused setup reuses Local Compute Writing and exposes readiness without another provider store", async () => {
  const compute = await read("app/settings/compute/ai-compute-workspace.tsx");

  assert.match(compute, /type ComputeFocus = "sage-plan"/);
  assert.match(compute, /focus === "sage-plan"[\s\S]*setActiveCapability\("writing"\)[\s\S]*setAdvancedOpen\(true\)/);
  assert.match(compute, /data-ai-compute-focus=\{focus\}/);
  assert.match(compute, /<SageFastModelSetup \/>/);
  assert.match(compute, /<AiRoutingPanel/);
  assert.doesNotMatch(compute, /localStorage|indexedDB/);
});

test("#1395 Sage and PLAN readiness, tests and the return to LEARN action remain visible", async () => {
  const setup = await read("app/sage-fast-model-setup.tsx");

  assert.match(setup, />Runtime found<\/span>/);
  assert.match(setup, />Sage ready<\/span>/);
  assert.match(setup, />PLAN ready<\/span>/);
  assert.match(setup, /Set up Sage and PLAN/);
  assert.match(setup, />Test Sage<\/button>/);
  assert.match(setup, />Test PLAN<\/button>/);
  assert.match(setup, /sageReady \? <a className=\{styles\.returnLink\} href="\/\?workspace=learn">Return to LEARN<\/a> : null/);
});
