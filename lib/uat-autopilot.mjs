function pushUnique(target, message) {
  if (message && !target.includes(message)) target.push(message);
}

export function validateUatRegistry(registry) {
  const errors = [];
  if (registry?.schemaVersion !== 1) errors.push("UAT registry schemaVersion must be 1.");
  if (!Array.isArray(registry?.areas) || !registry.areas.length) errors.push("UAT registry must contain at least one area.");
  const ids = new Set();
  for (const area of registry?.areas || []) {
    if (!area?.id || !area?.label) errors.push("Every UAT area needs an id and label.");
    if (ids.has(area?.id)) errors.push(`Duplicate UAT area id: ${area.id}.`);
    ids.add(area?.id);
    if (!Array.isArray(area?.tests) || !area.tests.length) errors.push(`${area?.label || area?.id || "Unknown area"} needs at least one contract test.`);
    if (area?.route) {
      if (!String(area.route).startsWith("/?workspace=")) errors.push(`${area.label} route must use the canonical workspace query.`);
      if (!Array.isArray(area.requiredTerms) || !area.requiredTerms.length) errors.push(`${area.label} needs rendered-content terms.`);
      if (!Number.isFinite(Number(area.minimumTextLength)) || Number(area.minimumTextLength) < 100) errors.push(`${area.label} minimumTextLength must be at least 100.`);
    }
  }
  return errors;
}

export function contractTestsFromRegistry(registry) {
  return [...new Set((registry?.areas || []).flatMap((area) => Array.isArray(area.tests) ? area.tests : []))];
}

export function assessRenderedArea(area, evidence = {}) {
  const blockers = [];
  const warnings = [];
  const bodyText = String(evidence.bodyText || "");
  if (!evidence.reached) pushUnique(blockers, `${area.label} did not render at ${area.route}.`);
  if (Number(evidence.bodyLength || bodyText.length) < Number(area.minimumTextLength || 0)) {
    pushUnique(blockers, `${area.label} rendered too little visible content (${Number(evidence.bodyLength || bodyText.length)} characters).`);
  }
  for (const term of area.requiredTerms || []) {
    if (!bodyText.toLowerCase().includes(String(term).toLowerCase())) pushUnique(blockers, `${area.label} is missing expected rendered text: ${term}.`);
  }
  if (!evidence.screenshotCaptured) pushUnique(blockers, `${area.label} is missing screenshot evidence.`);
  if (evidence.consoleErrors) pushUnique(blockers, `${area.label} produced a browser console error.`);
  if (evidence.url && !String(evidence.url).includes(String(area.route).split("?")[1]?.split("&")[0] || "")) {
    pushUnique(warnings, `${area.label} finished on an unexpected URL: ${evidence.url}.`);
  }
  return { blockers, warnings };
}

export function assessStartupEvidence(startup = {}) {
  const blockers = [];
  const warnings = [];
  if (!startup.statusOk) pushUnique(blockers, startup.message || "Startup status endpoint did not respond successfully.");
  if (startup.mastraReady === false) pushUnique(blockers, "Mastra is not ready after startup.");
  if (startup.embedded === false) pushUnique(blockers, "Mastra is not running in the expected embedded mode.");
  if (startup.sageRegistered === false) pushUnique(blockers, "Sage Brinewick is not registered after startup.");
  if (startup.foundationsRegistered === false) pushUnique(blockers, "Foundations Planner is not registered after startup.");

  if (startup.fastAvailable === true && startup.sageAttempted && !startup.sagePassed) {
    pushUnique(blockers, startup.sageMessage || "Sage live-response probe failed.");
  }
  if (startup.fastAvailable === false) pushUnique(warnings, "Fast local model is unavailable; Sage live-response UAT was skipped.");

  if (startup.qualityAvailable === true && startup.plannerAttempted && !startup.plannerPassed) {
    pushUnique(blockers, startup.plannerMessage || "Foundations Planner structured-output probe failed.");
  }
  if (startup.qualityAvailable === false) pushUnique(warnings, "Quality local model is unavailable; Foundations Planner live structured-output UAT was skipped.");
  return { blockers, warnings };
}

export function assessFocusedUat({ registry, contractExitCode = 0, rendered = [], startup = {} }) {
  const blockers = [];
  const warnings = [];
  const registryErrors = validateUatRegistry(registry);
  blockers.push(...registryErrors);
  if (contractExitCode !== 0) pushUnique(blockers, `Focused contract tests exited with code ${contractExitCode}.`);

  const byId = new Map(rendered.map((entry) => [entry.id, entry]));
  for (const area of registry?.areas || []) {
    if (!area.route) continue;
    const evidence = byId.get(area.id) || {};
    const result = assessRenderedArea(area, evidence);
    result.blockers.forEach((message) => pushUnique(blockers, message));
    result.warnings.forEach((message) => pushUnique(warnings, message));
  }

  const startupResult = assessStartupEvidence(startup);
  startupResult.blockers.forEach((message) => pushUnique(blockers, message));
  startupResult.warnings.forEach((message) => pushUnique(warnings, message));

  return {
    overall: blockers.length ? "FAIL" : warnings.length ? "WARN" : "PASS",
    blockers,
    warnings,
    metrics: {
      areasRegistered: registry?.areas?.length || 0,
      renderedAreas: rendered.length,
      contractTests: contractTestsFromRegistry(registry).length,
    },
  };
}
