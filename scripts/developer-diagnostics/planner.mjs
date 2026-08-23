import { matchesAnyPattern, normalizeRepositoryPath } from "./registry.mjs";

function unique(values) {
  return [...new Set(values)];
}

export function planChangedTests(files, registry, options = {}) {
  const normalizedFiles = unique(files.map(normalizeRepositoryPath).filter(Boolean)).sort();
  const matchedAreas = [];

  for (const area of registry.areas) {
    const triggers = normalizedFiles.filter((file) => matchesAnyPattern(file, area.patterns));
    if (!triggers.length) continue;
    matchedAreas.push({
      id: area.id,
      label: area.label,
      triggers,
      suites: [...area.suites],
      contracts: [...(area.contracts || [])],
      allowedPaths: [...area.allowedPaths],
      platform: area.platform || null,
    });
  }

  const suites = unique(matchedAreas.flatMap((area) => area.suites)).sort();
  const contracts = unique(matchedAreas.flatMap((area) => area.contracts)).sort();
  const allowedPaths = unique(matchedAreas.flatMap((area) => area.allowedPaths)).sort();
  const command = suites.length ? ["node", "--test", ...suites] : [];
  const safeFallback = normalizedFiles.length === 0
    ? "No changed files were discovered. Supply --files or explicit --base/--head refs; the full suite was not selected automatically."
    : matchedAreas.length === 0
      ? "Changed files did not match a registered diagnostic area. Add a registry mapping or request an explicit human-approved broader run."
      : null;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: options.source || "unknown",
    base: options.base || null,
    head: options.head || null,
    files: normalizedFiles,
    areas: matchedAreas,
    suites,
    contracts,
    allowedPaths,
    command,
    commandText: command.join(" "),
    requiresHumanApprovalForFullSuite: !registry.defaults?.allowFullSuite,
    safeFallback,
  };
}

export function renderPlan(plan) {
  const lines = [
    "# PlotPickle changed-file test plan",
    "",
    `Source: ${plan.source}`,
    `Changed files: ${plan.files.length}`,
    `Matched areas: ${plan.areas.length}`,
    `Selected suites: ${plan.suites.length}`,
    "",
  ];

  for (const area of plan.areas) {
    lines.push(`## ${area.label}`);
    lines.push("");
    lines.push(`Reason: ${area.triggers.join(", ")}`);
    lines.push(`Suites: ${area.suites.length}`);
    if (area.platform) lines.push(`Platform: ${area.platform}`);
    lines.push("");
  }

  if (plan.commandText) {
    lines.push("## Focused command", "", "```text", plan.commandText, "```", "");
  }
  if (plan.safeFallback) lines.push("## Stop reason", "", plan.safeFallback, "");
  return `${lines.join("\n")}\n`;
}
