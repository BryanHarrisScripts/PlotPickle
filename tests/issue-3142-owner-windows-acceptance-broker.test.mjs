import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ownerWindowsAcceptanceAction, readOwnerAcceptanceReceipt } from
  "../scripts/engineering-team/windows/acceptance/owner-windows-acceptance.mjs";

const MAIN = "a".repeat(40), HEAD = "b".repeat(40), ID = "c".repeat(32);
const allowed = {
  action: "stage", candidatePrNumber: 3311, candidateHead: HEAD,
  expectedHead: MAIN, requestId: ID,
  consent: "AUTHORIZE_OWNER_WINDOWS_CANDIDATE_STAGE",
};
const useRoot = async fn => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-owner-acceptance-"));
  try { return await fn(root); }
  finally { await rm(root, { recursive: true, force: true }); }
};
const fake = (root, stage) => ({
  root, repoRoot: path.join(root, "trusted-main"), platform: "win32",
  interactive: true, now: () => 1_800_000,
  source: async () => MAIN,
  supervisor: async () => ({ state: "RUNNING", exactSha: MAIN, checkedAt: 1_799_900 }),
  inspect: async () => ({ state: "TEST_PASSED", code: "CANDIDATE_HEAD_VERIFIED" }),
  stage,
});

test("status reports observations, never Windows acceptance or merge authority", () =>
  useRoot(async root => {
    const result = await ownerWindowsAcceptanceAction({ action: "status" }, {
      ...fake(root, async () => { throw Error("must not stage"); }),
      capacity: async () => ({ state: "READY", observedRetainedStages: 70 }),
      lock: async () => ({ state: "ABSENT" }),
    });
    assert.equal(result.state, "OBSERVED_NOT_ACCEPTED");
    assert.equal(result.supervisorState, "RUNNING");
    assert.equal(result.retainedStages, 70);
    assert.equal(result.stageLockState, "ABSENT");
    assert.equal(result.ownerWindowsAcceptance, false);
    assert.equal(result.independentVerification, false);
  }));

test("only interactive owner consent on Windows admits staging", () =>
  useRoot(async root => {
    let called = 0;
    const opts = fake(root, async () => { called++; });
    for (const denied of [
      { ...opts, interactive: false },
      { ...opts, platform: "linux" },
    ]) assert.equal((await ownerWindowsAcceptanceAction(allowed, denied)).code,
      "LOCAL_OPERATOR_CONSENT_REQUIRED");
    assert.equal((await ownerWindowsAcceptanceAction({ ...allowed, consent: "ALLOW" }, opts)).code,
      "LOCAL_OPERATOR_CONSENT_REQUIRED");
    assert.equal((await ownerWindowsAcceptanceAction({ ...allowed, requestId: "outside" }, opts)).code,
      "INVALID_STAGE_SELECTION");
    assert.equal(called, 0);
    assert.equal((await readOwnerAcceptanceReceipt({ root, requestId: ID })).state, "NO_REQUEST");
  }));

test("stale MAIN, supervisor STOP/PAUSE, old heartbeat or unverified PR deny admission", () =>
  useRoot(async root => {
    const noStage = async () => { throw Error("must never stage"); };
    const opts = fake(root, noStage);
    assert.equal((await ownerWindowsAcceptanceAction(allowed, { ...opts,
      source: async () => "d".repeat(40) })).code, "EXACT_CLEAN_MAIN_REQUIRED");
    for (const state of ["STOP_REQUESTED", "PAUSED", "PAUSE_REQUESTED", "OFFLINE"]) {
      assert.equal((await ownerWindowsAcceptanceAction(allowed, { ...opts,
        supervisor: async () => ({ state, exactSha: MAIN, checkedAt: 1_799_900 }) })).code,
        "SUPERVISOR_NOT_FRESH_RUNNING_ON_MAIN");
    }
    assert.equal((await ownerWindowsAcceptanceAction(allowed, { ...opts,
      supervisor: async () => ({ state: "RUNNING", exactSha: MAIN, checkedAt: 1_000_000 }) })).code,
      "SUPERVISOR_NOT_FRESH_RUNNING_ON_MAIN");
    assert.equal((await ownerWindowsAcceptanceAction(allowed, { ...opts,
      inspect: async () => ({ state: "BLOCKED", code: "CANDIDATE_HEAD_MISMATCH" }) })).code,
      "CANDIDATE_HEAD_MISMATCH");
    assert.equal((await readOwnerAcceptanceReceipt({ root, requestId: ID })).state, "NO_REQUEST");
  }));

test("one approved local staging operation writes a durable read-back, no execution or replay", () =>
  useRoot(async root => {
    let calls = 0;
    const stage = async args => {
      calls++;
      assert.equal(args.candidateHead, HEAD);
      assert.equal(args.expectedHead, MAIN);
      assert.equal(args.root, root);
      return { state: "TEST_PASSED", code: "CANDIDATE_STATIC_STAGED",
        sourceHead: MAIN, candidateHead: HEAD, candidatePrNumber: 3311,
        stageId: ID, changedFileCount: 5 };
    };
    const opts = fake(root, stage);
    const result = await ownerWindowsAcceptanceAction(allowed, opts);
    assert.equal(result.state, "STAGED_NOT_ACCEPTED");
    assert.equal(result.code, "CANDIDATE_STATIC_STAGED");
    assert.equal(result.ownerWindowsAcceptance, false);
    assert.equal(result.independentVerification, false);
    assert.equal(result.automaticMergeAuthorized, false);
    assert.equal((await readOwnerAcceptanceReceipt({ root, requestId: ID })).state, "STAGED_NOT_ACCEPTED");
    assert.equal((await ownerWindowsAcceptanceAction(allowed, opts)).code,
      "REQUEST_ALREADY_RESERVED_OR_UNVERIFIABLE");
    assert.equal(calls, 1);
    const reserved = JSON.parse(await readFile(path.join(root,
      "owner-windows-acceptance", "receipts", ID + ".reserved.json"), "utf8"));
    assert.equal(reserved.state, "RESERVED_NO_REPLAY");
  }));

test("typed staging failure is recorded without false acceptance or replay", () =>
  useRoot(async root => {
    let calls = 0;
    const opts = fake(root, async () => { calls++; return {
      state: "BLOCKED", code: "STAGE_ADMISSION_BUSY" };
    });
    const result = await ownerWindowsAcceptanceAction(allowed, opts);
    assert.equal(result.state, "BLOCKED");
    assert.equal(result.code, "STAGE_ADMISSION_BUSY");
    assert.equal((await readOwnerAcceptanceReceipt({ root, requestId: ID })).state, "BLOCKED");
    await ownerWindowsAcceptanceAction(allowed, opts);
    assert.equal(calls, 1);
  }));

test("damaged receipt and uncertain stage preserve no-replay evidence", () =>
  useRoot(async root => {
    const opts = fake(root, async () => { throw Error("UNCERTAIN_EXTERNAL_EFFECT"); });
    const result = await ownerWindowsAcceptanceAction(allowed, opts);
    assert.equal(result.state, "STARTED_UNCONFIRMED");
    assert.equal((await readOwnerAcceptanceReceipt({ root, requestId: ID })).state,
      "STARTED_UNCONFIRMED");
    assert.equal((await ownerWindowsAcceptanceAction(allowed, opts)).code,
      "REQUEST_ALREADY_RESERVED_OR_UNVERIFIABLE");
    const receiptPath = path.join(root, "owner-windows-acceptance", "receipts");
    await writeFile(path.join(receiptPath, ID + ".result.json"),
      JSON.stringify({ state: "STAGED_NOT_ACCEPTED", requestId: ID, expectedHead: MAIN,
        candidateHead: HEAD, candidatePrNumber: 3311, stageId: "e".repeat(32),
        code: "CANDIDATE_STATIC_STAGED", changedFileCount: 2 }) + "\n");
    assert.equal((await readOwnerAcceptanceReceipt({ root, requestId: ID })).state,
      "STARTED_UNCONFIRMED");
  }));

test("a STOP observed after reservation cannot run candidate staging", () =>
  useRoot(async root => {
    let observed = 0, staged = 0;
    const opts = fake(root, async () => { staged++; });
    opts.supervisor = async () => (++observed > 1)
      ? { state: "STOP_REQUESTED", exactSha: MAIN, checkedAt: 1_799_900 }
      : { state: "RUNNING", exactSha: MAIN, checkedAt: 1_799_900 };
    const result = await ownerWindowsAcceptanceAction(allowed, opts);
    assert.equal(result.state, "BLOCKED");
    assert.equal(result.code, "INTENTIONAL_STOP_OR_SUPERVISOR_CHANGED");
    assert.equal(staged, 0);
    assert.equal((await readOwnerAcceptanceReceipt({ root, requestId: ID })).state, "BLOCKED");
  }));
