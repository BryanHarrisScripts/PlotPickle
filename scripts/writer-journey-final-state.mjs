const PROJECT_KEY = "plotpickle.foundation.project.v1";
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
    } catch {}
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
  const acceptedIds = new Set(Array.isArray(project?.build?.foundations?.acceptedVisualArtifactIds)
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
  const acceptedRoughVisuals = roughVisuals.filter((artifact) => acceptedIds.has(artifact.id));

  const learn = rendered.learn || {};
  const plan = rendered.plan || {};
  const build = rendered.build || {};
  const dashboard = rendered.dashboard || {};

  const checks = [
    check(
      "learn.persisted",
      "Foundations LEARN persisted completion",
      completedLessonIds.length >= 11,
      `${completedLessonIds.length} lesson completion record(s) persisted; current Foundations acceptance requires at least 11.`,
      { completedLessonCount: completedLessonIds.length },
    ),
    check(
      "learn.rendered",
      "Foundations LEARN reopened green checks",
      Number(learn.foundationLessonCount || 0) >= 11
        && Number(learn.foundationCompletedCount || 0) === Number(learn.foundationLessonCount || 0),
      `${learn.foundationCompletedCount || 0} of ${learn.foundationLessonCount || 0} visible Foundations lessons are marked complete after reopen.`,
      learn,
    ),
    check(
      "plan.persisted",
      "Foundations PLAN persisted decisions",
      foundationAnswers >= 33 && Boolean(foundationBrief),
      `${foundationAnswers} saved Foundations answer(s); Foundations Brief ${foundationBrief ? "is saved" : "is empty"}.`,
      { foundationAnswerCount: foundationAnswers, foundationBriefCharacters: foundationBrief.length },
    ),
    check(
      "plan.rendered",
      "Foundations PLAN reopened completion",
      Number(plan.completeLessonCount || 0) >= 11
        && Number(plan.completeLessonCount || 0) === Number(plan.lessonCount || 0)
        && Number(plan.answerCount || 0) >= 33,
      `${plan.completeLessonCount || 0} of ${plan.lessonCount || 0} visible PLAN lessons complete; ${plan.answerCount || 0} answers reported after reopen.`,
      plan,
    ),
    check(
      "build.persisted",
      "BUILD rough visual evidence persisted",
      roughVisuals.length > 0 && acceptedRoughVisuals.length > 0,
      `${roughVisuals.length} rough Foundations frame(s) persisted; ${acceptedRoughVisuals.length} accepted.`,
      { roughVisualCount: roughVisuals.length, acceptedRoughVisualCount: acceptedRoughVisuals.length },
    ),
    check(
      "build.rendered",
      "BUILD rough visuals reopened",
      Number(build.localAssetImageCount || 0) > 0,
      `${build.localAssetImageCount || 0} generated local image(s) are visible in BUILD after reopen.`,
      build,
    ),
    check(
      "marquee.persisted",
      "Marquee first poster persisted as PPF Marketing Reference",
      Boolean(marketingReference),
      marketingReference
        ? `Marketing Reference ${marketingReference.id} persists at ${marketingReference.assetUrl}.`
        : "No valid Foundations Marketing Reference is persisted.",
      marketingReference ? { id: marketingReference.id, assetUrl: marketingReference.assetUrl, workflow: marketingReference.workflow } : {},
    ),
    check(
      "marquee.rendered",
      "Marquee is unlocked after Foundations",
      learn.marqueeDisabled === false,
      learn.marqueeDisabled === false ? "Marquee is selectable after reopen." : "Marquee is still disabled or missing after reopen.",
      { marqueeDisabled: learn.marqueeDisabled },
    ),
    check(
      "dashboard.progress",
      "Dashboard reflects accumulated progress",
      Number(dashboard.foundationLearnComplete || 0) >= 11
        && Number(dashboard.foundationPlanAnswers || 0) >= 33
        && Number(dashboard.acceptedArtifactCount || 0) > 0,
      `Dashboard reports ${dashboard.foundationLearnComplete || 0} Foundations lessons, ${dashboard.foundationPlanAnswers || 0} PLAN answers and ${dashboard.acceptedArtifactCount || 0} accepted artifact(s).`,
      dashboard,
    ),
  ];

  return {
    schemaVersion: 1,
    passed: checks.every((item) => item.passed),
    projectId: String(project?.id || ""),
    projectTitle: String(project?.title || ""),
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

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function evaluateJson(client, resultText, expression) {
  const result = await client.call("browser_evaluate", { function: expression });
  return parseEvaluateJson(resultText(result));
}

async function open(client, baseUrl, route) {
  await client.call("browser_navigate", { url: new URL(route, baseUrl).toString() });
  await wait(850);
}

async function readProject(client, resultText) {
  return evaluateJson(client, resultText, `() => {
    const raw = localStorage.getItem(${JSON.stringify(PROJECT_KEY)});
    return JSON.stringify(raw ? JSON.parse(raw) : null);
  }`);
}

async function inspectLearn(client, resultText) {
  return evaluateJson(client, resultText, `() => {
    const groups = [...document.querySelectorAll('section')];
    const foundations = groups.find((section) => {
      const toggle = section.querySelector('button[aria-controls^="learn-topic-"]');
      return toggle && /foundations/i.test(toggle.textContent || '');
    });
    const completionButtons = foundations
      ? [...foundations.querySelectorAll('button[aria-label^="Mark "]')]
      : [];
    const marquee = [...document.querySelectorAll('button')].find((button) => /^Marquee(?:\\s|$)/i.test((button.textContent || '').trim()));
    return JSON.stringify({
      foundationLessonCount: completionButtons.length,
      foundationCompletedCount: completionButtons.filter((button) => button.getAttribute('aria-pressed') === 'true').length,
      marqueeDisabled: marquee ? marquee.disabled : null,
    });
  }`);
}

async function inspectPlan(client, resultText) {
  return evaluateJson(client, resultText, `() => {
    const rail = document.querySelector('aside[aria-label="PLAN Foundations lessons"]');
    const summary = rail?.querySelector('header small')?.textContent || '';
    const match = summary.match(/(\\d+) of (\\d+) lessons answered.*?(\\d+) of (\\d+) fields/i);
    const completion = [...(rail?.querySelectorAll('[aria-label="Lesson answers complete"]') || [])].length;
    return JSON.stringify({
      completeLessonCount: match ? Number(match[1]) : completion,
      lessonCount: match ? Number(match[2]) : 0,
      answerCount: match ? Number(match[3]) : 0,
      fieldCount: match ? Number(match[4]) : 0,
    });
  }`);
}

async function inspectBuild(client, resultText) {
  return evaluateJson(client, resultText, `() => JSON.stringify({
    localAssetImageCount: [...document.querySelectorAll('main img')]
      .filter((image) => String(image.getAttribute('src') || '').includes('/api/local-ai/assets/')).length,
    acceptedLabelCount: [...document.querySelectorAll('main *')]
      .filter((node) => /^Accepted$/i.test((node.textContent || '').trim())).length,
  })`);
}

async function inspectDashboard(client, resultText) {
  return evaluateJson(client, resultText, `() => {
    const text = document.querySelector('main[aria-label="PlotPickle Dashboard"]')?.textContent || '';
    const learn = text.match(/(\\d+) of (\\d+) Foundations lessons complete/i);
    const plan = text.match(/(\\d+) of (\\d+) PLAN answers saved/i);
    const artifacts = text.match(/(\\d+) accepted Foundations visual/i);
    return JSON.stringify({
      foundationLearnComplete: learn ? Number(learn[1]) : 0,
      foundationLearnTotal: learn ? Number(learn[2]) : 0,
      foundationPlanAnswers: plan ? Number(plan[1]) : 0,
      foundationPlanFields: plan ? Number(plan[2]) : 0,
      acceptedArtifactCount: artifacts ? Number(artifacts[1]) : 0,
    });
  }`);
}

export async function observeWriterJourneyFinalState({
  client,
  resultText,
  baseUrl,
  captureScreenshot = async () => false,
}) {
  const ledger = [];

  await open(client, baseUrl, "/?workspace=learn");
  const learn = await inspectLearn(client, resultText);
  await captureScreenshot("writer-final-learn");
  ledger.push({ area: "learn", route: "/?workspace=learn", evidence: learn });

  await open(client, baseUrl, "/?workspace=plan&section=foundations");
  const plan = await inspectPlan(client, resultText);
  await captureScreenshot("writer-final-plan");
  ledger.push({ area: "plan", route: "/?workspace=plan&section=foundations", evidence: plan });

  await open(client, baseUrl, "/?workspace=build&section=foundations");
  const build = await inspectBuild(client, resultText);
  await captureScreenshot("writer-final-build");
  ledger.push({ area: "build", route: "/?workspace=build&section=foundations", evidence: build });

  await open(client, baseUrl, "/?workspace=dashboard");
  const dashboard = await inspectDashboard(client, resultText);
  await captureScreenshot("writer-final-dashboard");
  ledger.push({ area: "dashboard", route: "/?workspace=dashboard", evidence: dashboard });

  const project = await readProject(client, resultText);
  const audit = auditPersistedWriterProject(project, { learn, plan, build, dashboard });
  return {
    ...audit,
    observedAt: new Date().toISOString(),
    authority: "read-only-final-state-observer",
    mutationAuthority: "none",
    ledger,
  };
}
