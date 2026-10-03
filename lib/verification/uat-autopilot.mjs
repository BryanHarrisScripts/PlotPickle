import { createHash } from "node:crypto";
import { validateAutonomousStoryRoutes } from "./autonomous-story-routes.mjs";

function pushUnique(target, message) {
  if (message && !target.includes(message)) target.push(message);
}

export function validateUatRegistry(registry) {
  const errors = [];
  if (registry?.schemaVersion !== 1) errors.push("UAT registry schemaVersion must be 1.");
  if (!Array.isArray(registry?.areas) || !registry.areas.length) errors.push("UAT registry must contain at least one area.");
  const ids = new Set();
  for (const area of registry?.areas || []) {
    if (!area?.id || !area?.label) errors.push("Every UAT area needs an id and label.");
    if (ids.has(area?.id)) errors.push(`Duplicate UAT area id: ${area.id}.`);
    ids.add(area?.id);
    if (!Array.isArray(area?.tests) || !area.tests.length) errors.push(`${area?.label || area?.id || "Unknown area"} needs at least one contract test.`);
    if (area?.route) {
      if (!String(area.route).startsWith("/?workspace=")) errors.push(`${area.label} route must use the canonical workspace query.`);
      if (!Array.isArray(area.requiredTerms) || !area.requiredTerms.length) errors.push(`${area.label} needs rendered-content terms.`);
      if (!Number.isFinite(Number(area.minimumTextLength)) || Number(area.minimumTextLength) < 100) errors.push(`${area.label} minimumTextLength must be at least 100.`);
    }
  }
  if (registry?.autonomousStoryRoutes !== undefined) errors.push(...validateAutonomousStoryRoutes(registry));
  return errors;
}

export function contractTestsFromRegistry(registry) {
  return [...new Set((registry?.areas || []).flatMap((area) => Array.isArray(area.tests) ? area.tests : []))];
}

export function assessRenderedArea(area, evidence = {}) {
  const blockers = [];
  const warnings = [];
  const bodyText = String(evidence.bodyText || "");
  if (!evidence.reached) pushUnique(blockers, `${area.label} did not render at ${area.route}.`);
  if (Number(evidence.bodyLength || bodyText.length) < Number(area.minimumTextLength || 0)) {
    pushUnique(blockers, `${area.label} rendered too little visible content (${Number(evidence.bodyLength || bodyText.length)} characters).`);
  }
  for (const term of area.requiredTerms || []) {
    if (!bodyText.toLowerCase().includes(String(term).toLowerCase())) pushUnique(blockers, `${area.label} is missing expected rendered text: ${term}.`);
  }
  if (!evidence.screenshotCaptured) pushUnique(blockers, `${area.label} is missing screenshot evidence.`);
  if (evidence.consoleErrors) pushUnique(blockers, `${area.label} produced a browser console error.`);
  if (evidence.url && !String(evidence.url).includes(String(area.route).split("?")[1]?.split("&")[0] || "")) {
    pushUnique(warnings, `${area.label} finished on an unexpected URL: ${evidence.url}.`);
  }
  return { blockers, warnings };
}

export function assessStartupEvidence(startup = {}) {
  const blockers = [];
  const warnings = [];
  if (!startup.statusOk) pushUnique(blockers, startup.message || "Startup status endpoint did not respond successfully.");
  if (startup.mastraReady === false) pushUnique(blockers, "Mastra is not ready after startup.");
  if (startup.embedded === false) pushUnique(blockers, "Mastra is not running in the expected embedded mode.");
  if (startup.sageRegistered === false) pushUnique(blockers, "Sage Brinewick is not registered after startup.");
  if (startup.foundationsRegistered === false) pushUnique(blockers, "Foundations Planner is not registered after startup.");

  if (startup.fastAvailable === true && startup.sageAttempted && !startup.sagePassed) {
    pushUnique(blockers, startup.sageMessage || "Sage live-response probe failed.");
  }
  if (startup.fastAvailable === false) pushUnique(warnings, "Fast local model is unavailable; Sage live-response UAT was skipped.");

  if (startup.qualityAvailable === true && startup.plannerAttempted && !startup.plannerPassed) {
    pushUnique(blockers, startup.plannerMessage || "Foundations Planner structured-output probe failed.");
  }
  if (startup.qualityAvailable === false) pushUnique(warnings, "Quality local model is unavailable; Foundations Planner live structured-output UAT was skipped.");
  return { blockers, warnings };
}

export function assessFocusedUat({ registry, contractExitCode = 0, rendered = [], startup = {} }) {
  const blockers = [];
  const warnings = [];
  const registryErrors = validateUatRegistry(registry);
  blockers.push(...registryErrors);
  if (contractExitCode !== 0) pushUnique(blockers, `Focused contract tests exited with code ${contractExitCode}.`);

  const byId = new Map(rendered.map((entry) => [entry.id, entry]));
  for (const area of registry?.areas || []) {
    if (!area.route) continue;
    const evidence = byId.get(area.id) || {};
    const result = assessRenderedArea(area, evidence);
    result.blockers.forEach((message) => pushUnique(blockers, message));
    result.warnings.forEach((message) => pushUnique(warnings, message));
  }

  const startupResult = assessStartupEvidence(startup);
  startupResult.blockers.forEach((message) => pushUnique(blockers, message));
  startupResult.warnings.forEach((message) => pushUnique(warnings, message));

  return {
    overall: blockers.length ? "FAIL" : warnings.length ? "WARN" : "PASS",
    blockers,
    warnings,
    metrics: {
      areasRegistered: registry?.areas?.length || 0,
      renderedAreas: rendered.length,
      contractTests: contractTestsFromRegistry(registry).length,
    },
  };
}

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
