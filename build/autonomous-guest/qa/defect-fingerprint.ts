import { createHash } from "node:crypto";
import type { AutonomousQaTesterRole } from "./test-campaign";

export const AUTONOMOUS_QA_DEFECT_SEVERITIES = ["blocker", "critical", "major", "minor", "flaky"] as const;
export type AutonomousQaDefectSeverity = (typeof AUTONOMOUS_QA_DEFECT_SEVERITIES)[number];

export type AutonomousQaDefectObservation = Readonly<{
  commitSha: string;
  buildId: string;
  testerRole: AutonomousQaTesterRole;
  routeId: string;
  assertionRef: string;
  expectedRef: string;
  actualRef: string;
  errorClass: string;
  reproductionRefs: readonly string[];
  evidenceRefs: readonly string[];
}>;

export type AutonomousQaDefectCandidate = Readonly<{
  fingerprint: string;
  severity: AutonomousQaDefectSeverity;
  testerRole: AutonomousQaTesterRole;
  routeId: string;
  assertionRef: string;
  expectedRef: string;
  actualRef: string;
  errorClass: string;
  observations: readonly AutonomousQaDefectObservation[];
  reproductionRefs: readonly string[];
  evidenceRefs: readonly string[];
  reproducible: boolean;
}>;

export type AutonomousQaKnownDefect = Readonly<{
  fingerprint: string;
  linkedIssue: string;
  state: "open" | "closed";
}>;

const SHA = /^[a-f0-9]{40}$/i;
const SAFE_TOKEN = /^[a-z0-9][a-z0-9._:/-]{1,239}$/i;
const MAX_REFS = 64;
const MAX_OBSERVATIONS = 8;

function token(value: string, label: string, allowEmpty = false) {
  const normalized = String(value || "").trim();
  if (allowEmpty && !normalized) return "";
  if (!SAFE_TOKEN.test(normalized)) throw new Error(`Autonomous QA defect ${label} is missing or invalid.`);
  return normalized;
}

function refs(values: readonly string[], label: string) {
  const normalized = [...new Set(values.map((value) => token(value, label)))];
  if (normalized.length > MAX_REFS) throw new Error(`Autonomous QA defect ${label} exceeds its bounded size.`);
  return Object.freeze(normalized);
}

function observation(value: AutonomousQaDefectObservation): AutonomousQaDefectObservation {
  if (!SHA.test(value.commitSha)) throw new Error("Autonomous QA defect observation requires an exact commit SHA.");
  return Object.freeze({
    commitSha: value.commitSha.toLowerCase(),
    buildId: token(value.buildId, "build ID"),
    testerRole: value.testerRole,
    routeId: token(value.routeId, "route ID", true),
    assertionRef: token(value.assertionRef, "assertion reference"),
    expectedRef: token(value.expectedRef, "expected-result reference"),
    actualRef: token(value.actualRef, "actual-result reference"),
    errorClass: token(value.errorClass, "error class", true),
    reproductionRefs: refs(value.reproductionRefs, "reproduction reference"),
    evidenceRefs: refs(value.evidenceRefs, "evidence reference"),
  });
}

function fingerprintFor(value: AutonomousQaDefectObservation) {
  const stable = [
    value.testerRole,
    value.routeId,
    value.assertionRef,
    value.expectedRef,
    value.actualRef,
    value.errorClass,
    ...value.reproductionRefs,
  ].join("\n");
  return `qa-defect-${createHash("sha256").update(stable).digest("hex").slice(0, 32)}`;
}

export function createAutonomousQaDefectCandidate(input: Readonly<{
  severity: AutonomousQaDefectSeverity;
  observations: readonly AutonomousQaDefectObservation[];
}>) {
  if (!(AUTONOMOUS_QA_DEFECT_SEVERITIES as readonly string[]).includes(input.severity)) {
    throw new Error("Autonomous QA defect severity is invalid.");
  }
  if (!input.observations.length || input.observations.length > MAX_OBSERVATIONS) {
    throw new Error("Autonomous QA defect requires a bounded observation set.");
  }
  const observations = Object.freeze(input.observations.map(observation));
  const fingerprint = fingerprintFor(observations[0]);
  if (observations.some((item) => fingerprintFor(item) !== fingerprint)) {
    throw new Error("Autonomous QA defect observations do not reproduce the same fingerprint.");
  }
  const reproducible = observations.length >= 2;
  const severity = reproducible ? input.severity : "flaky";
  return Object.freeze({
    fingerprint,
    severity,
    testerRole: observations[0].testerRole,
    routeId: observations[0].routeId,
    assertionRef: observations[0].assertionRef,
    expectedRef: observations[0].expectedRef,
    actualRef: observations[0].actualRef,
    errorClass: observations[0].errorClass,
    observations,
    reproductionRefs: refs(observations.flatMap((item) => item.reproductionRefs), "reproduction reference"),
    evidenceRefs: refs(observations.flatMap((item) => item.evidenceRefs), "evidence reference"),
    reproducible,
  } satisfies AutonomousQaDefectCandidate);
}

export function classifyAutonomousQaDefectDisposition(
  candidate: AutonomousQaDefectCandidate,
  knownDefects: readonly AutonomousQaKnownDefect[],
) {
  if (!candidate.reproducible || candidate.severity === "flaky") {
    return Object.freeze({ disposition: "record-flaky" as const, linkedIssue: "" });
  }
  const existing = knownDefects.find((item) => item.fingerprint === candidate.fingerprint && item.state === "open");
  if (existing) {
    return Object.freeze({ disposition: "append-existing" as const, linkedIssue: token(existing.linkedIssue, "linked issue") });
  }
  return Object.freeze({ disposition: "create-new" as const, linkedIssue: "" });
}
