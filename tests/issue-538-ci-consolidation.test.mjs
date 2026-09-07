import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const workflowRoot = new URL(".github/workflows/", root);
const source = (path) => readFile(new URL(path, root), "utf8");
const exists = async (path) => {
  try {
    await access(new URL(path, root));
    return true;
  } catch {
    return false;
  }
};

test("#1747 replaces the common PR workflow fan-out with PR Gate and Product Gate", async () => {
  const files = (await readdir(workflowRoot)).filter((file) => /\.ya?ml$/.test(file)).sort();
  assert.ok(files.includes("pr-gate.yml"));
  assert.ok(files.includes("product-gate.yml"));

  for (const retired of [
    "learn-validation.yml",
    "visual-readiness.yml",
    "repository-architecture-inventory.yml",
    "build-story-model.yml",
    "story-workbench.yml",
    "story-decisions.yml",
    "hardware-aware-local-ai.yml",
    "ben-code-quality.yml",
    "profile-experience.yml",
    "buzz-guildhall.yml",
    "autonomous-qa-targeted-fix.yml",
  ]) {
    assert.equal(await exists(`.github/workflows/${retired}`), false, `${retired} must not return as a separate PR check`);
  }

  const [prGate, productGate] = await Promise.all([
    source(".github/workflows/pr-gate.yml"),
    source(".github/workflows/product-gate.yml"),
  ]);
  assert.match(prGate, /^name: PR Gate$/m);
  assert.match(prGate, /^    name: PR Gate$/m);
  assert.match(productGate, /^name: Product Gate$/m);
  assert.match(productGate, /^    name: Product Gate$/m);
  assert.match(prGate, /^  pull_request:$/m);
  assert.match(productGate, /^  pull_request:$/m);
});

test("#1747 preserves deterministic coverage inside PR Gate with one dependency install and one production build", async () => {
  const prGate = await source(".github/workflows/pr-gate.yml");
  assert.match(prGate, /npm run validate:learn/);
  assert.match(prGate, /issue-1338-progressive-build-story-model/);
  assert.match(prGate, /issue-1419-story-workbench/);
  assert.match(prGate, /hardware-aware-local-ai-runtime/);
  assert.match(prGate, /test:profile-experience/);
  assert.match(prGate, /issue-675-buzz-guildhall/);
  assert.match(prGate, /repository-architecture-enforcement\.mjs/);
  assert.match(prGate, /run-ben-code-quality\.mjs --base-ref/);
  assert.match(prGate, /run-uat-autopilot\.mjs --contracts-only/);
  assert.equal((prGate.match(/npm ci --include=dev --no-audit --no-fund/g) || []).length, 1);
  assert.equal((prGate.match(/npm run build/g) || []).length, 1);
});

test("#1747 keeps rendered, autonomous, and Windows packaged proof behind the single Product Gate", async () => {
  const productGate = await source(".github/workflows/product-gate.yml");
  assert.match(productGate, /Wait for PR Gate before expensive verification/);
  assert.match(productGate, /ui-stylelint-gate\.mjs/);
  assert.match(productGate, /ui-axe-audit\.mjs/);
  assert.match(productGate, /ui-experience-audit\.mjs/);
  assert.match(productGate, /ui-sitemap-rendered-audit\.mjs/);
  assert.match(productGate, /run-autonomous-story-reference\.mjs/);
  assert.match(productGate, /gh workflow run windows-installer\.yml/);
  assert.match(productGate, /gh run watch/);
  assert.equal((productGate.match(/npm ci --include=dev --no-audit --no-fund/g) || []).length, 1);
});

test("#1747 keeps specialized child workflows reusable without creating direct PR checks", async () => {
  for (const file of [
    "autonomous-qa-campaign.yml",
    "autonomous-story-reference.yml",
    "windows-installer.yml",
  ]) {
    const workflow = await source(`.github/workflows/${file}`);
    assert.doesNotMatch(workflow, /^  pull_request:/m, `${file} must not create a direct PR check`);
  }

  const campaign = await source(".github/workflows/autonomous-qa-campaign.yml");
  assert.match(campaign, /^  schedule:$/m);
  assert.match(campaign, /^  workflow_dispatch:$/m);

  const reference = await source(".github/workflows/autonomous-story-reference.yml");
  assert.match(reference, /^  workflow_call:$/m);
  assert.match(reference, /^  workflow_dispatch:$/m);

  const windows = await source(".github/workflows/windows-installer.yml");
  assert.match(windows, /^  workflow_call:$/m);
  assert.match(windows, /^  workflow_dispatch:$/m);
});
