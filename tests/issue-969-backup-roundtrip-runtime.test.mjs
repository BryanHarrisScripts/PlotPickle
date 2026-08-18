import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_BACKUP_FORMAT,
  LOCAL_BACKUP_VERSION,
  createLocalBackupArchive,
  inspectLocalBackupArchive,
  restoreLocalBackupArchive,
  sanitizeBackupJson,
} from "../lib/local-backup-runtime.mjs";

test("complete backup archive round-trips project and optional evidence bytes exactly", () => {
  const projectPpf = Buffer.from("PK\u0003\u0004fake-but-stable-project-ppf-bytes", "utf8");
  const run = Buffer.from(JSON.stringify({ runId: "run-1", state: "completed", events: [{ type: "verification.result" }] }));
  const verification = Buffer.from(JSON.stringify({ runId: "verification-1", deterministic: { result: "PASS" } }));
  const archive = createLocalBackupArchive({
    backupId: "backup-test-1",
    projectId: "project-test-1",
    projectTitle: "Backup Test",
    projectRevision: 7,
    sourceAppVersion: "test",
    createdAt: "2026-08-18T02:00:00.000Z",
    includes: ["complete-project-ppf", "responsibility-runs", "verification-history"],
    exclusions: ["credentials", "BUZZ private data"],
    entries: {
      "project.ppf": projectPpf,
      "evidence/runs/run-1.json": run,
      "evidence/verification/verification-1.json": verification,
    },
  });

  const inspected = inspectLocalBackupArchive(archive);
  assert.equal(inspected.valid, true, inspected.errors.join("; "));
  assert.equal(inspected.manifest.format, LOCAL_BACKUP_FORMAT);
  assert.equal(inspected.manifest.formatVersion, LOCAL_BACKUP_VERSION);
  assert.equal(inspected.manifest.projectRevision, 7);
  assert.deepEqual(inspected.entries["project.ppf"], projectPpf);
  assert.deepEqual(inspected.entries["evidence/runs/run-1.json"], run);
  assert.deepEqual(inspected.entries["evidence/verification/verification-1.json"], verification);

  const restored = restoreLocalBackupArchive(archive);
  assert.equal(restored.requiresExplicitApply, true);
  assert.equal(restored.overwritePerformed, false);
  assert.deepEqual(restored.entries["project.ppf"], projectPpf);
});

test("backup inspection detects tampered entry bytes", () => {
  const archive = createLocalBackupArchive({
    projectId: "project-test-2",
    projectTitle: "Tamper Test",
    projectRevision: 2,
    sourceAppVersion: "test",
    entries: { "project.ppf": Buffer.from("original") },
  });
  const parsed = JSON.parse(archive.toString("utf8"));
  parsed.entries[0].data = Buffer.from("tampered").toString("base64");
  const tampered = Buffer.from(JSON.stringify(parsed), "utf8");
  const inspected = inspectLocalBackupArchive(tampered);
  assert.equal(inspected.valid, false);
  assert.ok(inspected.errors.some((error) => /checksum/i.test(error)));
  assert.throws(() => restoreLocalBackupArchive(tampered), /checksum/i);
});

test("unsupported backup versions fail safely instead of attempting restore", () => {
  const archive = createLocalBackupArchive({
    projectId: "project-test-3",
    projectTitle: "Version Test",
    projectRevision: 1,
    sourceAppVersion: "test",
    entries: { "project.ppf": Buffer.from("project") },
  });
  const parsed = JSON.parse(archive.toString("utf8"));
  parsed.manifest.formatVersion = 999;
  assert.throws(() => inspectLocalBackupArchive(Buffer.from(JSON.stringify(parsed), "utf8")), /Unsupported PlotPickle backup version 999/);
});

test("optional evidence sanitizer redacts credentials and removes private internal-deliberation fields", () => {
  const sanitized = sanitizeBackupJson({
    apiKey: "sk-secret-secret-secret",
    nested: { authorization: "Bearer abcdefghijklmnop", useful: "keep this" },
    chainOfThought: "do not archive this",
    scratchpad: "do not archive this either",
    normal: "safe",
  });
  assert.equal(sanitized.apiKey, "[redacted]");
  assert.equal(sanitized.nested.authorization, "[redacted]");
  assert.equal(sanitized.nested.useful, "keep this");
  assert.equal(sanitized.normal, "safe");
  assert.equal(Object.hasOwn(sanitized, "chainOfThought"), false);
  assert.equal(Object.hasOwn(sanitized, "scratchpad"), false);
});
