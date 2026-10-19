import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  WEBMCP_ACCEPTANCE_JOURNEYS,
  evaluateAcceptanceAssertions,
  normalizeWebMcpAcceptanceRequest,
} from "../core/sidecars/webmcp-acceptance-sidecar.mjs";

const request = Object.freeze({
  requestId: "issue-3118-story-factory-read-only",
  operation: "rendered-acceptance",
  target: "story-factory-read-only-journey",
  mode: "exact-head",
  commitSha: "a".repeat(40),
});

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("#3118 admits one named read-only Story Factory rendered journey", () => {
  const journey = WEBMCP_ACCEPTANCE_JOURNEYS[request.target];
  assert.equal(journey.issue, 3118);
  assert.equal(journey.postMergeCritical, true);
  assert.equal(normalizeWebMcpAcceptanceRequest(request).target, request.target);
  assert.throws(() => normalizeWebMcpAcceptanceRequest({ ...request, target: "story-factory-write" }), /Unknown browser acceptance journey/u);
  assert.throws(() => normalizeWebMcpAcceptanceRequest({ ...request, operation: "click-arbitrary" }), /only accepts rendered-acceptance/u);
});

test("#3118 browser journey traverses the required real surfaces in order", async () => {
  const source = await read("core/sidecars/webmcp-acceptance-sidecar.mjs");
  const start = source.indexOf("async function runStoryFactoryReadOnlyJourney");
  const end = source.indexOf("export async function runWebMcpAcceptanceJourney");
  const journey = source.slice(start, end);
  assert.ok(start > 0 && end > start);

  const ordered = [
    "runMindMapWorldMapJourney",
    'id: "outline"',
    'id: "write"',
    'id: "storyboard"',
    'id: "previs"',
    'id: "timeline"',
  ];
  let previous = -1;
  for (const token of ordered) {
    const index = journey.indexOf(token);
    assert.ok(index > previous, `${token} must remain in journey order`);
    previous = index;
  }
  for (const selector of [
    "data-dashboard-review-surface='outline'",
    "data-block-native-write='24x96'",
    "data-skin-v1-preproduction-review='storyboard'",
    "data-skin-v1-preproduction-review='previs'",
    "data-timeline-shot-board='25-shot'",
  ]) assert.ok(journey.includes(selector), selector);
});

test("#3118 journey preserves project identity and has no generation or canon mutation action", async () => {
  const source = await read("core/sidecars/webmcp-acceptance-sidecar.mjs");
  const start = source.indexOf("async function runStoryFactoryReadOnlyJourney");
  const end = source.indexOf("export async function runWebMcpAcceptanceJourney");
  const journey = source.slice(start, end);
  assert.match(journey, /observed\.projectId === initialProject/u);
  assert.match(journey, /finalProject === initialProject/u);
  assert.match(journey, /provider-generation-not-invoked/u);
  assert.match(journey, /canon-mutation-not-invoked/u);
  assert.doesNotMatch(journey, /getByRole\("button", \{ name: "(?:Generate|Ask Agent|Save|Save & Lock|Approve)/u);
  assert.doesNotMatch(journey, /fetch\(/u);
});

test("#3118 live browser verifier explicitly forces LOCAL and binds the new report", async () => {
  const source = await read("scripts/verification-webmcp-live.mjs");
  assert.match(source, /body: JSON\.stringify\(\{ mode: "local" \}\)/u);
  assert.match(source, /forceLocalStoryMode\(acceptanceStorageStatePath\)/u);
  assert.match(source, /cookie\?\.name === "ppsid"/u);
  assert.match(source, /"X-PlotPickle-CSRF": csrf/u);
  assert.match(source, /target: "story-factory-read-only-journey"/u);
  assert.match(source, /Story Factory rendered acceptance failed/u);
  assert.match(source, /providerSpendAllowed: false/u);
  assert.match(source, /story-factory-read-only-journey\/exact-head\.json/u);
});

test("#3118 missing rendered checkpoint remains FAIL and cannot become browser acceptance", () => {
  const result = evaluateAcceptanceAssertions(request, [
    { id: "library", status: "PASS", expected: "rendered", observed: "rendered" },
    { id: "timeline", status: "FAIL", expected: "rendered", observed: "not reached" },
  ]);
  assert.equal(result.status, "FAIL");
  assert.equal(result.blockerCount, 1);
  assert.equal(result.rendered, true);
  assert.equal(result.deterministic, true);
  assert.equal(result.isolatedBrowserContext, true);
});
