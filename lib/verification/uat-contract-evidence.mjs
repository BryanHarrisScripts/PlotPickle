import { createHash } from "node:crypto";

const MAX_DIAGNOSTIC_CHARS = 6000;

function unquote(value) {
  const text = String(value || "").trim();
  if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
    return text.slice(1, -1);
  }
  return text;
}

function relativeSource(value, repoRoot = "") {
  let text = unquote(value).replace(/^file:\/\//u, "").replaceAll("\\", "/");
  const normalizedRoot = String(repoRoot || "").replaceAll("\\", "/").replace(/\/$/u, "");
  if (normalizedRoot && text.startsWith(`${normalizedRoot}/`)) text = text.slice(normalizedRoot.length + 1);
  const testsIndex = text.lastIndexOf("/tests/");
  if (testsIndex >= 0) text = text.slice(testsIndex + 1);
  return text;
}

function scalar(block, key) {
  const match = block.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, "mu"));
  return match ? unquote(match[1]) : "";
}

function multilineScalar(block, key) {
  const lines = block.split(/\r?\n/u);
  const index = lines.findIndex((line) => new RegExp(`^\\s*${key}:\\s*\\|[-+]?\\s*$`, "u").test(line));
  if (index < 0) return scalar(block, key);
  const keyIndent = lines[index].match(/^\s*/u)?.[0].length || 0;
  const collected = [];
  for (let i = index + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      collected.push("");
      continue;
    }
    const indent = line.match(/^\s*/u)?.[0].length || 0;
    if (indent <= keyIndent) break;
    collected.push(line.slice(Math.min(line.length, keyIndent + 2)));
  }
  return collected.join("\n").trim();
}

function sourceFromBlock(block, repoRoot) {
  const location = scalar(block, "location");
  if (location) return relativeSource(location, repoRoot);
  const stack = multilineScalar(block, "stack");
  const match = stack.match(/(?:file:\/\/)?([^\s()]+\.test\.mjs:\d+:\d+)/u);
  return match ? relativeSource(match[1], repoRoot) : "";
}

function failureFingerprint(failure) {
  return createHash("sha256")
    .update([failure.source, failure.name, failure.code, failure.message].join("\n"))
    .digest("hex")
    .slice(0, 16);
}

export function parseNodeTestTapFailures(tap, { repoRoot = "" } = {}) {
  const lines = String(tap || "").split(/\r?\n/u);
  const failures = [];

  for (let index = 0; index < lines.length; index += 1) {
    const start = lines[index].match(/^(\s*)not ok \d+\s+-\s+(.+?)(?:\s+#\s+.*)?$/u);
    if (!start) continue;
    const indent = start[1].length;
    let end = index + 1;
    for (; end < lines.length; end += 1) {
      const next = lines[end];
      const sibling = next.match(/^(\s*)(?:ok|not ok) \d+\s+-\s+/u);
      if (sibling && sibling[1].length <= indent) break;
      const subtest = next.match(/^(\s*)# Subtest:/u);
      if (subtest && subtest[1].length <= indent) break;
    }

    const block = lines.slice(index, end).join("\n");
    const message = multilineScalar(block, "error") || scalar(block, "error") || start[2].trim();
    const failure = {
      name: start[2].trim(),
      source: sourceFromBlock(block, repoRoot),
      code: scalar(block, "code"),
      failureType: scalar(block, "failureType"),
      message: message.slice(0, MAX_DIAGNOSTIC_CHARS),
      diagnostic: block.slice(0, MAX_DIAGNOSTIC_CHARS),
    };
    failure.fingerprint = failureFingerprint(failure);
    failures.push(failure);
  }

  return failures;
}

export function groupNodeTestFailures(failures) {
  const groups = new Map();
  for (const failure of failures || []) {
    const key = failure.fingerprint || failureFingerprint(failure);
    const current = groups.get(key);
    if (current) {
      current.occurrences += 1;
      current.names.push(failure.name);
      continue;
    }
    groups.set(key, {
      fingerprint: key,
      occurrences: 1,
      name: failure.name,
      names: [failure.name],
      source: failure.source,
      code: failure.code,
      failureType: failure.failureType,
      message: failure.message,
    });
  }
  return [...groups.values()];
}

export function buildNodeTestFailureInventory(tap, options) {
  const failures = parseNodeTestTapFailures(tap, options);
  return {
    failures,
    groups: groupNodeTestFailures(failures),
  };
}
