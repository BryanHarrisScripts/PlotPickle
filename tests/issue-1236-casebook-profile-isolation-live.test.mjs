import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runProfileIsolationLiveCase } from "../scripts/casebook/profile-isolation-live.mjs";

test("#1236 profile Case exercises two Humans, private storage, deliberate cross-profile faults, and restart on one test Node", async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "plotpickle-casebook-profile-test-"));
  const root = path.join(parent, "isolated-node");
  try {
    const result = await runProfileIsolationLiveCase({ root, keepArtifacts: false });
    assert.equal(result.caseId, "profile-isolation");
    assert.equal(result.mode, "real-machine");
    assert.equal(result.profileCount, 2);
    assert.equal(result.independentVerification.source, "profile-boundary-observer");
    assert.equal(result.independentVerification.independent, true);
    assert.equal(result.independentVerification.status, "verified");
    assert.equal(result.observations.every((item) => item.status === "verified"), true);
    assert.deepEqual(result.faults.map((item) => [item.id, item.injected, item.outcome]), [
      ["attempt-cross-profile-project-read", true, "blocked"],
      ["attempt-cross-profile-project-export", true, "blocked"],
    ]);
    assert.deepEqual(await readdir(parent), []);
    assert.doesNotMatch(JSON.stringify(result), /casebook-a-[A-Za-z0-9_-]+|casebook-b-[A-Za-z0-9_-]+/);
    assert.doesNotMatch(JSON.stringify(result), /A-only synthetic retrieval memory|A-only synthetic retrieval chunk/);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
