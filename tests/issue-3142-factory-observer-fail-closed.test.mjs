import test from "node:test";
import assert from "node:assert/strict";
import { summarizeFactoryObserver } from "../scripts/engineering-team/mcp/factory-observer.mjs";

// This regression verifies observation only; it does not prove owned process
// identity, live model invocation, Windows acceptance or merge eligibility.
test("#3142 Factory observer fails closed for STOP and unknown heartbeat states", () => {
  const liveStates = [
    "IDLE", "RUNNING", "BLOCKED", "PR_OPEN", "MERGED",
    "WAITING_FOR_PROVIDER", "WAITING_FOR_DEPENDENCIES",
    "WAITING_FOR_PRODUCT_UAT", "WAITING_FOR_PR_VERIFICATION",
    "WAITING_FOR_ELIGIBLE_ISSUE", "WAITING_FOR_EXACT_CLEAN_MAIN",
    "WAITING_FOR_RETRY_HEAD_OR_REVIEW",
  ];
  for (const state of liveStates) {
    const snapshot = summarizeFactoryObserver({
      status: { state, heartbeatFresh: true, enabled: true }, now: 1000,
    });
    assert.equal(snapshot.factory.online, true, state);
    assert.equal(snapshot.factory.processOwnershipVerified, false, state);
  }
  for (const state of [
    "OFF", "OFFLINE", "UNKNOWN", "STOP_REQUESTED", "STOPPED",
    "PAUSED", "PAUSE_REQUESTED", "RESUME_REQUESTED",
    "RUNNING;execute", "", "NEW_UNRECOGNIZED_STATE",
  ]) {
    const snapshot = summarizeFactoryObserver({
      status: { state, heartbeatFresh: true, enabled: true }, now: 1000,
    });
    assert.equal(snapshot.factory.online, false, state);
    assert.equal(snapshot.factory.processOwnershipVerified, false, state);
  }
  // A stale RUNNING heartbeat must never override explicit owner disablement.
  // Missing enabled is also unverified and therefore offline.
  for (const state of liveStates) {
    for (const enabled of [false, undefined]) {
      const snapshot = summarizeFactoryObserver({
        status: { state, heartbeatFresh: true, enabled }, now: 1000,
      });
      assert.equal(snapshot.factory.online, false, `${state}: enabled=${enabled}`);
      assert.equal(snapshot.factory.processOwnershipVerified, false);
    }
  }
  // An intentional STOP/PAUSE is not an abnormal stale-heartbeat outage.
  for (const state of ["STOP_REQUESTED", "STOPPED", "PAUSED", "PAUSE_REQUESTED"]) {
    const snapshot = summarizeFactoryObserver({
      status: { state, heartbeatFresh: false, enabled: true }, now: 1000,
    });
    assert.equal(snapshot.factory.online, false, state);
    assert.equal(snapshot.factory.stalled, false, state);
  }
  // A stale unknown or OFFLINE state is not an authenticated intentional STOP.
  for (const state of [...liveStates, "OFFLINE", "UNRECOGNIZED"]) {
    const snapshot = summarizeFactoryObserver({
      status: { state, heartbeatFresh: false, enabled: true }, now: 1000,
    });
    assert.equal(snapshot.factory.online, false, state);
    assert.equal(snapshot.factory.stalled, true, state);
  }
});
