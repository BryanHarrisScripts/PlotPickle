import test from "node:test";
import assert from "node:assert/strict";
import {
  compileCinematographySelection,
  selectCinematographyPrimitives,
} from "../lib/cinematography-grammar";

test("selects isolation/reveal grammar deterministically", () => {
  const selection = selectCinematographyPrimitives(
    "Make her feel isolated and small in the frame, leaving empty space while the house is slowly revealed.",
    { medium: "video", limit: 5 },
  );
  assert.ok(selection.primitiveIds.includes("framing.subject-small-in-world"));
  assert.ok(selection.primitiveIds.includes("composition.negative-space"));
  assert.ok(selection.primitiveIds.includes("camera-movement.slow-reveal"));
  assert.equal(selection.medium, "video");
  assert.deepEqual(selection, selectCinematographyPrimitives(
    "Make her feel isolated and small in the frame, leaving empty space while the house is slowly revealed.",
    { medium: "video", limit: 5 },
  ));
});

test("suppresses conflicting primitives", () => {
  const selection = selectCinematographyPrimitives(
    "Push in and pull back, intimacy and separation.",
    { medium: "video", limit: 8 },
  );
  const hasPush = selection.primitiveIds.includes("camera-movement.push-attention");
  const hasPull = selection.primitiveIds.includes("camera-movement.pull-release");
  assert.notEqual(hasPush, hasPull);
});

test("does not select motion-only grammar for stills", () => {
  const selection = selectCinematographyPrimitives(
    "A slow reveal with room pressure and a hard cut.",
    { medium: "still", limit: 8 },
  );
  assert.ok(!selection.primitiveIds.some((id) => id.startsWith("camera-movement.")));
  assert.ok(!selection.primitiveIds.some((id) => id.startsWith("edit-transition.")));
  assert.ok(!selection.primitiveIds.some((id) => id.startsWith("sound-atmosphere.")));
});

test("compiled grammar describes observable effects rather than provider syntax", () => {
  const selection = selectCinematographyPrimitives("isolated negative space", { medium: "still" });
  const compiled = compileCinematographySelection(selection);
  assert.match(compiled, /VISIBLE EFFECT:/u);
  assert.doesNotMatch(compiled, /--ar|cfg|steps|seed|model|provider/iu);
});
