function safeText(value) {
  return String(value || "").replace(/\p{Extended_Pictographic}/gu, "").replace(/[\r\n]/gu, " ").replace(/[<>`\[\]]/gu, "").slice(0, 900);
}

export function renderCreativeReview(result) {
  if (!result || result.status === "disabled") return "";
  const lines = [
    "## Creative Focus — Storytelling Education and Visual Production Top 3",
    "",
    "Companion review for Human consideration. The broad Radar keeps its existing score and selection. Focused scores measure documented creative relevance, not validated integration quality.",
    "",
    `Status: ${result.status}. Historical candidates scanned: ${result.historicalScanned || 0}; shortlisted for refresh: ${result.historicalRefreshed || 0}. Fresh queries: ${result.freshQueriesExecuted || 0}; fresh repositories: ${result.freshCandidatesExamined || 0}. Refresh attempts: ${result.refreshAttempted || 0}; eligible revalidated candidates: ${result.revalidated || 0}.`,
    "",
    `History window: ${(result.historicalMonths || []).join("; ")}. Current Learn baseline: ${result.baseline?.lessonCount || 0} canonical lessons; topic coverage does not establish feature completeness.`,
    result.dailyNovelty ? `Daily non-repeat truth: Previous Creative Focus report ${result.dailyNovelty.previousReportDate || "none"}; excluded ${result.dailyNovelty.excludedRepositories.length} prior featured repositories; selected ${result.dailyNovelty.selected}/${result.dailyNovelty.target}; shortfall ${result.dailyNovelty.shortfall}. Previously featured projects cannot be restored to fill empty slots.` : "Daily non-repeat status unavailable; no Creative Focus candidates published.",
    "",
  ];
  for (const warning of result.warnings || []) lines.push(`- ${safeText(warning)}`);
  if (!result.selected?.length) lines.push("No currently enriched candidate qualified. No weak or stale finding was added to fill three slots.");
  for (const [index, candidate] of (result.selected || []).entries()) {
    const access = candidate.focusedEvidence.access.map((entry) => `${entry.id}: ${entry.matchedPhrases.join(", ")}`).join("; ") || "No reusable access evidenced";
    const concepts = candidate.focusedEvidence.groups.map((entry) => `${entry.id} (${entry.matchedPhrases.join(", ")})`).join("; ");
    const topics = candidate.coverage.topics.map((topic) => `${topic.title}: ${topic.lessonCount} lessons (${topic.path})`).join("; ");
    const source = candidate.provenance?.at(-1);
    const skills = (candidate.coverage.skills || []).map((skill) => `${skill.name} (${skill.path})`).join("; ");
    lines.push("", `### Focus ${index + 1}. [${candidate.fullName}](${candidate.url})`, "",
      `- **Focused Enriched PlotPickle Score:** ${candidate.focusedScore.toFixed(2)}/100 — ${candidate.focusedDomain === "education" ? "storytelling education" : "visual production"}`,
      `- **Original broad Radar score:** ${candidate.broadScore == null ? "not previously recorded" : `${candidate.broadScore.toFixed(2)}/100`} (different scoring profile).`,
      `- **Description:** ${safeText(candidate.description)}`,
      `- **Documented creative capabilities:** ${safeText(concepts)}`,
      `- **Human / agent intake evidence:** ${safeText(access)}. Keyword evidence requires review of actual usability.`,
      `- **Existing PlotPickle coverage:** ${safeText(topics || "No matching Learn topic in the baseline")}${candidate.coverage.paths.length ? `; source owners: ${candidate.coverage.paths.join(", ")}` : ""}.`,
      `- **Existing agent procedures:** ${safeText(skills || "No mapped procedure in the current canonical registry")}.`,
      `- **Proposed extension:** ${safeText(candidate.coverage.proposedExtension)}`,
      `- **Score breakdown:** ${Object.entries(candidate.focusedDimensions).map(([id, value]) => `${id} ${value.points}/${value.weight}`).join("; ")}.`,
      `- **Provenance:** ${source ? `[Radar ${source.date}](${source.url}); refreshed GitHub metadata/README/package` : "fresh targeted GitHub discovery; current metadata/README/package"}.`,
      `- **Licence / activity:** ${safeText(candidate.license.spdxId)}; latest push ${safeText(candidate.pushedAt)}.`,
      "- **Next step:** research/adapt independently authored teaching or evaluate visual workflow support; Human approval before adoption.");
  }
  if (result.historicalComparison?.length) {
    lines.push("", "### Historical shortlist comparison", "");
    for (const item of result.historicalComparison) lines.push(`- ${item.fullName}: ${item.result} (${item.focusedScore.toFixed(2)}/100 focused).`);
  }
  if (result.failures?.length) {
    lines.push("", "### Candidates excluded during revalidation", "");
    for (const item of result.failures) lines.push(`- ${item.fullName}: ${safeText(item.reasons.join(", "))}.`);
  }
  return lines.join("\n");
}
