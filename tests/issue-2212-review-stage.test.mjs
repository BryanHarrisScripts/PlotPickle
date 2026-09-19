import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function importReviewStage() {
  const source = await read("lib/review-stage.ts");
  const compiled = stripTypeScriptTypes(source, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}#${Date.now()}-${Math.random()}`);
}

test("#2212 Review Stage feedback is exact-agent, durable-shaped and idempotent", async () => {
  const {
    createReviewStageFeedback,
    queueReviewStageFeedback,
    deliverReviewStageFeedback,
    acknowledgeReviewStageFeedback,
    markReviewStageFeedbackActedOn,
    answerReviewStageFeedback,
    resolveReviewStageFeedback,
    reviewStageFeedbackInbox,
  } = await importReviewStage();

  const created = createReviewStageFeedback({
    feedbackId: "feedback-2212",
    sessionId: "session-2212",
    itemId: "item-2212",
    targetAgentId: "bram-gatewick",
    actorId: "human-1",
    decision: "needs-review",
    body: "The screenshot and reference do not agree.",
    createdAt: "2026-09-19T14:30:00.000Z",
  });
  assert.equal(created.state, "feedback-created");

  const queued = queueReviewStageFeedback(created);
  assert.equal(queued.state, "pending-delivery");
  assert.throws(() => deliverReviewStageFeedback(queued, "wrong-agent"), /exact target Agent/u);

  const delivered = deliverReviewStageFeedback(queued, "bram-gatewick", "2026-09-19T14:31:00.000Z");
  assert.equal(delivered.state, "delivered-to-agent");
  assert.strictEqual(deliverReviewStageFeedback(delivered, "bram-gatewick"), delivered, "duplicate delivery must be idempotent");
  assert.deepEqual(reviewStageFeedbackInbox([delivered], "bram-gatewick").map((item) => item.feedbackId), ["feedback-2212"]);

  const acknowledged = acknowledgeReviewStageFeedback(delivered, "bram-gatewick", "2026-09-19T14:32:00.000Z");
  assert.equal(acknowledged.state, "acknowledged");
  assert.strictEqual(acknowledgeReviewStageFeedback(acknowledged, "bram-gatewick"), acknowledged, "duplicate acknowledgement must be idempotent");

  const actedOn = markReviewStageFeedbackActedOn(acknowledged, "bram-gatewick", "2026-09-19T14:33:00.000Z");
  const answered = answerReviewStageFeedback(actedOn, "bram-gatewick", "Rechecked the bounded evidence and prepared a revised proposal.", "2026-09-19T14:34:00.000Z");
  assert.equal(answered.state, "answered");
  assert.match(answered.agentReply, /revised proposal/u);

  const resolved = resolveReviewStageFeedback(answered, "human-1", "2026-09-19T14:35:00.000Z");
  assert.equal(resolved.state, "resolved");
  assert.deepEqual(reviewStageFeedbackInbox([resolved], "bram-gatewick"), []);
});

test("#2212 developer UAT projection preserves deterministic truth while attaching Human review", async () => {
  const { projectDeveloperReviewStage } = await importReviewStage();
  const session = projectDeveloperReviewStage({
    sessionId: "uat-2212",
    buildRef: "head-2212",
    sourceRevision: "head-2212",
    targetAgentId: "bram-gatewick",
    createdAt: "2026-09-19T14:30:00.000Z",
    events: [{
      key: "uat-2212|event-1",
      label: "Storyboard visual check",
      result: "FAIL",
      summary: "Rendered surface differs from the canonical reference.",
      evidenceRef: ".artifacts/visual/storyboard.png",
      sourceRevision: "head-2212",
      capturedAt: "2026-09-19T14:31:00.000Z",
    }],
    reviews: [{
      eventKey: "uat-2212|event-1",
      decision: "needs-review",
      comment: "Recheck the reference spacing before another run.",
      updatedAt: "2026-09-19T14:32:00.000Z",
    }],
  });

  assert.equal(session.domain, "developer");
  assert.equal(session.projectionOnly, true);
  assert.equal(session.items[0].canonicalMutationAllowed, false);
  assert.equal(session.items[0].targetAgentId, "bram-gatewick");
  assert.match(session.items[0].parts[0].content, /^FAIL/u);
  assert.equal(session.items[0].parts[1].kind, "comment");
  assert.match(session.items[0].parts[1].content, /reference spacing/u);
  assert.equal(session.items[0].stale, false);
});

test("#2212 creator review uses the same contract, exact story target and stale-source signal", async () => {
  const { projectCreatorReviewStage } = await importReviewStage();
  const session = projectCreatorReviewStage([{
    id: "feedback-story-1",
    title: "Reveal timing",
    target: {
      kind: "storyboard-frame",
      targetId: "frame-17-1",
      label: "Block 17 · frame 1",
      workspace: "storyboard",
    },
    author: "Local reviewer",
    source: "human",
    body: "The reveal arrives one beat too early.",
    status: "open",
    proposedChange: "Hold the face until the next shot.",
    thread: [{
      id: "message-1",
      author: "Local reviewer",
      body: "Compare with the source evidence.",
      createdAt: "2026-09-19T14:20:00.000Z",
    }],
    resolution: "",
    createdAt: "2026-09-19T14:20:00.000Z",
    updatedAt: "2026-09-19T14:21:00.000Z",
    linkedRevisionId: "revision-3",
    originId: "review-thread-1",
  }], {
    sessionId: "creator-2212",
    projectId: "project-1",
    currentRevision: "revision-4",
    createdAt: "2026-09-19T14:30:00.000Z",
  });

  assert.equal(session.domain, "creator");
  assert.equal(session.projectionOnly, true);
  assert.equal(session.items[0].subject.id, "frame-17-1");
  assert.equal(session.items[0].subject.revision, "revision-3");
  assert.equal(session.items[0].stale, true);
  assert.equal(session.items[0].canonicalMutationAllowed, false);
  assert.equal(session.items[0].parts.some((part) => part.kind === "comment"), true);
  assert.equal(session.items[0].parts.some((part) => part.label === "Proposed change"), true);
});

test("#2212 both Human stories consume one projection contract instead of a new authority", async () => {
  const [contract, route, panel, feedbackWorkspace, transactions, responsibility] = await Promise.all([
    read("lib/review-stage.ts"),
    read("app/api/auth/uat-guide/route.ts"),
    read("app/skin-v1/uat-guide-panel.tsx"),
    read("app/feedback-workspace.tsx"),
    read("lib/creative-transactions/creative-transaction-contract.ts"),
    read("lib/agents/responsibility/responsibility-runs.ts"),
  ]);

  assert.match(contract, /projectionOnly: true/u);
  assert.match(contract, /canonicalMutationAllowed: false/u);
  assert.doesNotMatch(contract, /writePrivateJson|localStorage|indexedDB|commitCreative|applyCanon/u);

  assert.match(route, /projectDeveloperReviewStage/u);
  assert.match(route, /reviewStageFeedbackInbox/u);
  assert.match(route, /targetAgentId: "bram-gatewick"/u);
  assert.match(route, /deterministicResultUnchanged: true/u);
  assert.match(route, /feedbackId = `uat-review:/u);
  assert.match(panel, /data-review-stage-domain/u);
  assert.match(feedbackWorkspace, /projectCreatorReviewStage/u);
  assert.match(feedbackWorkspace, /data-review-stage-projection/u);

  assert.match(transactions, /requestReview\(transactionId: string\)/u);
  assert.match(transactions, /commit\(transactionId: string\)/u);
  assert.match(responsibility, /canonical: false/u);
  assert.match(responsibility, /PPF canon mutation still requires the separate revision-aware PPF apply boundary/u);
});

test("#2212 records the Sideshow design influence without adding a runtime dependency", async () => {
  const [architecture, registrySource, readme] = await Promise.all([
    read("docs/architecture/REVIEW-STAGE.md"),
    read("config/third-party-oss.json"),
    read("README.md"),
  ]);
  const registry = JSON.parse(registrySource);
  const sideshow = registry.systems.find((item) => item.id === "sideshow");

  assert.match(architecture, /PLOTPICKLE:OSS-INFLUENCE:sideshow/u);
  assert.match(architecture, /modem-dev\/sideshow/u);
  assert.match(architecture, /MIT-licensed/u);
  assert.match(architecture, /does not embed Sideshow/u);
  assert.match(architecture, /claim affiliation/u);
  assert.equal(sideshow?.usage, "reference-only");
  assert.equal(sideshow?.license, "MIT");
  assert.deepEqual(sideshow?.evidencePaths, ["docs/architecture/REVIEW-STAGE.md"]);
  assert.match(readme, /\| Sideshow \| Inspired the shared visual Review Stage pattern/u);
});

test("#2212 authority summary keeps canon, agent work and review persistence with their existing owners", async () => {
  const { reviewStageAuthoritySummary } = await importReviewStage();
  assert.deepEqual(reviewStageAuthoritySummary(), {
    projectionOnly: true,
    developerEvidenceAuthority: "UAT Semantic Review / deterministic verification",
    creatorFeedbackAuthority: "Unified Feedback / project review threads",
    agentWorkAuthority: "Responsibility Runs",
    canonPromotionAuthority: "Creative Transactions / PPF approval boundary",
    duplicatedAuthority: false,
  });
});
