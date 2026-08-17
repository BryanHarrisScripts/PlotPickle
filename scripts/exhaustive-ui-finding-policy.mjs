const harnessOnlySummaryPatterns = [
  /could not be exercised by the synthetic UAT runner/i,
  /threw or stalled during synthetic UAT/i,
  /could not be completed by the synthetic browser harness/i,
  /has no current accessibility target/i,
  /was discovered but could not be reached again/i,
  /exhaustive UAT (?:hit|reached) its .* ceiling/i,
  /exhaustive UAT did not complete any .* interaction/i,
];

const harnessOnlyImpactPatterns = [
  /no matching accessibility ref/i,
  /no current accessibility target/i,
  /Playwright MCP did not expose/i,
  /Invalid arguments for tool/i,
  /expected string, received undefined/i,
  /MCP argument validation/i,
  /Browser harness:/i,
  /interaction ceiling/i,
  /follow-up ceiling/i,
  /Required Settings control family was not proven/i,
];

const harnessOnlyKinds = new Set(["harness", "accessibility", "unreached"]);

export function isReportableExhaustiveFinding(finding) {
  if (!finding || finding.reportable === false || finding.actionable === false) return false;
  if (harnessOnlyKinds.has(String(finding.kind || "").toLowerCase())) return false;
  const summary = String(finding.summary || "");
  const impact = String(finding.impact || "");
  if (harnessOnlySummaryPatterns.some((pattern) => pattern.test(summary))) return false;
  if (harnessOnlyImpactPatterns.some((pattern) => pattern.test(impact))) return false;
  return true;
}

export function partitionExhaustiveFindings(findings = []) {
  const reportable = [];
  const harnessOnly = [];
  for (const finding of findings) {
    (isReportableExhaustiveFinding(finding) ? reportable : harnessOnly).push(finding);
  }
  return { reportable, harnessOnly };
}
