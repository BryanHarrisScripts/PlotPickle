import { parseRenderedEvaluateText } from "./writer-visual-observer-v3.mjs";
import { resultText } from "./creative-uat/mcp-runtime.mjs";

export const EXPECTED_NAVIGATION_IDS = [
  "community",
  "library",
  "learn",
  "wyrmwood",
  "plan",
  "build",
  "storyboard",
  "graphic-novel",
  "write",
  "edit",
  "feedback",
  "refine",
  "reports",
  "dashboard",
  "settings",
];

export const EXPECTED_NAVIGATION_LABELS = [
  "Community",
  "Library",
  "Learn",
  "Wyrmwood",
  "Plan",
  "Build",
  "Storyboard",
  "Previs",
  "Write",
  "Edit",
  "Feedback",
  "Refine",
  "Reports",
  "Dashboard",
  "Settings",
];

export const EXPECTED_NAVIGATION_GAPS = [];

export async function inspectWorkspaceNavigation(client) {
  const result = await client.call("browser_evaluate", { function: `async () => {
    const readNavigation = () => {
      const items = [...document.querySelectorAll('[data-workspace-navigation="true"] [data-workspace-nav-id]')]
        .map((node) => ({
          id: node.getAttribute('data-workspace-nav-id') || '',
          label: (node.querySelector('strong')?.textContent || '').replace(/\\s+/g, ' ').trim(),
          detail: (node.querySelector('small')?.textContent || '').replace(/\\s+/g, ' ').trim(),
          width: Math.round(node.getBoundingClientRect().width),
        }));
      const gaps = items.length
        ? [...document.querySelectorAll('[data-workspace-navigation="true"] [data-navigation-gap-after]')].map((node) => ({
            after: node.getAttribute('data-workspace-nav-id') || '',
            kind: node.getAttribute('data-navigation-gap-after') || '',
            marginRight: Math.round(parseFloat(getComputedStyle(node).marginRight) || 0),
          }))
        : [];
      return { items, gaps };
    };

    let facts = readNavigation();
    for (let attempt = 0; attempt < 40 && facts.items.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 75));
      facts = readNavigation();
    }
    return JSON.stringify(facts);
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
  const oversized = (facts?.items || []).filter((item) => Number(item.width || 0) > 72);
  if (oversized.length) {
    violations.push(`navigation item width ${oversized.map((item) => `${item.id}:${item.width}`).join(", ")}`);
  }
  return violations;
}
