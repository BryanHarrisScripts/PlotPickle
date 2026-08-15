export const EXPECTED_BROWSER_SCREENS = [
  "Dashboard",
  "Plan",
  "Storyboard",
  "Write",
  "Edit",
  "Graphic Novel",
  "Build",
  "Feedback",
  "Refine",
  "Reports",
  "Settings",
];

export const MIN_SNAPSHOT_LENGTH = 250;

const rowPattern = /^\|\s*([^|]+?)\s*\|\s*(PASS|WARN|FAIL)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/;

export function safeSlug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function parseAcceptanceReport(markdown) {
  const text = String(markdown || "");
  const overall = text.match(/^Overall:\s*(PASS|WARN|FAIL)\s*$/m)?.[1] || "UNKNOWN";
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(rowPattern);
    if (!match) continue;
    rows.push({
      screen: match[1].trim(),
      status: match[2],
      navigation: match[3].trim(),
      location: match[4].trim(),
      screenshot: match[5].trim(),
    });
  }
  const consoleErrors = /(?:^|\n)\s*Console:\s*.+/i.test(text);
  const runnerError = text.match(/## Blocking runner error\s*\n\s*\n([^\n]+)/i)?.[1]?.trim() || "";
  return { overall, rows, consoleErrors, runnerError };
}

export function parseContinuityReport(markdown) {
  const text = String(markdown || "");
  const summary = text.match(/Screens inspected:\s*(\d+)[\s\S]*?Findings:\s*(\d+)\s*\((\d+)\s+errors,\s*(\d+)\s+warnings\)/i);
  const runtimeError = text.match(/Runtime note:\s*([^\n]+)/i)?.[1]?.trim() || "";
  return {
    screens: Number(summary?.[1] || 0),
    findings: Number(summary?.[2] || 0),
    errors: Number(summary?.[3] || 0),
    warnings: Number(summary?.[4] || 0),
    runtimeError,
  };
}

function pushUnique(target, message) {
  if (message && !target.includes(message)) target.push(message);
}

export function assessAutopilotEvidence({
  browser,
  continuity,
  snapshotLengths = {},
  learn = {},
  agents = {},
  browserExitCode = 0,
  continuityExitCode = 0,
}) {
  const blockers = [];
  const warnings = [];

  if (browserExitCode !== 0) pushUnique(blockers, `Browser UAT process exited with code ${browserExitCode}.`);
  if (browser.overall === "FAIL" || browser.overall === "UNKNOWN") {
    pushUnique(blockers, browser.runnerError ? `Browser UAT failed: ${browser.runnerError}` : `Browser UAT overall result is ${browser.overall}.`);
  }
  if (browser.consoleErrors) pushUnique(blockers, "Browser console errors were recorded during deterministic UAT.");

  const byScreen = new Map(browser.rows.map((row) => [row.screen, row]));
  for (let index = 0; index < EXPECTED_BROWSER_SCREENS.length; index += 1) {
    const screen = EXPECTED_BROWSER_SCREENS[index];
    const row = byScreen.get(screen);
    if (!row) {
      pushUnique(blockers, `${screen} is missing from the full browser UAT journey.`);
      continue;
    }
    if (row.status === "FAIL") pushUnique(blockers, `${screen} failed deterministic browser UAT.`);
    if (row.screenshot.toLowerCase() !== "captured") pushUnique(blockers, `${screen} is missing screenshot evidence.`);
    if (/direct recovery navigation/i.test(row.navigation)) {
      pushUnique(warnings, `${screen} required recovery navigation instead of the visible product control.`);
    } else if (row.status === "WARN") {
      pushUnique(warnings, `${screen} completed with a browser UAT warning.`);
    }

    const filename = `${String(index + 1).padStart(2, "0")}-${safeSlug(screen)}.md`;
    const length = Number(snapshotLengths[filename] || 0);
    if (length < MIN_SNAPSHOT_LENGTH) {
      pushUnique(blockers, `${screen} accessibility evidence is missing or too small (${length} characters).`);
    }
  }

  if (continuityExitCode !== 0) pushUnique(blockers, `UI Continuity Agent exited with code ${continuityExitCode}.`);
  if (continuity.runtimeError) pushUnique(blockers, `UI Continuity Agent runtime error: ${continuity.runtimeError}`);
  if (continuity.screens === 0) pushUnique(blockers, "UI Continuity Agent did not inspect any rendered screens.");
  if (continuity.errors > 0) pushUnique(blockers, `UI Continuity Agent found ${continuity.errors} error-level visual/UX regression${continuity.errors === 1 ? "" : "s"}.`);
  if (continuity.warnings > 0) pushUnique(warnings, `UI Continuity Agent found ${continuity.warnings} warning-level drift item${continuity.warnings === 1 ? "" : "s"}.`);

  if (!learn.ok) {
    pushUnique(blockers, learn.message || "LEARN did not render successfully through its canonical local route.");
  } else if (Number(learn.bodyLength || 0) < 1000) {
    pushUnique(blockers, `LEARN rendered only ${Number(learn.bodyLength || 0)} characters of HTML, below the UAT content floor.`);
  }

  if (!agents.statusOk) pushUnique(blockers, agents.statusMessage || "Writing-assistant status endpoint did not pass UAT.");
  if (agents.mastraReady === false) pushUnique(blockers, "Mastra is not ready during UAT.");
  if (agents.sageRegistered === false) pushUnique(blockers, "Sage Brinewick is not registered during UAT.");
  if (agents.foundationsRegistered === false) pushUnique(blockers, "Foundations Planner is not registered during UAT.");

  if (agents.sageAttempted && !agents.sagePassed) pushUnique(blockers, agents.sageMessage || "Sage conversational quality probe failed.");
  if (!agents.sageAttempted && agents.fastAvailable === false) pushUnique(warnings, "Fast local model is unavailable; Sage live-response UAT was skipped.");

  if (agents.plannerAttempted && !agents.plannerPassed) pushUnique(blockers, agents.plannerMessage || "Foundations Planner structured-output probe failed.");
  if (!agents.plannerAttempted && agents.qualityAvailable === false) pushUnique(warnings, "Quality local model is unavailable; Foundations Planner live structured-output UAT was skipped.");

  return {
    overall: blockers.length ? "FAIL" : warnings.length ? "WARN" : "PASS",
    blockers,
    warnings,
    metrics: {
      browserScreens: browser.rows.length,
      continuityScreens: continuity.screens,
      continuityErrors: continuity.errors,
      continuityWarnings: continuity.warnings,
      snapshotCount: Object.values(snapshotLengths).filter((length) => Number(length) >= MIN_SNAPSHOT_LENGTH).length,
    },
  };
}
