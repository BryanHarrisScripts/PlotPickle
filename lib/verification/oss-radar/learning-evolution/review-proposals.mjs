/**
 * #3227 Learning & Evolution Factory — research-only handoff.
 *
 * Translates the existing evidence-backed OSS RADAR Creative Focus result into
 * bounded Human-review proposals. This module neither imports teaching nor
 * grants lesson, Skill, code, provider, package or merge authority.
 */
const REPOSITORY = /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/iu;
const TOPIC = /^[a-z0-9-]+$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const TARGETS = Object.freeze({
  education: Object.freeze({ primary: "lesson-or-exercise-outline", destination: "LEARN" }),
  visual: Object.freeze({ primary: "contextual-help-or-product-evaluation", destination: "VISUALIZE" }),
});

function validRepository(candidate) {
  const fullName = String(candidate?.fullName || "");
  if (!REPOSITORY.test(fullName) || fullName.includes("..")) return null;
  if (String(candidate?.url || "").toLowerCase() !==
    `https://github.com/${fullName}`.toLowerCase()) return null;
  return fullName;
}

function topicsFromBaseline(candidate, baseline) {
  const known = new Map((baseline?.topics || [])
    .filter((topic) => TOPIC.test(String(topic?.id || "")) &&
      topic.path === `learn/${topic.id}.json`)
    .map((topic) => [topic.id, topic]));
  const result = new Map();
  for (const topic of candidate?.coverage?.topics || []) {
    const canonical = known.get(topic?.id);
    if (canonical && topic.path === canonical.path) result.set(canonical.id, {
      topicId: canonical.id, sourcePath: canonical.path,
    });
  }
  return [...result.values()].sort((a, b) => a.topicId.localeCompare(b.topicId));
}

export function projectLearningEvolutionReview(result = {}) {
  const focus = result?.creativeFocus;
  const date = String(focus?.reportDate || result?.reportDate || "");
  const ready = DATE.test(date) && ["available", "partial"].includes(focus?.status);
  const excluded = [];
  const proposals = [];
  const seen = new Set();
  const baseline = focus?.baseline;
  if (ready && Array.isArray(focus?.selected)) {
    for (const item of focus.selected.slice(0, 3)) {
      const fullName = validRepository(item);
      if (!fullName) { excluded.push({ reason: "INVALID_REPOSITORY" }); continue; }
      const key = fullName.toLowerCase();
      if (seen.has(key)) { excluded.push({ repository: fullName, reason: "DUPLICATE" }); continue; }
      seen.add(key);
      if (item.focusedEligible !== true || item.enrichment?.readme?.status !== "success") {
        excluded.push({ repository: fullName, reason: "UNVERIFIED_README_OR_CREATIVE_FIT" }); continue;
      }
      const score = item.focusedScore;
      if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) {
        excluded.push({ repository: fullName, reason: "INVALID_FOCUSED_SCORE" }); continue;
      }
      const domain = item.focusedDomain;
      if (!Object.hasOwn(TARGETS, domain)) {
        excluded.push({ repository: fullName, reason: "UNSUPPORTED_DOMAIN" }); continue;
      }
      const groups = [...new Set((item.focusedEvidence?.groups || [])
        .map((group) => group?.id).filter((id) => TOPIC.test(String(id || ""))))].sort();
      const topics = topicsFromBaseline(item, baseline);
      if (!groups.length || !topics.length) {
        excluded.push({ repository: fullName, reason: "NO_SOURCE_BACKED_CURRICULUM_MATCH" }); continue;
      }
      proposals.push({
        id: `radar:${date}:${key}`,
        state: "HUMAN_REVIEW_REQUIRED",
        authority: "RESEARCH_ONLY",
        researchDate: date,
        repository: fullName,
        sourceUrl: `https://github.com/${fullName}`,
        evidence: {
          sourceKind: "GITHUB_README_REVALIDATED",
          readmeStatus: "success",
          focusedScore: score,
          matchedCapabilityIds: groups,
          comparison: "Existing PlotPickle coverage is observed; no curriculum gap or product defect is established.",
        },
        currentCoverage: { topics },
        proposal: {
          target: TARGETS[domain].destination,
          kind: TARGETS[domain].primary,
          hypothesis: "Review matched research evidence against the current baseline; independently author and evaluate any approved extension.",
          learningEffectiveness: "UNTESTED",
        },
        reviewRequirements: [
          "Verify primary craft or official technical sources and current editions",
          "Check copyright, licence, attribution, accuracy and accessible teaching",
          "Compare with current LEARN content, Skills and existing product capability",
          "Obtain an explicit Human approval before any content, agent or software change",
          "Require separate exact-source tests and UAT for any implementation",
        ],
      });
    }
  }
  return {
    schemaVersion: 1,
    issue: 3227,
    factory: "learning-evolution",
    profile: "oss-radar-creative-companion",
    reportDate: DATE.test(date) ? date : null,
    status: !ready ? "unavailable" : proposals.length === 0 || focus.status === "partial" || excluded.length
      ? "partial" : "available",
    authority: "RESEARCH_ONLY",
    directChangeAuthorized: false,
    baseline: {
      lessonCount: Number.isInteger(baseline?.lessonCount) ? baseline.lessonCount : null,
      // No lesson or source body is included in this artifact.
      topicCount: Array.isArray(baseline?.topics) ? baseline.topics.length : null,
    },
    proposals,
    exclusions: excluded,
    warning: !ready
      ? "Creative Focus is unavailable or lacks a valid dated report; no proposals were inferred."
      : "Focused repository research is not professional craft authority, lesson effectiveness or approval to install or change software.",
  };
}

export function renderLearningEvolutionReview(review) {
  const lines = [
    "# PlotPickle Learning & Evolution — Research Review Queue",
    "",
    `Report date: ${review.reportDate || "unavailable"}`,
    `Research status: ${review.status}`,
    "Authority: RESEARCH ONLY — Human review required",
    "",
    "This is a read-only proposal projection of the existing OSS RADAR Creative Focus evidence.",
    "It does not change lesson content, canon, Skills, dependencies, issues or code.",
    "",
  ];
  if (!review.proposals.length) lines.push("No source-verified proposals qualified for this report.", "");
  for (const entry of review.proposals) {
    lines.push(`## [${entry.repository}](${entry.sourceUrl})`, "",
      `Focused Score: ${entry.evidence.focusedScore}/100 (research ranking, not teaching effectiveness)`,
      `Potential output: ${entry.proposal.target} / ${entry.proposal.kind}`,
      `Existing coverage: ${entry.currentCoverage.topics.map((x) => x.topicId).join(", ")}`,
      `Matched capabilities: ${entry.evidence.matchedCapabilityIds.join(", ")}`,
      "Decision: HUMAN REVIEW REQUIRED; not approved for adoption.",
      "");
  }
  lines.push("Before approval, independently validate primary sources, licence, coverage, accuracy and accessibility. Implementation, installation and merging remain separate governed decisions.", "");
  return lines.join("\n");
}
