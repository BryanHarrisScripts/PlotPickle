import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #117 supports every required AI review scope", async () => {
  const workflows = await source("lib/review-workflows.ts");
  for (const scope of [
    "project",
    "act",
    "sequence",
    "selected-blocks",
    "all-blocks",
    "selected-mini-blocks",
    "all-mini-blocks",
    "character-arc",
    "treatment",
    "screenplay",
    "scenes",
    "storyboard-continuity",
  ]) assert.ok(workflows.includes(`\"${scope}\"`), `Missing AI review scope: ${scope}`);
  assert.match(workflows, /buildAiReviewContext/);
  assert.match(workflows, /stable Block IDs/);
  assert.match(workflows, /stable mini-block IDs/);
});

test("issue #117 provides every suggested review lens", async () => {
  const workflows = await source("lib/review-workflows.ts");
  for (const lens of [
    "story-editor",
    "instructor",
    "director",
    "producer",
    "actor",
    "dialogue-specialist",
    "continuity-reviewer",
    "visual-continuity-reviewer",
    "audience-reader",
    "pacing-analyst",
    "structure-analyst",
  ]) assert.ok(workflows.includes(`\"${lens}\"`), `Missing AI review lens: ${lens}`);
  assert.match(workflows, /AI_REVIEW_LENSES/);
});

test("issue #117 prepares privacy context cost and writer-control notices before submission", async () => {
  const workflows = await source("lib/review-workflows.ts");
  for (const contract of [
    "createAiReviewNotice",
    "privacy:",
    "context:",
    "cost:",
    "writerControl:",
    "No AI provider is connected",
    "Provider charges may apply",
    "cannot change canonical story content automatically",
  ]) assert.ok(workflows.includes(contract), `Missing review notice contract: ${contract}`);
});

test("issue #117 records provider model date context and prompt provenance", async () => {
  const workflows = await source("lib/review-workflows.ts");
  for (const contract of [
    "AiProviderSnapshot",
    "requestedAt",
    "completedAt",
    "contextCharacters",
    "estimatedInputTokens",
    "instructions",
    "prompt",
    "promptHash",
    "AI review provenance",
    "Prompt hash",
  ]) assert.ok(workflows.includes(contract), `Missing AI provenance contract: ${contract}`);
  assert.match(workflows, /fnv1a-/);
  assert.doesNotMatch(workflows, /node:crypto|createHash\(/);
});

test("issue #117 parses structured AI summaries findings patterns and priorities", async () => {
  const workflows = await source("lib/review-workflows.ts");
  for (const contract of [
    "parseAiReviewResult",
    "projectSummary",
    "findings",
    "recurringPatterns",
    "priorities",
    "proposedChange",
    "evidence",
    "targetForFinding",
  ]) assert.ok(workflows.includes(contract), `Missing structured AI result contract: ${contract}`);
});

test("issue #117 saves AI output as feedback without applying canon", async () => {
  const workflows = await source("lib/review-workflows.ts");
  assert.match(workflows, /saveAiReviewResult/);
  assert.match(workflows, /next = createFeedback\(next, input\)/);
  assert.match(workflows, /status: "under-review"/);
  assert.match(workflows, /source: "ai"/);
  assert.doesNotMatch(workflows, /project\.blocks\s*=|project\.screenplay\s*=|applyCanonical|updateCanonical/);
});

test("issue #117 supports human identity requests threads approvals resolution and GitHub linkage", async () => {
  const workflows = await source("lib/review-workflows.ts");
  for (const contract of [
    "HumanReviewerIdentity",
    "HumanReviewRequest",
    "reviewer",
    "organisation",
    "contact",
    "questions",
    "requestedAt",
    "dueAt",
    "HumanReviewStatus",
    "githubProposalUrl",
    "githubProposalNumber",
    "createHumanReviewRequest",
    "createFeedback",
  ]) assert.ok(workflows.includes(contract), `Missing human review contract: ${contract}`);
});

test("issue #117 converts accepted feedback to an approval-gated revision proposal", async () => {
  const workflows = await source("lib/review-workflows.ts");
  for (const contract of [
    "ReviewRevisionProposal",
    "createRevisionProposalFromFeedback",
    "approveRevisionProposal",
    "rejectRevisionProposal",
    'status: "proposed"',
    'status: "approved"',
    'status: "rejected"',
    "approvedAt",
    "approvedBy",
  ]) assert.ok(workflows.includes(contract), `Missing revision proposal boundary: ${contract}`);
  assert.match(workflows, /if \(proposal\.status !== "proposed"\) return proposal/);
});

test("issue #117 can accept reject or defer findings and export a review summary", async () => {
  const workflows = await source("lib/review-workflows.ts");
  assert.match(workflows, /reviewDecisionStatus/);
  assert.match(workflows, /"accept" \| "reject" \| "defer"/);
  assert.match(workflows, /return "accepted"/);
  assert.match(workflows, /return "rejected"/);
  assert.match(workflows, /return "deferred"/);
  assert.match(workflows, /exportReviewSummary/);
  assert.match(workflows, /# \$\{title\}/);
  assert.match(workflows, /Linked revision/);
});

test("issue #117 remains useful without AI or GitHub", async () => {
  const workflows = await source("lib/review-workflows.ts");
  assert.match(workflows, /You can prepare and save the review request locally/);
  assert.match(workflows, /githubProposalUrl: clean\(input\.githubProposalUrl\)/);
  assert.match(workflows, /githubProposalNumber: input\.githubProposalNumber \?\? null/);
  assert.doesNotMatch(workflows, /throw new Error\("Connect GitHub|throw new Error\("Connect an AI/);
});

test("issue #117 mounts dedicated AI and human workflows inside Feedback", async () => {
  const feedback = await source("app/feedback-workspace.tsx");
  for (const contract of [
    'import ReviewWorkflowsPanel from "./review-workflows-panel"',
    'section === "ai-review"',
    'mode="ai"',
    'section === "human-review"',
    'mode="human"',
  ]) assert.ok(feedback.includes(contract), `Missing Feedback workflow mount: ${contract}`);
});

test("issue #117 AI workflow checks the local provider and requires notice acknowledgement", async () => {
  const panel = await source("app/review-workflows-panel.tsx");
  for (const contract of [
    'fetch("/api/local-ai/connection"',
    'fetch("/api/local-ai/generate/text"',
    "Prepare review",
    "Copy prepared prompt",
    "Privacy",
    "Context",
    "Cost",
    "Writer control",
    "I reviewed the selected context, privacy notice and possible provider cost.",
    "Submit AI review",
    "Connect a provider in Settings to submit",
  ]) assert.ok(panel.includes(contract), `Missing live AI review contract: ${contract}`);
  assert.match(panel, /disabled=\{!provider\.connected \|\| !acknowledged/);
});

test("issue #117 AI results expose structured findings decisions and proposal approval", async () => {
  const panel = await source("app/review-workflows-panel.tsx");
  for (const contract of [
    "Structured result",
    "Recurring patterns",
    "Priorities",
    "Save all under review",
    "Accept as feedback",
    "Defer",
    "Reject",
    "Create an approval-gated revision proposal",
    "Approve proposal",
    "Reject proposal",
    "No story record changes until a later explicit revision operation",
  ]) assert.ok(panel.includes(contract), `Missing AI result decision contract: ${contract}`);
});

test("issue #117 human workflow collects identity questions due date GitHub link and exports", async () => {
  const panel = await source("app/review-workflows-panel.tsx");
  for (const contract of [
    "Structured human review",
    "Reviewer name",
    "Reviewer role",
    "Organisation",
    "Contact · optional",
    "Requested due date",
    "GitHub proposal URL · optional",
    "GitHub proposal number · optional",
    "Review questions · one per line",
    "Create human review request",
    "Export review summary",
    "Local-first review",
  ]) assert.ok(panel.includes(contract), `Missing human review UI contract: ${contract}`);
  assert.match(panel, /createHumanReviewRequest\(project/);
  assert.match(panel, /exportReviewSummary\(model\.records/);
});

test("issue #117 visually distinguishes AI and human review", async () => {
  const panelCss = await source("app/review-workflows-panel.module.css");
  const feedbackCss = await source("app/feedback-workspace.module.css");
  const feedback = await source("app/feedback-workspace.tsx");
  assert.match(panelCss, /\.aiPanel\{/);
  assert.match(panelCss, /\.humanPanel\{/);
  assert.match(feedbackCss, /\.aiRecord\{/);
  assert.match(feedbackCss, /\.humanRecord\{/);
  assert.match(feedback, /record\.source === "ai" \|\| record\.source === "diagnostic"/);
});

test("issue #117 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-117-ai-human-review\.test\.mjs/);
  assert.equal(packageJson.scripts["test:review-workflows"], "node --test tests/issue-117-ai-human-review.test.mjs");
});
