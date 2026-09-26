import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  semanticJourneyEvent,
  normalizeConversationalFinding,
  correlateConversationalFindings,
  decideConversationalFinding,
} from "../lib/verification/conversational-uat-referee.mjs";

const identity = { head: "a".repeat(40), runtime: "option-3" };
const candidate = {
  source: "webmcp-ui", surfaceId: "STORYBOARD", expected: "Kept frame stays locked after reload",
  observed: "Frame is back in review", expectationSource: "product-contract", expectationRef: "storyboard.keep-lock",
  fingerprint: "storyboard.keep-lock-reload", evidenceRefs: ["uat-report:keep-lock"],
};

test("semantic observation excludes raw input, prose, and arbitrary DOM text", () => {
  const event = semanticJourneyEvent({ from: "DASHBOARD", to: "STORYBOARD", actionId: "nav.storyboard", text: "private story", key: "password" });
  assert.deepEqual(Object.keys(event), ["at", "from", "to", "actionId", "maturity"]);
  assert.equal(JSON.stringify(event).includes("private story"), false);
  assert.equal(JSON.stringify(event).includes("password"), false);
});

test("only contract-backed observations reach Human validation; N suppresses unchanged duplicates", () => {
  const weak = normalizeConversationalFinding({ ...candidate, expectationRef: "" }, identity);
  assert.equal(weak.state, "unproven");
  assert.throws(() => decideConversationalFinding([weak], weak.fingerprint, "Y", identity));
  const findings = correlateConversationalFindings([], candidate, identity);
  const rejected = decideConversationalFinding(findings, candidate.fingerprint, "N", identity);
  assert.equal(correlateConversationalFindings(rejected, candidate, identity)[0].state, "human-rejected");
  assert.equal(correlateConversationalFindings(rejected, candidate, { ...identity, head: "b".repeat(40) }).length, 2);
});

test("Y records Human authority without changing story/canon or granting code repair", () => {
  const findings = correlateConversationalFindings([], candidate, identity);
  const confirmed = decideConversationalFinding(findings, candidate.fingerprint, "Y", identity);
  assert.deepEqual(confirmed[0].humanDecision.answer, "Y");
  assert.equal(confirmed[0].state, "human-confirmed");
  assert.equal(Object.hasOwn(confirmed[0], "story"), false);
  assert.equal(Object.hasOwn(confirmed[0], "repair"), false);
});

test("Option 3 closed-loop observation cannot enable raw GitHub reporting or repair", async () => {
  const source = await readFile(new URL("../scripts/run-uat-closed-loop.mjs", import.meta.url), "utf8");
  assert.match(source, /conversationalObserve && \(githubReport \|\| repair\)/u);
  assert.match(source, /if \(!conversationalObserve\) await mirrorUatResult/u);
  assert.match(source, /conversational-candidates\.json/u);
});
