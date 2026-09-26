import assert from "node:assert/strict";
import test from "node:test";
import {
  correlateConversationalFindings,
  decideConversationalFinding,
  semanticJourneyEvent,
} from "../lib/verification/conversational-uat/referee.mjs";
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

test("#2470 journey evidence stays semantic and data-minimized", () => {
  const event = semanticJourneyEvent({ from: "DASHBOARD", to: "STORYBOARD", actionId: "nav.storyboard", prose: "private story", key: "secret" });
  assert.equal(event.from, "DASHBOARD");
  assert.equal(event.to, "STORYBOARD");
  assert.equal(JSON.stringify(event).includes("private story"), false);
  assert.equal(JSON.stringify(event).includes("secret"), false);
});

test("#2470 Y/N keeps Human authority in the shared referee lifecycle", () => {
  const findings = correlateConversationalFindings([], candidate, identity);
  assert.equal(findings.length, 1);
  const rejected = decideConversationalFinding(findings, candidate.fingerprint, "N", identity);
  assert.equal(rejected[0].state, "human-rejected");

  const confirmed = decideConversationalFinding(findings, candidate.fingerprint, "Y", identity);
  assert.equal(confirmed[0].state, "human-confirmed");
});

test("#2470 UI/server preserve safe checkpoint, no-canon, and automatic Y publication boundaries", async () => {
  const [panel, gateway, launcher, runner] = await Promise.all([
    readFile(new URL("../app/skin-v1/global-dsdd-conversation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../build/dsdd/dsdd-session-gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../Start-PlotPickle.bat", import.meta.url), "utf8"),
    readFile(new URL("../scripts/run-uat-closed-loop.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(panel, /data-dsdd-finding-card/u);
  assert.match(panel, /const key = event\.key\.toUpperCase\(\)/u);
  assert.match(panel, /key !== "Y" && key !== "N"/u);
  assert.match(panel, /validateFinding\(key as "Y" \| "N"\)/u);
  assert.match(panel, /Pending findings/u);
  assert.match(gateway, /action === "observe-journey"/u);
  assert.match(gateway, /action === "validate-finding"/u);
  assert.match(gateway, /await draftDeveloperBrief\(\)/u);
  assert.match(gateway, /await publishBriefIssue\(\)/u);
  assert.match(gateway, /CONVERSATIONAL_UAT_OBJECT_ID/u);
  assert.match(gateway, /source\.head === identity\.head/u);
  assert.match(gateway, /Human-confirmed Conversational UAT finding/u);
  assert.match(gateway, /specification publication only/u);
  assert.doesNotMatch(gateway, /--repair|github-report/u);
  assert.match(launcher, /CONVERSATIONAL_UAT_OBSERVER=scripts\\run-uat-closed-loop\.mjs/u);
  assert.match(launcher, /--conversational-observe/u);
  assert.match(runner, /PLOTPICKLE_SOURCE_SHA/u);
});
