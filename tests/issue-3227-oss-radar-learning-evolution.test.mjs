import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeRadarArtifactBundle } from "../lib/verification/oss-radar/artifact-bundle.mjs";
import { projectLearningEvolutionReview, renderLearningEvolutionReview } from "../lib/verification/oss-radar/learning-evolution/review-proposals.mjs";

function radarCandidate(overrides = {}) {
  return {
    fullName: "a/storycraft", url: "https://github.com/a/storycraft",
    focusedEligible: true, focusedDomain: "education", focusedScore: 81,
    focusedEvidence: { groups: [{ id: "character" }] },
    enrichment: { readme: { status: "success" } },
    coverage: { topics: [{ id: "character", path: "learn/character.json" }] },
    ...overrides,
  };
}
function radarResult(candidates = [radarCandidate()], options = {}) {
  return {
    reportDate: "2026-10-22", reportBody: "Existing unmodified broad report",
    creativeFocus: {
      reportDate: "2026-10-22", status: "available",
      baseline: { lessonCount: 81, topics: [{ id: "character", path: "learn/character.json" }] },
      selected: candidates,
    },
    ...options,
  };
}

test("#3227 source-verified top creative finding becomes read-only Human proposal", () => {
  const result = radarResult();
  const original = JSON.stringify(result);
  const review = projectLearningEvolutionReview(result);
  assert.equal(review.status, "available");
  assert.equal(review.proposals.length, 1);
  assert.equal(review.proposals[0].id, "radar:2026-10-22:a/storycraft");
  assert.equal(review.proposals[0].state, "HUMAN_REVIEW_REQUIRED");
  assert.equal(review.proposals[0].authority, "RESEARCH_ONLY");
  assert.equal(review.proposals[0].sourceUrl, "https://github.com/a/storycraft");
  assert.equal(review.proposals[0].evidence.readmeStatus, "success");
  assert.equal(review.proposals[0].proposal.learningEffectiveness, "UNTESTED");
  assert.deepEqual(review.proposals[0].currentCoverage.topics,
    [{ topicId: "character", sourcePath: "learn/character.json" }]);
  assert.equal(review.directChangeAuthorized, false);
  assert.equal(JSON.stringify(result), original, "must not mutate input or source");
  assert.match(renderLearningEvolutionReview(review), /not approved for adoption/u);
});

test("#3227 missing README, generic tools, spoofed URL, unknown domain or unverified coverage never produce proposals", () => {
  const bad = [
    radarCandidate({ fullName: "a/other", url: "https://example.com/a/other" }),
    radarCandidate({ fullName: "a/missing", url: "https://github.com/a/missing",
      enrichment: { readme: { status: "missing" } } }),
    radarCandidate({ fullName: "a/generic", url: "https://github.com/a/generic",
      focusedEligible: false }),
    radarCandidate({ fullName: "a/unknown", url: "https://github.com/a/unknown",
      focusedDomain: "unapproved" }),
    radarCandidate({ fullName: "a/nomatch", url: "https://github.com/a/nomatch",
      coverage: { topics: [{ id: "malicious", path: "learn/malicious.json" }] } }),
  ];
  for (const candidate of bad) {
    const review = projectLearningEvolutionReview(radarResult([candidate]));
    assert.equal(review.proposals.length, 0);
    assert.equal(review.status, "partial");
    assert.equal(review.exclusions.length, 1);
  }
});

test("#3227 zero/partial discovery fails closed and duplicates cannot inflate queue", () => {
  const missing = projectLearningEvolutionReview({ creativeFocus: { status: "unavailable", selected: [radarCandidate()] } });
  assert.equal(missing.status, "unavailable");
  assert.deepEqual(missing.proposals, []);
  const one = radarCandidate();
  const other = radarCandidate({ fullName: "A/STORYCRAFT", url: "https://github.com/A/STORYCRAFT" });
  const duplicated = projectLearningEvolutionReview(radarResult([one, other]));
  assert.equal(duplicated.proposals.length, 1);
  assert.equal(duplicated.exclusions[0].reason, "DUPLICATE");
  const partial = projectLearningEvolutionReview(radarResult([one], {
    creativeFocus: { ...radarResult().creativeFocus, status: "partial", selected: [one] },
  }));
  assert.equal(partial.status, "partial");
});

test("#3227 visual research suggests contextual help/evaluation, never auto-adoption", () => {
  const candidate = radarCandidate({
    focusedDomain: "visual",
    focusedEvidence: { groups: [{ id: "storyboard" }] },
  });
  const review = projectLearningEvolutionReview(radarResult([candidate]));
  assert.equal(review.proposals[0].proposal.target, "VISUALIZE");
  assert.equal(review.proposals[0].proposal.kind, "contextual-help-or-product-evaluation");
  assert.equal(review.proposals[0].directChangeAuthorized, undefined);
  assert.equal(review.directChangeAuthorized, false);
});

test("#3227 existing daily artifact includes proposal JSON and Markdown without changing report publication", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pp-learning-review-"));
  try {
    const input = path.join(dir, "radar.json");
    const output = path.join(dir, "out");
    const fixture = radarResult();
    await writeFile(input, JSON.stringify(fixture));
    const written = await writeRadarArtifactBundle({ resultPath: input, outputDir: output });
    assert.ok(written.files.includes("learning-evolution-proposals.json"));
    assert.ok(written.files.includes("learning-evolution-review.md"));
    const proposals = JSON.parse(await readFile(path.join(output, "learning-evolution-proposals.json"), "utf8"));
    assert.equal(proposals.proposals.length, 1);
    const md = await readFile(path.join(output, "learning-evolution-review.md"), "utf8");
    assert.match(md, /Human review required/iu);
    assert.equal(await readFile(path.join(output, "report.md"), "utf8"), fixture.reportBody);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("#3227 workflow preserves one scheduler and never grants publication to PRs", async () => {
  const workflow = await readFile(new URL("../.github/workflows/oss-radar.yml", import.meta.url), "utf8");
  assert.match(workflow, /cron: '24 4 \* \* \*'/u);
  assert.match(workflow, /timezone: 'America\/Toronto'/u);
  assert.match(workflow, /issue-3227-oss-radar-learning-evolution/u);
  assert.doesNotMatch(workflow, /^  pull_request:/mu);
});
