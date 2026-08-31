export const AUTONOMOUS_ROUTE_DISPOSITIONS = Object.freeze([
  "entered",
  "operated",
  "skipped-prerequisite",
  "failed-defect",
]);

export const REQUIRED_AUTONOMOUS_ROUTE_IDS = Object.freeze([
  "library",
  "learn",
  "plan",
  "build",
  "story-decisions",
  "story-workbench",
  "visual-readiness",
  "storyboard",
  "production-shots",
  "previs-animatic",
  "write",
  "edit",
  "refine",
  "reports",
]);

function pushUnique(target, message) {
  if (message && !target.includes(message)) target.push(message);
}

function routeLabel(route) {
  return route?.label || route?.id || "Unknown autonomous route";
}

export function autonomousStoryRoutes(registry) {
  return [...(registry?.autonomousStoryRoutes || [])].sort((left, right) => Number(left.order) - Number(right.order));
}

export function validateAutonomousStoryRoutes(registry) {
  const errors = [];
  const routes = registry?.autonomousStoryRoutes;
  if (!Array.isArray(routes) || !routes.length) return ["UAT registry must contain autonomousStoryRoutes."];

  const ids = new Set();
  const orders = new Set();
  for (const route of routes) {
    const label = routeLabel(route);
    if (!route?.id || !route?.label) pushUnique(errors, "Every autonomous story route needs an id and label.");
    if (ids.has(route?.id)) pushUnique(errors, `Duplicate autonomous story route id: ${route.id}.`);
    ids.add(route?.id);

    if (!Number.isInteger(route?.order) || route.order <= 0) pushUnique(errors, `${label} needs a positive integer order.`);
    if (orders.has(route?.order)) pushUnique(errors, `Duplicate autonomous story route order: ${route.order}.`);
    orders.add(route?.order);

    const hasRoute = typeof route?.route === "string" && route.route.startsWith("/");
    const hasTemplate = typeof route?.routeTemplate === "string" && route.routeTemplate.startsWith("/");
    if (hasRoute === hasTemplate) pushUnique(errors, `${label} needs exactly one canonical route or routeTemplate.`);
    if (route?.operation !== "inspect" && route?.operation !== "operate") pushUnique(errors, `${label} operation must be inspect or operate.`);
    if (!Array.isArray(route?.requiredTerms) || !route.requiredTerms.length) pushUnique(errors, `${label} needs rendered-content terms.`);
    if (!Number.isFinite(Number(route?.minimumTextLength)) || Number(route.minimumTextLength) < 100) pushUnique(errors, `${label} minimumTextLength must be at least 100.`);
    if (!Array.isArray(route?.prerequisites)) pushUnique(errors, `${label} needs an explicit prerequisites array.`);
    if (!Array.isArray(route?.tests) || !route.tests.length) pushUnique(errors, `${label} needs at least one contract test.`);

    const inputs = Array.isArray(route?.routeInputs) ? route.routeInputs : [];
    const placeholders = [...String(route?.routeTemplate || "").matchAll(/\{([a-zA-Z0-9_-]+)\}/g)].map((match) => match[1]);
    if (hasTemplate && !inputs.length) pushUnique(errors, `${label} routeTemplate needs routeInputs.`);
    if (hasTemplate && !route.prerequisites?.length) pushUnique(errors, `${label} routeTemplate needs a declared prerequisite.`);
    for (const input of inputs) {
      if (!placeholders.includes(input)) pushUnique(errors, `${label} route input ${input} is not present in its routeTemplate.`);
    }
    for (const placeholder of placeholders) {
      if (!inputs.includes(placeholder)) pushUnique(errors, `${label} routeTemplate placeholder ${placeholder} is not declared in routeInputs.`);
    }
  }

  for (const id of REQUIRED_AUTONOMOUS_ROUTE_IDS) {
    if (!ids.has(id)) pushUnique(errors, `Autonomous story route registry is missing required route: ${id}.`);
  }
  return errors;
}

export function autonomousContractTestsFromRegistry(registry) {
  return [...new Set(autonomousStoryRoutes(registry).flatMap((route) => Array.isArray(route.tests) ? route.tests : []))];
}

export function materializeAutonomousRoute(route, routeInputs = {}) {
  if (route?.route) return { route: route.route, missingInputs: [] };
  const missingInputs = [];
  const materialized = String(route?.routeTemplate || "").replace(/\{([a-zA-Z0-9_-]+)\}/g, (_match, key) => {
    const value = routeInputs?.[key];
    if (value === undefined || value === null || String(value).trim() === "") {
      missingInputs.push(key);
      return `{${key}}`;
    }
    return encodeURIComponent(String(value));
  });
  return { route: missingInputs.length ? null : materialized, missingInputs };
}

export function skippedAutonomousRoute(route, missingInputs) {
  const prerequisites = Array.isArray(route?.prerequisites) ? route.prerequisites : [];
  const reason = `Route input${missingInputs.length === 1 ? "" : "s"} ${missingInputs.join(", ")} unavailable until ${prerequisites.join(", ") || "a declared prerequisite"}.`;
  return {
    id: route.id,
    label: route.label,
    order: route.order,
    intendedOperation: route.operation,
    canonicalRoute: route.route || route.routeTemplate,
    resolvedRoute: null,
    actualRoute: null,
    entered: false,
    disposition: "skipped-prerequisite",
    reason,
    prerequisites,
    missingInputs: [...missingInputs],
    readiness: { passed: null, bodyLength: 0, matchedTerms: [], missingTerms: [] },
    action: { attempted: false, succeeded: false },
    timingMs: 0,
  };
}

export function assessAutonomousRoute(route, evidence = {}, action = {}) {
  const bodyText = String(evidence.bodyText || "");
  const normalized = bodyText.toLowerCase();
  const matchedTerms = [];
  const missingTerms = [];
  for (const term of route.requiredTerms || []) {
    if (normalized.includes(String(term).toLowerCase())) matchedTerms.push(term);
    else missingTerms.push(term);
  }
  const bodyLength = Number(evidence.bodyLength || bodyText.length);
  const blockers = [];
  if (!evidence.reached) blockers.push(evidence.error || `${route.label} did not render.`);
  if (bodyLength < Number(route.minimumTextLength || 0)) blockers.push(`${route.label} rendered too little visible content (${bodyLength} characters).`);
  if (missingTerms.length) blockers.push(`${route.label} is missing expected rendered text: ${missingTerms.join(", ")}.`);
  if (evidence.consoleErrors) blockers.push(`${route.label} produced a browser console error.`);
  if (action.attempted && !action.succeeded) blockers.push(action.error || `${route.label} action failed.`);
  let actualRoute = "";
  if (evidence.url) {
    try {
      const actual = new URL(String(evidence.url), "http://plotpickle.local");
      actualRoute = `${actual.pathname}${actual.search}`;
    } catch {
      blockers.push(`${route.label} returned an invalid browser URL.`);
    }
  }
  if (evidence.resolvedRoute && actualRoute && actualRoute !== evidence.resolvedRoute) {
    blockers.push(`${route.label} finished on unexpected route ${actualRoute}.`);
  }

  const skippedPrerequisite = String(action.skippedPrerequisite || "");
  const legitimateSkip = skippedPrerequisite && (route.prerequisites || []).includes(skippedPrerequisite);
  if (skippedPrerequisite && !legitimateSkip) blockers.push(`${route.label} claimed an undeclared prerequisite: ${skippedPrerequisite}.`);
  if (route.operation === "operate" && !action.attempted && !legitimateSkip) {
    blockers.push(`${route.label} is registered to operate but produced no autonomous action evidence.`);
  }

  const disposition = blockers.length
    ? "failed-defect"
    : legitimateSkip
      ? "skipped-prerequisite"
    : action.attempted && action.succeeded
      ? "operated"
      : "entered";
  return {
    id: route.id,
    label: route.label,
    order: route.order,
    intendedOperation: route.operation,
    canonicalRoute: route.route || route.routeTemplate,
    resolvedRoute: evidence.resolvedRoute || route.route || null,
    actualRoute: actualRoute || null,
    entered: Boolean(evidence.reached),
    disposition,
    reason: legitimateSkip && !blockers.length ? `Operation remained blocked by declared prerequisite: ${skippedPrerequisite}.` : blockers.join(" "),
    prerequisites: [...(route.prerequisites || [])],
    missingInputs: [],
    readiness: {
      passed: !blockers.length,
      bodyLength,
      matchedTerms,
      missingTerms,
      consoleErrors: Boolean(evidence.consoleErrors),
    },
    action: {
      attempted: Boolean(action.attempted),
      succeeded: Boolean(action.succeeded),
      actionId: action.actionId || "",
      skippedPrerequisite,
    },
    timingMs: Math.max(0, Number(evidence.timingMs || 0)),
  };
}

export function summarizeAutonomousRouteResults(results = []) {
  const counts = Object.fromEntries(AUTONOMOUS_ROUTE_DISPOSITIONS.map((disposition) => [disposition, 0]));
  for (const result of results) {
    if (Object.hasOwn(counts, result?.disposition)) counts[result.disposition] += 1;
  }
  const failed = counts["failed-defect"];
  const skipped = counts["skipped-prerequisite"];
  return {
    overall: failed ? "FAIL" : skipped ? "WARN" : "PASS",
    counts,
    total: results.length,
    blockers: results.filter((result) => result.disposition === "failed-defect").map((result) => `${result.label}: ${result.reason || "route defect"}`),
    prerequisiteSkips: results.filter((result) => result.disposition === "skipped-prerequisite").map((result) => `${result.label}: ${result.reason}`),
  };
}
