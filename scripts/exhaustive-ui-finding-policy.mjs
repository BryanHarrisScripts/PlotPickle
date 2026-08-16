const harnessOnlySummaryPatterns = [
  /could not be exercised by the synthetic UAT runner/i,
  /threw or stalled during synthetic UAT/i,
  /can be activated but produces no observable result/i,
  /exhaustive UAT hit its interaction ceiling/i,
  /exhaustive UAT did not complete any .* interaction/i,
];

const harnessOnlyImpactPatterns = [
  /no matching accessibility ref/i,
  /Playwright MCP did not expose/i,
  /Invalid arguments for tool/i,
  /expected string, received undefined/i,
  /interaction ceiling/i,
  /Required Settings control family was not proven/i,
];

export function isReportableExhaustiveFinding(finding) {
  if (!finding || finding.reportable === false || finding.actionable === false) return false;
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
