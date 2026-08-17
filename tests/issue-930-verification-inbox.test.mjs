import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  VERIFICATION_STAGE_NAMES,
  normalizeVerificationRecord,
  redactVerificationText,
  writeVerificationRecord,
} from "../scripts/verification-record.mjs";

function stages(overrides = {}) {
  return VERIFICATION_STAGE_NAMES.map((Step, index) => ({
    Step,
    Category: index < 2 ? "Architecture" : index === 2 ? "Curriculum" : index === 3 ? "Production Build" : index < 6 ? "Local AI / Pi" : index === 6 ? "BUZZ" : index === 7 ? "UI / UX UAT" : "Writer Journey",
    Status: overrides[index]?.Status || "PASS",
    ExitCode: overrides[index]?.ExitCode ?? 0,
    Detail: overrides[index]?.Detail || "",
  }));
}

test("clean 9/9 verification is stored without inventing findings", () => {
  const record = normalizeVerificationRecord({ startedAt: "2026-08-17T10:00:00Z", completedAt: "2026-08-17T10:05:00Z", rawLogName: "plotpickle-full-check-test.log", stages: stages(), overall: "FAIL" }, { runId: "verification-clean-12345678", plotPickleVersion: "1.0.0", commit: "abc", ref: "main", platformClass: "win32/x64" });
  assert.equal(record.deterministicResult, "PASS");
  assert.equal(record.passCount, 9);
  assert.equal(record.headline, "9/9 PASS — PlotPickle verification complete");
  assert.deepEqual(record.failureSummaries, []);
  assert.deepEqual(record.agentObservations, []);
  assert.deepEqual(record.repairAttempts, []);
  assert.deepEqual(record.retests, []);
  assert.deepEqual(record.evidenceReferences, [{ kind: "transcript", ref: "full-verification/plotpickle-full-check-test.log" }]);
  assert.equal(record.integrity.storyCanon, false);
});

test("a failed deterministic stage cannot be overwritten by a supplied PASS", () => {
  const record = normalizeVerificationRecord({ stages: stages({ 7: { Status: "FAIL", ExitCode: 3, Detail: "Visual check failed" } }), deterministicResult: "PASS" }, { runId: "verification-fail-12345678" });
  assert.equal(record.deterministicResult, "FAIL");
  assert.equal(record.passCount, 8);
  assert.equal(record.failureSummaries.length, 1);
  assert.match(record.headline, /^8\/9 PASS — 1 checks need attention$/);
  assert.equal(record.integrity.agentMayOverrideResult, false);
});

test("verification summaries redact credentials and private user paths", () => {
  const clean = redactVerificationText("C:\\Users\\Bryan\\secret.txt token=abc123 nsec1abcdefghijklmnopqrstuvwxyz /home/bryan/private.txt");
  assert.doesNotMatch(clean, /Bryan|bryan|nsec1abcdefghijklmnopqrstuvwxyz|token=abc123/);
  assert.match(clean, /%USERPROFILE%/);
  assert.match(clean, /token=\[redacted\]/);
});

test("verification record writes a new append-only application record", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-verification-"));
  const first = await writeVerificationRecord({ stages: stages(), rawLogName: "run.log" }, { root, runId: "verification-write-12345678", plotPickleVersion: "test", commit: "abc", ref: "test", platformClass: "test/x64" });
  const stored = JSON.parse(await readFile(first.filePath, "utf8"));
  assert.equal(stored.deterministicResult, "PASS");
  assert.equal((await readdir(path.join(root, "records"))).length, 1);
  await assert.rejects(() => writeVerificationRecord({ stages: stages() }, { root, runId: "verification-write-12345678" }));
});

test("Full Verification runner keeps raw transcript and writes a structured inbox record", async () => {
  const runner = await readFile(new URL("../scripts/run-plotpickle-full-check.ps1", import.meta.url), "utf8");
  assert.match(runner, /Start-Transcript -Path \$LogPath/);
  assert.match(runner, /Stop-Transcript \| Out-Null/);
  assert.match(runner, /Write-StructuredVerificationRecord/);
  assert.match(runner, /\.\\scripts\\verification-record\.mjs/);
  assert.match(runner, /rawLogName = \(Split-Path -Leaf \$LogPath\)/);
  assert.match(runner, /stages = @\(\$Results\)/);
});

test("Verification Inbox API is local, read-only and validates deterministic integrity", async () => {
  const gateway = await readFile(new URL("../build/verification-inbox-gateway.ts", import.meta.url), "utf8");
  assert.match(gateway, /persistentHome\(\).*verification-inbox.*records/s);
  assert.match(gateway, /if \(!isLocalRequest\(request\)\)/);
  assert.match(gateway, /request\.method !== "GET"/);
  assert.match(gateway, /Verification Inbox is read-only/);
  assert.match(gateway, /const derived = passCount === 9 \? "PASS" : "FAIL"/);
  assert.match(gateway, /item\.integrity\?\.agentMayOverrideResult === false/);
  assert.doesNotMatch(gateway, /PPFProject|FOUNDATION_PROJECT_STORAGE_KEY|localStorage/);
});

test("Verification Inbox UI leads with plain results and progressively discloses technical evidence", async () => {
  const page = await readFile(new URL("../app/verification-inbox/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Quality \/ Verification Inbox/);
  assert.match(page, /Every Full Verification run, kept as evidence/);
  assert.match(page, /Nine-stage verification/);
  assert.match(page, /No findings were invented for this clean run/);
  assert.match(page, /<details className=\{styles\.technical\}>/);
  assert.match(page, /Technical details and evidence/);
  assert.match(page, /Back to Reports/);
  assert.doesNotMatch(page, /privateKey|apiKey|hidden reasoning/);
});
