import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import { libraryUnloadRequiresSessionRecovery, assertLibraryUnloadRetryIdentity } from "../modules/library/model/library-unload-session-truth.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#2960 identifies session/auth failure without equating ordinary storage errors with logon expiry", () => {
  for (const text of [
    "The authentication request could not be completed",
    "The session could not be verified for the working profile",
    "Unlock your Human profile",
    "HTTP 403",
    "CSRF token expired",
  ]) assert.equal(libraryUnloadRequiresSessionRecovery(new Error(text)), true);
  for (const text of ["Disk full", "Snapshot digest mismatch", "Unrelated media files are missing"]) {
    assert.equal(libraryUnloadRequiresSessionRecovery(new Error(text)), false);
  }
});

test("#2960 a recovered session cannot retry on a switched story or profile", () => {
  assert.equal(assertLibraryUnloadRetryIdentity("profile-1", "story-1", "profile-1", "story-1"), true);
  for (const [profile, story] of [["profile-2", "story-1"], ["profile-1", "story-2"], ["profile-1", null]]) {
    assert.throws(() => assertLibraryUnloadRetryIdentity("profile-1", "story-1", profile, story), /profile or story changed/);
  }
});

// Execute the actual Library handler in a controlled browser/store fixture. No
// assertion treats the fixture as real profile storage or a Windows observation.
const functionSource = async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const start = source.indexOf("  async function unloadCurrentStory() {");
  const end = source.indexOf("  async function createNewStory()", start);
  assert.ok(start > 0 && end > start, "the current Library handler is executable");
  return source.slice(start, end);
};

async function scenario({ sessionFailure = false, saveFailureAt = 0, saveError = "" } = {}) {
  const calls = [], result = { notice: "", recovery: null, busy: false, selected: "story-1", profile: "profile-1" };
  let saveCount = 0;
  const context = {
    Error,
    unloadingStory: false,
    activeProject: { id: "story-1" },
    currentProfileId: () => result.profile,
    sessionActiveProjectId: () => result.selected,
    assertLibraryUnloadRetryIdentity,
    libraryUnloadRequiresSessionRecovery,
    setUnloadingStory: value => { result.busy = value; calls.push("busy:" + value); },
    setUnloadRecovery: value => { result.recovery = value; },
    setNotice: value => { result.notice = value; },
    refreshProfilePrivateBrowserSession: async profileId => {
      calls.push("verify:" + profileId);
      if (sessionFailure) throw new Error("The authentication request could not be completed");
    },
    loadLibraryProjectSnapshot: id => { calls.push("snapshot:" + id); return { id, title: "Synthetic story" }; },
    createProfileRecoveryPoint: async () => { calls.push("recovery-point"); },
    persistActiveProfileProject: async () => {
      calls.push("persist:" + result.selected);
      saveCount++;
      if (saveCount === saveFailureAt) throw new Error(saveError || "The authentication request could not be completed");
    },
    flushProfilePrivateWrites: async () => { calls.push("flush"); },
    unloadActiveLibraryProject: () => {
      calls.push("detach");
      result.selected = null;
      return "story-1";
    },
    switchActiveLibraryProject: id => { calls.push("rollback:" + id); result.selected = id; },
    returnToMatrixDashboardFromLibrary: () => { calls.push("dashboard"); return true; },
    window: { location: { assign: () => calls.push("navigate") } },
  };
  const unload = vm.runInNewContext((await functionSource()) + "\nunloadCurrentStory", context);
  await unload();
  return { calls, result };
}

test("#2960 expired auth stops before any recovery-point, save, detach or navigation", async () => {
  const { calls, result } = await scenario({ sessionFailure: true });
  assert.deepEqual(calls.filter(x => !x.startsWith("busy:")), ["verify:profile-1"]);
  assert.equal(result.selected, "story-1");
  assert.equal(result.recovery.stage, "verify");
  assert.match(result.notice, /not completed/);
  assert.match(result.notice, /working story is still selected/);
  assert.equal(result.busy, false);
});

test("#2960 successful same-profile Unload retains ordered durable writes before navigation", async () => {
  const { calls, result } = await scenario();
  const order = ["verify:profile-1","snapshot:story-1","recovery-point","persist:story-1","flush","detach","persist:null","flush","dashboard"];
  assert.deepEqual(calls.filter(x => !x.startsWith("busy:")), order);
  assert.equal(result.selected, null);
  assert.equal(result.recovery, null);
  assert.equal(result.notice, "");
});

test("#2960 auth failure before detaching keeps the same project and exposes recovery", async () => {
  const { calls, result } = await scenario({ saveFailureAt: 1 });
  assert.ok(calls.includes("persist:story-1"));
  assert.ok(!calls.includes("detach"));
  assert.equal(result.selected, "story-1");
  assert.equal(result.recovery.stage, "verify");
  assert.ok(!calls.includes("dashboard"));
});

test("#2960 failed post-detach persistence rolls back selection rather than claiming Unload", async () => {
  const { calls, result } = await scenario({ saveFailureAt: 2 });
  assert.ok(calls.includes("detach"));
  assert.ok(calls.includes("rollback:story-1"));
  assert.equal(result.selected, "story-1");
  assert.equal(result.recovery.stage, "verify");
  assert.ok(!calls.includes("dashboard"));
  assert.ok(!calls.includes("navigate"));
});

test("#2960 ordinary storage failures preserve project but do not fabricate session expiry", async () => {
  const { calls, result } = await scenario({ saveFailureAt: 1, saveError: "Disk full" });
  assert.equal(result.selected, "story-1");
  assert.equal(result.recovery, null);
  assert.equal(result.notice, "Disk full");
  assert.ok(!calls.includes("detach"));
});

test("#2960 in-place unlock is explicit, same-profile, and never triggers automatic Unload", async () => {
  const [library, panel, storage, contract] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("app/_components/settings/profile-session-panel.tsx"),
    read("core/storage/profile-private-browser.ts"),
    read("docs/behavioral-contracts/PP-SAVE-001.md"),
  ]);
  assert.match(library, /data-library-unload-recovery=\{unloadRecovery\.stage\}/);
  assert.match(library, /<ProfileSessionPanel verifiedActionLabel="Library Unload"/);
  assert.match(library, /assertLibraryUnloadRetryIdentity\(unloadRecovery\.profileId, unloadRecovery\.projectId/);
  assert.match(library, /setUnloadRecovery\(\{ \.\.\.unloadRecovery, stage: "retry" \}\)/);
  assert.match(library, />Retry Unload<\/button>/);
  assert.match(panel, /refreshProfilePrivateBrowserSession\(profileId\)/);
  assert.match(panel, /next\.profile\.profileId !== profileId/);
  assert.match(panel, /Profile passphrase/);
  assert.doesNotMatch(library.slice(library.indexOf("async function unloadCurrentStory()"), library.indexOf("async function createNewStory()")), /stageSessionActiveProjectHandoff|logout|lock|switch-profile/);
  assert.match(storage, /The session could not be verified for the working profile/);
  assert.match(contract, /Unsafe in-app Unload\/Logout\/profile switch is blocked/);
});
