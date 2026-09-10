import { parseRenderedEvaluateText } from "./writer-visual-observer-v3.mjs";
import { resultText } from "./creative-uat/mcp-runtime.mjs";

export const EXPECTED_NAVIGATION_AREAS = [
  { id: "home", label: "Home", members: ["dashboard", "library"] },
  { id: "create", label: "Create", members: ["learn", "plan", "build"] },
  { id: "produce", label: "Produce", members: ["storyboard", "graphic-novel", "write", "edit"] },
  { id: "review", label: "Review", members: ["feedback", "refine", "reports"] },
  { id: "connect", label: "Connect / Play", members: ["community", "wyrmwood"] },
  { id: "settings", label: "Settings", members: ["settings"] },
];

export const EXPECTED_NAVIGATION_IDS = EXPECTED_NAVIGATION_AREAS.flatMap((area) => area.members);
export const EXPECTED_NAVIGATION_LABELS = [
  "Dashboard",
  "Library",
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
  "Community",
  "Wyrmwood",
  "Settings",
];
export const EXPECTED_NAVIGATION_GAPS = [];

export async function inspectWorkspaceNavigation(client) {
  const result = await client.call("browser_evaluate", { function: `async () => {
    const visible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
    };
    const readNavigation = () => {
      const shell = document.querySelector('[data-current-navigation-area]');
      const areas = [...document.querySelectorAll('[data-workspace-areas="true"] [data-navigation-area-id]')]
        .map((node) => ({
          id: node.getAttribute('data-navigation-area-id') || '',
          label: (node.querySelector('strong')?.textContent || '').replace(/\\s+/g, ' ').trim(),
          height: Math.round(node.querySelector('button')?.getBoundingClientRect().height || 0),
          current: node.querySelector('button')?.getAttribute('aria-current') === 'location',
        }));
      const items = [...document.querySelectorAll('[data-workspace-navigation="true"] [data-workspace-nav-id]')]
        .map((node) => ({
          id: node.getAttribute('data-workspace-nav-id') || '',
          label: (node.querySelector('strong')?.textContent || '').replace(/\\s+/g, ' ').trim(),
          detail: (node.querySelector('small')?.textContent || '').replace(/\\s+/g, ' ').trim(),
          area: node.getAttribute('data-navigation-area') || '',
          width: Math.round(node.querySelector('button')?.getBoundingClientRect().width || 0),
          height: Math.round(node.querySelector('button')?.getBoundingClientRect().height || 0),
          visible: visible(node),
          current: node.querySelector('button')?.getAttribute('aria-current') === 'page',
        }));
      const visiblePanels = [...document.querySelectorAll('[data-navigation-area-panel]')]
        .filter(visible)
        .map((node) => node.getAttribute('data-navigation-area-panel') || '');
      return {
        areas,
        items,
        visiblePanels,
        currentArea: shell?.getAttribute('data-current-navigation-area') || '',
        currentDestination: shell?.getAttribute('data-current-destination') || '',
        canonicalCount: Number(document.querySelector('[data-navigation-canonical-count]')?.getAttribute('data-navigation-canonical-count') || 0),
        projectContext: visible(document.querySelector('[data-shell-project-context="true"]')),
        primaryNext: visible(document.querySelector('[data-shell-primary-next]')),
      };
    };

    let facts = readNavigation();
    for (let attempt = 0; attempt < 40 && (facts.areas.length === 0 || facts.items.length === 0); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 75));
      facts = readNavigation();
    }
    return JSON.stringify(facts);
  }` });
  return parseRenderedEvaluateText(resultText(result));
}

export function navigationViolations(facts) {
  const violations = [];
  const areas = facts?.areas || [];
  const items = facts?.items || [];
  const actualAreaIds = areas.map((area) => area.id);
  const expectedAreaIds = EXPECTED_NAVIGATION_AREAS.map((area) => area.id);
  const actualAreaLabels = areas.map((area) => area.label);
  const expectedAreaLabels = EXPECTED_NAVIGATION_AREAS.map((area) => area.label);

  if (areas.length > 6 || actualAreaIds.join("|") !== expectedAreaIds.join("|")) {
    violations.push(`navigation areas ${actualAreaIds.join(" → ") || "missing"}`);
  }
  if (actualAreaLabels.join("|") !== expectedAreaLabels.join("|")) {
    violations.push(`navigation area labels ${actualAreaLabels.join(" → ") || "missing"}`);
  }

  const ids = items.map((item) => item.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== EXPECTED_NAVIGATION_IDS.length || EXPECTED_NAVIGATION_IDS.some((id) => !uniqueIds.has(id)) || ids.length !== uniqueIds.size) {
    violations.push(`navigation reachability ${ids.join(" → ") || "missing"}`);
  }
  if (Number(facts?.canonicalCount || 0) !== EXPECTED_NAVIGATION_IDS.length) {
    violations.push(`navigation canonical count ${facts?.canonicalCount ?? "missing"}`);
  }

  for (const expected of EXPECTED_NAVIGATION_AREAS) {
    const actual = items.filter((item) => item.area === expected.id).map((item) => item.id);
    if (actual.join("|") !== expected.members.join("|")) {
      violations.push(`navigation membership ${expected.id}:${actual.join(",") || "missing"}`);
    }
  }
  if (items.some((item) => !expectedAreaIds.includes(item.area))) {
    violations.push("navigation membership contains unknown area");
  }

  if (!expectedAreaIds.includes(facts?.currentArea || "")) {
    violations.push(`active area ${facts?.currentArea || "missing"}`);
  }
  if ((facts?.visiblePanels || []).length !== 1 || facts.visiblePanels[0] !== facts.currentArea) {
    violations.push(`active area panel ${(facts?.visiblePanels || []).join(",") || "missing"}`);
  }
  if (!facts?.currentDestination) {
    violations.push("active destination missing");
  } else if (facts.currentDestination !== "story" && !uniqueIds.has(facts.currentDestination)) {
    violations.push(`active destination ${facts.currentDestination}`);
  }

  const smallAreas = areas.filter((area) => Number(area.height || 0) < 44);
  const smallItems = items.filter((item) => item.visible && (Number(item.width || 0) < 44 || Number(item.height || 0) < 44));
  if (smallAreas.length) violations.push(`navigation area target ${smallAreas.map((area) => `${area.id}:${area.height}`).join(", ")}`);
  if (smallItems.length) violations.push(`navigation item target ${smallItems.map((item) => `${item.id}:${item.width}x${item.height}`).join(", ")}`);
  if (!facts?.projectContext) violations.push("project context missing");

  return violations;
}
