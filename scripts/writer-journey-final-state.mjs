const MARKETING_WORKFLOW = "marquee-director/foundations-first-poster-v1";

function parseEvaluateJson(raw) {
  const text = String(raw || "").trim();
  const marker = "### Result";
  const section = text.includes(marker)
    ? text.slice(text.indexOf(marker) + marker.length).split(/\r?\n###\s/)[0].trim()
    : text;
  for (const candidate of [section, text]) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === "string") return JSON.parse(parsed);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // Try the next bounded representation from the MCP result wrapper.
    }
  }
  throw new Error("Writer final-state observer returned no parseable JSON evidence.");
}

function countAnswers(lessons) {
  return Object.values(lessons || {}).reduce((total, lesson) => (
    total + Object.values(lesson?.answers || {}).filter((value) => typeof value === "string" && value.trim()).length
  ), 0);
}

function check(id, label, passed, detail, evidence = {}) {
  return { id, label, passed: Boolean(passed), detail: String(detail || ""), evidence };
}

export function auditPersistedWriterProject(project, rendered = {}) {
  const completedLessonIds = Array.isArray(project?.learning?.completedLessonIds)
    ? project.learning.completedLessonIds.filter(Boolean)
    : [];
  const foundationAnswers = countAnswers(project?.foundations?.lessons);
  const foundationBrief = String(project?.foundations?.brief?.content || "").trim();
  const foundationArtifacts = Array.isArray(project?.build?.foundations?.visualArtifacts)
    ? project.build.foundations.visualArtifacts
    : [];
  const foundationAcceptedIds = new Set(Array.isArray(project?.build?.foundations?.acceptedVisualArtifactIds)
    ? project.build.foundations.acceptedVisualArtifactIds
    : []);
  const roughVisuals = foundationArtifacts.filter((artifact) => (
    artifact?.frameNumber && artifact?.reviewState !== "rejected" && artifact?.workflow !== MARKETING_WORKFLOW
  ));
  const marketingReference = foundationArtifacts.find((artifact) => (
    artifact?.workflow === MARKETING_WORKFLOW
    && artifact?.curriculumFrontier === "Foundations"
    && artifact?.reviewState !== "rejected"
    && typeof artifact?.assetUrl === "string"
    && artifact.assetUrl.startsWith("/api/local-ai/assets/")
  )) || null;
  const acceptedRoughVisuals = roughVisuals.filter((artifact) => foundationAcceptedIds.has(artifact.id));

  const worldAnswers = countAnswers(project?.world?.lessons);
  const worldBrief = String(project?.world?.brief?.content || "").trim();
  const worldArtifacts = Array.isArray(project?.build?.world?.visualArtifacts)
    ? project.build.world.visualArtifacts
    : [];
  const worldAcceptedIds = new Set(Array.isArray(project?.build?.world?.acceptedVisualArtifactIds)
    ? project.build.world.acceptedVisualArtifactIds
    : []);
  const retainedWorldArtifacts = worldArtifacts.filter((artifact) => artifact?.reviewState !== "rejected");
  const acceptedWorldArtifacts = retainedWorldArtifacts.filter((artifact) => worldAcceptedIds.has(artifact.id));

  const learn = rendered.foundationsLearn || rendered.learn || {};
  const worldLearn = rendered.worldLearn || learn;
  const plan = rendered.plan || {};
  const build = rendered.build || {};
  const worldPlan = rendered.worldPlan || {};
  const worldBuild = rendered.worldBuild || {};
  const dashboard = rendered.dashboard || {};
  const wyrmwood = rendered.wyrmwood || {};
  const settings = rendered.settings || {};

  const checks = [
    check("learn.persisted", "Foundations LEARN persisted completion", completedLessonIds.length >= 4,
      `${completedLessonIds.length} lesson completion record(s) persisted; current Foundations acceptance requires at least 4.`,
      { completedLessonCount: completedLessonIds.length }),
    check("learn.rendered", "Foundations LEARN reopened green checks",
      Number(learn.foundationLessonCount || 0) >= 4 && Number(learn.foundationCompletedCount || 0) === Number(learn.foundationLessonCount || 0),
      `${learn.foundationCompletedCount || 0} of ${learn.foundationLessonCount || 0} visible Foundations lessons are marked complete after reopen.`, learn),
    check("plan.persisted", "Foundations PLAN persisted decisions", foundationAnswers >= 33 && Boolean(foundationBrief),
      `${foundationAnswers} saved Foundations answer(s); Foundations Brief ${foundationBrief ? "is saved" : "is empty"}.`,
      { foundationAnswerCount: foundationAnswers, foundationBriefCharacters: foundationBrief.length }),
    check("plan.rendered", "Foundations PLAN reopened completion",
      Number(plan.completeLessonCount || 0) >= 11
        && Number(plan.completeLessonCount || 0) === Number(plan.lessonCount || 0)
        && Number(plan.answerCount || 0) >= 33,
      `${plan.completeLessonCount || 0} of ${plan.lessonCount || 0} visible PLAN lessons complete; ${plan.answerCount || 0} answers reported after reopen.`, plan),
    check("build.persisted", "BUILD rough visual evidence persisted", roughVisuals.length > 0 && acceptedRoughVisuals.length > 0,
      `${roughVisuals.length} rough Foundations frame(s) persisted; ${acceptedRoughVisuals.length} accepted.`,
      { roughVisualCount: roughVisuals.length, acceptedRoughVisualCount: acceptedRoughVisuals.length }),
    check("build.rendered", "BUILD rough visuals reopened", Number(build.localAssetImageCount || 0) > 0,
      `${build.localAssetImageCount || 0} generated local image(s) are visible in Foundations BUILD after reopen.`, build),
    check("marquee.persisted", "Marquee first poster persisted as PPF Marketing Reference", Boolean(marketingReference),
      marketingReference ? `Marketing Reference ${marketingReference.id} persists at ${marketingReference.assetUrl}.` : "No valid Foundations Marketing Reference is persisted.",
      marketingReference ? { id: marketingReference.id, assetUrl: marketingReference.assetUrl, workflow: marketingReference.workflow } : {}),
    check("marquee.rendered", "Marquee is unlocked after Foundations", learn.marqueeDisabled === false,
      learn.marqueeDisabled === false ? "Marquee is selectable after reopen." : "Marquee is still disabled or missing after reopen.",
      { marqueeDisabled: learn.marqueeDisabled }),
    check("world.learn.persisted", "World LEARN persisted completion", completedLessonIds.length >= 9,
      `${completedLessonIds.length} total lesson completion record(s) persisted; Foundations + World currently requires at least 9.`,
      { completedLessonCount: completedLessonIds.length }),
    check("world.learn.rendered", "World LEARN reopened green checks",
      Number(worldLearn.worldLessonCount || 0) === 5 && Number(worldLearn.worldCompletedCount || 0) === Number(worldLearn.worldLessonCount || 0),
      `${worldLearn.worldCompletedCount || 0} of ${worldLearn.worldLessonCount || 0} visible World lessons are marked complete after reopen.`, worldLearn),
    check("world.plan.persisted", "World PLAN persisted decisions",
      worldAnswers > 0 && Boolean(worldBrief) && Number(worldPlan.fieldCount || 0) > 0 && worldAnswers >= Number(worldPlan.fieldCount || 0),
      `${worldAnswers} saved World answer(s); World Brief ${worldBrief ? "is saved" : "is empty"}; reopened World PLAN exposes ${worldPlan.fieldCount || 0} required field(s).`,
      { worldAnswerCount: worldAnswers, worldBriefCharacters: worldBrief.length, reopenedFieldCount: worldPlan.fieldCount || 0 }),
    check("world.plan.rendered", "World PLAN reopened completion",
      Number(worldPlan.lessonCount || 0) === 5
        && Number(worldPlan.completeLessonCount || 0) === Number(worldPlan.lessonCount || 0)
        && Number(worldPlan.answerCount || 0) > 0
        && Number(worldPlan.answerCount || 0) === Number(worldPlan.fieldCount || 0),
      `${worldPlan.completeLessonCount || 0} of ${worldPlan.lessonCount || 0} visible World PLAN lessons complete; ${worldPlan.answerCount || 0} of ${worldPlan.fieldCount || 0} World decisions reported after reopen.`, worldPlan),
    check("world.build.persisted", "World BUILD accepted visual evidence persisted", retainedWorldArtifacts.length > 0 && acceptedWorldArtifacts.length > 0,
      `${retainedWorldArtifacts.length} World visual change(s) persisted; ${acceptedWorldArtifacts.length} accepted.`,
      { worldVisualCount: retainedWorldArtifacts.length, acceptedWorldVisualCount: acceptedWorldArtifacts.length }),
    check("world.build.rendered", "World BUILD visuals reopened",
      Number(worldBuild.localAssetImageCount || 0) > 0 && Number(worldBuild.acceptedLabelCount || 0) > 0,
      `${worldBuild.localAssetImageCount || 0} generated local image(s) and ${worldBuild.acceptedLabelCount || 0} accepted World label(s) are visible after reopen.`, worldBuild),
    check("dashboard.progress", "Dashboard reflects accumulated Foundations progress",
      Number(dashboard.foundationLearnComplete || 0) >= 4
        && Number(dashboard.foundationPlanAnswers || 0) >= 33
        && Number(dashboard.acceptedArtifactCount || 0) > 0,
      `Dashboard reports ${dashboard.foundationLearnComplete || 0} Foundations lessons, ${dashboard.foundationPlanAnswers || 0} PLAN answers and ${dashboard.acceptedArtifactCount || 0} accepted Foundations artifact(s).`, dashboard),
    check("dashboard.world-progress", "Dashboard reflects completed World frontier",
      Number(dashboard.worldLearnComplete || 0) === 5
        && Number(dashboard.worldLearnComplete || 0) === Number(dashboard.worldLearnTotal || 0)
        && Number(dashboard.worldPlanAnswers || 0) > 0
        && Number(dashboard.worldPlanAnswers || 0) === Number(dashboard.worldPlanFields || 0)
        && Number(dashboard.worldAcceptedArtifactCount || 0) > 0,
      `Dashboard reports ${dashboard.worldLearnComplete || 0} of ${dashboard.worldLearnTotal || 0} World lessons, ${dashboard.worldPlanAnswers || 0} of ${dashboard.worldPlanFields || 0} World PLAN decisions and ${dashboard.worldAcceptedArtifactCount || 0} accepted World visual change(s).`, dashboard),
    check("wyrmwood.rendered", "Wyrmwood review route reopens",
      wyrmwood.mainPresent === true && wyrmwood.wyrmwoodVisible === true && wyrmwood.loading !== true,
      wyrmwood.mainPresent === true && wyrmwood.wyrmwoodVisible === true && wyrmwood.loading !== true
        ? "The Wyrmwood review route rendered its writer-facing main surface."
        : "The Wyrmwood review route did not finish rendering a recognizable writer-facing main surface.", wyrmwood),
    check("settings.rendered", "Settings review route reopens",
      settings.mainPresent === true && settings.settingsVisible === true,
      settings.mainPresent === true && settings.settingsVisible === true
        ? "The Settings review route rendered its writer-facing main surface."
        : "The Settings review route did not render a recognizable writer-facing main surface.", settings),
  ];

  return {
    schemaVersion: 3,
    passed: checks.every((item) => item.passed),
    projectId: String(project?.id || ""),
    projectTitle: String(project?.title || ""),
    frontier: "Foundations + World",
    marketingReference: marketingReference ? {
      id: marketingReference.id,
      assetUrl: marketingReference.assetUrl,
      provider: marketingReference.provider || "",
      model: marketingReference.model || "",
      workflow: marketingReference.workflow,
    } : null,
    checks,
  };
}

function readProjectPage() {
  const raw = localStorage.getItem("plotpickle.foundation.project.v1");
  return JSON.stringify(raw ? JSON.parse(raw) : null);
}

function inspectLearnPage() {
  const groups = [...document.querySelectorAll("section")];
  const statsFor = (topic) => {
    const section = groups.find((candidate) => {
      const toggle = candidate.querySelector('button[aria-controls^="learn-topic-"]');
      return toggle && new RegExp(topic, "i").test(toggle.textContent || "");
    });
    const buttons = section ? [...section.querySelectorAll('button[aria-label^="Mark "]')] : [];
    return {
      lessonCount: buttons.length,
      completedCount: buttons.filter((button) => button.getAttribute("aria-pressed") === "true").length,
    };
  };
  const foundations = statsFor("Foundations");
  const world = statsFor("World");
  const marquee = [...document.querySelectorAll("button")].find((button) => /^Marquee(?:\s|$)/i.test((button.textContent || "").trim()));
  return JSON.stringify({
    foundationLessonCount: foundations.lessonCount,
    foundationCompletedCount: foundations.completedCount,
    worldLessonCount: world.lessonCount,
    worldCompletedCount: world.completedCount,
    marqueeDisabled: marquee ? marquee.disabled : null,
  });
}

function inspectPlanPage() {
  const rail = document.querySelector('aside[aria-label="PLAN Foundations lessons"]');
  const summary = rail?.querySelector("header small")?.textContent || "";
  const match = summary.match(/(\d+) of (\d+) lessons answered.*?(\d+) of (\d+) fields/i);
  const completion = [...(rail?.querySelectorAll('[aria-label="Lesson answers complete"]') || [])].length;
  return JSON.stringify({
    completeLessonCount: match ? Number(match[1]) : completion,
    lessonCount: match ? Number(match[2]) : 0,
    answerCount: match ? Number(match[3]) : 0,
    fieldCount: match ? Number(match[4]) : 0,
  });
}

function inspectWorldPlanPage() {
  const rail = document.querySelector('nav[aria-label="World PLAN lessons"]');
  const lessonButtons = rail ? [...rail.querySelectorAll("button")] : [];
  const statusText = document.querySelector('main[aria-label="World PLAN"]')?.textContent || "";
  const match = statusText.match(/World PLAN:\s*(\d+)\s*\/\s*(\d+)/i);
  return JSON.stringify({
    lessonCount: lessonButtons.length,
    completeLessonCount: lessonButtons.filter((button) => /PLAN answers complete/i.test(button.textContent || "")).length,
    answerCount: match ? Number(match[1]) : 0,
    fieldCount: match ? Number(match[2]) : 0,
  });
}

function inspectBuildPage() {
  return JSON.stringify({
    localAssetImageCount: [...document.querySelectorAll("main img")]
      .filter((image) => String(image.getAttribute("src") || "").includes("/api/local-ai/assets/")).length,
    acceptedLabelCount: [...document.querySelectorAll("main *")]
      .filter((node) => /^Accepted$/i.test((node.textContent || "").trim())).length,
  });
}

function inspectDashboardPage() {
  const text = document.querySelector('main[aria-label="PlotPickle Dashboard"]')?.textContent || "";
  const learn = text.match(/(\d+) of (\d+) Foundations lessons complete/i);
  const plan = text.match(/(\d+) of (\d+) PLAN answers saved/i);
  const artifacts = text.match(/(\d+) accepted Foundations visual/i);
  const world = text.match(/(\d+) \/ (\d+) World lessons · (\d+) \/ (\d+) World PLAN decisions · (\d+) accepted World visual change/i);
  return JSON.stringify({
    foundationLearnComplete: learn ? Number(learn[1]) : 0,
    foundationLearnTotal: learn ? Number(learn[2]) : 0,
    foundationPlanAnswers: plan ? Number(plan[1]) : 0,
    foundationPlanFields: plan ? Number(plan[2]) : 0,
    acceptedArtifactCount: artifacts ? Number(artifacts[1]) : 0,
    worldLearnComplete: world ? Number(world[1]) : 0,
    worldLearnTotal: world ? Number(world[2]) : 0,
    worldPlanAnswers: world ? Number(world[3]) : 0,
    worldPlanFields: world ? Number(world[4]) : 0,
    worldAcceptedArtifactCount: world ? Number(world[5]) : 0,
  });
}

function inspectWyrmwoodPage() {
  const main = document.querySelector("main");
  const text = main?.textContent || "";
  return JSON.stringify({
    mainPresent: Boolean(main),
    wyrmwoodVisible: /Wyrmwood/i.test(text),
    loading: /Opening Wyrmwood/i.test(text),
  });
}

function inspectSettingsPage() {
  const main = document.querySelector("main");
  const text = main?.textContent || "";
  return JSON.stringify({
    mainPresent: Boolean(main),
    settingsVisible: /Settings|Setup & Connections|AI & Runtime/i.test(text),
  });
}

const PAGE_FUNCTIONS = {
  readProjectPage,
  inspectLearnPage,
  inspectPlanPage,
  inspectWorldPlanPage,
  inspectBuildPage,
  inspectDashboardPage,
  inspectWyrmwoodPage,
  inspectSettingsPage,
};

export const WRITER_OBSERVER_CHECKPOINTS = Object.freeze([
  { id: "dashboard-start", label: "Dashboard start", area: "dashboard", route: "/?workspace=dashboard", pageFunction: "inspectDashboardPage", renderKey: "dashboardStart", owner: "final-state-observer" },
  { id: "foundations-learn", label: "Foundations LEARN", area: "learn", route: "/?workspace=learn", pageFunction: "inspectLearnPage", renderKey: "foundationsLearn", owner: "final-state-observer" },
  { id: "foundations-plan", label: "Foundations PLAN", area: "plan", route: "/?workspace=plan&section=foundations", pageFunction: "inspectPlanPage", renderKey: "plan", owner: "final-state-observer" },
  { id: "foundations-build", label: "Foundations BUILD", area: "build", route: "/?workspace=build&section=foundations", pageFunction: "inspectBuildPage", renderKey: "build", owner: "final-state-observer" },
  { id: "marquee-marketing-reference", label: "Marquee Marketing Reference", area: "marquee", route: "/?workspace=learn", pageFunction: null, renderKey: null, owner: "final-state-observer" },
  { id: "world-learn", label: "World LEARN", area: "world-learn", route: "/?workspace=learn&section=world", pageFunction: "inspectLearnPage", renderKey: "worldLearn", owner: "final-state-observer" },
  { id: "world-plan", label: "World PLAN", area: "world-plan", route: "/?workspace=plan&section=world", pageFunction: "inspectWorldPlanPage", renderKey: "worldPlan", owner: "final-state-observer" },
  { id: "world-build", label: "World BUILD", area: "world-build", route: "/?workspace=build&section=world", pageFunction: "inspectBuildPage", renderKey: "worldBuild", owner: "final-state-observer" },
  { id: "wyrmwood", label: "Wyrmwood", area: "wyrmwood", route: "/?workspace=wyrmwood", pageFunction: "inspectWyrmwoodPage", renderKey: "wyrmwood", owner: "final-state-observer" },
  { id: "settings", label: "Settings", area: "settings", route: "/?workspace=settings", pageFunction: "inspectSettingsPage", renderKey: "settings", owner: "final-state-observer" },
  { id: "dashboard-final", label: "Final Dashboard reopen", area: "dashboard", route: "/?workspace=dashboard", pageFunction: "inspectDashboardPage", renderKey: "dashboard", owner: "final-state-observer" },
].map((definition) => Object.freeze(definition)));

export function validateWriterObserverCheckpointOwnership(definitions = WRITER_OBSERVER_CHECKPOINTS) {
  const owners = new Map();
  for (const definition of definitions) {
    const id = String(definition?.id || "").trim();
    const owner = String(definition?.owner || "").trim();
    if (!id || !owner) throw new Error("Writer observer checkpoints require a canonical id and owner.");
    if (owners.has(id) && definition?.architectureOverride !== true) {
      throw new Error(`Writer observer checkpoint ${id} is already owned by ${owners.get(id)}; an explicit architecture override is required.`);
    }
    owners.set(id, owner);
  }
  return true;
}

const FORBIDDEN_PAGE_FUNCTION_OPERATIONS = [
  { pattern: /\b(?:localStorage|sessionStorage)\s*\.\s*(?:setItem|removeItem|clear)\s*\(/, label: "browser storage mutation" },
  { pattern: /\bdocument\s*\.\s*cookie\s*=/, label: "cookie mutation" },
  { pattern: /\.\s*(?:click|submit|requestSubmit|dispatchEvent|remove|append|appendChild|prepend|replaceChildren|replaceWith|insertAdjacentHTML)\s*\(/, label: "DOM or interaction mutation" },
  { pattern: /\bhistory\s*\.\s*(?:pushState|replaceState)\s*\(/, label: "history mutation" },
  { pattern: /\blocation\s*\.\s*(?:assign|replace|reload)\s*\(/, label: "navigation mutation" },
  { pattern: /\b(?:fetch|XMLHttpRequest)\s*\(/, label: "network mutation" },
];

export function writerObserverFunctionSources() {
  return Object.fromEntries(Object.entries(PAGE_FUNCTIONS).map(([name, fn]) => [name, fn.toString()]));
}

export function validateWriterObserverPageFunction(functionName, pageFunction) {
  const source = typeof pageFunction === "string" ? pageFunction : pageFunction?.toString?.() || "";
  if (!source.trim()) throw new Error(`Writer observer function ${functionName || "<unknown>"} has no executable source.`);
  Function(`return (${source});`)();
  for (const operation of FORBIDDEN_PAGE_FUNCTION_OPERATIONS) {
    if (operation.pattern.test(source)) {
      throw new Error(`Writer observer function ${functionName || "<unknown>"} requests forbidden ${operation.label}.`);
    }
  }
  return source;
}

function structuredObserverFailure(functionName, stage, error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    status: "observer-failed",
    passed: false,
    functionName,
    stage,
    error: message,
  };
}

export async function executeWriterObserverPageFunction({ client, resultText, functionName, pageFunction }) {
  let source = "";
  try {
    source = validateWriterObserverPageFunction(functionName, pageFunction);
  } catch (error) {
    return structuredObserverFailure(functionName, "payload-validation", error);
  }

  let result;
  try {
    result = await client.call("browser_evaluate", { function: source });
  } catch (error) {
    return structuredObserverFailure(functionName, "browser-evaluate", error);
  }

  try {
    return {
      status: "observer-passed",
      passed: true,
      functionName,
      stage: "result-parse",
      evidence: parseEvaluateJson(resultText(result)),
    };
  } catch (error) {
    return structuredObserverFailure(functionName, "result-parse", error);
  }
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function open(client, baseUrl, route, settleMs) {
  await client.call("browser_navigate", { url: new URL(route, baseUrl).toString() });
  if (settleMs > 0) await wait(settleMs);
}

export async function observeWriterJourneyFinalState({
  client,
  resultText,
  baseUrl,
  captureScreenshot = async () => false,
  provenance = {},
  settleMs = 850,
}) {
  validateWriterObserverCheckpointOwnership();
  const ledger = WRITER_OBSERVER_CHECKPOINTS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    area: definition.area,
    route: definition.route,
    owner: definition.owner,
    status: "not-reached",
    stage: "pending",
    detail: "The final-state observer has not reached this checkpoint.",
    evidence: {},
  }));
  const rendered = {};
  const observerFailures = [];
  const entryFor = (id) => ledger.find((entry) => entry.id === id);
  const mark = (id, status, stage, detail, evidence = {}) => {
    Object.assign(entryFor(id), { status, stage, detail, evidence });
  };

  for (const definition of WRITER_OBSERVER_CHECKPOINTS.filter((item) => item.pageFunction)) {
    try {
      await open(client, baseUrl, definition.route, settleMs);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      mark(definition.id, "observer-failed", "navigation", detail);
      observerFailures.push({ checkpointId: definition.id, functionName: definition.pageFunction, route: definition.route, stage: "navigation", error: detail });
      continue;
    }

    const execution = await executeWriterObserverPageFunction({
      client,
      resultText,
      functionName: definition.pageFunction,
      pageFunction: PAGE_FUNCTIONS[definition.pageFunction],
    });
    if (!execution.passed) {
      mark(definition.id, "observer-failed", execution.stage, execution.error);
      observerFailures.push({ checkpointId: definition.id, functionName: definition.pageFunction, route: definition.route, stage: execution.stage, error: execution.error });
      continue;
    }

    rendered[definition.renderKey] = execution.evidence;
    let screenshotError = "";
    try {
      await captureScreenshot(`writer-final-${definition.id}`);
    } catch (error) {
      screenshotError = error instanceof Error ? error.message : String(error);
    }
    mark(
      definition.id,
      "observer-passed",
      "reopened-state",
      screenshotError ? `Read-only evidence collected; screenshot failed: ${screenshotError}` : "Read-only reopened-state evidence collected.",
      execution.evidence,
    );
  }

  const projectExecution = await executeWriterObserverPageFunction({
    client,
    resultText,
    functionName: "readProjectPage",
    pageFunction: readProjectPage,
  });
  const project = projectExecution.passed ? projectExecution.evidence : null;
  if (!projectExecution.passed) {
    observerFailures.push({ checkpointId: "persisted-project", functionName: "readProjectPage", route: "/?workspace=dashboard", stage: projectExecution.stage, error: projectExecution.error });
    for (const id of ["foundations-learn", "foundations-plan", "foundations-build", "marquee-marketing-reference", "world-learn", "world-plan", "world-build", "dashboard-final"]) {
      if (entryFor(id).status !== "observer-failed") {
        mark(id, "observer-failed", projectExecution.stage, `Persisted project reconciliation failed: ${projectExecution.error}`, entryFor(id).evidence);
      }
    }
  } else {
    mark("marquee-marketing-reference", "observer-passed", "persisted-project", "Persisted Marketing Reference evidence collected.");
  }

  const audit = auditPersistedWriterProject(project, rendered);
  const checkIdsByCheckpoint = {
    "foundations-learn": ["learn.persisted", "learn.rendered"],
    "foundations-plan": ["plan.persisted", "plan.rendered"],
    "foundations-build": ["build.persisted", "build.rendered"],
    "marquee-marketing-reference": ["marquee.persisted", "marquee.rendered"],
    "world-learn": ["world.learn.persisted", "world.learn.rendered"],
    "world-plan": ["world.plan.persisted", "world.plan.rendered"],
    "world-build": ["world.build.persisted", "world.build.rendered"],
    wyrmwood: ["wyrmwood.rendered"],
    settings: ["settings.rendered"],
    "dashboard-final": ["dashboard.progress", "dashboard.world-progress"],
  };
  for (const [checkpointId, checkIds] of Object.entries(checkIdsByCheckpoint)) {
    const entry = entryFor(checkpointId);
    if (entry.status !== "observer-passed") continue;
    const failed = audit.checks.filter((item) => checkIds.includes(item.id) && !item.passed);
    if (failed.length) {
      mark(checkpointId, "product-state-failed", "acceptance", failed.map((item) => item.detail).join(" | "), entry.evidence);
    }
  }

  const ledgerPassed = ledger.every((entry) => entry.status === "observer-passed" || entry.status === "outside-frontier");
  return {
    ...audit,
    passed: audit.passed && ledgerPassed,
    observedAt: new Date().toISOString(),
    authority: "read-only-final-state-observer",
    mutationAuthority: "none",
    provenance: { baseUrl, ...provenance },
    checkpointOwner: "final-state-observer",
    observerFailures,
    ledger,
  };
}
