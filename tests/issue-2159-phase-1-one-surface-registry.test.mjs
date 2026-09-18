import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SKIN_V1_SURFACE_REGISTRY,
  canonicalContinuityIds,
  canonicalWebMcpSurfaceIds,
  projectUiContinuityScreens,
} from "../lib/verification/skin-v1-surface-registry.mjs";
import {
  WEBMCP_STANDARD_SURFACE_REGISTRY,
  WEBMCP_STANDARD_SURFACE_TARGETS,
} from "../lib/verification/webmcp-canonical-surface-registry.mjs";
import { WEBMCP_UAT_SKILL_POLICY } from "../lib/verification/webmcp-uat-skills.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

async function compatibilityRegistry() {
  return JSON.parse(await read("config/ui-continuity-agent-registry.json"));
}

test("#2159 Phase 1 keeps Dashboard and Skin V1 Matrix as canonical registry authority", () => {
  assert.equal(SKIN_V1_SURFACE_REGISTRY.contractId, "skin-v1-surface-registry-v1");
  assert.equal(SKIN_V1_SURFACE_REGISTRY.designSystem, "skin-v1-matrix");
  assert.equal(SKIN_V1_SURFACE_REGISTRY.referenceSurface, "dashboard");
});

test("#2159 Phase 1 projects UI Continuity inclusion and order from canonical continuityIds", async () => {
  const compatibility = await compatibilityRegistry();
  const projected = projectUiContinuityScreens(compatibility);
  assert.deepEqual(projected.map((screen) => screen.id), [...canonicalContinuityIds()]);
  assert.equal(projected.length, compatibility.screens.length);
  assert.ok(projected.every((screen) => screen.designSystem === "skin-v1-matrix"));
  assert.ok(projected.every((screen) => screen.canonicalRegistry === "skin-v1-surface-registry-v1"));
  assert.ok(projected.every((screen) => screen.canonicalSurfaceId && screen.surfaceClass && screen.family));
});

test("#2159 Phase 1 fails closed when UI Continuity compatibility metadata diverges", async () => {
  const compatibility = await compatibilityRegistry();
  assert.throws(
    () => projectUiContinuityScreens({ ...compatibility, screens: compatibility.screens.slice(1) }),
    /drifted from the canonical Surface Registry/u,
  );
  assert.throws(
    () => projectUiContinuityScreens({ ...compatibility, screens: [...compatibility.screens, { id: "undeclared-screen" }] }),
    /Undeclared metadata: undeclared-screen/u,
  );
});

test("#2159 Phase 1 makes canonical webmcpId mappings own the standard target set", () => {
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.length, 30);
  assert.deepEqual(WEBMCP_STANDARD_SURFACE_TARGETS, [...canonicalWebMcpSurfaceIds()]);
  assert.deepEqual(Object.keys(WEBMCP_STANDARD_SURFACE_REGISTRY), [...canonicalWebMcpSurfaceIds()]);
  assert.deepEqual(WEBMCP_UAT_SKILL_POLICY.allowedTargets, WEBMCP_STANDARD_SURFACE_TARGETS);
});

test("#2159 Phase 1 runtime sources consume the canonical projection without changing product UI", async () => {
  const [agent, axe, skills, brief] = await Promise.all([
    read("scripts/ui-continuity-agent.mjs"),
    read("lib/verification/ui-axe-audit.mjs"),
    read("lib/verification/webmcp-uat-skills.mjs"),
    read("docs/developer-briefs/2159-phase-1-one-surface-registry.md"),
  ]);
  assert.match(agent, /projectUiContinuityScreens/u);
  assert.match(agent, /for \(const screen of screens\)/u);
  assert.doesNotMatch(agent, /for \(const screen of registry\.screens\)/u);
  assert.match(axe, /webmcp-canonical-surface-registry\.mjs/u);
  assert.match(skills, /webmcp-canonical-surface-registry\.mjs/u);
  assert.match(brief, /compatibility metadata only/u);
  assert.match(brief, /No PR is merged while any layer is red/u);
});
