import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const digest = (text) => createHash("sha256").update(text.replace(/\r\n/gu, "\n")).digest("hex");

export function candidateManifest(source, stable, candidate) {
  if (!/^\d+\.\d+\.\d+-rc\.\d+$/u.test(candidate)) throw Error("Only an explicit release candidate is allowed.");
  const pin = 'fframes = { version = "=' + stable + '"';
  if (source.split(pin).length !== 2) throw Error("Stable FFrames pin is absent or ambiguous.");
  return source.replace(pin, 'fframes = { version = "=' + candidate + '"');
}

export function analyzeCandidateGraph(metadata, candidate) {
  if (!metadata?.resolve?.root || !Array.isArray(metadata.resolve.nodes) || !Array.isArray(metadata.packages)) {
    throw Error("Cargo metadata must include resolved root, nodes and packages.");
  }
  const nodes = new Map(metadata.resolve.nodes.map((x) => [x.id, x]));
  const packages = new Map(metadata.packages.map((x) => [x.id, x]));
  const routes = new Map([[metadata.resolve.root, []]]);
  const queue = [metadata.resolve.root];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i], node = nodes.get(id), pkg = packages.get(id);
    if (!node || !pkg || !Array.isArray(node.deps)) throw Error("Incomplete resolved Cargo node.");
    for (const edge of node.deps) {
      if (!nodes.has(edge.pkg) || !packages.has(edge.pkg)) throw Error("Unresolved Cargo dependency node.");
      if (!routes.has(edge.pkg)) {
        routes.set(edge.pkg, [...routes.get(id), pkg.name + "@" + pkg.version]);
        queue.push(edge.pkg);
      }
    }
  }
  const reachable = [...routes.keys()].map((id) => packages.get(id));
  if (!reachable.some((x) => x.name === "fframes" && x.version === candidate)) {
    throw Error("Cargo did not resolve the exact requested FFrames candidate.");
  }
  const legacy = new Set(["memmap", "paste", "rustybuzz", "ttf-parser"]);
  const findings = reachable.filter((x) => legacy.has(x.name)).map((x) => ({
    package: x.name + "@" + x.version,
    path: [...routes.get(x.id), x.name + "@" + x.version]
  })).sort((a, b) => a.package.localeCompare(b.package));
  return {
    status: findings.length ? "LEGACY_DEPENDENCIES_REMAIN" : "GRAPH_ONLY_NATIVE_PROOF_REQUIRED",
    reachable: reachable.length, findings, promoted: false
  };
}

export function classifyCandidateCompilation(result) {
  if (result?.status === 0 && !result.error) return { status: "COMPILED_NOT_RENDER_VERIFIED" };
  return { status: "BLOCKED", exitCode: result?.status ?? null,
    diagnostic: String(result?.error?.message || result?.stderr || "compiler did not complete")
      .trim().slice(-600) };
}

export async function runCandidateResolution({ projectRoot = root, execute = spawnSync } = {}) {
  const read = (relative) => readFile(path.join(projectRoot, relative), "utf8");
  const base = "tools/fframes-bridge";
  const [manifest, lock, policy] = await Promise.all([
    read(base + "/Cargo.toml"), read(base + "/Cargo.lock"),
    read("config/verification/fframes-upgrade-candidates-2026-10-18.json").then(JSON.parse)
  ]);
  if (policy.schemaVersion !== 1 || policy.production !== "1.2.0" ||
      policy.candidate !== "1.2.1-rc.45" || policy.promoted !== false) throw Error("Unreviewed candidate policy.");
  const stableLockDigest = digest(lock);
  const scratch = await mkdtemp(path.join(os.tmpdir(), "plotpickle-fframes-candidate-"));
  let result;
  try {
    await mkdir(path.join(scratch, "src"), { recursive: true });
    await cp(path.join(projectRoot, base, "vendor"), path.join(scratch, "vendor"), { recursive: true });
    await cp(path.join(projectRoot, base, "src", "main.rs"), path.join(scratch, "src", "main.rs"));
    await writeFile(path.join(scratch, "Cargo.toml"), candidateManifest(manifest, policy.production, policy.candidate));
    await writeFile(path.join(scratch, "Cargo.lock"), lock);
    const processResult = execute("cargo", ["+1.99.0", "metadata", "--format-version", "1",
      "--manifest-path", path.join(scratch, "Cargo.toml")], {
      cwd: scratch, encoding: "utf8", timeout: 90000, maxBuffer: 16 * 1024 * 1024,
      windowsHide: true, env: { ...process.env, CARGO_TARGET_DIR: path.join(scratch, "target") }
    });
    if (processResult.error) throw Error("Cargo invocation failed: " + processResult.error.message);
    if (processResult.status !== 0) {
      result = { status: "CANDIDATE_RESOLUTION_BLOCKED", candidateCompilation: { status: "NOT_ATTEMPTED_GRAPH_BLOCKED" }, exitCode: processResult.status,
        errorTail: String(processResult.stderr || "").trim().slice(-400), promoted: false };
    } else {
      result = analyzeCandidateGraph(JSON.parse(processResult.stdout), policy.candidate);
      if (process.env.PLOTPICKLE_FFRAMES_CANDIDATE_NATIVE_COMPILE === "1") {
        const buildResult = execute("cargo", ["+1.99.0", "build", "--release", "--locked",
          "--manifest-path", path.join(scratch, "Cargo.toml")], {
          cwd: scratch, encoding: "utf8", timeout: 480000, maxBuffer: 16 * 1024 * 1024,
          windowsHide: true, env: { ...process.env, CARGO_TARGET_DIR: path.join(scratch, "target"),
            CARGO_BUILD_JOBS: "2" }
        });
        result.candidateCompilation = classifyCandidateCompilation(buildResult);
      } else {
        result.candidateCompilation = { status: "NOT_REQUESTED" };
      }
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  if (digest(await read(base + "/Cargo.lock")) !== stableLockDigest) throw Error("Production Cargo.lock was modified.");
  const report = { ...result, issue: 3088, production: policy.production, candidate: policy.candidate,
    productionLockDigest: stableLockDigest, scope: "TEMPORARY_CARGO_METADATA_ONLY",
    candidateNativeEncode: "NOT_PROVEN", candidateNativeDecode: "NOT_PROVEN", licenseAndRollback: "NOT_PROVEN", promoted: false };
  const out = path.join(projectRoot, ".artifacts", "fframes-candidate-3088", "resolution.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCandidateResolution().catch((error) => { console.error(error); process.exitCode = 1; });
}
