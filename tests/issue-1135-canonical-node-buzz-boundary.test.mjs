import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  activateLocalHumanProfile,
  createLocalHumanProfileRegistry,
  lockActiveHumanProfile,
  registerLocalHumanProfile,
  switchLocalHumanProfile,
} from "../core/identity/local-human-profile-core.mjs";

const root = path.resolve(import.meta.dirname, "..");
const cleanup = Object.freeze({ projectClosed: true, vaultReleased: true, agentContextCleared: true, retrievalContextCleared: true, privateUiCleared: true, buzzSessionDetached: true, credentialsCleared: true, priorSessionInvalidated: true });

test("one Node can host isolated Human profiles without turning a profile into a Node", () => {
  let registry = createLocalHumanProfileRegistry("node-household-pc");
  registry = registerLocalHumanProfile(registry, { profileId: "profile-bryan", personId: "person-bryan", displayName: "Bryan", vaultRef: "vault-bryan", buzzSignerRef: "signer-bryan", settingsRef: "settings-bryan", guest: false, createdAt: "2026-08-20T07:00:00.000Z" });
  registry = registerLocalHumanProfile(registry, { profileId: "profile-alex", personId: "person-alex", displayName: "Alex", vaultRef: "vault-alex", buzzSignerRef: "signer-alex", settingsRef: "settings-alex", guest: false, createdAt: "2026-08-20T07:01:00.000Z" });
  registry = registerLocalHumanProfile(registry, { profileId: "profile-guest", displayName: "Guest", vaultRef: "vault-guest", guest: true, createdAt: "2026-08-20T07:02:00.000Z" });
  assert.equal(registry.nodeId, "node-household-pc");
  assert.equal(Object.keys(registry.profiles).length, 3);
  assert.equal(registry.profiles["profile-bryan"].personId, "person-bryan");
  assert.equal(registry.profiles["profile-alex"].personId, "person-alex");
  assert.equal(registry.profiles["profile-guest"].personId, null);
});

test("profile metadata rejects private workspace contents and unlock secrets", () => {
  const registry = createLocalHumanProfileRegistry("node-household-pc");
  const base = { profileId: "profile-bryan", personId: "person-bryan", displayName: "Bryan", vaultRef: "vault-bryan", guest: false, createdAt: "2026-08-20T07:00:00.000Z" };
  assert.throws(() => registerLocalHumanProfile(registry, { ...base, ppf: { title: "Private story" } }), /outside the allowlist: ppf/i);
  assert.throws(() => registerLocalHumanProfile(registry, { ...base, privateKey: "secret" }), /outside the allowlist: privateKey/i);
  assert.throws(() => registerLocalHumanProfile(registry, { ...base, pin: "1234" }), /outside the allowlist: pin/i);
});

test("switching Humans requires complete cleanup evidence and a separately verified unlock", () => {
  let registry = createLocalHumanProfileRegistry("node-household-pc");
  registry = registerLocalHumanProfile(registry, { profileId: "profile-bryan", personId: "person-bryan", displayName: "Bryan", vaultRef: "vault-bryan", guest: false, createdAt: "2026-08-20T07:00:00.000Z" });
  registry = registerLocalHumanProfile(registry, { profileId: "profile-alex", personId: "person-alex", displayName: "Alex", vaultRef: "vault-alex", guest: false, createdAt: "2026-08-20T07:01:00.000Z" });
  registry = activateLocalHumanProfile(registry, "profile-bryan", { method: "os", verified: true });
  assert.equal(registry.activeProfileId, "profile-bryan");
  assert.throws(() => switchLocalHumanProfile(registry, "profile-alex", { ...cleanup, agentContextCleared: false }, { method: "pin", verified: true }), /agentContextCleared/i);
  assert.throws(() => switchLocalHumanProfile(registry, "profile-alex", cleanup, { method: "pin", verified: false }), /must be verified/i);
  registry = switchLocalHumanProfile(registry, "profile-alex", cleanup, { method: "pin", verified: true });
  assert.equal(registry.activeProfileId, "profile-alex");
  assert.equal(registry.sessionEpoch, 2);
  registry = lockActiveHumanProfile(registry, cleanup);
  assert.equal(registry.activeProfileId, null);
  assert.equal(registry.sessionEpoch, 3);
});

test("canonical architecture distinguishes Communities/people discovery from Node provenance and resources", () => {
  const architecture = fs.readFileSync(path.join(root, "docs", "architecture", "PLOTPICKLE-NODE-TOPOLOGY.md"), "utf8");
  const cloud = fs.readFileSync(path.join(root, "docs", "architecture", "TRUSTED-REMOTE-COMPUTE.md"), "utf8");
  assert.match(architecture, /BUZZ Communities and people/i);
  assert.match(architecture, /Node identity.*provenance/i);
  assert.match(architecture, /Community presence is never compute eligibility/i);
  assert.match(architecture, /multiple Human profiles/i);
  assert.match(cloud, /managed cloud/i);
  assert.match(cloud, /not another Community member/i);
});
