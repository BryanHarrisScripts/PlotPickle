import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1571 defines the six initial autonomous tester roles without creating new authority classes", async () => {
  const [source, authority] = await Promise.all([
    read("build/autonomous-guest/qa/test-campaign.ts"),
    read("core/auth/autonomous-guest/guest-authority.ts"),
  ]);
  for (const role of [
    "fresh-install",
    "beginner-writer",
    "full-story-journey",
    "visual-production",
    "persistence-recovery",
    "adversarial-boundary",
  ]) assert.ok(source.includes(`\"${role}\"`), `Missing tester role ${role}`);

  assert.ok(source.includes('authorityClass: "delegated-guest-autonomous-operator"'));
  assert.ok(source.includes('humanProfileId: ""'));
  assert.ok(source.includes("assertGuestAuthority"));
  assert.ok(authority.includes('AUTONOMOUS_GUEST_AUTHORITY_CLASS = "delegated-guest-autonomous-operator"'));
  assert.doesNotMatch(source, /authenticated-human|new-authority|tester-authority/i);
});

test("#1571 campaign contract is exact-head, isolated, registered-route and budget bounded", async () => {
  const [source, registry] = await Promise.all([
    read("build/autonomous-guest/qa/test-campaign.ts"),
    read("config/uat-autopilot-registry.json"),
  ]);
  for (const contract of [
    "autonomousGuestRegisteredRouteIds",
    "exact 40-character commit SHA",
    "reference-working-copy",
    "temporary-test-project",
    "providerPolicyRef",
    "paidCloudAllowed",
    "maxActions",
    "maxDurationMs",
    "maxRequests",
    "maxTokens",
    "maxCloudCostUsd",
  ]) assert.ok(source.includes(contract), `Missing campaign boundary ${contract}`);

  const parsed = JSON.parse(registry);
  const registered = new Set(parsed.autonomousStoryRoutes.map((route) => route.id));
  for (const routeId of ["library", "learn", "plan", "build", "story-decisions", "story-workbench", "visual-readiness", "storyboard", "production-shots", "previs-animatic", "write", "edit", "refine", "reports"]) {
    assert.ok(registered.has(routeId), `Expected existing autonomous route ${routeId}`);
  }
});

test("#1571 testers cannot mutate source/state, inherit Human credentials, post to Human communities or self-certify", async () => {
  const source = await read("build/autonomous-guest/qa/test-campaign.ts");
  for (const contract of [
    "directStateMutationAllowed: false",
    "sourceCodeMutationAllowed: false",
    "humanCredentialAccessAllowed: false",
    "humanCommunityPostingAllowed: false",
    "aiSelfCertificationAllowed: false",
    "aiSelfCertified: false",
    "evidence requires deterministic gate evidence",
  ]) assert.ok(source.includes(contract), `Missing QA safety boundary ${contract}`);

  assert.doesNotMatch(source, /saveActiveLibraryProject|applyStoryCommand|writeCanon|canon-write|localStorage\.setItem|BUZZ_AUTH_TAG|private[_-]?key/i);
});

test("#1571 evidence is bounded to campaign routes, deterministic refs, findings and cleanup state", async () => {
  const source = await read("build/autonomous-guest/qa/test-campaign.ts");
  for (const contract of [
    "createAutonomousQaEvidence",
    "allowedRoutes.has(routeId)",
    "deterministicGateRefs",
    "reproductionRefs",
    "fingerprint",
    "linkedIssue",
    "cleanupState",
    "routeOutcomes",
    "timingMs",
  ]) assert.ok(source.includes(contract), `Missing QA evidence contract ${contract}`);
  assert.doesNotMatch(source, /chain[-_ ]?of[-_ ]?thought|hidden reasoning|pageText|storyText|credentialValue/i);
});
