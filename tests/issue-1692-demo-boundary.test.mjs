import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  DEMO_ALLOWED_CAPABILITIES,
  DEMO_AUTHORITY_CLASS,
  DEMO_FORBIDDEN_CAPABILITIES,
  createApprovedDemoHandoff,
  createDemoBoundary,
  createDemoReset,
  assertDemoCapability,
} from "../modules/demo-onboarding/demo-boundary.mjs";

const root = process.cwd();

test("#1692 DEMO authority is synthetic, disposable and has no Human identity", () => {
  const boundary = createDemoBoundary({ demoId: "story-intro", seed: "story-intro-v1" });
  assert.equal(boundary.authorityClass, DEMO_AUTHORITY_CLASS);
  assert.equal(boundary.disposable, true);
  assert.equal(boundary.authenticatedHuman, false);
  assert.equal(boundary.humanProfileId, "");
  assert.equal(boundary.storageScope, "demo-owned-disposable");
  assert.ok(DEMO_ALLOWED_CAPABILITIES.includes("story.synthetic.resolve"));
});

test("#1692 DEMO capability guard fails closed for every private or host authority", () => {
  for (const capability of DEMO_FORBIDDEN_CAPABILITIES) {
    assert.throws(() => assertDemoCapability(capability), (error) => error?.code === "DEMO_CAPABILITY_DENIED");
  }
  assert.equal(assertDemoCapability("sage.explain.read"), "sage.explain.read");
});

test("#1692 DEMO reset recreates known synthetic state without touching Guest or Human data", () => {
  const boundary = createDemoBoundary({ demoId: "story-intro", seed: "story-intro-v1" });
  const initialState = { scene: 1, consequence: null };
  const reset = createDemoReset({ boundary, initialState });
  initialState.scene = 5;
  assert.deepEqual(reset.resetTo, { scene: 1, consequence: null });
  assert.equal(reset.deleteBeforeReset, true);
  assert.equal(reset.preserveHumanPrivateState, true);
  assert.equal(reset.preserveGuestState, true);
});

test("#1692 Make This Mine requires explicit approval and rejects authority-bearing payloads", () => {
  assert.throws(
    () => createApprovedDemoHandoff({ approved: false, sourceDemoId: "story-intro", starterContent: { title: "My Story" } }),
    (error) => error?.code === "DEMO_HANDOFF_APPROVAL_REQUIRED",
  );
  for (const privileged of [
    { profileId: "profile-secret" },
    { nested: { csrfToken: "secret" } },
    { nested: [{ providerCredentials: { key: "secret" } }] },
    { runtimeAuthority: "admin" },
    { connectorScopes: ["github"] },
  ]) {
    assert.throws(
      () => createApprovedDemoHandoff({ approved: true, sourceDemoId: "story-intro", starterContent: privileged }),
      (error) => error?.code === "DEMO_HANDOFF_PRIVILEGED_FIELD",
    );
  }
  const handoff = createApprovedDemoHandoff({
    approved: true,
    sourceDemoId: "story-intro",
    starterContent: { title: "My Story", storyPieces: [{ type: "character", name: "Mara" }] },
  });
  assert.equal(handoff.destination, "fresh-human-project");
  assert.deepEqual(handoff.starterContent.storyPieces, [{ type: "character", name: "Mara" }]);
});

test("#1692 Phase 0 preserves existing Guest and profile behavior rather than widening Guest", async () => {
  const profileUi = await readFile(path.join(root, "app/profile-access/profile-access-boundary.tsx"), "utf8");
  const architecture = await readFile(path.join(root, "docs/architecture/PLOTPICKLE-DEMO-ONBOARDING.md"), "utf8");
  for (const phrase of ["Use isolated Guest", "Temporary writing space", "Save as new profile", "Delete Guest work and exit"]) {
    assert.ok(profileUi.includes(phrase), `Existing Guest contract changed unexpectedly: ${phrase}`);
  }
  assert.match(architecture, /DEMO is not Guest/u);
  assert.match(architecture, /same deterministic STORY rules\/session contracts/u);
  assert.match(architecture, /Make This Mine/u);
  assert.match(architecture, /server-network mode keeps its existing fail-closed authentication\/bootstrap behavior/i);
});
