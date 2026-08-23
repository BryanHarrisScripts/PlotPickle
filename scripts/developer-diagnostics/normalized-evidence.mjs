import { contractsForTest, normalizeRepositoryPath, ownersForContract } from "./registry.mjs";

function normalizeMessage(value) {
  return String(value || "")
    .replace(/\b\d+(?:\.\d+)?\s*ms\b/gi, "<duration>")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeContracts(contracts, testFile, registry) {
  if (!contracts?.length) return testFile ? contractsForTest(testFile, registry) : [];
  return contracts.map((contract) => {
    if (typeof contract === "string") return { id: contract, owners: ownersForContract(contract, registry) };
    return {
      id: contract.id,
      owners: contract.owners?.length
        ? contract.owners.map((owner) => typeof owner === "string" ? { path: normalizeRepositoryPath(owner) } : owner)
        : ownersForContract(contract.id, registry),
    };
  });
}

function classify(record, registry) {
  if (record.classification) return record.classification;
  const evidence = `${record.name || ""}\n${record.message || ""}`.toLowerCase();
  for (const classifier of registry.classifiers || []) {
    if ((classifier.patterns || []).some((pattern) => evidence.includes(String(pattern).toLowerCase()))) return classifier.id;
  }
  return "unknown";
}

export function summarizeFailureEvidence(records, registry, options = {}) {
  const failures = records.map((record, index) => {
    const testFile = record.testFile ? normalizeRepositoryPath(record.testFile) : null;
    const message = String(record.message || record.name || "Failure evidence unavailable.");
    return {
      id: record.id || `failure-${index + 1}`,
      name: record.name || message,
      message,
      normalizedMessage: normalizeMessage(record.normalizedMessage || message),
      classification: classify(record, registry),
      testFile,
      line: record.line ?? null,
      column: record.column ?? null,
      detail: Array.isArray(record.detail) ? record.detail.slice(0, 40) : [],
      contracts: normalizeContracts(record.contracts, testFile, registry),
      evidenceSource: record.evidenceSource || null,
    };
  });

  const groups = new Map();
  for (const failure of failures) {
    const contractKey = failure.contracts.map((contract) => contract.id).sort().join(",") || "unowned";
    const key = `${failure.classification}|${contractKey}|${failure.normalizedMessage}`;
    const group = groups.get(key) || {
      id: `cluster-${groups.size + 1}`,
      classification: failure.classification,
      message: failure.normalizedMessage,
      contracts: failure.contracts.map((contract) => contract.id),
      failureIds: [],
      testFiles: [],
      evidenceSources: [],
    };
    group.failureIds.push(failure.id);
    if (failure.testFile && !group.testFiles.includes(failure.testFile)) group.testFiles.push(failure.testFile);
    if (failure.evidenceSource && !group.evidenceSources.some((source) => JSON.stringify(source) === JSON.stringify(failure.evidenceSource))) {
      group.evidenceSources.push(failure.evidenceSource);
    }
    groups.set(key, group);
  }

  const clusters = [...groups.values()].map((cluster) => ({
    ...cluster,
    count: cluster.failureIds.length,
    sharedCause: cluster.failureIds.length > 1,
    confidence: cluster.failureIds.length > 1 ? "medium" : "low",
  }));
  const failedTests = [...new Set(failures.map((failure) => failure.testFile).filter(Boolean))].sort();
  const focusedCommand = failedTests.length ? ["node", "--test", ...failedTests] : [];

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: options.source || "normalized-evidence",
    provenance: options.provenance || null,
    passed: failures.length === 0,
    counts: { failures: failures.length, affectedFiles: failedTests.length, clusters: clusters.length },
    failures,
    clusters,
    focusedCommand,
    focusedCommandText: focusedCommand.join(" "),
  };
}
