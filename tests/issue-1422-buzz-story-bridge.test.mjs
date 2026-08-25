import assert from "node:assert/strict";
import { createECDH, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createAffectedStoryBridgeUpdate,
  createStoryBridgeRequest,
  dedupeStoryBridgeContributions,
  normalizeStoryBridgeContribution,
  STORY_BRIDGE_RESULT_MARKER,
} from "../core/story-workflow/buzz-story-bridge-core.mjs";
import {
  canonicalNostrEventId,
  verifyNostrEventSignature,
} from "../core/buzz/nostr-event-verification.mjs";

const GROUP_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function taggedHash(tag, value) {
  const tagHash = createHash("sha256").update(Buffer.from(tag, "utf8")).digest();
  return createHash("sha256").update(Buffer.concat([tagHash, tagHash, value])).digest();
}

function scalarBytes(value) {
  return Buffer.from(value.toString(16).padStart(64, "0"), "hex");
}

function pointForScalar(value) {
  const key = createECDH("secp256k1");
  key.setPrivateKey(scalarBytes(value));
  const compressed = key.getPublicKey(undefined, "compressed");
  return { even: compressed[0] === 2, x: compressed.subarray(1, 33) };
}

function xor(left, right) {
  return Buffer.from(left.map((value, index) => value ^ right[index]));
}

function signBip340(message, secretValue) {
  const d0 = BigInt(secretValue);
  const publicPoint = pointForScalar(d0);
  const d = publicPoint.even ? d0 : GROUP_N - d0;
  const aux = Buffer.alloc(32);
  const masked = xor(scalarBytes(d), taggedHash("BIP0340/aux", aux));
  const nonceHash = taggedHash("BIP0340/nonce", Buffer.concat([masked, publicPoint.x, message]));
  const k0 = BigInt(`0x${nonceHash.toString("hex")}`) % GROUP_N;
  if (!k0) throw new Error("Test nonce unexpectedly reduced to zero.");
  const noncePoint = pointForScalar(k0);
  const k = noncePoint.even ? k0 : GROUP_N - k0;
  const challengeHash = taggedHash("BIP0340/challenge", Buffer.concat([noncePoint.x, publicPoint.x, message]));
  const challenge = BigInt(`0x${challengeHash.toString("hex")}`) % GROUP_N;
  const s = (k + challenge * d) % GROUP_N;
  return {
    pubkey: publicPoint.x.toString("hex"),
    signature: Buffer.concat([noncePoint.x, scalarBytes(s)]).toString("hex"),
  };
}

function signedNostrEvent(content, secret = 3n, overrides = {}) {
  const createdAt = 1_787_694_000;
  const unsigned = {
    pubkey: pointForScalar(secret).x.toString("hex"),
    created_at: createdAt,
    kind: 1,
    tags: [["t", "plotpickle-story-bridge"]],
    content,
    ...overrides,
  };
  const id = createHash("sha256").update(Buffer.from(JSON.stringify([
    0,
    unsigned.pubkey,
    unsigned.created_at,
    unsigned.kind,
    unsigned.tags,
    unsigned.content,
  ]), "utf8")).digest();
  const signed = signBip340(id, secret);
  return { ...unsigned, id: id.toString("hex"), sig: signed.signature };
}

function request(overrides = {}) {
  return createStoryBridgeRequest({
    projectId: "afterglow-working-copy",
    projectRoomPrefix: "afterglow-afterglow",
    workItemId: "story-work:motivation",
    runId: "run-afterglow-1",
    baseRevision: "9",
    targetRefs: ["ppf:foundations:motivation", "ppf:foundations:proposal-container"],
    dependencyRefs: ["ppf:foundations:premise"],
    evidenceRefs: ["afterglow-v9:scene-12"],
    agentProfileId: "tamsin-hearthquill",
    agentActorId: "tamsin-hearthquill",
    expectedAgentPubkey: pointForScalar(3n).x.toString("hex"),
    localEquivalentAllowed: true,
    destination: {
      privacyClass: "private-project",
      roomId: "story",
      roomName: "afterglow-afterglow-story",
    },
    contextItems: [{
      id: "story-workflow:ppf:motivation",
      sourceType: "ppf-canon",
      sourceId: "afterglow-working-copy",
      allowedUse: "canon",
      content: "Only the exact bounded story evidence needed for this work item.",
    }],
    createdAt: "2026-08-25T21:30:00.000Z",
    ...overrides,
  });
}

function resultEnvelope(bridge, overrides = {}) {
  const payload = {
    version: 1,
    contributionId: "contribution-1",
    requestId: bridge.requestId,
    projectId: bridge.projectId,
    workItemId: bridge.workItemId,
    runId: bridge.runId,
    baseRevision: bridge.baseRevision,
    agentProfileId: bridge.agentProfileId,
    agentActorId: bridge.agentActorId,
    result: {
      resultId: "story-result:motivation",
      workItemId: bridge.workItemId,
      kind: "proposal",
      targetRefs: ["ppf:foundations:motivation"],
      evidenceRefs: ["afterglow-v9:scene-12"],
      curriculumRequirementId: "foundations:motivation",
      principleRef: "curriculum:foundations:motivation",
      severity: "medium",
      confidence: 0.84,
      changesCanon: true,
      explanation: "The source evidence supports a stronger causal statement, but it remains a proposal.",
      proposal: "Clarify the protagonist's protective motive without changing accepted canon automatically.",
      alternatives: [],
      affectedDownstreamRefs: ["ppf:structure:sequence-2"],
    },
    ...overrides,
  };
  return `${STORY_BRIDGE_RESULT_MARKER}\n${JSON.stringify(payload)}`;
}

test("#1422 verifies signed Nostr event identity locally and rejects tampered content", () => {
  const event = signedNostrEvent("bounded story contribution", 3n);
  assert.equal(canonicalNostrEventId(event), event.id);
  const verified = verifyNostrEventSignature(event);
  assert.equal(verified.valid, true);
  assert.equal(verified.pubkey, event.pubkey);
  assert.match(verified.reason, /provenance only/i);

  const tampered = { ...event, content: "different content after signing" };
  assert.equal(verifyNostrEventSignature(tampered).valid, false);
});

test("#1422 creates stable private project bridge requests and degrades locally until official Agent signers exist", () => {
  const first = request();
  const second = request();
  assert.equal(first.requestId, second.requestId);
  assert.equal(first.state, "ready");
  assert.equal(first.destination.privacyClass, "private-project");
  assert.ok(first.destination.roomName.startsWith(`${first.projectRoomPrefix}-`));

  const localOnly = request({ expectedAgentPubkey: "" });
  assert.equal(localOnly.state, "degraded-local");
  assert.match(localOnly.stateReason, /local equivalent/i);

  assert.throws(() => request({
    destination: { privacyClass: "public-great-hall", roomId: "story", roomName: "afterglow-afterglow-story" },
  }), /private project Story Room/i);
});

test("#1422 accepts only the exact signed approved Agent envelope and rejects Human or mismatched signer confusion", () => {
  const bridge = request();
  const envelope = resultEnvelope(bridge);
  const event = signedNostrEvent(envelope, 3n);
  const accepted = normalizeStoryBridgeContribution({ request: bridge, envelope, rawEvent: event, currentRevision: "9" });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.state, "accepted");
  assert.equal(accepted.provenance.signatureVerified, true);
  assert.equal(accepted.provenance.pubkey, bridge.expectedAgentPubkey);
  assert.equal(accepted.result?.humanGate, "proposal-review");

  const humanSigned = signedNostrEvent(envelope, 5n);
  const wrongSigner = normalizeStoryBridgeContribution({ request: bridge, envelope, rawEvent: humanSigned, currentRevision: "9" });
  assert.equal(wrongSigner.accepted, false);
  assert.equal(wrongSigner.state, "rejected");
  assert.match(wrongSigner.reason, /different identity/i);

  const differentEnvelope = resultEnvelope(bridge, { contributionId: "tampered-envelope" });
  const detached = normalizeStoryBridgeContribution({ request: bridge, envelope: differentEnvelope, rawEvent: event, currentRevision: "9" });
  assert.equal(detached.accepted, false);
  assert.match(detached.reason, /exact content authenticated/i);
});

test("#1422 preserves late signed contributions as stale instead of silently superseding newer PPF state", () => {
  const bridge = request();
  const envelope = resultEnvelope(bridge);
  const stale = normalizeStoryBridgeContribution({
    request: bridge,
    envelope,
    rawEvent: signedNostrEvent(envelope, 3n),
    currentRevision: "10",
  });
  assert.equal(stale.accepted, false);
  assert.equal(stale.state, "stale");
  assert.ok(stale.result, "stale structured evidence is preserved for provenance/history");
});

test("#1422 rejects structured results that escape the original Story Work Item target boundary", () => {
  const bridge = request();
  const envelope = resultEnvelope(bridge, {
    result: {
      workItemId: bridge.workItemId,
      kind: "proposal",
      targetRefs: ["ppf:unrelated:secret-target"],
      evidenceRefs: [],
      explanation: "Attempted target escape.",
      changesCanon: true,
    },
  });
  const contribution = normalizeStoryBridgeContribution({
    request: bridge,
    envelope,
    rawEvent: signedNostrEvent(envelope, 3n),
    currentRevision: "9",
  });
  assert.equal(contribution.accepted, false);
  assert.match(contribution.reason, /target boundary/i);
});

test("#1422 deduplicates reconnect/retry contributions and creates only bounded affected-context updates", () => {
  const bridge = request();
  const envelope = resultEnvelope(bridge);
  const contribution = normalizeStoryBridgeContribution({ request: bridge, envelope, rawEvent: signedNostrEvent(envelope, 3n), currentRevision: "9" });
  assert.deepEqual(dedupeStoryBridgeContributions([contribution, contribution]).map((item) => item.contributionId), ["contribution-1"]);

  assert.equal(createAffectedStoryBridgeUpdate(bridge, { baseRevision: "10", changedRefs: ["ppf:unrelated:visual"] }), null);
  const update = createAffectedStoryBridgeUpdate(bridge, {
    baseRevision: "10",
    changedRefs: ["ppf:foundations:premise"],
    acceptedDecisionId: "decision-42",
    priorFindingIds: ["story-result:motivation"],
  });
  assert.deepEqual(update?.changedRefs, ["ppf:foundations:premise"]);
  assert.equal(update?.workItemId, bridge.workItemId);
  assert.equal(update?.baseRevision, "10");
});

test("#1422 reuses Agent, Context, Responsibility Run and BUZZ room boundaries without creating a chat-to-canon path", async () => {
  const [adapter, gateway, profiles, publicProfiles, storyRoom, connectorPolicy] = await Promise.all([
    read("modules/story-workflow/buzz-story-bridge.ts"),
    read("build/story-workflow-buzz-bridge-gateway.ts"),
    read("lib/agents/agent-profiles.ts"),
    read("config/agent-profile-extensions/public.json"),
    read("lib/buzz/buzz-story-room.ts"),
    read("lib/agents/responsibility/connector-trust-policy.ts"),
  ]);

  for (const contract of [
    "agentProfileById",
    "officialAgentPublicIdentity",
    "agentExecutionContexts",
    "inboundExternalContext",
    "redactConnectorPayload",
    "buzzProjectSlug",
    "buzzRoomName",
    'privacyClass: "private-project"',
  ]) assert.ok(adapter.includes(contract), `Story Bridge adapter is missing reuse-first boundary: ${contract}`);

  for (const contract of [
    "/api/local-buzz/rooms/ensure",
    "/api/local-buzz/messages",
    "degraded-local",
    "no paid-cloud fallback",
    "connected Human signer authored only the task dispatch",
    "STORY_BRIDGE_RESULT_MARKER",
    "normalizeStoryBridgeContribution",
  ]) assert.ok(gateway.includes(contract), `Story Bridge gateway is missing: ${contract}`);

  assert.match(profiles, /officialAgentPublicIdentity/);
  assert.match(publicProfiles, /"tamsin-hearthquill"[\s\S]*?"pubkey": null/,
    "distributed PlotPickle must not fabricate an official Agent signer just to make BUZZ available");
  assert.match(storyRoom, /visibility\", \"private|BUZZ_STORY_ROOMS|buzzRoomName/);
  assert.match(connectorPolicy, /BUZZ signatures prove provenance|Signature verified: provenance is known/i);

  for (const source of [adapter, gateway]) {
    assert.doesNotMatch(source, /saveActiveLibraryProject|foundations\.proposal\.accept|ppf-direct-write|canon-write/i,
      "Story Bridge transport must not gain a direct canon mutation path");
    assert.doesNotMatch(source, /LangGraph|Hermes|provider:\s*["'](?:openai|minimax|anthropic)/i,
      "Story Bridge must not add another orchestration framework or paid-cloud fallback");
  }
});
