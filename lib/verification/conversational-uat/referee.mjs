import { createHash } from "node:crypto";

// Option [3] development evidence. This record never belongs to a PPF project.
const SOURCES = new Set(["human-journey", "focused-uat", "webmcp-ui", "surface-contract"]);
const EXPECTATIONS = new Set(["product-contract", "surface-registry", "locked-reference", "dsdd-intent", "human-narration"]);
const STATES = new Set(["candidate", "human-confirmed", "human-rejected", "unproven"]);
const TOKEN = /^[a-z0-9][a-z0-9._:/-]{0,159}$/iu;

function token(value) {
  const candidate = typeof value === "string" ? value.slice(0, 160) : "";
  return TOKEN.test(candidate) ? candidate : "";
}

function bounded(value, limit = 400) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/gu, " ").trim().slice(0, limit) : "";
}

export function semanticJourneyEvent(value = {}) {
  // Never copy DOM text, arbitrary story content, inputs, or raw keyboard events.
  return Object.freeze({
    at: new Date(value.at || Date.now()).toISOString(),
    from: token(value.from),
    to: token(value.to),
    actionId: token(value.actionId),
    maturity: ["locked", "in-review", "unavailable"].includes(value.maturity) ? value.maturity : "",
  });
}

export function normalizeConversationalFinding(value = {}, identity = {}) {
  const sources = [...new Set((Array.isArray(value.sources) ? value.sources : [value.source]).filter((source) => SOURCES.has(source)))];
  const surfaceId = token(value.surfaceId);
  const expected = bounded(value.expected, 700);
  const observed = bounded(value.observed, 700);
  const expectationSource = EXPECTATIONS.has(value.expectationSource) ? value.expectationSource : "";
  const expectationRef = token(value.expectationRef);
  const suppliedFingerprint = token(value.fingerprint);
  const fingerprint = suppliedFingerprint || `uat.${createHash("sha256").update(JSON.stringify({ surfaceId, expected, observed, expectationRef })).digest("hex").slice(0, 20)}`;
  const proof = expectationSource && expectationRef && expected && observed && sources.some((source) => source !== "human-journey")
    ? "contract-backed" : "unproven";
  return {
    fingerprint,
    sources,
    observedAt: new Date(value.observedAt || Date.now()).toISOString(),
    head: token(identity.head),
    runtime: token(identity.runtime),
    surfaceId,
    route: bounded(value.route, 250),
    maturity: ["locked", "in-review", "unavailable"].includes(value.maturity) ? value.maturity : "",
    expected,
    expectationSource,
    expectationRef,
    observed,
    evidenceRefs: (Array.isArray(value.evidenceRefs) ? value.evidenceRefs : []).map(token).filter(Boolean).slice(0, 8),
    safeNavigationTarget: token(value.safeNavigationTarget),
    proof,
    state: proof === "contract-backed" ? "candidate" : "unproven",
    humanDecision: null,
  };
}

export function correlateConversationalFindings(existing = [], incoming, identity) {
  const finding = normalizeConversationalFinding(incoming, identity);
  const previous = existing.find((entry) => entry.fingerprint === finding.fingerprint && entry.head === finding.head);
  if (!previous) return [...existing, finding].slice(-100);
  return existing.map((entry) => entry === previous ? {
    ...previous,
    sources: [...new Set([...previous.sources, ...finding.sources])],
    evidenceRefs: [...new Set([...previous.evidenceRefs, ...finding.evidenceRefs])].slice(0, 8),
    proof: finding.proof === "contract-backed" ? finding.proof : previous.proof,
    state: previous.state === "unproven" && finding.proof === "contract-backed" ? "candidate" : previous.state,
  } : entry);
}

export function decideConversationalFinding(findings, fingerprint, decision, identity, now = new Date().toISOString()) {
  if (decision !== "Y" && decision !== "N") throw new Error("Human decision must be Y or N.");
  const match = findings.find((entry) => entry.fingerprint === fingerprint && entry.head === identity.head && entry.state === "candidate");
  if (!match || !STATES.has(match.state)) throw new Error("A current, contract-backed candidate is required before Human validation.");
  return findings.map((entry) => entry === match ? {
    ...entry,
    state: decision === "Y" ? "human-confirmed" : "human-rejected",
    humanDecision: { answer: decision, at: now, head: identity.head, runtime: identity.runtime },
  } : entry);
}
