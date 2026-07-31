import { contractsForTest, normalizeRepositoryPath } from "./registry.mjs";

function normalizeMessage(value) {
  return String(value || "")
    .replace(/file:\/\/\/[^\s)'\"]+/g, "<file>")
    .replace(/[A-Za-z]:\\[^\s)'\"]+/g, "<file>")
    .replace(/\/[\w./-]+\.(?:mjs|js|ts|tsx):\d+:\d+/g, "<file>")
    .replace(/\b\d+(?:\.\d+)?\s*ms\b/gi, "<duration>")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLocation(lines) {
  const joined = lines.join("\n");
  const patterns = [
    /location:\s*['\"]?(?:file:\/\/\/)?([^'\"\r\n]+?\.(?:mjs|js|ts|tsx)):(\d+):(\d+)/,
    /(?:file:\/\/\/)?([A-Za-z]:[\\/][^)\r\n]+?\.(?:mjs|js|ts|tsx)):(\d+):(\d+)/,
    /(?:file:\/\/\/)?((?:\/|\.\/)?[^)\s\r\n]+?\.(?:mjs|js|ts|tsx)):(\d+):(\d+)/,
  ];
  for (const pattern of patterns) {
    const match = joined.match(pattern);
    if (!match) continue;
    return {
      file: normalizeRepositoryPath(match[1].replaceAll("\\", "/").replace(/^.*?\/tests\//, "tests/")),
      line: Number(match[2]),
      column: Number(match[3]),
    };
  }
  return { file: null, line: null, column: null };
}

function extractMessage(name, lines) {
  const candidates = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].replace(/^\s*#?\s*/, "").trim();
    if (!trimmed) continue;
    const field = trimmed.match(/^(?:error|message):\s*(.*)$/i);
    if (field?.[1]) {
      const value = field[1].replace(/^['\"]|['\"]$/g, "");
      if (/^\|[-+]?|^>[-+]?$/.test(value)) {
        const blockLine = lines.slice(index + 1).map((line) => line.trim()).find(Boolean);
        if (blockLine) candidates.push(blockLine);
      } else {
        candidates.push(value);
      }
    }
    if (/^(?:AssertionError|Error):\s+/.test(trimmed)) candidates.push(trimmed);
  }
  return candidates.find((item) => item && item !== name) || name;
}

function classifyFailure(failure, registry) {
  const haystack = `${failure.name}\n${failure.message}\n${failure.detail.join("\n")}`.toLowerCase();
  for (const classifier of registry.classifiers || []) {
    if ((classifier.patterns || []).some((pattern) => haystack.includes(String(pattern).toLowerCase()))) {
      return classifier.id;
    }
  }
  return "unknown";
}

export function parseNodeTestOutput(output, registry) {
  const lines = String(output || "").split(/\r?\n/);
  const failures = [];
  let current = null;

  const finish = () => {
    if (!current) return;
    const location = extractLocation(current.detail);
    const testFile = location.file || inferTestFile(current.detail);
    const contracts = testFile ? contractsForTest(testFile, registry) : [];
    const message = extractMessage(current.name, current.detail);
    const failure = {
      id: `failure-${failures.length + 1}`,
      name: current.name,
      message,
      normalizedMessage: normalizeMessage(message),
      testFile,
      line: location.line,
      column: location.column,
      detail: current.detail.slice(0, 40),
      contracts,
    };
    failure.classification = classifyFailure(failure, registry);
    failures.push(failure);
    current = null;
  };

  for (const line of lines) {
    const start = line.match(/^\s*not ok\s+\d+\s+-\s+(.+?)\s*$/);
    if (start) {
      finish();
      current = { name: start[1].trim(), detail: [] };
      continue;
    }
    if (current && /^\s*(?:ok|not ok)\s+\d+\s+-\s+/.test(line)) {
      finish();
    }
    if (current) current.detail.push(line);
  }
  finish();

  const groups = new Map();
  for (const failure of failures) {
    const ownerKey = failure.contracts.map((contract) => contract.id).sort().join(",") || "unowned";
    const key = `${failure.classification}|${ownerKey}|${failure.normalizedMessage}`;
    const group = groups.get(key) || {
      id: `cluster-${groups.size + 1}`,
      classification: failure.classification,
      message: failure.normalizedMessage,
      contracts: failure.contracts.map((contract) => contract.id),
      failureIds: [],
      testFiles: [],
    };
    group.failureIds.push(failure.id);
    if (failure.testFile && !group.testFiles.includes(failure.testFile)) group.testFiles.push(failure.testFile);
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
    passed: failures.length === 0,
    counts: {
      failures: failures.length,
      affectedFiles: failedTests.length,
      clusters: clusters.length,
    },
    failures,
    clusters,
    focusedCommand,
    focusedCommandText: focusedCommand.join(" "),
  };
}

function inferTestFile(lines) {
  const joined = lines.join("\n").replaceAll("\\", "/");
  const match = joined.match(/(?:^|[(\"' ])((?:tests\/)[^:)'\"\s]+\.test\.mjs)(?::\d+:\d+)?/m);
  return match ? normalizeRepositoryPath(match[1]) : null;
}

export function enrichSummaryWithPlan(summary, plan) {
  const allowedTests = new Set(plan?.suites || []);
  const outOfPlan = plan
    ? summary.failures
      .map((failure) => failure.testFile)
      .filter((file) => file && !allowedTests.has(file))
    : [];
  return {
    ...summary,
    plan: plan ? {
      source: plan.source,
      areas: plan.areas.map((area) => area.id),
      suites: plan.suites,
      allowedPaths: plan.allowedPaths,
    } : null,
    scope: {
      withinPlan: outOfPlan.length === 0,
      outOfPlan: [...new Set(outOfPlan)],
    },
  };
}
