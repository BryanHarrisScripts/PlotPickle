import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const WEBMCP_FULL_QA_ARTIFACT_ROOT = ".artifacts/webmcp-full-qa";

const STANDARD_EVIDENCE = Object.freeze([
  ".artifacts/webmcp-startup/summary.json",
  ".artifacts/webmcp-startup/uat-findings.json",
  ".artifacts/visual-readiness/startup-initializing-candidate.png",
  ".artifacts/visual-readiness/profile-locked-candidate.png",
  ".artifacts/visual-readiness/dashboard-canonical.png",
  ".artifacts/visual-readiness/visual-director-report.json",
  ".artifacts/browser-diagnostics/surface-contract-matrix.md",
  ".artifacts/browser-diagnostics/skin-v1-visual-director/geometry",
]);

const PROFILE_DIAGNOSTIC_SUFFIXES = Object.freeze([
  "interaction",
  "resilience",
  "continuity",
  "runtime",
]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

async function collectFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(root, target));
    else if (entry.isFile()) files.push(path.relative(root, target).replaceAll("\\", "/"));
  }
  return files.sort();
}

export async function writeStoreZip(rootDir, zipPath) {
  const names = await collectFiles(rootDir);
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = dosDateTime();

  for (const name of names) {
    const data = await readFile(path.join(rootDir, name));
    const filename = Buffer.from(name, "utf8");
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, filename, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, filename);
    offset += local.length + filename.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  await mkdir(path.dirname(zipPath), { recursive: true });
  await writeFile(zipPath, Buffer.concat([...localParts, centralDirectory, end]));
  return { zipPath, files: names.length };
}

function gitSha(repoRoot) {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function portableArtifactRef(repoRoot, value) {
  if (!value) return "";
  const absolute = path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
  const relative = path.relative(repoRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return path.basename(absolute);
  return relative.replaceAll("\\", "/");
}

async function copyExistingEvidence(repoRoot, runDir, runId) {
  const copied = [];
  const dynamicDiagnostics = PROFILE_DIAGNOSTIC_SUFFIXES.map(
    (suffix) => `.artifacts/browser-diagnostics/${runId}-${suffix}`,
  );
  for (const relative of [...STANDARD_EVIDENCE, ...dynamicDiagnostics]) {
    const source = path.resolve(repoRoot, relative);
    try {
      await stat(source);
    } catch {
      continue;
    }
    const destination = path.join(runDir, "evidence", relative.replace(/^\.artifacts[\\/]/u, ""));
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true, force: true });
    copied.push(relative);
  }
  return copied;
}

export async function finalizeWebMcpFullQaArtifacts({
  repoRoot,
  runId,
  startedAt,
  profileResults,
  overall,
} = {}) {
  const runDir = path.resolve(repoRoot, WEBMCP_FULL_QA_ARTIFACT_ROOT, runId);
  await mkdir(runDir, { recursive: true });

  const endedAt = new Date().toISOString();
  const aggregate = {
    schemaVersion: 1,
    runId,
    commitSha: gitSha(repoRoot),
    profile: "6",
    label: "FULL QA",
    startedAt,
    endedAt,
    overall,
    profiles: profileResults.map((result) => ({
      id: result.id,
      key: result.key,
      label: result.label,
      status: result.status,
      blockers: Number(result.blockers || 0),
      advisories: Number(result.advisories || 0),
      skipped: Boolean(result.skipped),
      skippedReason: result.skippedReason || "",
      report: portableArtifactRef(repoRoot, result.report),
    })),
    totals: {
      blockers: profileResults.reduce((sum, result) => sum + Number(result.blockers || 0), 0),
      advisories: profileResults.reduce((sum, result) => sum + Number(result.advisories || 0), 0),
      skipped: profileResults.filter((result) => result.skipped).length,
    },
  };
  const aggregatePath = path.join(runDir, "aggregate-summary.json");
  await writeFile(aggregatePath, `${JSON.stringify(aggregate, null, 2)}\n`, "utf8");

  const copiedStandardEvidence = await copyExistingEvidence(repoRoot, runDir, runId);
  const evidenceFiles = await collectFiles(runDir);
  const manifest = {
    schemaVersion: 1,
    format: "plotpickle-webmcp-full-qa",
    runId,
    commitSha: aggregate.commitSha,
    selectedProfile: "6",
    orderedProfiles: ["1", "2", "3", "4", "5"],
    startedAt,
    endedAt,
    overall,
    surfaceCatalogue: 30,
    blockerCount: aggregate.totals.blockers,
    advisoryCount: aggregate.totals.advisories,
    skippedChecks: profileResults.filter((result) => result.skipped).map((result) => ({
      profile: result.id,
      reason: result.skippedReason,
    })),
    sanitization: {
      browserDiagnostics: "Browser Verification Broker sanitizer",
      credentials: "excluded",
      cookies: "excluded",
      tokens: "excluded",
      humanPassphrases: "excluded",
      privateStoryContent: "not intentionally captured; Standard uses the governed representative fixture",
    },
    copiedEvidence: copiedStandardEvidence,
    evidenceFiles: [...evidenceFiles, "manifest.json"].sort(),
  };
  const manifestPath = path.join(runDir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const zipPath = path.resolve(repoRoot, `.artifacts/webmcp-full-qa-${runId}.zip`);
  await writeStoreZip(runDir, zipPath);
  return { runDir, zipPath, manifestPath, aggregatePath, manifest, aggregate };
}
