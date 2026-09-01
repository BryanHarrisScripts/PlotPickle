import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createExactHeadArchitectureSnapshot,
  evaluateArchitectureSnapshotFreshness,
} from "../build/autonomous-guest/maintainer/architecture-learner.mjs";
import { runRepositoryArchitectureInventory } from "../scripts/repository-architecture-inventory.mjs";

const HEAD = "a".repeat(40);
const NEXT_HEAD = "b".repeat(40);
const authority = Object.freeze({
  authorityClass: "delegated-guest-autonomous-operator",
  delegated: true,
  humanProfileId: "",
  accessMode: "desktop-loopback",
  autonomousRunId: "run-1592-slice-b",
  workspaceId: "repository-main",
  operatorId: "architecture-learner",
});

test("#1592 Slice B produces one bounded exact-head architecture ownership snapshot", async () => {
  const inventory = await runRepositoryArchitectureInventory({ writeArtifact: false });
  const snapshot = createExactHeadArchitectureSnapshot({ authority, exactCommitSha: HEAD, inventory });
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.exactCommitSha, HEAD);
  assert.equal(snapshot.state, "verified");
  assert.equal(snapshot.inventoryStatus, "ratified-plan-ready");
  assert.deepEqual(snapshot.domains.map((item) => item.domain).sort(), Object.keys(inventory.domains).sort());
  assert.ok(snapshot.domains.every((item) => item.ownershipPaths.length >= 1 && item.ownershipPaths.length <= 16));
  assert.ok(snapshot.domains.every((item) => item.sourceRefs.includes("config/repository-architecture-target.json")));
  assert.ok(snapshot.domains.every((item) => item.changedPathInvalidationInputs.includes("scripts/repository-architecture-inventory.mjs")));
});

test("#1592 Slice B rejects non-Guest authority and invalid architecture inventory", async () => {
  const inventory = await runRepositoryArchitectureInventory({ writeArtifact: false });
  assert.throws(
    () => createExactHeadArchitectureSnapshot({ authority: { ...authority, humanProfileId: "human-1" }, exactCommitSha: HEAD, inventory }),
    /delegated non-Human desktop-loopback Guest authority/,
  );
  assert.throws(
    () => createExactHeadArchitectureSnapshot({ authority, exactCommitSha: HEAD, inventory: { ...inventory, status: "invalid-plan", planIssues: ["broken"] } }),
    /valid deterministic repository inventory/,
  );
  assert.throws(
    () => createExactHeadArchitectureSnapshot({ authority, exactCommitSha: "main", inventory }),
    /exact head commit SHA/,
  );
});

test("#1592 Slice B fails closed on a new commit and identifies changed ownership domains", async () => {
  const inventory = await runRepositoryArchitectureInventory({ writeArtifact: false });
  const snapshot = createExactHeadArchitectureSnapshot({ authority, exactCommitSha: HEAD, inventory });
  const current = evaluateArchitectureSnapshotFreshness(snapshot, { currentCommitSha: HEAD, changedPaths: [] });
  assert.equal(current.state, "verified");
  assert.equal(current.requiresHarnessReverification, false);

  const storyChange = evaluateArchitectureSnapshotFreshness(snapshot, {
    currentCommitSha: NEXT_HEAD,
    changedPaths: ["core/story-workflow/workbench/core.mjs"],
  });
  assert.equal(storyChange.state, "stale");
  assert.equal(storyChange.requiresHarnessReverification, true);
  assert.ok(storyChange.affectedDomains.includes("story"));
  assert.equal(storyChange.operationalAuthorityGranted, false);

  const unknownChange = evaluateArchitectureSnapshotFreshness(snapshot, { currentCommitSha: NEXT_HEAD, changedPaths: [] });
  assert.deepEqual([...unknownChange.affectedDomains].sort(), snapshot.domains.map((item) => item.domain).sort());
});

test("#1592 Slice B remains read-only and cannot admit or operationalize learned knowledge", async () => {
  const inventory = await runRepositoryArchitectureInventory({ writeArtifact: false });
  const snapshot = createExactHeadArchitectureSnapshot({ authority, exactCommitSha: HEAD, inventory });
  for (const boundary of [
    "durableAdmissionAllowed",
    "sourceMutationAllowed",
    "skillInstallationAllowed",
    "skillActivationAllowed",
    "operationalAuthorityGranted",
    "aiSelfCertified",
  ]) assert.equal(snapshot[boundary], false, `${boundary} must remain false`);
  assert.equal(snapshot.harnessApprovalRef, "");
});

test("#1592 Slice B CLI binds evidence to a clean real Git head", async () => {
  const source = await readFile(new URL("../scripts/autonomous-qa/run-maintainer-architecture-learner.mjs", import.meta.url), "utf8");
  assert.match(source, /git.*rev-parse.*HEAD/s);
  assert.match(source, /git.*status.*--porcelain.*--untracked-files=all/s);
  assert.match(source, /requires a clean exact-head repository checkout/);
  assert.match(source, /expected .* but repository HEAD is/);
  assert.match(source, /maintainer-snapshot\.json/);
});
