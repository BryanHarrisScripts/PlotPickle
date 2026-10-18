import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { candidateManifest, analyzeCandidateGraph } from "./fframes-candidate-resolution.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const digest = (text) => createHash("sha256").update(text.replace(/\r\n/gu, "\n")).digest("hex");

export function withoutReviewedLruPatch(manifest, current, candidate) {
  const original = candidateManifest(manifest, current, candidate);
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
  const modern = rows.some((r) => r.version === "0.18.5");
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
    await writeFile(path.join(scratch, "src", "main.rs"), "fn main() {}\n");
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
      result = classifyLruCandidateGraph(JSON.parse(observed.stdout), policy.candidate);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  if (digest(await get("tools/fframes-bridge/Cargo.lock")) !== lockHash) {
    throw Error("Production Cargo.lock was modified by upstream lru experiment.");
  }
  const report = { ...result, issue: 3089, candidate: policy.candidate,
    production: policy.production, productionLockSha256Lf: lockHash,
    upstreamSourceReference: "dmtrKovalenko/fframes main fframes/Cargo.toml at 03df1209227bc13cbc733ab567362142d5a43163",
    nativeCandidateWithUpstreamLru: "NOT_PROVEN",
    distributionRights: "NOT_PROVEN", productionPromoted: false };
  const out = path.join(projectRoot, ".artifacts", "fframes-candidate-3088", "lru-transition.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runLruTransitionProbe().catch((error) => { console.error(error); process.exitCode = 1; });
}
