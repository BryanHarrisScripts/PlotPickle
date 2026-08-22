import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runProfileIsolationLiveCase } from "../scripts/creative-uat/casebook-profile-isolation-live.mjs";
import {
  createPhase3b3StepDrivers,
  finalizePhase3b3Proof,
  verifyGreatHallEvidence,
} from "../scripts/creative-uat/casebook-phase3b3-live.mjs";
import { loadCasebook } from "../scripts/casebook-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function event(id = "event-1", overrides = {}) {
  return {
    id,
    content: "PlotPickle Casebook marker-1",
    author: "Casebook Human",
    createdAt: "2026-08-22T00:00:00.000Z",
    raw: { pubkey: "pubkey-casebook-human", ...overrides },
  };
}

test("#1236 Phase 3B3 profile isolation performs real encrypted two-Human boundary checks and deliberate cross-profile faults", async () => {
  const result = await runProfileIsolationLiveCase();
  assert.equal(result.caseId, "profile-isolation");
  assert.equal(result.mode, "real-machine");
  assert.equal(result.profileCount, 2);
  assert.equal(result.independentVerification.status, "verified");
  assert.equal(result.independentVerification.source, "profile-boundary-observer");
  assert.equal(result.observations.every((item) => item.status === "verified"), true);
  assert.ok(result.faults.length >= 2);
  assert.equal(result.faults.every((item) => ["blocked", "fail"].includes(item.outcome)), true);
  assert.equal(result.rootRetained, "");
});

test("#1236 Great Hall verifier requires one stable event id and rejects duplicates or signer mismatch", () => {
  const marker = "PlotPickle Casebook marker-1";
  const original = event();
  const pass = verifyGreatHallEvidence({
    marker,
    initialMessages: [original],
    reloadMessages: [structuredClone(original)],
    humanIdentity: { pubkey: "pubkey-casebook-human" },
  });
  assert.equal(pass.status, "verified");
  assert.equal(pass.source, "buzz-event-observer");
  assert.equal(pass.metadata.eventId, "event-1");
  assert.equal(pass.metadata.signerMatched, true);

  const duplicate = verifyGreatHallEvidence({
    marker,
    initialMessages: [original, structuredClone(original)],
    reloadMessages: [original],
    humanIdentity: { pubkey: "pubkey-casebook-human" },
  });
  assert.equal(duplicate.status, "contradicted");
  assert.match(duplicate.summary, /exactly one/i);

  const wrongSigner = verifyGreatHallEvidence({
    marker,
    initialMessages: [event("event-1", { pubkey: "wrong-pubkey" })],
    reloadMessages: [event("event-1", { pubkey: "wrong-pubkey" })],
    humanIdentity: { pubkey: "pubkey-casebook-human" },
  });
  assert.equal(wrongSigner.status, "contradicted");
  assert.match(wrongSigner.summary, /signer/i);
});

test("#1236 Phase 3B3 exposes complete profile and BUZZ attended step drivers", () => {
  const browser = {
    clickVisible: async () => false,
    fillByLabel: async () => ({ ok: false, method: "test" }),
    navigate: async () => {},
  };
  const client = { call: async () => ({ content: [{ type: "text", text: '{"ok":false}' }] }) };
  const drivers = createPhase3b3StepDrivers({ browser, client, runState: {} });
  for (const key of [
    "profile-isolation:unlock-a",
    "profile-isolation:create-private-a",
    "profile-isolation:switch-b",
    "profile-isolation:deny-cross-profile",
    "profile-isolation:restart-and-recheck",
    "buzz-connect-existing-identity:verify-signer",
    "buzz-connect-existing-identity:persist-connected",
    "buzz-connect-existing-identity:open-community",
    "buzz-great-hall-signed-conversation:open-great-hall",
    "buzz-great-hall-signed-conversation:send-message",
    "buzz-great-hall-signed-conversation:observe-signed-event",
    "buzz-great-hall-signed-conversation:read-back",
    "buzz-great-hall-signed-conversation:reload-and-confirm",
  ]) assert.equal(typeof drivers.get(key), "function", `missing Phase 3B3 driver ${key}`);
});

test("#1236 Phase 3B3 profile and BUZZ proofs use the Casebook-declared independent verifier sources", async () => {
  const casebook = await loadCasebook();
  const profile = casebook.cases.find((item) => item.id === "profile-isolation");
  const profileRun = await runProfileIsolationLiveCase();
  const profileProof = await finalizePhase3b3Proof({ caseDefinition: profile, runState: { profileIsolation: profileRun } });
  assert.equal(profileProof.status, "verified");
  assert.equal(profileProof.source, profile.independentVerification.source);

  const buzz = casebook.cases.find((item) => item.id === "buzz-connect-existing-identity");
  const buzzProof = await finalizePhase3b3Proof({
    caseDefinition: buzz,
    runState: {
      buzzIdentity: {
        connected: { identityVerified: true, humanCommunityAllowed: true, pubkey: "pubkey-a" },
        persisted: { pubkey: "pubkey-a" },
        communityOpened: true,
      },
    },
  });
  assert.equal(buzzProof.status, "verified");
  assert.equal(buzzProof.source, buzz.independentVerification.source);
});

test("#1236 attended runner now executes B3 proof and faults instead of leaving a blanket pending-fault blocker", async () => {
  const source = await readFile(path.join(repoRoot, "scripts", "run-casebook-attended.mjs"), "utf8");
  assert.match(source, /createPhase3b3StepDrivers/);
  assert.match(source, /finalizePhase3b3Proof/);
  assert.match(source, /runPhase3b3Faults/);
  assert.match(source, /record\.faults = await runPhase3b3Faults/);
  assert.match(source, /detectedFaults/);
  assert.doesNotMatch(source, /Deliberate real-machine fault injection is still required before this attended record can become green/);
  assert.match(source, /A case remains non-green if any critical step, independent proof or fault detector is missing/);
});
