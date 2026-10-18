import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseFframesCargoLock, reviewFframesRustMaintenance } from "../lib/verification/oss-radar/dependency-graphs/fframes-maintenance.mjs";

const read = (relative) => readFile(new URL("../" + relative, import.meta.url), "utf8");
const sha = (value) => createHash("sha256").update(value.replace(/\r\n/gu, "\n")).digest("hex");
const policyPath = "config/verification/fframes-maintenance-2026-10-18.json";

test("#3026 FFrames v4 Cargo graph records every five reachable advisory packages without claiming safety", async () => {
  const [manifest, lock, policyText] = await Promise.all([
    read("tools/fframes-bridge/Cargo.toml"),
    read("tools/fframes-bridge/Cargo.lock"),
    read(policyPath)
  ]);
  const policy = JSON.parse(policyText);
  assert.equal(policy.cargoManifestSha256Lf, sha(manifest));
  assert.equal(policy.cargoLockSha256Lf, sha(lock));
  const review = reviewFframesRustMaintenance(manifest, lock, policy);
  assert.equal(review.status, "REVIEW_REQUIRED");
  assert.equal(review.packageRecords, 281);
  assert.equal(review.affectedRecords, 5);
  assert.equal(review.distinctAdvisories, 4);
  assert.deepEqual(review.findings.map((finding) => finding.package), [
    "memmap@0.7.0", "paste@1.0.15", "rustybuzz@0.12.1", "ttf-parser@0.20.0", "ttf-parser@0.25.1"
  ]);
  for (const finding of review.findings) {
    assert.equal(finding.dependencyPath[0], "plotpickle-fframes-bridge@0.1.0");
    assert.equal(finding.dependencyPath[1], "fframes@1.2.0");
    assert.equal(finding.dependencyPath.at(-1), finding.package);
  }
  const byName = Object.fromEntries(review.findings.map((finding) => [finding.package, finding.dependencyPath]));
  assert.ok(byName["paste@1.0.15"].includes("pulp@0.22.3"));
  assert.ok(byName["paste@1.0.15"].includes("image@0.25.10"));
  assert.ok(byName["rustybuzz@0.12.1"].includes("usvgr@0.46.1"));
  assert.ok(byName["ttf-parser@0.20.0"].includes("fontdb@0.16.2"));
  assert.equal(review.localLruBackport, "REVIEWED_PATH_PATCH_PRESENT_NOT_NATIVE_PROOF");
  assert.equal(review.nativeWindowsProof, "NOT_RUN_BY_THIS_AUDIT");
});

test("#3026 source changes cannot silently clear the known Rust maintenance findings", async () => {
  const [manifest, lock, policyText] = await Promise.all([
    read("tools/fframes-bridge/Cargo.toml"), read("tools/fframes-bridge/Cargo.lock"), read(policyPath)
  ]);
  const policy = JSON.parse(policyText);
  assert.throws(() => reviewFframesRustMaintenance(manifest, lock.replace('name = "memmap"', 'name = "memmap2"'), policy), /source changed/u);
  assert.throws(() => reviewFframesRustMaintenance(manifest.replace('=1.2.0', '=1.2.1-rc.40'), lock, policy), /source changed/u);
  const missingNotice = { ...policy, notices: policy.notices.slice(1) };
  assert.throws(() => reviewFframesRustMaintenance(manifest, lock, missingNotice), /missing|baseline|advisory/u);
});

test("#3026 malformed Cargo records and ambiguous versions fail the source review", () => {
  const prefix = 'version = 4\n\n';
  assert.throws(() => parseFframesCargoLock(prefix + '[[package]]\nname = "bad"\n'), /Incomplete Cargo/u);
  assert.throws(() => parseFframesCargoLock(prefix + '[[package]]\nname = "dup"\nversion = "1"\n[[package]]\nname = "dup"\nversion = "1"\n'), /Duplicate/u);
  assert.throws(() => parseFframesCargoLock(prefix + '[[package]]\nname = "root"\nversion = "1"\ndependencies = [\n "missing",\n]\n'), /Missing or ambiguous/u);
  assert.throws(() => parseFframesCargoLock(prefix + '[[package]]\nname = "bad"\nversion = "1"\ndependencies = [\n bad\n]\n'), /Invalid Cargo dependency/u);
});

test("#3026 FFrames runtime stays stable and retained lru backport remains separately proven", async () => {
  const [manifest, provenance, bridge] = await Promise.all([
    read("tools/fframes-bridge/Cargo.toml"),
    read("tools/fframes-bridge/vendor/lru-0.14.0-patched/SECURITY-BACKPORT.md"),
    read("tools/fframes-bridge/src/main.rs")
  ]);
  assert.match(manifest, /fframes = \{ version = "=1\.2\.0"/u);
  assert.match(provenance, /RUSTSEC-2026-0002/u);
  assert.match(provenance, /RUSTSEC-2026-0253/u);
  assert.match(bridge, /preferred_encoder: Some\("mpeg4"\)/u);
  assert.match(bridge, /const FPS: usize = 24/u);
});
