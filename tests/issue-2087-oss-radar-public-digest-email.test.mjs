import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderEmailArtifact } from "../lib/verification/oss-radar/email-artifact.mjs";
import { renderGitHubSummary } from "../lib/verification/oss-radar/github-summary.mjs";
import { renderRadarReviewEmail, renderXReadyDigest } from "../lib/verification/oss-radar/public-digest.mjs";
import { renderDailyReport } from "../lib/verification/oss-radar/report-renderer.mjs";

const workflow = await readFile(".github/workflows/oss-radar.yml", "utf8");

function candidate(overrides = {}) {
  return {
    repositoryStableId: 1001,
    fullName: "example/story-tool",
    url: "https://github.com/example/story-tool",
    description: "Open-source storyboarding and previs workflow for filmmakers.",
    score: 88.5,
    discoveryScore: 77.2,
    scoreStage: "enriched",
    matchedLaneIds: ["visual-story"],
    matchedQueries: ["storyboard AI"],
    searchableText: "storyboard previs local windows production",
    primaryDisposition: "LEARN",
    reviewQualification: "qualified",
    qualificationThreshold: 65,
    qualificationGap: 0,
    previouslyReviewed: false,
    plotPickleFit: {
      targets: ["Visual Story / Storyboard / Previs"],
      craftModules: ["12"],
      relatedIssues: [1918],
      internalCategories: ["VISUAL STORY"],
    },
    scoreEvidence: {
      activity: { ageDays: 0 },
      relevance: {
        matchedTerms: ["storyboard"],
        evidenceConcepts: ["storyboard-previs", "windows-local"],
        plotPickleTargets: ["Storyboard", "Previs"],
      },
      reasonCodes: ["evidence-lane:visual-story", "evidence:storyboard-previs"],
    },
    license: { spdxId: "MIT", status: "known-open-source" },
    ...overrides,
  };
}

test("#2087 public digest is copy-ready and strips internal Radar metadata", () => {
  const first = candidate();
  const second = candidate({
    repositoryStableId: 1002,
    fullName: "example/agent-runtime",
    url: "https://github.com/example/agent-runtime",
    description: "Agent runtime with MCP tools and pluggable skills.",
    matchedLaneIds: ["ai-architecture"],
    searchableText: "agent runtime mcp skills",
  });
  const digest = renderXReadyDigest({ reportDate: "2026-09-15", candidates: [first, second] });

  assert.match(digest, /Story-to-Screen OSS Radar — 2026-09-15/u);
  assert.match(digest, /example\/story-tool/u);
  assert.match(digest, /STORYBOARD/u);
  assert.match(digest, /example\/agent-runtime/u);
  assert.match(digest, /AGENTS/u);
  assert.match(digest, /Why it matters:/u);
  assert.match(digest, /Presented by PlotPickle/u);
  assert.doesNotMatch(digest, /88\.5|77\.2|Enriched PlotPickle Score|Discovery Score/u);
  assert.doesNotMatch(digest, /#1918|evidence-lane|qualification|reason code/u);
});

test("#2087 public digest never pads beyond real candidates", () => {
  const digest = renderXReadyDigest({ reportDate: "2026-09-15", candidates: [candidate()] });
  assert.match(digest, /^1\. example\/story-tool —/mu);
  assert.doesNotMatch(digest, /^2\./mu);
});

test("#2087 detailed Radar report keeps internal evidence and appends a separate public section", () => {
  const item = candidate({ radarHistory: { label: "first Radar review" } });
  const selection = {
    selected: [item],
    belowThreshold: [],
    reviewQueue: [item],
    target: 5,
    reviewTarget: 5,
  };
  const contract = {
    report: { targetFindings: 5, humanDispositions: ["WATCH", "SAVE", "IMPROVE", "ADD", "LEARN"] },
    runtimeRadar: {
      discovery: { discoveryCoverage: {}, creationAge: {} },
      candidateHistorySummary: {},
      candidateLedger: [],
    },
  };
  const rendered = renderDailyReport({ reportDate: "2026-09-15", selection, contract, history: new Map() });

  assert.match(rendered.body, /Enriched PlotPickle Score/u);
  assert.match(rendered.body, /Related Issue fit/u);
  assert.match(rendered.body, /## X-ready public digest/u);
  assert.match(rendered.body, /```text\n🎬 Story-to-Screen OSS Radar/u);
  const publicSection = rendered.body.split("## X-ready public digest")[1] || "";
  assert.doesNotMatch(publicSection.split("<!-- PLOTPICKLE-OSS-RADAR-STATE:")[0] || "", /Enriched PlotPickle Score|Related Issue fit|#1918|evidence-lane/u);
});

test("#2087 review email carries the copy block, links and internal report pointer", () => {
  const item = candidate();
  const publicDigest = renderXReadyDigest({ reportDate: "2026-09-15", candidates: [item] });
  const email = renderRadarReviewEmail({
    reportDate: "2026-09-15",
    candidates: [item],
    publicDigest,
    reportUrl: "https://github.com/BryanHarrisScripts/PlotPickle/issues/3000#issuecomment-7000",
  });
  assert.equal(email.subject, "PlotPickle OSS Radar - 2026-09-15 - X draft");
  assert.match(email.body, /----- COPY FOR X -----/u);
  assert.match(email.body, /example\/story-tool: https:\/\/github\.com\/example\/story-tool/u);
  assert.match(email.body, /issuecomment-7000/u);
  assert.doesNotMatch(email.body, /Enriched PlotPickle Score|Discovery Score|#1918|evidence-lane/u);
});

test("#2087 email artifact is standard plain text and rejects header injection", () => {
  const eml = renderEmailArtifact({
    email: { subject: "PlotPickle OSS Radar - 2026-09-15 - X draft", body: "copy me" },
    from: "radar@example.test",
    to: "review@example.test",
  });
  assert.match(eml, /^From: radar@example\.test\r\nTo: review@example\.test\r\nSubject:/u);
  assert.match(eml, /Content-Type: text\/plain; charset=UTF-8/u);
  assert.match(eml, /\r\n\r\ncopy me\r\n$/u);
  assert.throws(() => renderEmailArtifact({
    email: { subject: "safe\r\nBcc: attacker@example.test", body: "x" },
    from: "radar@example.test",
    to: "review@example.test",
  }), /subject is invalid/u);
});

test("#2087 workflow uses GitHub-native summary delivery without custom SMTP", () => {
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /tests\/issue-2087-oss-radar-\*\.test\.mjs/u);
  assert.match(workflow, /oss-radar-result\.json/u);
  assert.match(workflow, /github-summary\.mjs oss-radar-result\.json/u);
  assert.doesNotMatch(workflow, /email_mode|OSS_RADAR_SMTP|OSS_RADAR_EMAIL_TO|curl --fail|--mail-from|--mail-rcpt/u);
});

test("#2087 GitHub run summary carries report link, X-ready copy and PlotPickle footer", () => {
  const digest = renderXReadyDigest({ reportDate: "2026-09-15", candidates: [candidate()] });
  const summary = renderGitHubSummary({
    reportDate: "2026-09-15",
    reportUrl: "https://github.com/BryanHarrisScripts/PlotPickle/issues/3000#issuecomment-7000",
    reviewCount: 7,
    reviewTarget: 21,
    publicDigest: digest,
  });
  assert.match(summary, /PlotPickle OSS Radar — 2026-09-15/u);
  assert.match(summary, /Open the full OSS Radar report/u);
  assert.match(summary, /Architecture findings: 7\/21/u);
  assert.match(summary, /X-ready post/u);
  assert.match(summary, /Story-to-Screen OSS Radar/u);
  assert.match(summary, /Presented by PlotPickle — Today’s OSS Radar/u);
});
