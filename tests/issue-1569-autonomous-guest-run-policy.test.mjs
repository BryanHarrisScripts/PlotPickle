import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#1569 current Guest run policy is durable, bounded and namespace-scoped", async () => {
  const [source, storage] = await Promise.all([
    read("build/autonomous-guest/policy/run-policy-store.ts"),
    read("build/autonomous-guest/storage/workspace-storage.ts"),
  ]);
  assert.match(source, /run-policy\.json/);
  assert.match(source, /autonomousGuestWorkspaceStorageDirectory/);
  assert.match(storage, /"autonomous-guest", authority\.workspaceId/);
  assert.match(storage, /delegated-guest-autonomous-operator/);
  assert.match(storage, /guest-auto-\[a-f0-9\]/i);
  assert.match(source, /MAX_BYTES = 256 \* 1024/);
  assert.match(source, /mode: 0o600/);
  assert.match(source, /writeFile\(temporary/);
  assert.match(source, /rename\(temporary, target\)/);
  assert.match(source, /value\.autonomousRunId !== authority\.autonomousRunId/);
  assert.match(source, /value\.guestWorkspaceId !== authority\.workspaceId/);
});

test("#1569 stored run policy can only allow routes from the existing autonomous registry", async () => {
  const source = await read("build/autonomous-guest/policy/run-policy-store.ts");
  assert.match(source, /autonomousGuestRegisteredRouteIds/);
  assert.match(source, /allowedRouteIds\.some\(\(routeId\) => !registeredRoutes\.has\(routeId\)\)/);
  assert.match(source, /Autonomous Guest run policy contains an unregistered route/);
  assert.match(source, /resolveAutonomousGuestRouteTaskPolicy/);
});

test("#1569 missing durable policy fails closed without cancelling history", async () => {
  const source = await read("build/autonomous-guest/policy/run-policy-store.ts");
  assert.match(source, /guestEnabled: false/);
  assert.match(source, /allowListedTaskKinds: Object\.freeze\(\[\]\)/);
  assert.match(source, /providerAllowed: false/);
  assert.match(source, /budgetAllowed: false/);
  assert.match(source, /cancelled: false/);
  assert.match(source, /policy \? resolveAutonomousGuestRouteTaskPolicy/);
});

test("#1569 scheduler can resolve current policy after restart without in-memory injection", async () => {
  const source = await read("build/autonomous-guest/mastra-wake-runtime.ts");
  assert.match(source, /createAutonomousGuestStoredRoutePolicyResolver/);
  assert.match(source, /resolvePolicy \?\? createAutonomousGuestStoredRoutePolicyResolver\(authority\)/);
  assert.match(source, /resolvePolicy: runtime\.resolvePolicy/);
  assert.match(source, /await runtime\.mastra\.startWorkers\(\)/);
});

test("#1569 durable run policy stores authority facts, not Human identity, credentials or story content", async () => {
  const source = await read("build/autonomous-guest/policy/run-policy-store.ts");
  assert.doesNotMatch(source, /readCredentialJson|writeCredentialJson|profileCredentialsDirectory|apiKey|password|privateKey|BUZZ|storyText|chainOfThought|reasoningTrace/i);
  assert.doesNotMatch(source, /applyStory|writeProject|ppf|canonStore|playwright|fetch\(/i);
});
