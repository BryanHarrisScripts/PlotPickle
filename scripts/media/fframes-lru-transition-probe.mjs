import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { candidateManifest, analyzeCandidateGraph, classifyCandidateCompilation, proveCandidateNativeVideo } from "./fframes-candidate-resolution.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const digest = (text) => createHash("sha256").update(text.replace(/\r\n/gu, "\n")).digest("hex");

export function compareLruNativeProof(baseline, candidate) {
  const fields = ["status", "codec", "frameRate", "width", "height", "decodedFrames",
    "everyFrameColorAndOrder", "finalFrame", "durationSeconds"];
  if (baseline?.status !== "PASS" || candidate?.status !== "PASS" ||
      !/^[a-f0-9]{64}$/u.test(baseline.artifactSha256 || "") ||
      !/^[a-f0-9]{64}$/u.test(candidate.artifactSha256 || "") ||
      fields.some((field) => baseline[field] === undefined || baseline[field] !== candidate[field])) {
    throw Error("Upstream lru native proof differs from tested patched candidate baseline.");
  }
  return { status: "PASS", measuredContract: "MATCH", byteIdentical:
    baseline.artifactSha256 === candidate.artifactSha256,
    baselineSha256: baseline.artifactSha256, candidateSha256: candidate.artifactSha256 };
}

export function withoutReviewedLruPatch(manifest, current, candidate) {
  const original = candidateManifest(manifest.replace(/\r\n/gu, "\n"), current, candidate);
  const marker = "\n[patch.crates-io]\n";
  if (original.split(marker).length !== 2) throw Error("Reviewed lru patch stanza absent or ambiguous.");
  const tail = original.split(marker)[1];
  if (!/lru\s*=\s*\{\s*path\s*=\s*"vendor\/lru-0\.14\.0-patched"\s*\}/u.test(tail)
      || /\n\[[^[\]\r\n]+\]/u.test(tail)) {
    throw Error("Reviewed lru patch requires explicit source inspection before trial.");
  }
  return original.split(marker)[0] + "\n";
}

export function classifyLruCandidateGraph(metadata, candidate) {
  // Existing upstream candidate identity / dependency path validation runs first.
  const checked = analyzeCandidateGraph(metadata, candidate);
  const nodes = new Map(metadata.resolve.nodes.map((n) => [n.id, n]));
  const packages = new Map(metadata.packages.map((p) => [p.id, p]));
  const visited = new Set(), queue = [metadata.resolve.root];
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    if (visited.has(id)) continue;
    visited.add(id);
    for (const dep of nodes.get(id)?.deps || []) {
      if (!nodes.has(dep.pkg) || !packages.has(dep.pkg)) throw Error("Unresolved lru trial dependency.");
      queue.push(dep.pkg);
    }
  }
  const rows = [...visited].map((id) => packages.get(id)).filter((p) => p.name === "lru")
    .map((p) => ({ name: p.name, version: p.version, source: p.source || null }))
    .sort((a, b) => a.version.localeCompare(b.version));
  if (rows.some((r) => !r.source?.startsWith("registry+"))) {
    return { status: "BLOCKED_LOCAL_LRU_STILL_PRESENT", lruRows: rows,
      promotion: false, upstreamGraphOnly: true, legacyCount: checked.findings.length };
  }
  const stale = rows.filter((r) => r.version.startsWith("0.14."));
  const modern = rows.length === 1 && rows[0].version === "0.18.5";
  const status = stale.length ? "BLOCKED_UPSTREAM_LRU_014_REQUIRED"
    : modern ? "UPSTREAM_LRU_0185_GRAPH_ELIGIBLE_REQUIRES_NATIVE_PROOF"
      : "BLOCKED_REQUIRED_LRU_0185_MISSING";
  return { status, lruRows: rows, promotion: false,
    upstreamGraphOnly: true, legacyCount: checked.findings.length };
}

export async function runLruTransitionProbe({ projectRoot = root, execute = spawnSync } = {}) {
  const get = (relative) => readFile(path.join(projectRoot, relative), "utf8");
  const [manifest, lock, policy] = await Promise.all([
    get("tools/fframes-bridge/Cargo.toml"), get("tools/fframes-bridge/Cargo.lock"),
    get("config/verification/fframes-upgrade-candidates-2026-10-18.json").then(JSON.parse)
  ]);
  if (policy.production !== "1.2.0" || policy.candidate !== "1.2.1-rc.45"
      || policy.promoted !== false) throw Error("Unreviewed upstream lru trial candidate.");
  const lockHash = digest(lock);
  const scratch = await mkdtemp(path.join(os.tmpdir(), "plotpickle-lru-upstream-"));
  let result;
  try {
    await mkdir(path.join(scratch, "src"), { recursive: true });
    await cp(path.join(projectRoot, "tools/fframes-bridge/src/main.rs"), path.join(scratch, "src", "main.rs"));
    await writeFile(path.join(scratch, "Cargo.toml"),
      withoutReviewedLruPatch(manifest, policy.production, policy.candidate));
    await writeFile(path.join(scratch, "Cargo.lock"), lock);
    const observed = execute("cargo", ["+1.99.0", "metadata", "--format-version", "1",
      "--manifest-path", path.join(scratch, "Cargo.toml")], {
      cwd: scratch, encoding: "utf8", timeout: 90_000, maxBuffer: 16 * 1024 * 1024,
      windowsHide: true, env: { ...process.env, CARGO_TARGET_DIR: path.join(scratch, "target") }
    });
    if (observed.error || observed.status !== 0) {
      result = { status: "BLOCKED_CARGO_RESOLUTION", errorTail:
        String(observed.error?.message || observed.stderr || "Cargo resolution failed").trim().slice(-450),
        promotion: false, upstreamGraphOnly: true };
    } else {
      const metadata = JSON.parse(observed.stdout);
      result = classifyLruCandidateGraph(metadata, policy.candidate);
      result.lruProvenance = metadata.packages.filter((pkg) => result.lruRows.some((row) =>
        row.name === pkg.name && row.version === pkg.version && row.source === pkg.source))
        .map((pkg) => ({ name: pkg.name, version: pkg.version, source: pkg.source,
          license: pkg.license, features: metadata.resolve.nodes.find((node) => node.id === pkg.id)?.features }));
      if (process.env.PLOTPICKLE_FFRAMES_LRU_NATIVE_RENDER === "1") {
        if (result.status !== "UPSTREAM_LRU_0185_GRAPH_ELIGIBLE_REQUIRES_NATIVE_PROOF") {
          throw Error("Upstream lru native proof requires the eligible registry graph.");
        }
        const compiled = execute("cargo", ["+1.99.0", "build", "--release", "--locked",
          "--manifest-path", path.join(scratch, "Cargo.toml")], {
          cwd: scratch, encoding: "utf8", timeout: 480_000, maxBuffer: 16 * 1024 * 1024,
          windowsHide: true, env: { ...process.env, CARGO_TARGET_DIR: path.join(scratch, "target"), CARGO_BUILD_JOBS: "2" }
        });
        result.candidateCompilation = classifyCandidateCompilation(compiled);
        if (result.candidateCompilation.status !== "COMPILED_NOT_RENDER_VERIFIED") {
          throw Error("Upstream lru native compilation failed: " + result.candidateCompilation.diagnostic);
        }
        result.nativeProof = await proveCandidateNativeVideo({ scratch, execute });
        const baseline = JSON.parse(await get(".artifacts/fframes-candidate-3088/resolution.json"));
        if (baseline.production !== policy.production || baseline.candidate !== policy.candidate ||
            baseline.productionLockDigest !== lockHash || baseline.promoted !== false) {
          throw Error("Upstream lru comparison baseline identity mismatch.");
        }
        const comparison = compareLruNativeProof(baseline.candidateRenderProof, result.nativeProof);
        const artifactRoot = path.join(projectRoot, ".artifacts/fframes-candidate-3088");
        await mkdir(artifactRoot, { recursive: true });
        await cp(path.join(scratch, "synthetic-proof/render.mp4"), path.join(artifactRoot, "upstream-lru-render.mp4"));
        await cp(path.join(scratch, "Cargo.lock"), path.join(artifactRoot, "upstream-lru-Cargo.lock"));
        result.baselineComparison = comparison;
      }
    }
  } catch (error) {
    result = { ...result, status: "BLOCKED_NATIVE_PROOF", diagnostic: String(error.message).slice(-600) };
  } finally {
    await rm(scratch, { recursive: true, force: true });
    if (digest(await get("tools/fframes-bridge/Cargo.toml")) !== digest(manifest)) {
      throw Error("Production Cargo.toml was modified by upstream lru experiment.");
    }
    if (digest(await get("tools/fframes-bridge/Cargo.lock")) !== lockHash) {
      throw Error("Production Cargo.lock was modified by upstream lru experiment.");
    }
  }
  if (digest(await get("tools/fframes-bridge/Cargo.lock")) !== lockHash) {
    throw Error("Production Cargo.lock was modified by upstream lru experiment.");
  }
  const report = { ...result, issue: 3089, candidate: policy.candidate,
    production: policy.production, productionLockSha256Lf: lockHash,
    upstreamSourceReference: "dmtrKovalenko/fframes main fframes/Cargo.toml at 03df1209227bc13cbc733ab567362142d5a43163",
    nativeCandidateWithUpstreamLru: "NOT_PROVEN",
    ...(result.status === "UPSTREAM_LRU_0185_GRAPH_ELIGIBLE_REQUIRES_NATIVE_PROOF" &&
      result.baselineComparison?.status === "PASS" ? { nativeCandidateWithUpstreamLru: "PASS_SYNTHETIC_36_FRAMES" } : {}),
    distributionRights: "NOT_PROVEN", productionPromoted: false };
  const out = path.join(projectRoot, ".artifacts", "fframes-candidate-3088", "lru-transition.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
  if (process.env.PLOTPICKLE_FFRAMES_LRU_NATIVE_RENDER === "1" &&
      report.nativeCandidateWithUpstreamLru !== "PASS_SYNTHETIC_36_FRAMES") {
    throw Error("Upstream lru native proof required but not completed: " + report.status);
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runLruTransitionProbe().catch((error) => { console.error(error); process.exitCode = 1; });
}
