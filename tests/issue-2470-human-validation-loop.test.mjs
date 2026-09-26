import assert from "node:assert/strict";
import test from "node:test";
import {
  appendConversationalJourney,
  applyConversationalHumanDecision,
  confirmedFindingInterpretation,
  confirmedFindingNarration,
  normalizeConversationalUatState,
  pendingConversationalCandidates,
} from "../build/dsdd/conversational-uat-runtime.ts";
import { correlateConversationalFindings } from "../lib/verification/conversational-uat/referee.mjs";
import { readFile } from "node:fs/promises";

const identity = { head: "c".repeat(40), runtime: "option-3" };
const candidate = {
  source: "webmcp-ui",
  surfaceId: "STORYBOARD",
  route: "/storyboard",
  expected: "Kept frame remains locked after reload",
  observed: "Restored frame returns to review",
  expectationSource: "product-contract",
  expectationRef: "storyboard.keep-lock",
  fingerprint: "storyboard.keep-lock-reload",
  evidenceRefs: ["uat-report:keep-lock"],
  safeNavigationTarget: "/storyboard",
};

test("#2470 Option 3 state is head-aware and journey evidence stays semantic", () => {
  let state = normalizeConversationalUatState({}, identity);
  state = appendConversationalJourney(state, { from: "DASHBOARD", to: "STORYBOARD", actionId: "nav.storyboard", prose: "private story", key: "secret" });
  assert.equal(state.head, identity.head);
  assert.equal(state.journey.length, 1);
  assert.equal(JSON.stringify(state.journey).includes("private story"), false);
  assert.equal(JSON.stringify(state.journey).includes("secret"), false);
});

test("#2470 Y/N keeps Human authority and Y creates bounded DSDD source text", () => {
  let state = normalizeConversationalUatState({}, identity);
  state = { ...state, findings: correlateConversationalFindings([], candidate, identity) };
  assert.equal(pendingConversationalCandidates(state).length, 1);
  const rejected = applyConversationalHumanDecision(state, candidate.fingerprint, "N", identity);
  assert.equal(rejected.findings[0].state, "human-rejected");

  state = normalizeConversationalUatState({}, identity);
  state = { ...state, findings: correlateConversationalFindings([], candidate, identity) };
  const confirmed = applyConversationalHumanDecision(state, candidate.fingerprint, "Y", identity);
  assert.equal(confirmed.findings[0].state, "human-confirmed");
  assert.match(confirmedFindingNarration(confirmed.findings[0]), /Human-confirmed Conversational UAT finding/u);
  assert.match(confirmedFindingInterpretation(confirmed.findings[0]), /specification publication only/u);
});

test("#2470 UI/server preserve safe checkpoint, no-canon, and automatic Y publication boundaries", async () => {
  const [panel, gateway, launcher, runner] = await Promise.all([
    readFile(new URL("../app/skin-v1/global-dsdd-conversation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../build/dsdd/dsdd-session-gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../Start-PlotPickle.bat", import.meta.url), "utf8"),
    readFile(new URL("../scripts/run-uat-closed-loop.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(panel, /data-dsdd-finding-card/u);
  assert.match(panel, /event\.key\.toUpperCase\(\) === "Y"/u);
  assert.match(panel, /event\.key\.toUpperCase\(\) === "N"/u);
  assert.match(panel, /Pending findings/u);
  assert.match(gateway, /action === "observe-journey"/u);
  assert.match(gateway, /action === "validate-finding"/u);
  assert.match(gateway, /await draftDeveloperBrief\(\)/u);
  assert.match(gateway, /await publishBriefIssue\(\)/u);
  assert.match(gateway, /CONVERSATIONAL_UAT_OBJECT_ID/u);
  assert.doesNotMatch(gateway, /--repair|github-report/u);
  assert.match(launcher, /CONVERSATIONAL_UAT_OBSERVER=scripts\\run-uat-closed-loop\.mjs/u);
  assert.match(launcher, /--conversational-observe/u);
  assert.match(runner, /PLOTPICKLE_SOURCE_SHA/u);
});
