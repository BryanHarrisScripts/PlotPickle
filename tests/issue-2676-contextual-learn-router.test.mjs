import assert from "node:assert/strict";
import test from "node:test";
import { routeCraftCapability, runtimeFailureFallback } from "../core/learning/contextual-craft-router.ts";

const capabilities = [
  { id: "theme-craft", domain: "theme", available: true },
  { id: "genre-craft", domain: "genre-tropes", available: true },
  { id: "character-craft", domain: "character", available: true },
  { id: "scene-craft", domain: "scene", available: true },
  { id: "dialogue-craft", domain: "dialogue", available: true },
];

test("#2676 routes known craft context deterministically without infrastructure UI", () => {
  const route = routeCraftCapability({ mode: "learn", context: ["Theme"], capabilities });
  assert.equal(route.primary?.id, "theme-craft");
  assert.equal(route.learnerVisibleLabel, "Learn");
  assert.equal(route.canonicalMutationAllowed, false);
  for (const domain of ["genre", "character", "scene", "dialogue"]) {
    assert.ok(routeCraftCapability({ mode: "learn", context: [domain], capabilities }).primary);
  }
});

test("#2676 same capability serves Learn and authoring proposal without authority escalation", () => {
  const learn = routeCraftCapability({ mode: "learn", context: ["theme"], capabilities });
  const author = routeCraftCapability({ mode: "authoring-proposal", context: ["theme"], capabilities });
  assert.equal(learn.primary?.id, author.primary?.id);
  assert.equal(author.learnerVisibleLabel, "Ask Agent");
  assert.equal(learn.canonicalMutationAllowed, false);
  assert.equal(author.canonicalMutationAllowed, false);
});

test("#2676 caps fan-out at one primary plus two supporting capabilities", () => {
  const route = routeCraftCapability({ mode: "authoring-proposal", context: ["theme", "character", "scene", "dialogue"], capabilities });
  assert.equal(route.primary?.domain, "theme");
  assert.deepEqual(route.supporting.map((item) => item.domain), ["character", "scene"]);
});

test("#2676 unavailable runtime falls back to baseline Learn and preserves project authority", () => {
  const route = routeCraftCapability({ mode: "learn", context: ["theme"], capabilities });
  const fallback = runtimeFailureFallback(route);
  assert.equal(fallback.fallback, "baseline-learn");
  assert.equal(fallback.primary, null);
  assert.equal(fallback.supporting.length, 0);
  assert.equal(fallback.canonicalMutationAllowed, false);
});
