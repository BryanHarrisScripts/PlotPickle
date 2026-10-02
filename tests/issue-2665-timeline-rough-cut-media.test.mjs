import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../core/media/timeline-rough-cut-assembly.ts", import.meta.url), "utf8");

test("#2665 keeps Timeline/Rough Cut instructions provider-neutral", () => {
  assert.match(source, /providerNeutral: true/);
  assert.match(source, /canonical: false/);
  assert.doesNotMatch(source, /FFramesLocalMediaEngine|fframes::|Cargo/);
});

test("#2665 maps only approved shots and approved selected takes", () => {
  assert.match(source, /shot\.reviewState !== "approved"/);
  assert.match(source, /placement\.takeId !== packet\.approvedTakeId/);
  assert.match(source, /Math\.round\(shot\.durationSeconds \* 1000\)/);
});

test("#2665 preserves order, transitions, audio identity, and provenance", () => {
  assert.match(source, /order: placementIndex \+ 1/);
  assert.match(source, /transitionIn: shot\.transitionIn/);
  assert.match(source, /audioSourceRefs/);
  assert.match(source, /storyboardDependencyKey/);
});

test("#2665 failures are evidence, not Timeline/canon mutation", () => {
  assert.match(source, /Timeline and Rough Cut state were not mutated/);
  assert.doesNotMatch(source, /applyStoryCommand|saveFoundationProject/);
});
