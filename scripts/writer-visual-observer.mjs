import {
  observeRenderedUi as observeRenderedUiV3,
  parseRenderedEvaluateText,
  reviewRenderedUi as reviewRenderedUiV3,
  visualFactsForWriter as visualFactsForWriterV3,
} from "./writer-visual-observer-v3.mjs";
import { inspectWorkspaceNavigation, navigationViolations } from "./workspace-navigation-uat.mjs";

export { parseRenderedEvaluateText };

export async function observeRenderedUi(client, textExtractor) {
  const facts = await observeRenderedUiV3(client, textExtractor);
  const workspaceNavigation = await inspectWorkspaceNavigation(client);
  return { ...facts, workspaceNavigation };
}

export function reviewRenderedUi(label, facts) {
  const findings = reviewRenderedUiV3(label, facts);
  for (const violation of navigationViolations(facts?.workspaceNavigation)) {
    findings.push({
      kind: "bug",
      severity: "high",
      actionable: true,
      summary: `${label}: global workspace navigation contract failed (${violation}).`,
      expectation: "The global navigation should stay in the approved four visual groups: Dashboard/Community/Wyrmwood; Learn/Plan/Build/Storyboard/Previs; Write/Edit/Feedback/Refine; Reports/Settings.",
      impact: "A writer can lose the intended product flow or see navigation drift that the UAT journey should catch immediately.",
    });
  }
  return findings;
}

export function visualFactsForWriter(facts) {
  const base = visualFactsForWriterV3(facts);
  const navigation = facts?.workspaceNavigation;
  const violations = navigationViolations(navigation);
  return `${base}, globalNavigation=${violations.length ? `FAIL(${violations.join("; ")})` : "PASS"}`;
}
