import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const contractPath = "docs/experience/matrix-reference/experience-surface-contract.md";

test("#2124 Phase 3 establishes the engineering authority hierarchy", async () => {
  const contract = await read(contractPath);

  for (const phrase of [
    "Approved Matrix reference artifact",
    "Experience Surface Contract",
    "implemented PlotPickle surface",
    "existing WebMCP / Experience Skins verification",
    "real application screenshot candidate / locked baseline",
    "Surface → Region → Component → State → Tokens → Behaviour",
  ]) assert.match(contract, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));

  assert.match(contract, /engineering truth/u);
  assert.match(contract, /regression evidence/u);
  assert.match(contract, /generated or deterministic reference boards are never production screenshots/u);
});

test("#2124 Phase 3 reuses Matrix token and interaction authority", async () => {
  const contract = await read(contractPath);

  for (const phrase of [
    "--pp-skin-canvas",
    "--pp-skin-accent-deep",
    "--pp-skin-accent-bright",
    "--pp-skin-focus",
    "--pp-skin-selected-bg",
    "--pp-skin-space-*",
    "Focus is not selection",
    "four-pixel grid",
  ]) assert.match(contract, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));

  assert.match(contract, /No second Matrix token namespace is permitted/u);
});

test("#2124/#2171 governs Story Map, Visual Story and Scene Workspace without new creative authority", async () => {
  const contract = await read(contractPath);

  assert.match(contract, /### Story Map[\s\S]*4 Acts → 12 Sequences → 24 Blocks → 96 Mini-Blocks/u);
  assert.match(contract, /### Visual Story[\s\S]*Scene → Beat → Shot → Frame/u);
  assert.match(contract, /#2107 SHOW_NOW \/ WITHHOLD_NOW/u);
  assert.match(contract, /### Scene Workspace[\s\S]*Dialogue \/ Action \/ Shot \/ Audio/u);
  assert.match(contract, /untimed Dialogue\/Action\/Audio remains visibly unplaced/u);
  assert.match(contract, /must not bypass #2035/u);
  assert.match(contract, /not a second timeline or cue store/u);
});

test("#2124 Phase 3 defines artifact and baseline governance without a parallel verifier", async () => {
  const contract = await read(contractPath);

  for (const field of [
    "artifactId",
    "artifactType",
    "sourcePromptId",
    "version",
    "approvalState",
    "allowedUsage",
    "disallowedUsage",
    "relatedSurfaceContractSections",
    "relatedCandidateOrLockedBaselines",
  ]) assert.match(contract, new RegExp(`\\b${field}\\b`, "u"));

  for (const state of ["candidate-reference", "approved-reference", "superseded-reference"]) {
    assert.match(contract, new RegExp(state, "u"));
  }

  assert.match(contract, /Reference SVGs never enter the real-app baseline set/u);
  assert.match(contract, /must not create a second verifier, second visual harness, new design Agent or parallel screenshot governance system/u);
});
