import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseFframesCargoLock, reviewFframesRustMaintenance } from "../lib/verification/oss-radar/dependency-graphs/fframes-maintenance.mjs";
import { candidateManifest, analyzeCandidateGraph } from "../scripts/media/fframes-candidate-resolution.mjs";

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

test("#3026 Rust maintenance evidence selects real FFrames Windows build and codec proof", async () => {
  const workflow = await read(".github/workflows/architecture-shadow.yml");
  const productGate = await read(".github/workflows/product-gate.yml");
  const scope = workflow.slice(workflow.indexOf("  windows-product-scope:"), workflow.indexOf("  windows-product-proof:"));
  const row = scope.split("\n").find((line) => line.includes("then media=true; fi"));
  assert.ok(row, "media must have an impact-based scope selector");
  const match = /grep -Eq '([^']+)'/u.exec(row);
  assert.ok(match, "media selection must use the explicit existing grep pattern");
  const pattern = new RegExp(match[1], "u");
  for (const selected of [
    "tools/fframes-bridge/Cargo.toml",
    "tools/fframes-bridge/Cargo.lock",
    "tools/fframes-bridge/vendor/lru-0.14.0-patched/src/lib.rs",
    "core/media/fframes-local-media-engine.ts",
    "scripts/fframes-product-proof.mjs",
    "config/verification/fframes-maintenance-2026-10-18.json",
    "lib/verification/oss-radar/dependency-graphs/fframes-maintenance.mjs",
    "tests/issue-3026-fframes-rust-maintenance.test.mjs",
  ]) {
    assert.ok(pattern.test(selected), selected + " must require the native media lane");
  }
  for (const unrelated of [
    "docs/developer-briefs/3026-fframes-rust-audit.md",
    "tests/issue-2733-ci-windows-lanes.test.mjs",
    "lib/verification/oss-radar/github-summary.mjs",
    "app/skin-v1-definition.css",
  ]) assert.equal(pattern.test(unrelated), false, unrelated + " must not trigger costly native media");
  const media = productGate.slice(productGate.indexOf("  media-windows:"), productGate.indexOf("  local-voice-windows:"));
  assert.match(media, /cargo \+1\.99\.0 build --release --locked/u);
  assert.match(media, /cargo \+1\.99\.0 test/u);
  assert.match(media, /node scripts\/fframes-product-proof\.mjs/u);
  assert.match(media, /name: Media \/ FFrames Windows proof/u);
});

test("#3088 exact prerelease candidate cannot mutate stable FFrames manifest", async () => {
  const manifest = await read("tools/fframes-bridge/Cargo.toml");
  const policy = JSON.parse(await read("config/verification/fframes-upgrade-candidates-2026-10-18.json"));
  assert.equal(policy.promoted, false);
  assert.equal(policy.alternatives.length, 6);
  assert.match(candidateManifest(manifest, policy.production, policy.candidate), /fframes = \{ version = "=1\.2\.1-rc\.45"/u);
  assert.match(manifest, /fframes = \{ version = "=1\.2\.0"/u);
  assert.throws(() => candidateManifest(manifest, "1.2.0", "*"), /explicit release candidate/u);
  assert.throws(() => candidateManifest(manifest, "9.0.0", "1.2.1-rc.45"), /pin is absent/u);
});

test("#3088 resolved candidate graph retains unmaintained nodes and disallows promotion", () => {
  const graph = { resolve: { root: "root", nodes: [
    { id: "root", deps: [{ pkg: "ff" }] },
    { id: "ff", deps: [{ pkg: "mm" }] },
    { id: "mm", deps: [] }
  ] }, packages: [
    { id: "root", name: "plotpickle-fframes-bridge", version: "0.1.0" },
    { id: "ff", name: "fframes", version: "1.2.1-rc.45" },
    { id: "mm", name: "memmap", version: "0.7.0" }
  ] };
  const withDebt = analyzeCandidateGraph(graph, "1.2.1-rc.45");
  assert.equal(withDebt.status, "LEGACY_DEPENDENCIES_REMAIN");
  assert.equal(withDebt.promoted, false);
  assert.deepEqual(withDebt.findings[0].path, [
    "plotpickle-fframes-bridge@0.1.0", "fframes@1.2.1-rc.45", "memmap@0.7.0"
  ]);
  graph.resolve.nodes[1].deps = [];
  const withoutDebt = analyzeCandidateGraph(graph, "1.2.1-rc.45");
  assert.equal(withoutDebt.status, "GRAPH_ONLY_NATIVE_PROOF_REQUIRED");
  assert.equal(withoutDebt.promoted, false);
  assert.throws(() => analyzeCandidateGraph(graph, "1.2.0"), /exact requested/u);
  graph.resolve.nodes[1].deps = [{ pkg: "absent" }];
  assert.throws(() => analyzeCandidateGraph(graph, "1.2.1-rc.45"), /Unresolved Cargo/u);
});
