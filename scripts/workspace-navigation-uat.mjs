import { parseRenderedEvaluateText } from "./writer-visual-observer-v3.mjs";
import { resultText } from "./creative-uat/mcp-runtime.mjs";

export const EXPECTED_NAVIGATION_IDS = [
  "dashboard",
  "community",
  "wyrmwood",
  "learn",
  "plan",
  "build",
  "storyboard",
  "graphic-novel",
  "write",
  "edit",
  "feedback",
  "refine",
  "reports",
  "settings",
];

export const EXPECTED_NAVIGATION_LABELS = [
  "Dashboard",
  "Community",
  "Wyrmwood",
  "Learn",
  "Plan",
  "Build",
  "Storyboard",
  "Previs",
  "Write",
  "Edit",
  "Feedback",
  "Refine",
  "Reports",
  "Settings",
];

export const EXPECTED_NAVIGATION_GAPS = [
  { after: "wyrmwood", kind: "community-game" },
  { after: "graphic-novel", kind: "previs" },
  { after: "refine", kind: "reports" },
];

export async function inspectWorkspaceNavigation(client) {
  const result = await client.call("browser_evaluate", { function: `() => {
    const items = [...document.querySelectorAll('[data-workspace-navigation="true"] [data-workspace-nav-id]')]
      .map((node) => ({
        id: node.getAttribute('data-workspace-nav-id') || '',
        label: (node.querySelector('strong')?.textContent || '').replace(/\\s+/g, ' ').trim(),
        detail: (node.querySelector('small')?.textContent || '').replace(/\\s+/g, ' ').trim(),
      }));
    const gaps = items.length
      ? [...document.querySelectorAll('[data-workspace-navigation="true"] [data-navigation-gap-after]')].map((node) => ({
          after: node.getAttribute('data-workspace-nav-id') || '',
          kind: node.getAttribute('data-navigation-gap-after') || '',
          marginRight: Math.round(parseFloat(getComputedStyle(node).marginRight) || 0),
        }))
      : [];
    return JSON.stringify({ items, gaps });
  }` });
  return parseRenderedEvaluateText(resultText(result));
}

export function navigationViolations(facts) {
  const actualIds = (facts?.items || []).map((item) => item.id);
  const actualLabels = (facts?.items || []).map((item) => item.label);
  const actualGaps = (facts?.gaps || []).map((gap) => ({ after: gap.after, kind: gap.kind }));
  const violations = [];

  if (actualIds.join("|") !== EXPECTED_NAVIGATION_IDS.join("|")) {
    violations.push(`navigation order ${actualIds.join(" → ") || "missing"}`);
  }
  if (actualLabels.join("|") !== EXPECTED_NAVIGATION_LABELS.join("|")) {
    violations.push(`navigation labels ${actualLabels.join(" → ") || "missing"}`);
  }
  if (JSON.stringify(actualGaps) !== JSON.stringify(EXPECTED_NAVIGATION_GAPS)) {
    violations.push(`navigation gaps ${actualGaps.map((gap) => `${gap.after}:${gap.kind}`).join(", ") || "missing"}`);
  }
  for (const gap of facts?.gaps || []) {
    if (Number(gap.marginRight || 0) <= 0) violations.push(`gap after ${gap.after} has no visible spacing`);
  }
  return violations;
}
