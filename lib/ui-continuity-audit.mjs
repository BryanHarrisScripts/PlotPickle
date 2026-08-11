const CANONICAL_NAVIGATION = ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Edit", "Graphic Novel", "Build", "Feedback", "Refine", "Reports"];

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function issue(id, message, severity = "warning") {
  return { id, severity, message };
}

function includesNamedReturn(controls, destination) {
  const wanted = clean(destination).toLowerCase();
  return (controls || []).some((label) => {
    const value = clean(label).toLowerCase();
    return (value.startsWith("back to ") || value.startsWith("return to ") || value.includes("back to ")) && value.includes(wanted);
  });
}

export function auditContinuitySnapshot(screen, snapshot, baseline = null) {
  const findings = [];
  const workspaceScreen = screen.kind === "workspace" || screen.kind === "nested-workspace";

  if (!snapshot?.rendered) findings.push(issue("screen-not-rendered", "The screen did not produce a visible main surface.", "error"));
  if (snapshot?.theme !== "dark") findings.push(issue("theme", "The root theme is not the approved dark theme."));
  if ((snapshot?.legacyPalette || []).length) {
    const sample = snapshot.legacyPalette.slice(0, 4).map((entry) => `${entry.property} ${entry.value}`).join(", ");
    findings.push(issue("legacy-palette", `Retired teal, blue or purple styling is still visible (${sample}).`, "error"));
  }
  if ((snapshot?.navigationOverlaps || []).length) {
    const overlap = snapshot.navigationOverlaps[0];
    findings.push(issue("navigation-overlap", `${overlap.first} and ${overlap.second} overlap by ${overlap.width}×${overlap.height}px.`, "error"));
  }
  if (!snapshot?.anchor?.visible) findings.push(issue("agent-settings-anchor", "The fixed Agent & Settings anchor is missing or hidden.", "error"));
  else {
    if (snapshot.anchor.x > 32 || snapshot.anchor.y > 32) findings.push(issue("agent-settings-position", `The Agent & Settings anchor moved from the top-left contract (${snapshot.anchor.x}, ${snapshot.anchor.y}).`));
    if (snapshot.anchor.name !== "Open Agent and Settings") findings.push(issue("agent-settings-name", "The Agent & Settings anchor does not expose its canonical accessible name."));
  }

  if (workspaceScreen) {
    if (snapshot?.shell?.contract !== "v1") findings.push(issue("shared-shell", "The canonical shared application shell is missing.", "error"));
    if (snapshot?.shell?.designSystem !== "matte-black-teal-orange") findings.push(issue("design-system", "The shared shell is not marked with the approved matte-black/teal-orange design contract."));
    if (snapshot?.activeWorkspace !== screen.activeWorkspace) findings.push(issue("active-workspace", `Expected active workspace ${screen.activeWorkspace}, found ${snapshot?.activeWorkspace || "none"}.`));
    if (!snapshot?.projectStrip) findings.push(issue("project-context", "The persistent project/save/progress strip is missing."));
    if (!snapshot?.statusSignals) findings.push(issue("status", "No visible project or workspace status signal was found."));
    for (const label of CANONICAL_NAVIGATION) {
      if (!(snapshot?.navigation || []).includes(label)) findings.push(issue(`navigation-${label.toLowerCase().replaceAll(" ", "-")}`, `${label} is missing from the shared navigation.`));
    }
    if (baseline && snapshot.shell) {
      if (Math.abs(Number(snapshot.shell.height) - Number(baseline.height)) > 1) findings.push(issue("shell-height", `Shared-shell height drifted from ${baseline.height}px to ${snapshot.shell.height}px.`));
      if (snapshot.shell.background !== baseline.background) findings.push(issue("shell-background", "Shared-shell background differs from the baseline Dashboard shell."));
      if (snapshot.shell.borderBottom !== baseline.borderBottom) findings.push(issue("shell-border", "Shared-shell border treatment differs from the baseline Dashboard shell."));
      if (snapshot.shell.fontFamily !== baseline.fontFamily) findings.push(issue("shell-type", "Shared-shell typography differs from the baseline Dashboard shell."));
    }
  }

  if (screen.returnDestination && !includesNamedReturn(snapshot?.returnControls, screen.returnDestination)) {
    findings.push(issue("named-return", `No visible Back to ${screen.returnDestination} or Return to ${screen.returnDestination} control was found.`, "error"));
  }

  return {
    screenId: screen.id,
    label: screen.label,
    path: screen.path,
    passed: findings.length === 0,
    findings,
  };
}

export function continuitySummary(results) {
  const errors = results.flatMap((result) => result.findings).filter((finding) => finding.severity === "error").length;
  const warnings = results.flatMap((result) => result.findings).filter((finding) => finding.severity === "warning").length;
  const passed = results.filter((result) => result.passed).length;
  return { screens: results.length, passed, findings: errors + warnings, errors, warnings };
}

export function continuityReport({ generatedAt, server, results, runtimeError = "" }) {
  const summary = continuitySummary(results);
  const lines = [
    "# PlotPickle UI Continuity Agent report",
    "",
    `Generated: ${generatedAt}`,
    `Local application: ${server}`,
    "Mode: read-only audit",
    "Automatic fixes: disabled",
    "",
    "The agent inspected rendered screens but did not click destructive controls, change project data, edit source files or apply design corrections. Any correction requires a separate, explicit human approval.",
    "",
    "## Summary",
    "",
    `Screens inspected: ${summary.screens}`,
    `Screens with no findings: ${summary.passed}`,
    `Findings: ${summary.findings} (${summary.errors} errors, ${summary.warnings} warnings)`,
  ];
  if (runtimeError) lines.push("", `Runtime note: ${runtimeError}`);
  lines.push("", "## Screen results", "");
  for (const result of results) {
    lines.push(`### ${result.label}`, "", `Route: \`${result.path}\``, `Result: ${result.passed ? "PASS" : "REVIEW"}`, "");
    if (result.passed) lines.push("All registered shared-shell, anchor, navigation, project, status, theme and return-control contracts passed.", "");
    else for (const finding of result.findings) lines.push(`- ${finding.severity.toUpperCase()}: ${finding.message}`);
    if (!result.passed) lines.push("");
  }
  lines.push("## Approval boundary", "", "This report is advisory. The UI Continuity Agent has no auto-fix path. A person must review the evidence and explicitly approve a separate code change before any finding can alter PlotPickle.", "");
  return `${lines.join("\n")}\n`;
}
