const CONFORMANCE_PREFIX = "UI-CONFORMANCE ";
const BOUNDED_VALUE_LENGTH = 240;
const BOUNDED_IDENTITY_LENGTH = 160;

function bounded(value, maxLength = BOUNDED_VALUE_LENGTH) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

function slug(value, fallback = "unknown", maxLength = 72) {
  const normalized = bounded(value, maxLength * 2)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, maxLength);
  return normalized || fallback;
}

function repairSafeIdentity(value, semanticRole = "element") {
  const candidate = bounded(value, BOUNDED_IDENTITY_LENGTH);
  // WebMCP may observe aria-label for navigation, but repair telemetry must never
  // persist arbitrary rendered labels. Only developer-shaped stable identifiers
  // (data/id/name/class/index forms) are admitted here.
  const developerShaped = /[._:#/\-]/u.test(candidate)
    && /^[a-zA-Z0-9][a-zA-Z0-9._:#/\-]{0,159}$/u.test(candidate);
  if (developerShaped) return candidate;
  return `${slug(semanticRole, "element", 40)}-anonymous`;
}

function boundedViolation(input = {}) {
  const semanticRole = bounded(input.semanticRole, 64) || "element";
  return {
    surface: bounded(input.surface, 64) || "UNKNOWN",
    semanticRole,
    stableIdentity: repairSafeIdentity(input.stableIdentity, semanticRole),
    property: bounded(input.property, 80) || "unknown-property",
    actual: bounded(input.actual),
    expected: bounded(input.expected),
    source: bounded(input.source, 120) || "skin-v1-contract",
  };
}

export function visualConformanceFingerprint(violation) {
  const evidence = boundedViolation(violation);
  return [
    "ui-conformance",
    slug(evidence.surface),
    slug(evidence.semanticRole),
    slug(evidence.stableIdentity, "element", 80),
    slug(evidence.property, "property", 64),
  ].join(".").slice(0, 220);
}

export function buildVisualConformanceFinding(violation) {
  const evidence = boundedViolation(violation);
  const fingerprint = visualConformanceFingerprint(evidence);
  return {
    schemaVersion: 1,
    fingerprint,
    area: "ui-conformance",
    severity: "blocker",
    title: `Skin V1 conformance: ${evidence.surface} ${evidence.property}`,
    message: `${evidence.surface} ${evidence.semanticRole} ${evidence.stableIdentity} rendered ${evidence.property} as ${evidence.actual || "empty"}; expected ${evidence.expected || "the active Skin V1 contract"}.`,
    evidence,
  };
}

export function buildWebMcpRuntimeFinding() {
  return {
    schemaVersion: 1,
    fingerprint: "ui-conformance.webmcp.runtime-or-navigation",
    area: "ui-conformance",
    severity: "blocker",
    title: "WebMCP visual UAT did not complete",
    message: "WebMCP surface visual UAT failed before bounded conformance evidence could be produced. Reproduce the failure with WebMCP Testing before changing product behavior.",
    evidence: {
      source: "webmcp-surface-visual-audit",
      failureClass: "runtime-or-navigation",
    },
  };
}

export function findingsFromWebMcpError(error) {
  const text = error instanceof Error ? error.message : String(error || "");
  const findings = [];
  for (const line of text.split(/\r?\n/u)) {
    const marker = line.indexOf(CONFORMANCE_PREFIX);
    if (marker < 0) continue;
    const payload = line.slice(marker + CONFORMANCE_PREFIX.length).trim();
    if (!payload.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(payload);
      findings.push(buildVisualConformanceFinding(parsed));
    } catch {
      // Malformed diagnostic text is deliberately not copied into repair telemetry.
    }
  }
  return [...new Map(findings.map((finding) => [finding.fingerprint, finding])).values()];
}
