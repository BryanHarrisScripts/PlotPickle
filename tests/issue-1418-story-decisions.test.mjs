import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createStoryDecisionFromCouncilResult,
  createStoryDecisionResponse,
  markStoryDecisionStale,
  mergeStoryDecisionRecords,
  storyDecisionAttentionCount,
  storyDecisionEligible,
  withdrawStoryDecision,
} from "../core/story-workflow/story-decisions/core.mjs";

function position(overrides = {}) {
  return {
    contributionId: overrides.contributionId || "contribution-mira-1",
    workItemId: overrides.workItemId || "work-afterglow-6",
    runId: overrides.runId || "run-afterglow-6-mira",
    agentId: overrides.agentId || "mira-threadmere",
    baseRevision: overrides.baseRevision || "9",
    targetRefs: overrides.targetRefs || ["ppf:build:block:6"],
    evidenceRefs: overrides.evidenceRefs || ["ppf:character:lead:motivation"],
    curriculumRefs: overrides.curriculumRefs || ["build:block-6:motivation"],
    severity: overrides.severity || "high",
    confidence: overrides.confidence ?? 0.62,
    proposal: overrides.proposal ?? "Make Mara choose the rescue because it costs her the escape route.",
    alternatives: overrides.alternatives || ["Keep the rescue accidental", "Make the rescue a deliberate sacrifice"],
    affectedDownstreamRefs: overrides.affectedDownstreamRefs || ["ppf:build:block:7", "ppf:build:block:8"],
  };
}

function council(overrides = {}) {
  const positions = overrides.positions || [position()];
  return {
    workItemId: overrides.workItemId || "work-afterglow-6",
    baseRevision: overrides.baseRevision || "9",
    contributionIds: positions.map((item) => item.contributionId),
    positions,
    targetRefs: overrides.targetRefs,
    evidenceRefs: overrides.evidenceRefs || positions.flatMap((item) => item.evidenceRefs),
    affectedDownstreamRefs: overrides.affectedDownstreamRefs || positions.flatMap((item) => item.affectedDownstreamRefs),
    humanGate: overrides.humanGate || "creative-choice",
    decisionClass: overrides.decisionClass || "alternative-choice",
    requiresHuman: overrides.requiresHuman ?? true,
    summary: overrides.summary || "Council found two credible creative directions for Block 6 motivation.",
  };
}

function makeDecision(overrides = {}) {
  const result = createStoryDecisionFromCouncilResult({
    projectId: "afterglow-v9",
    councilResult: council(overrides.council || {}),
    councilResultId: overrides.councilResultId || "council-afterglow-6",
    question: overrides.question || "Why does Mara choose the rescue in Block 6?",
    now: overrides.now || "2026-08-26T20:00:00Z",
    blockedByHuman: overrides.blockedByHuman,
  });
  assert.ok(result);
  return result;
}

test("routine Council results do not create Human Story Decisions", () => {
  const routine = council({ requiresHuman: false, humanGate: "informational", decisionClass: "informational-finding" });
  assert.equal(storyDecisionEligible(routine), false);
  assert.equal(createStoryDecisionFromCouncilResult({ projectId: "afterglow-v9", councilResult: routine }), null);
  const operationalBlock = council({ decisionClass: "blocked-prerequisite", humanGate: "blocked" });
  assert.equal(storyDecisionEligible(operationalBlock), false);
  assert.equal(storyDecisionEligible(operationalBlock, { blockedByHuman: true }), true);
});

test("creative Council result becomes one revision-aware non-canon Decision", () => {
  const decision = makeDecision();
  assert.match(decision.decisionId, /^story-decision-/);
  assert.equal(decision.projectId, "afterglow-v9");
  assert.equal(decision.baseRevision, "9");
  assert.equal(decision.status, "new");
  assert.equal(decision.decisionClass, "alternative-choice");
  assert.equal(decision.integrity.writesCanon, false);
  assert.equal(decision.integrity.requiresWorkbenchValidation, true);
  assert.deepEqual(decision.targetRefs, ["ppf:build:block:6"]);
  assert.ok(decision.evidenceRefs.includes("ppf:character:lead:motivation"));
  assert.ok(decision.alternatives.length >= 2);
});

test("duplicate Council findings group into the same underlying Decision", () => {
  const first = makeDecision();
  const second = makeDecision({ now: "2026-08-26T20:01:00Z", council: { evidenceRefs: ["ppf:character:lead:motivation", "ppf:build:block:6:turn"] } });
  assert.equal(first.problemKey, second.problemKey);
  assert.equal(first.groupKey, second.groupKey);
  const merged = mergeStoryDecisionRecords(first, second, { now: "2026-08-26T20:02:00Z" });
  assert.equal(merged.merged, true);
  assert.equal(merged.incoming, null);
  assert.ok(merged.existing.evidenceRefs.includes("ppf:build:block:6:turn"));
  assert.equal(storyDecisionAttentionCount([merged.existing]), 1);
});

test("replacement choice for the same problem supersedes the older card", () => {
  const first = makeDecision();
  const replacement = makeDecision({
    now: "2026-08-26T20:02:30Z",
    council: { positions: [position({ proposal: "Make Mara refuse the rescue and pay for that choice in Block 7.", alternatives: ["Refuse the rescue"] })] },
  });
  assert.equal(first.problemKey, replacement.problemKey);
  assert.notEqual(first.groupKey, replacement.groupKey);
  const result = mergeStoryDecisionRecords(first, replacement, { now: "2026-08-26T20:02:31Z" });
  assert.equal(result.merged, false);
  assert.equal(result.existing.status, "superseded");
  assert.equal(result.incoming?.decisionId, replacement.decisionId);
  assert.equal(storyDecisionAttentionCount([result.existing, result.incoming]), 1);
});

test("a newer story revision makes the old Decision stale instead of silently applying it", () => {
  const oldDecision = makeDecision();
  const newDecision = makeDecision({ council: { baseRevision: "10", positions: [position({ baseRevision: "10" })] }, now: "2026-08-26T20:03:00Z" });
  assert.equal(oldDecision.problemKey, newDecision.problemKey);
  const result = mergeStoryDecisionRecords(oldDecision, newDecision, { now: "2026-08-26T20:04:00Z" });
  assert.equal(result.merged, false);
  assert.equal(result.existing.status, "stale");
  assert.equal(result.incoming?.baseRevision, "10");
  const explicit = markStoryDecisionStale(oldDecision, "10", "2026-08-26T20:04:00Z");
  assert.equal(explicit.status, "stale");
  assert.equal(explicit.integrity.writesCanon, false);
});

test("Human response is structured, authenticated, revision-safe and Workbench-bound", () => {
  const decision = makeDecision();
  const accepted = createStoryDecisionResponse(decision, {
    responseClass: "accept-proposal",
    humanProfileId: "human-local-profile",
    currentRevision: "9",
    rationale: "The sacrifice clarifies the character arc.",
    respondedAt: "2026-08-26T20:05:00Z",
  });
  assert.equal(accepted.decision.status, "answered");
  assert.equal(accepted.response.humanAuthority, "authenticated-human");
  assert.equal(accepted.response.writesCanon, false);
  assert.equal(accepted.response.requiresWorkbenchValidation, true);
  assert.equal(accepted.response.baseRevision, "9");
  assert.equal(accepted.response.currentRevision, "9");
});

test("stale or unauthenticated responses fail closed", () => {
  const decision = makeDecision();
  assert.throws(() => createStoryDecisionResponse(decision, { responseClass: "accept-proposal", currentRevision: "9" }), /authenticated Human profile authority/);
  assert.throws(
    () => createStoryDecisionResponse(decision, { responseClass: "accept-proposal", humanProfileId: "human-local-profile", currentRevision: "10" }),
    (error) => error?.code === "STORY_DECISION_STALE" && /Story changed/.test(error.message),
  );
});

test("all writer response classes remain structured and non-canon", () => {
  const decision = makeDecision();
  const select = createStoryDecisionResponse(decision, { responseClass: "select-alternative", humanProfileId: "human", currentRevision: "9", selectedAlternativeId: "alternative-2" });
  assert.equal(select.response.responseClass, "select-alternative");
  const modify = createStoryDecisionResponse(decision, { responseClass: "modify-proposal", humanProfileId: "human", currentRevision: "9", replacementContent: "Mara rescues him only after choosing to abandon the escape plan." });
  assert.equal(modify.response.replacementContent.includes("escape plan"), true);
  const rejected = createStoryDecisionResponse(decision, { responseClass: "reject-proposal", humanProfileId: "human", currentRevision: "9" });
  assert.equal(rejected.response.responseClass, "reject-proposal");
  const deferred = createStoryDecisionResponse(decision, { responseClass: "defer", humanProfileId: "human", currentRevision: "9" });
  assert.equal(deferred.decision.status, "deferred");
  const alternatives = createStoryDecisionResponse(decision, { responseClass: "request-alternatives", humanProfileId: "human", currentRevision: "9" });
  assert.equal(alternatives.decision.status, "reviewing");
  const keep = createStoryDecisionResponse(decision, { responseClass: "keep-current", humanProfileId: "human", currentRevision: "9" });
  assert.equal(keep.decision.status, "answered");
  const freeform = createStoryDecisionResponse(decision, { responseClass: "freeform-decision", humanProfileId: "human", currentRevision: "9", replacementContent: "Mara leaves, then returns by choice." });
  assert.equal(freeform.response.writesCanon, false);
});

test("withdrawn Decisions preserve provenance and no longer count as attention", () => {
  const decision = makeDecision();
  const withdrawn = withdrawStoryDecision(decision, "10", "2026-08-26T20:06:00Z");
  assert.equal(withdrawn.status, "withdrawn");
  assert.equal(withdrawn.integrity.writesCanon, false);
  assert.equal(storyDecisionAttentionCount([withdrawn]), 0);
});

test("Afterglow proof covers character choice, structural conflict, grouping and stale flow", () => {
  const characterChoice = makeDecision();
  const structuralConflict = createStoryDecisionFromCouncilResult({
    projectId: "afterglow-v9",
    councilResult: council({
      workItemId: "work-afterglow-12",
      decisionClass: "unresolved-conflict",
      humanGate: "conflict",
      positions: [
        position({ contributionId: "elowen-12", workItemId: "work-afterglow-12", targetRefs: ["ppf:build:block:12"], proposal: "Move the midpoint reveal into Block 12.", alternatives: ["Reveal in Block 12"] }),
        position({ contributionId: "critics-12", workItemId: "work-afterglow-12", targetRefs: ["ppf:build:block:12"], proposal: "Hold the reveal until Block 13.", alternatives: ["Reveal in Block 13"] }),
      ],
    }),
    question: "Should the midpoint reveal land in Block 12 or Block 13?",
    now: "2026-08-26T20:07:00Z",
  });
  assert.ok(structuralConflict);
  assert.equal(structuralConflict.decisionClass, "unresolved-conflict");
  assert.notEqual(characterChoice.problemKey, structuralConflict.problemKey);
  const duplicate = makeDecision({ now: "2026-08-26T20:08:00Z" });
  assert.equal(mergeStoryDecisionRecords(characterChoice, duplicate).merged, true);
  assert.equal(markStoryDecisionStale(characterChoice, "10").status, "stale");
});

test("Story Decision gateway and UI preserve profile, encrypted storage, revision and no-canon boundaries", async () => {
  const [gateway, requestContext, profileFetch, page, dashboard, localGateway] = await Promise.all([
    readFile(new URL("../build/story-decisions/gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../build/profile-request-context.ts", import.meta.url), "utf8"),
    readFile(new URL("../core/auth/profile-request-browser.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/story-decisions/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/dashboard/dashboard-story-library.tsx", import.meta.url), "utf8"),
    readFile(new URL("../build/local-ai-gateway.ts", import.meta.url), "utf8"),
  ]);
  assert.match(requestContext, /"\/api\/story-decisions"/);
  assert.match(gateway, /currentProfileRequestContext/);
  assert.match(gateway, /profile\.profileId/);
  assert.match(gateway, /privateStorage\.readPrivateJson/);
  assert.match(gateway, /privateStorage\.writePrivateJson/);
  assert.match(gateway, /domain: "indexes"/);
  assert.match(gateway, /isLocalPlotPickleRequest/);
  assert.match(gateway, /action === "ingest-council"/);
  assert.match(gateway, /createStoryDecisionFromCouncilResult/);
  assert.match(gateway, /const unique = new Map<string, StoryDecisionRecord>/);
  assert.match(gateway, /const exact = store\.records\.find/);
  assert.match(gateway, /"answered", "superseded", "withdrawn", "stale"/);
  assert.match(gateway, /writesCanon: false/);
  assert.match(gateway, /story-workbench-validation/);
  assert.match(gateway, /Story changed since this question was created/);
  assert.doesNotMatch(gateway, /persistentHome|node:fs|saveFoundationProject|applyStoryCommand|PPFProject/);
  assert.match(localGateway, /from "\.\/story-decisions\/gateway"/);
  assert.match(localGateway, /registerStoryDecisionGateway\(server\)/);
  assert.match(profileFetch, /X-PlotPickle-CSRF/);
  assert.match(page, /authenticatedProfileFetch/);
  assert.match(page, /Story Decisions need you/);
  assert.match(page, /Accept recommendation/);
  assert.match(page, /Reject recommendation/);
  assert.match(page, /Keep current story/);
  assert.match(page, /Ask for alternatives/);
  assert.match(page, /Defer/);
  assert.match(page, /Open in story/);
  assert.match(page, /Send to Story Workbench/);
  assert.match(page, /loadFoundationProject/);
  assert.match(page, /Story changed since this question was created/);
  assert.match(page, /does not write PPF canon/);
  assert.match(dashboard, /Story Decisions/);
});
