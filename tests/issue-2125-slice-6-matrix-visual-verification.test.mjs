import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  WEBMCP_STANDARD_SURFACE_REGISTRY,
} from "../lib/verification/webmcp-surface-capture-registry.mjs";

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

const PREPRODUCTION_SURFACES = ["story-map", "visual-story", "scene-timeline"];

test("#2125 Slice 6 applies one Skin V1 Matrix bridge to all pre-production visual surfaces", async () => {
  const [runtime, bridge] = await Promise.all([
    read("app/skin-v1-runtime.tsx"),
    read("app/skin-v1/preproduction-matrix-contract.css"),
  ]);

  assert.match(runtime, /import "\.\/skin-v1\/preproduction-matrix-contract\.css"/u);
  for (const selector of [
    'data-progressive-story-map="24x96"',
    'data-visual-story="scene-beat-shot-frame"',
    'data-scene-timeline="frames-shots-action-timing"',
    'data-progressive-production-lanes="dialogue-sound-camera-transitions"',
  ]) assert.ok(bridge.includes(selector), `${selector} should be governed by the Matrix bridge`);

  for (const token of [
    "--pp-skin-surface-0",
    "--pp-skin-surface-1",
    "--pp-skin-ink",
    "--pp-skin-ink-soft",
    "--pp-skin-ink-muted",
    "--pp-skin-line",
    "--pp-skin-line-strong",
    "--pp-skin-accent-deep",
    "--pp-skin-accent",
    "--pp-skin-accent-bright",
    "--pp-skin-focus",
    "--pp-skin-selected-bg",
    "--pp-skin-selected-ink",
    "--pp-skin-disabled",
    "--pp-skin-radius",
    "--pp-skin-font-ui",
  ]) assert.ok(bridge.includes(`var(${token})`), `${token} should drive pre-production presentation`);

  assert.doesNotMatch(bridge, /#[0-9a-f]{3,8}\b/iu);
  assert.doesNotMatch(bridge, /\brgba?\(/iu);
  assert.doesNotMatch(bridge, /\bhsla?\(/iu);
  assert.doesNotMatch(bridge, /--pp-shell-/u);
});

test("#2125 Slice 6 preserves required Matrix interaction states and visual-story planning behaviour", async () => {
  const bridge = await read("app/skin-v1/preproduction-matrix-contract.css");

  assert.match(bridge, /button:hover:not\(:disabled\)/u);
  assert.match(bridge, /button\[aria-pressed="true"\]/u);
  assert.match(bridge, /button\[data-selected="true"\]/u);
  assert.match(bridge, /:focus-visible/u);
  assert.match(bridge, /:disabled/u);
  assert.match(bridge, /figure\[data-accepted="true"\]/u);
  assert.match(bridge, /filter:\s*grayscale\(1\) contrast\(1\.04\)/u);
  assert.match(bridge, /input\[type="range"\][\s\S]*accent-color:\s*var\(--pp-skin-accent-bright\)/u);
  assert.match(bridge, /\[data-state="locked"\][\s\S]*--story-state:\s*var\(--story-locked\)/u);
});

test("#2125 Slice 6 keeps the existing WebMCP surface hooks and candidate-only baseline governance", async () => {
  const [manifestText, contract] = await Promise.all([
    read("tests/visual-baselines/skin-v1/manifest.json"),
    read("docs/experience/matrix-reference/experience-surface-contract.md"),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.deepEqual(
    Object.entries(manifest.surfaces).filter(([, entry]) => entry.status === "locked").map(([id]) => id),
    ["dashboard"],
  );

  for (const surface of PREPRODUCTION_SURFACES) {
    const registry = WEBMCP_STANDARD_SURFACE_REGISTRY[surface];
    const visual = manifest.surfaces[surface];
    assert.equal(registry.approval, "#2124/#2125");
    assert.equal(visual.status, "candidate");
    assert.equal(visual.selector, registry.rootSelector);
    assert.equal(visual.candidate, registry.candidate);
    assert.equal(visual.baseline, registry.baseline);
  }

  assert.match(contract, /New pre-production surfaces = candidate until explicit Human approval/u);
  assert.match(contract, /existing WebMCP \/ Experience Skins verification/u);
});
