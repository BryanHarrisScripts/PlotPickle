import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createAffectedStoryBridgeUpdate,
  createStoryBridgeRequest,
  dedupeStoryBridgeContributions,
} from "../core/story-workflow/buzz-story-bridge-core.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function request(overrides = {}) {
  return createStoryBridgeRequest({
    projectId: "afterglow-working-copy",
    projectRoomPrefix: "afterglow-afterglow",
    workItemId: "story-work:motivation",
    runId: "run-afterglow-1",
    baseRevision: "9",
    targetRefs: ["ppf:foundations:motivation"],
    dependencyRefs: ["ppf:foundations:premise"],
    evidenceRefs: ["afterglow-v9:scene-12"],
    agentProfileId: "tamsin-hearthquill",
    agentActorId: "tamsin-hearthquill",
    expectedAgentPubkey: "f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9",
    localEquivalentAllowed: true,
    destination: {
      privacyClass: "private-project",
      federation: "private-only",
      roomId: "story",
      roomName: "afterglow-afterglow-story",
    },
    contextItems: [{
      id: "story-workflow:ppf:motivation",
      sourceType: "ppf-canon",
      sourceId: "afterglow-working-copy",
      allowedUse: "canon",
      content: "Only the bounded motivation evidence needed for this work item.",
    }],
    limits: {
      timeoutMs: 300_000,
      maxContextCharacters: 6_000,
      maxTokens: 8_000,
      maxToolCalls: 10,
      maxCloudCostUsd: 0,
    },
    createdAt: "2026-08-25T21:30:00.000Z",
    ...overrides,
  });
}

test("#1422 carries existing Run budgets and an explicit no-federation private destination", () => {
  const bridge = request();
  assert.equal(bridge.destination.privacyClass, "private-project");
  assert.equal(bridge.destination.federation, "private-only");
  assert.equal(bridge.limits.timeoutMs, 300_000);
  assert.equal(bridge.limits.maxContextCharacters, 6_000);
  assert.equal(bridge.limits.maxTokens, 8_000);
  assert.equal(bridge.limits.maxToolCalls, 10);
  assert.equal(bridge.limits.maxCloudCostUsd, 0);
  assert.ok(bridge.contextCharacters > 0 && bridge.contextCharacters <= bridge.limits.maxContextCharacters);

  assert.throws(() => request({
    destination: {
      privacyClass: "private-project",
      federation: "federated",
      roomId: "story",
      roomName: "afterglow-afterglow-story",
    },
  }), /federation disabled/i);
});

test("#1422 deduplicates the same structured result even when BUZZ retries create a different signed event", () => {
  const base = {
    requestId: "story-bridge:abc12345",
    contributionId: "event-one",
    result: { resultId: "story-result:motivation" },
  };
  const retry = {
    ...base,
    contributionId: "event-two",
  };
  assert.deepEqual(dedupeStoryBridgeContributions([base, retry]), [base]);
});

test("#1422 affected Human decisions carry only changed refs and updated evidence refs", () => {
  const bridge = request();
  const update = createAffectedStoryBridgeUpdate(bridge, {
    baseRevision: "10",
    changedRefs: ["ppf:foundations:premise"],
    acceptedDecisionId: "decision-42",
    updatedEvidenceRefs: ["ppf:foundations:premise", "afterglow-v9:scene-18"],
    priorFindingIds: ["story-result:motivation"],
  });
  assert.deepEqual(update?.changedRefs, ["ppf:foundations:premise"]);
  assert.deepEqual(update?.updatedEvidenceRefs, ["ppf:foundations:premise", "afterglow-v9:scene-18"]);
  assert.equal(update?.priorBaseRevision, "9");
  assert.equal(update?.baseRevision, "10");
});

test("#1422 server dispatch re-authorizes the exact persisted Run context before BUZZ transport", async () => {
  const [adapter, gateway] = await Promise.all([
    read("modules/story-workflow/buzz-story-bridge.ts"),
    read("build/story-workflow-buzz-bridge-gateway.ts"),
  ]);

  for (const contract of [
    "contextMatchesRun",
    "run.context.receiptGeneratedAt !== packet.receipt.generatedAt",
    "packet.receipt.sources.every",
    "federation: \"private-only\"",
    "timeoutMs: input.run.limits.timeoutMs",
    "maxCloudCostUsd: input.run.limits.maxCloudCostUsd",
  ]) assert.ok(adapter.includes(contract), `Story Bridge adapter is missing persisted Run binding: ${contract}`);

  for (const contract of [
    "verifyRunAuthorization",
    "/api/responsibility-runs?runId=",
    "TERMINAL_RUN_STATES",
    "bridge.contextItems.every",
    "attempted to exceed its persisted Responsibility Run budget",
    "privacyClass: bridge.destination.privacyClass",
    "contextCharacters: bridge.contextCharacters",
  ]) assert.ok(gateway.includes(contract), `Story Bridge gateway is missing re-authorization/observability contract: ${contract}`);

  assert.doesNotMatch(gateway, /saveActiveLibraryProject|foundations\.proposal\.accept|ppf-direct-write|canon-write/i);
});

test("#1422 Story Bridge puts the exact approved BUZZ Agent in the private room before canonical mention dispatch", async () => {
  const [gateway, membership, memberParser] = await Promise.all([
    read("build/story-workflow-buzz-bridge-gateway.ts"),
    read("build/story-workflow/buzz-private-room-membership.ts"),
    read("lib/buzz/membership/buzz-channel-members.ts"),
  ]);
  for (const contract of [
    "agentProfileById(bridge.agentProfileId)",
    "profile.buzzBinding.actorId !== bridge.agentActorId",
    "return `@${profile.displayName}`",
    "ensurePrivateBuzzAgentMembership",
    "agentPubkey: bridge.expectedAgentPubkey",
    "STORY_BRIDGE_RESULT_MARKER",
    "storyBridgeResultMatchesRequest",
    "Copy every correlation ID and target/evidence ref exactly",
    "canonical Agent mention",
  ]) assert.ok(gateway.includes(contract), `Story Bridge dispatch is missing managed-Agent live targeting: ${contract}`);

  for (const contract of [
    "readCredentialJson<unknown>(CONNECTION_FILE)",
    "resolveBuzzCliExecutable(connection.cliPath)",
    '["channels", "members", "--channel", channelId]',
    '["channels", "add-member", "--channel", channelId, "--pubkey", agentPubkey, "--role", "bot"]',
    "MEMBERSHIP_CONFIRM_ATTEMPTS",
    "MEMBERSHIP_CONFIRM_DELAY_MS",
    "waitForMembership",
    "await delay(MEMBERSHIP_CONFIRM_DELAY_MS)",
    "const confirmed = await waitForMembership(readMembers, agentPubkey)",
    "buzzChannelMemberPubkeys",
    "BUZZ did not confirm the approved Agent as a private Story Room member",
  ]) assert.ok(membership.includes(contract), `Story Bridge private-membership helper is missing a required boundary: ${contract}`);

  for (const contract of [
    'for (const key of ["members", "items", "data", "results"])',
    "typeof entry === \"string\"",
    "(entry as Record<string, unknown>).pubkey",
    "seen.has(pubkey)",
  ]) assert.ok(memberParser.includes(contract), `BUZZ member parser is missing documented roster-shape support: ${contract}`);

  assert.equal(
    (membership.match(/"channels", "add-member"/g) ?? []).length,
    1,
    "Membership confirmation may poll reads, but it must not repeat the add-member write.",
  );
  assert.match(membership, /replace\(\/nsec1\[a-z0-9\]\+\/gi/);
  assert.ok(
    gateway.includes("message.content.startsWith(`${STORY_BRIDGE_DISPATCH_MARKER}\\n`)")
      && gateway.includes("storyBridgeResultMatchesRequest(message.content, bridge.requestId)"),
    "The structured dispatch marker/request identity must remain stable for retry/idempotency detection.",
  );
});

test("#1422 exposes a one-click Afterglow/Tamsin live proof without writing the PPF", async () => {
  const [panel, liveTest, gateway] = await Promise.all([
    read("modules/story-workflow/ui/foundations-story-workflow-panel.tsx"),
    read("modules/story-workflow/ui/foundations-buzz-story-live-test.tsx"),
    read("build/story-workflow-buzz-bridge-gateway.ts"),
  ]);
  assert.ok(panel.includes("FoundationsBuzzStoryLiveTest"));
  for (const contract of [
    "Run BUZZ Story Test",
    "action: \"prepare\"",
    "action: \"dispatch\"",
    "retry.idempotent !== true",
    "Waiting for Tamsin Hearthquill’s signed response",
    "signatureVerified !== true",
    "simulated-next-revision",
    "item.state === \"stale\" && item.accepted === false",
    "JSON.stringify(before) !== JSON.stringify(after)",
    "BUZZ Story Test PASS",
  ]) assert.ok(liveTest.includes(contract), `Live Story Bridge UI is missing exit-proof behavior: ${contract}`);

  assert.ok(gateway.includes('if (action === "prepare")') && gateway.includes("prepareStoryBridgeRequest"),
    "Story Bridge request preparation must execute inside the localhost server gateway.");
  assert.doesNotMatch(liveTest, /prepareStoryBridgeRequest|nostr-event-verification|node:crypto/,
    "The client live-test component must not import server-only Story Bridge crypto or request preparation.");
  assert.doesNotMatch(liveTest, /saveFoundationProject|applyStoryCommand|foundations\.proposal\.store|writing-assistant\/chat/);
});
