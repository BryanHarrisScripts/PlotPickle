import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  correlateConversationalFindings,
  decideConversationalFinding,
  semanticJourneyEvent,
} from "../../lib/verification/conversational-uat/referee.mjs";

export const CONVERSATIONAL_UAT_OBJECT_ID = "conversational-uat-evidence-v1";

export function currentConversationalUatIdentity(env = process.env) {
  const head = String(env.PLOTPICKLE_SOURCE_SHA || env.GITHUB_SHA || "unknown").trim().slice(0, 160) || "unknown";
  return { head, runtime: "option-3" };
}

export function normalizeConversationalUatState(value, identity = currentConversationalUatIdentity()) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sameHead = source.head === identity.head && source.runtime === identity.runtime;
  return {
    schemaVersion: 1,
    sessionId: sameHead && typeof source.sessionId === "string" ? source.sessionId : randomUUID(),
    head: identity.head,
    runtime: identity.runtime,
    journey: sameHead && Array.isArray(source.journey) ? source.journey.slice(-120) : [],
    findings: sameHead && Array.isArray(source.findings) ? source.findings.slice(-100) : [],
    updatedAt: new Date().toISOString(),
  };
}

function defaultArtifactRoot(env = process.env) {
  const local = env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(local, "PlotPickle", "uat-focused");
}

export async function reconcileConversationalUatCandidates(
  state,
  identity = currentConversationalUatIdentity(),
  artifactRoot = defaultArtifactRoot(),
) {
  let document = null;
  try {
    document = JSON.parse(await readFile(path.join(artifactRoot, "conversational-candidates.json"), "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (!document || document.head !== identity.head || !Array.isArray(document.candidates)) return state;
  let findings = state.findings;
  for (const candidate of document.candidates) {
    findings = correlateConversationalFindings(findings, candidate, identity);
  }
  return { ...state, findings: findings.slice(-100), updatedAt: new Date().toISOString() };
}

export function appendConversationalJourney(state, value) {
  const event = semanticJourneyEvent(value && typeof value === "object" ? value : {});
  const last = state.journey.at(-1);
  if (last && last.from === event.from && last.to === event.to && last.actionId === event.actionId && last.maturity === event.maturity) return state;
  return { ...state, journey: [...state.journey, event].slice(-120), updatedAt: new Date().toISOString() };
}

export function applyConversationalHumanDecision(
  state,
  fingerprint,
  decision,
  identity = currentConversationalUatIdentity(),
) {
  return {
    ...state,
    findings: decideConversationalFinding(state.findings, fingerprint, decision, identity),
    updatedAt: new Date().toISOString(),
  };
}

export function confirmedFindingNarration(finding) {
  return [
    `Human-confirmed Conversational UAT finding ${finding.fingerprint}.`,
    `Surface: ${finding.surfaceId || "UNKNOWN"}.`,
    finding.route ? `Reproduction path: ${finding.route}.` : "",
    `Expected: ${finding.expected || "Expected behavior was not recorded."}`,
    `Observed: ${finding.observed || "Observed behavior was not recorded."}`,
    `Expectation source: ${finding.expectationSource || "unknown"} ${finding.expectationRef || ""}`.trim(),
    Array.isArray(finding.evidenceRefs) && finding.evidenceRefs.length ? `Evidence: ${finding.evidenceRefs.join(", ")}.` : "",
  ].filter(Boolean).join("\n");
}

export function confirmedFindingInterpretation(finding) {
  return [
    `- Preserve the expected ${finding.surfaceId || "surface"} behavior: ${finding.expected || "match the confirmed product contract"}.`,
    `- Treat the observed behavior as the Human-confirmed regression: ${finding.observed || "the confirmed mismatch"}.`,
    finding.route ? `- Reproduce through ${finding.route} without bypassing normal product gates.` : "- Reproduce only through the normal governed product path.",
    `- Keep UAT evidence separate from story canon; this confirmation authorizes specification publication only.`,
    `- Acceptance requires deterministic proof against expectation source ${finding.expectationRef || finding.expectationSource || "the recorded contract"}.`,
  ].join("\n");
}

export function findingContext(finding) {
  const route = typeof finding.route === "string" && finding.route.trim() ? finding.route.trim().slice(0, 512) : "/";
  const surfaceId = typeof finding.surfaceId === "string" && finding.surfaceId.trim() ? finding.surfaceId.trim().slice(0, 180) : "UNKNOWN";
  return { route, surfaceId, surfaceLabel: surfaceId, capturedAt: new Date().toISOString() };
}

export function pendingConversationalCandidates(state) {
  return state.findings.filter((finding) => finding.state === "candidate");
}
