import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  enableSupervisor, migrateSupervisorHead, supervisorStatus,
  pauseSupervisor, disableSupervisor,
} from "../scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs";

const FROM = "a".repeat(40), TO = "b".repeat(40);
const CONSENT = "ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR";
const PAIR = { enabled: true, hostId: "host-" + "1".repeat(32), authorizedActor: "expected-local-actor" };
const paired = async () => PAIR, head = async () => FROM, now = () => 1_800_000_000_000;
const checkout = async () => ({ sourceHead: TO, trackedClean: true,
  branch: "main", originVerified: true, ancestorVerified: true });
const dir = root => path.join(root, "engineering-team", "supervisor");
const args = root => ({ appRoot: root, consent: CONSENT, platform: "win32",
  fromHead: FROM, checkout, paired, now });
async function sandbox(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-3142-migration-"));
  try { return await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
const enable = root => enableSupervisor({
  appRoot: root, consent: CONSENT, platform: "win32", paired, head, now,
});

test("#3142 one-way head migration changes only scoped supervisor binding and immutable audit", () => sandbox(async root => {
  await enable(root);
  const old = JSON.parse(await readFile(path.join(dir(root), "enabled.json"), "utf8"));
  const result = await migrateSupervisorHead(args(root));
  assert.equal(result.state, "HEAD_MIGRATED_NOT_RUNNING");
  assert.equal(result.fromHead, FROM);
  assert.equal(result.exactSha, TO);
  assert.equal(result.workerProcessVerified, false);
  assert.equal(result.issueReplayed, false);
  assert.equal(result.automaticMergeEnabled, false);
  const files = await readdir(dir(root));
  assert.equal(files.includes("running.lock"), false);
  assert.equal(files.includes("stop-request.json"), false);
  assert.equal(files.includes("pause-request.json"), false);
  const next = JSON.parse(await readFile(path.join(dir(root), "enabled.json"), "utf8"));
  assert.equal(next.enabledAt, old.enabledAt);
  assert.equal(next.hostId, old.hostId);
  assert.equal(next.authorizedActor, old.authorizedActor);
  assert.equal(next.sourceHead, TO);
  assert.equal(next.lastMigrationFrom, FROM);
  assert.equal(next.modelDispatchAllowed, false);
  assert.equal(next.autonomousMergeAllowed, false);
  const proof = JSON.parse(await readFile(path.join(dir(root), "migration-" + FROM + "-to-" + TO + ".json"), "utf8"));
  assert.equal(proof.fromHead, FROM);
  assert.equal(proof.toHead, TO);
  assert.equal(proof.permissionChanged, false);
  assert.equal(proof.workerStarted, false);
  assert.equal(proof.replayAuthorized, false);
  assert.equal((await supervisorStatus({ appRoot: root, now })).state, "OFFLINE");
  await assert.rejects(migrateSupervisorHead(args(root)), /SUPERVISOR_AUTHORITY_UNVERIFIABLE/);
}));

test("#3142 migrate fails closed before any rewrite for wrong consent, old head, pairing, stale checkout or diverged history", () => sandbox(async root => {
  await enable(root);
  const original = await readFile(path.join(dir(root), "enabled.json"), "utf8");
  const negative = [
    [{ ...args(root), consent: "INVALID" }, /LOCAL_WINDOWS_CONSENT_REQUIRED/],
    [{ ...args(root), platform: "linux" }, /LOCAL_WINDOWS_CONSENT_REQUIRED/],
    [{ ...args(root), fromHead: "invalid" }, /MIGRATION_OLD_HEAD_REQUIRED/],
    [{ ...args(root), fromHead: "c".repeat(40) }, /SUPERVISOR_AUTHORITY_UNVERIFIABLE/],
    [{ ...args(root), paired: async () => ({ ...PAIR, hostId: "wrong-host" }) }, /PAIRING_CHANGED_OR_DISABLED/],
    [{ ...args(root), checkout: async () => ({ sourceHead: TO, trackedClean: false, branch: "main", originVerified: true, ancestorVerified: true }) }, /CLEAN_FAST_FORWARD_MAIN_REQUIRED/],
    [{ ...args(root), checkout: async () => ({ sourceHead: TO, trackedClean: true, branch: "feature", originVerified: true, ancestorVerified: true }) }, /CLEAN_FAST_FORWARD_MAIN_REQUIRED/],
    [{ ...args(root), checkout: async () => ({ sourceHead: TO, trackedClean: true, branch: "main", originVerified: false, ancestorVerified: true }) }, /CLEAN_FAST_FORWARD_MAIN_REQUIRED/],
    [{ ...args(root), checkout: async () => ({ sourceHead: TO, trackedClean: true, branch: "main", originVerified: true, ancestorVerified: false }) }, /CLEAN_FAST_FORWARD_MAIN_REQUIRED/],
    [{ ...args(root), checkout: async () => ({ sourceHead: FROM, trackedClean: true, branch: "main", originVerified: true, ancestorVerified: true }) }, /CLEAN_FAST_FORWARD_MAIN_REQUIRED/],
  ];
  for (const [opts, error] of negative) {
    await assert.rejects(migrateSupervisorHead(opts), error);
    assert.equal(await readFile(path.join(dir(root), "enabled.json"), "utf8"), original);
    assert.ok(!(await readdir(dir(root))).includes("running.lock"), "failure releases owned guard only");
  }
}));

test("#3142 STOP, PAUSE, live/malformed lock and fresh RUNNING heartbeat block migration without issue replay", () => sandbox(async root => {
  await enable(root);
  const folder = dir(root), lock = path.join(folder, "running.lock");
  await writeFile(lock, "not a valid owned lock\n");
  await assert.rejects(migrateSupervisorHead(args(root)), /SUPERVISOR_LOCKED_OR_STALE/);
  await rm(lock);
  await writeFile(path.join(folder, "heartbeat.json"),
    JSON.stringify({ state: "RUNNING", sourceHead: FROM, hostId: PAIR.hostId, at: now() }) + "\n");
  await assert.rejects(migrateSupervisorHead(args(root)), /SUPERVISOR_MAY_STILL_BE_RUNNING/);
  await writeFile(path.join(folder, "heartbeat.json"), "{CORRUPTED\n");
  await assert.rejects(migrateSupervisorHead(args(root)), /SUPERVISOR_HEARTBEAT_UNVERIFIABLE/);
  await rm(path.join(folder, "heartbeat.json"));
  await pauseSupervisor({ appRoot: root, consent: CONSENT, platform: "win32", paired, head, now });
  await assert.rejects(migrateSupervisorHead(args(root)), /PAUSE_REQUEST_REQUIRES_OPERATOR_REVIEW/);
  await rm(path.join(folder, "pause-request.json"));
  await disableSupervisor({ appRoot: root, now });
  await assert.rejects(migrateSupervisorHead(args(root)), /LOCAL_STOP_REQUIRES_OPERATOR_REENABLE/);
}));

test("#3142 migration holds exclusive original service.lock throughout verified checkout and blocks concurrent serve", () => sandbox(async root => {
  await enable(root);
  const opts = args(root);
  const result = await migrateSupervisorHead({
    ...opts, checkout: async () => {
      const lock = JSON.parse(await readFile(path.join(dir(root), "running.lock"), "utf8"));
      assert.equal(lock.kind, "supervisor-head-migration");
      assert.ok(lock.owner && lock.pid);
      return checkout();
    },
  });
  assert.equal(result.exactSha, TO);
  assert.ok(!(await readdir(dir(root))).includes("running.lock"));
}));

test("#3142 reviewed CLI offers a separate exact-old-head migration and does not auto-run a worker", async () => {
  const code = await readFile(new URL("../scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs", import.meta.url), "utf8");
  assert.match(code, /--migrate/);
  assert.match(code, /MIGRATION_REQUIRES_EXPLICIT_OLD_HEAD_AND_LOCAL_CONSENT/);
  assert.match(code, /CLEAN_FAST_FORWARD_MAIN_REQUIRED/);
  assert.match(code, /merge-base/);
  assert.match(code, /writeFile\(p.lock/);
  assert.match(code, /autonomousMergeAllowed: false/);
  assert.doesNotMatch(code.slice(code.indexOf("export async function migrateSupervisorHead"), code.indexOf("export async function reenableSupervisor")), /Start-ScheduledTask|merge_pull_request|runPortableCommand|exec\("pwsh"/);
});
