import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PLOTPICKLE_EXPERIENCE_V2_ISSUE,
  WORKFLOW_STATE,
  validatePlotPickleScreenRegistry,
} from "../app/_components/plotpickle-system/contract.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1742 binds the visual-system registry to the Experience V2 contract", async () => {
  const registry = JSON.parse(await read("app/_components/plotpickle-system/screen-registry.json"));

  assert.equal(PLOTPICKLE_EXPERIENCE_V2_ISSUE, 1742);
  assert.deepEqual(WORKFLOW_STATE, ["locked", "available", "incomplete", "ready", "accepted"]);
  assert.equal(registry.experienceContractIssue, 1742);
  assert.deepEqual(registry.workflowStates, WORKFLOW_STATE);
  assert.deepEqual(validatePlotPickleScreenRegistry(registry), []);
});

test("#1742 exposes state colors only as semantic visual affordances", async () => {
  const [css, guide] = await Promise.all([
    read("app/_components/plotpickle-system/system.css"),
    read("app/_components/plotpickle-system/README.md"),
  ]);

  for (const state of WORKFLOW_STATE) {
    assert.match(css, new RegExp(`--pp-state-${state}:\\s*var\\(--pp-system-`, "u"), `missing semantic state role ${state}`);
  }

  assert.match(guide, /State color is supportive only/iu);
  assert.match(guide, /ready is not accepted/iu);
  assert.match(guide, /AI or agent output remains a proposal until explicit user acceptance/iu);
});

test("#1742 rejects drift in workflow-state authority or ordering", async () => {
  const registry = JSON.parse(await read("app/_components/plotpickle-system/screen-registry.json"));

  const wrongAuthority = structuredClone(registry);
  wrongAuthority.experienceContractIssue = 1736;
  assert.ok(validatePlotPickleScreenRegistry(wrongAuthority).some((failure) => failure.includes("experience contract must be issue 1742")));

  const reordered = structuredClone(registry);
  reordered.workflowStates = ["available", "locked", "incomplete", "ready", "accepted"];
  assert.ok(validatePlotPickleScreenRegistry(reordered).some((failure) => failure.includes("workflowStates must be")));

  const invented = structuredClone(registry);
  invented.workflowStates = [...WORKFLOW_STATE, "finished"];
  assert.ok(validatePlotPickleScreenRegistry(invented).some((failure) => failure.includes("workflowStates must be")));
});
