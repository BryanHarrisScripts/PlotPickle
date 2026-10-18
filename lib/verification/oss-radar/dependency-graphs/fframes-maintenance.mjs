import { createHash } from "node:crypto";

const digest = (text) => createHash("sha256").update(text.replace(/\r\n/gu, "\n")).digest("hex");
const identifier = (item) => item.name + "@" + item.version;

export function parseFframesCargoLock(text) {
  if (!/^version = 4\s*$/mu.test(text)) throw new Error("FFrames audit requires a Cargo v4 lockfile.");
  const sections = text.split(/^\[\[package\]\]\s*$/mu).slice(1);
  if (!sections.length) throw new Error("FFrames lockfile contains no package records.");
  const records = sections.map((section) => {
    const name = /^name = "([^"\r\n]+)"$/mu.exec(section)?.[1];
    const version = /^version = "([^"\r\n]+)"$/mu.exec(section)?.[1];
    if (!name || !version) throw new Error("Incomplete Cargo package name/version; review graph parser.");
    const hasDependencies = /^dependencies = \[$/mu.test(section);
    const match = /^dependencies = \[\r?\n([\s\S]*?)^\]$/mu.exec(section);
    if (hasDependencies && !match) throw new Error("Unsupported Cargo dependency list for " + name);
    const dependencies = (match?.[1] || "").split(/\r?\n/u).filter(Boolean).map((line) => {
      const entry = /^\s*"([^"\r\n]+)",?\s*$/u.exec(line);
      if (!entry) throw new Error("Invalid Cargo dependency entry for " + name);
      return entry[1];
    });
    return { name, version, source: /^source = "([^"]+)"$/mu.exec(section)?.[1] || null,
      checksum: /^checksum = "([^"]+)"$/mu.exec(section)?.[1] || null, dependencies };
  });
  const nodes = new Map();
  const names = new Map();
  for (const record of records) {
    const id = identifier(record);
    if (nodes.has(id)) throw new Error("Duplicate Cargo package identity " + id);
    nodes.set(id, record);
    names.set(record.name, [...(names.get(record.name) || []), record]);
  }
  const resolve = (dependency) => {
    const [name, version, ...extra] = dependency.split(" ");
    if (extra.length) throw new Error("Unsupported Cargo dependency identity " + dependency);
    const candidates = (names.get(name) || []).filter((item) => !version || item.version === version);
    if (candidates.length !== 1) throw new Error("Missing or ambiguous Cargo dependency " + dependency);
    return candidates[0];
  };
  for (const record of records) for (const dependency of record.dependencies) resolve(dependency);
  return { records, nodes, resolve };
}

export function reviewFframesRustMaintenance(manifest, lockText, policy) {
  if (policy?.schemaVersion !== 1 || !Array.isArray(policy.notices) || !policy.notices.length) {
    throw new Error("FFrames audit requires the reviewed dated maintenance baseline.");
  }
  if (digest(manifest) !== policy.cargoManifestSha256Lf || digest(lockText) !== policy.cargoLockSha256Lf) {
    throw new Error("FFrames Cargo source changed; regenerate with Cargo and review the dated advisory baseline before reporting a clean result.");
  }
  if (!manifest.includes('fframes = { version = "=' + policy.stableFframes + '"')) {
    throw new Error("FFrames runtime dependency differs from the reviewed stable-version pin.");
  }
  if (!/\[patch\.crates-io\][\s\S]*lru = \{ path = "vendor\/lru-0\.14\.0-patched" \}/u.test(manifest)) {
    throw new Error("Reviewed local lru security backport is no longer enabled.");
  }
  const graph = parseFframesCargoLock(lockText);
  if (graph.records.length !== policy.packageCount) throw new Error("FFrames graph size changed without audit renewal.");
  const root = graph.nodes.get(policy.rootPackage);
  if (!root || !root.dependencies.includes("fframes")) throw new Error("FFrames bridge root/renderer edge is absent.");
  const expectedLru = graph.nodes.get("lru@" + policy.patchedLru);
  if (!expectedLru || expectedLru.source !== null || expectedLru.checksum !== null) {
    throw new Error("FFrames lru no longer resolves to the reviewed local source.");
  }
  for (const name of ["fframes", "usvgr"]) {
    const found = graph.records.find((item) => item.name === name);
    if (!found?.dependencies.includes("lru")) throw new Error(name + " lost its reviewed local lru edge.");
  }
  const paths = new Map([[identifier(root), [identifier(root)]]]);
  const queue = [root];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const edge of current.dependencies) {
      const next = graph.resolve(edge);
      const id = identifier(next);
      if (!paths.has(id)) {
        paths.set(id, [...paths.get(identifier(current)), id]);
        queue.push(next);
      }
    }
  }
  const expected = new Set(policy.notices.map((notice) => notice.name + "@" + notice.version));
  const knownRows = ["memmap@0.7.0", "paste@1.0.15", "rustybuzz@0.12.1", "ttf-parser@0.20.0", "ttf-parser@0.25.1"];
  if (expected.size !== policy.notices.length || expected.size !== knownRows.length
    || knownRows.some((id) => !expected.has(id))) {
    throw new Error("FFrames advisory baseline missing a known affected package or duplicates a row.");
  }
  const findings = policy.notices.map((notice) => {
    if (!/^RUSTSEC-\d{4}-\d{4}$/u.test(notice.id) || !/^https:\/\/rustsec\.org\/advisories\//u.test(notice.advisory)) {
      throw new Error("FFrames advisory record has no valid provenance.");
    }
    const id = notice.name + "@" + notice.version;
    if (!graph.nodes.has(id) || !paths.has(id)) throw new Error("FFrames advisory entry changed or became unreachable: " + id);
    return { advisoryId: notice.id, package: id, alternativeForMigrationReview: notice.alternative,
      dependencyPath: paths.get(id), disposition: "UNMAINTAINED_UPSTREAM_MIGRATION_REQUIRED" };
  });
  return {
    status: "REVIEW_REQUIRED",
    scope: "SOURCE_LOCK_GRAPH_NOT_INSTALLED_RUNTIME",
    cargoManifestSha256Lf: digest(manifest),
    cargoLockSha256Lf: digest(lockText),
    packageRecords: graph.records.length,
    reachableRecords: paths.size,
    affectedRecords: findings.length,
    distinctAdvisories: [...new Set(findings.map((finding) => finding.advisoryId))].length,
    localLruBackport: "REVIEWED_PATH_PATCH_PRESENT_NOT_NATIVE_PROOF",
    findings,
    nativeWindowsProof: "NOT_RUN_BY_THIS_AUDIT",
    caveat: "Unmaintained advisories are not proof of exploitable defects; no remediation or universal vulnerability-free claim."
  };
}
