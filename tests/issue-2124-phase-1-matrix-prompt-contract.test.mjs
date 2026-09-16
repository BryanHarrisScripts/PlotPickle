import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const base = "docs/experience/matrix-reference/";

test("#2124 Phase 1 defines one provider-neutral versioned Matrix prompt contract", async () => {
  const manifest = JSON.parse(await read(`${base}prompt-contract.json`));

  assert.equal(manifest.issue, 2124);
  assert.equal(manifest.providerNeutral, true);
  assert.equal(manifest.contractVersion, "1.0.0");
  assert.equal(manifest.masterPrompt.id, "matrix-master-v1");
  assert.equal(manifest.boards.length, 3);
  assert.deepEqual(manifest.boards.map((board) => board.initialApprovalState), [
    "candidate-reference",
    "candidate-reference",
    "candidate-reference",
  ]);
  assert.equal(manifest.authority.generatedBoard, "design-intent-only");
  assert.equal(manifest.authority.engineeringTruth, "Experience Surface Contract");
  assert.equal(manifest.authority.regressionEvidence, "real PlotPickle application screenshot");
  assert.equal(manifest.authority.humanApprovalRequired, true);
});

test("#2124 Phase 1 master prompt preserves current Matrix and authority boundaries", async () => {
  const master = await read(`${base}master-generation-prompt.md`);

  for (const phrase of [
    "black canvas",
    "restrained Matrix-green",
    "keyboard-first",
    "Surface → Region → Component → State → Tokens → Behaviour",
    "--pp-skin-*",
    "candidate reference artifact",
    "not a production screenshot",
    "Human explicitly approves",
  ]) assert.match(master, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));

  assert.doesNotMatch(master, /OpenAI|ChatGPT|ComfyUI|Midjourney|Stable Diffusion|DALL-E/u);
});

test("#2124 Phase 1 has three distinct board-specific prompt specifications", async () => {
  const [blueprint, states, tokens] = await Promise.all([
    read(`${base}board-a-interface-blueprint.md`),
    read(`${base}board-b-interaction-state.md`),
    read(`${base}board-c-tokens-operational.md`),
  ]);

  assert.match(blueprint, /HEADER/u);
  assert.match(blueprint, /MASTER NAVIGATION/u);
  assert.match(blueprint, /MAIN VIEWPORT/u);
  assert.match(blueprint, /STATUS BAR/u);

  for (const phrase of ["default", "hover", "selected", "keyboard focused", "disabled", "empty", "loading / async", "error", "validation", "scrollbar / overflow"]) {
    assert.match(states, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
  }

  for (const phrase of ["typography scale", "spacing / density", "z-index", "border treatment", "panel treatment", "focus-indicator", "--pp-skin-*"]) {
    assert.match(tokens, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
  }

  for (const board of [blueprint, states, tokens]) {
    assert.match(board, /candidate-reference/u);
    assert.match(board, /not a production screenshot/u);
  }
});
