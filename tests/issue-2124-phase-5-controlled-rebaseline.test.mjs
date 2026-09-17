import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("#2124 Phase 5 keeps Dashboard as the sole locked Matrix baseline while pre-production surfaces remain Human-review candidates", async () => {
  const manifest = JSON.parse(await read("tests/visual-baselines/skin-v1/manifest.json"));
  const locked = Object.entries(manifest.surfaces)
    .filter(([, entry]) => entry.status === "locked")
    .map(([id]) => id);

  assert.deepEqual(locked, ["dashboard"]);
  for (const surface of ["story-map", "visual-story", "scene-timeline"]) {
    assert.equal(manifest.surfaces[surface].status, "candidate");
  }
});

test("#2124 Phase 5 Story Map correction is now enforced by the canonical Skin V1 presentation bridge", async () => {
  const [runtime, bridge] = await Promise.all([
    read("app/skin-v1-runtime.tsx"),
    read("app/skin-v1/preproduction-matrix-contract.css"),
  ]);

  assert.match(runtime, /import "\.\/skin-v1\/preproduction-matrix-contract\.css"/u);
  assert.match(bridge, /\[data-progressive-story-map="24x96"\]/u);
  assert.match(bridge, /--story-defined:\s*var\(--pp-skin-accent-bright\)/u);
  assert.match(bridge, /--story-observed:\s*var\(--pp-skin-accent\)/u);
  assert.match(bridge, /--story-missing:\s*var\(--pp-skin-ink-muted\)/u);
  assert.match(bridge, /--story-locked:\s*var\(--pp-skin-disabled\)/u);
  assert.match(bridge, /var\(--pp-skin-focus\)/u);
  assert.match(bridge, /var\(--pp-skin-line-strong\)/u);
  assert.doesNotMatch(bridge, /#[0-9a-f]{3,8}\b/iu);
  assert.doesNotMatch(bridge, /--pp-shell-/u);
});

test("#2124 Phase 5 preserves non-colour evidence-state meaning while reducing Story Map colour dependence", async () => {
  const storyMap = await read("modules/build/ui/progressive-story-map.tsx");

  assert.match(storyMap, /defined:\s*"DEFINED"/u);
  assert.match(storyMap, /observed:\s*"OBSERVED"/u);
  assert.match(storyMap, /emerging:\s*"EMERGING"/u);
  assert.match(storyMap, /missing:\s*"AVAILABLE"/u);
  assert.match(storyMap, /locked:\s*"LOCKED"/u);
  assert.match(storyMap, /aria-label="24\/96 evidence states"/u);
});
