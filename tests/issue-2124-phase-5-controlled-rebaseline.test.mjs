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

test("#2124 Phase 5 drives the Story Map correction through canonical Matrix skin tokens rather than another colour system", async () => {
  const css = await read("modules/build/ui/progressive-story-map-v2.module.css");
  const marker = "/* #2124 Phase 5:";
  const phase5 = css.slice(css.indexOf(marker));

  assert.ok(css.includes(marker), "Phase 5 Matrix contract bridge should remain explicit");
  assert.match(phase5, /--story-defined:\s*var\(--pp-skin-accent-bright\)/u);
  assert.match(phase5, /--story-observed:\s*var\(--pp-skin-accent\)/u);
  assert.match(phase5, /--story-missing:\s*var\(--pp-skin-ink-muted\)/u);
  assert.match(phase5, /--story-locked:\s*var\(--pp-skin-disabled\)/u);
  assert.match(phase5, /var\(--pp-skin-focus\)/u);
  assert.match(phase5, /var\(--pp-skin-line-strong\)/u);
  assert.doesNotMatch(phase5, /#[0-9a-f]{3,8}\b/iu);
  assert.doesNotMatch(phase5, /--pp-shell-/u);
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
