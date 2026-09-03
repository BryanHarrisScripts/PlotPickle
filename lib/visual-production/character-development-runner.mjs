import { recordCharacterDevelopmentStudyOutput } from "../../core/visual-production/character-development.mjs";

const IMAGE_API = "/api/local-ai/generate/image";
const LOCAL_ASSET = /^\/api\/local-ai\/assets\/[a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp)$/i;
const SUPPORTED_ROUTES = new Set(["comfyui", "openai", "minimax"]);
const SECRET_KEY = /(api.?key|password|secret|private.?key|token|credential)/i;

function text(value, maximum = 1_000) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

function strings(value, maximumItems = 64, maximumCharacters = 320) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => text(item, maximumCharacters)).filter(Boolean))].slice(0, maximumItems);
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeId(value, fallback = "asset") {
  return text(value, 180).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function localAssets(value) {
  return strings(value, 12, 500).filter((item) => LOCAL_ASSET.test(item));
}

function safeStructured(value, depth = 0) {
  if (depth > 4) return undefined;
  if (typeof value === "string") return text(value, 1_200);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 24).map((item) => safeStructured(item, depth + 1)).filter((item) => item !== undefined);
  if (!value || typeof value !== "object") return undefined;
  const output = {};
  for (const [key, child] of Object.entries(value).slice(0, 32)) {
    if (SECRET_KEY.test(key)) continue;
    const safe = safeStructured(child, depth + 1);
    if (safe !== undefined) output[text(key, 120)] = safe;
  }
  return output;
}

function blocked(code, detail) {
  return { status: "blocked", blocker: { code, detail } };
}

function configuredModel(status, route) {
  if (route === "comfyui") {
    const comfy = record(status?.comfyui);
    return text(comfy.selectedCheckpoint || comfy.checkpoint, 240);
  }
  const profile = record(record(status?.profiles)[route]);
  return text(profile.imageModel, 240);
}

function routeReady(status, route) {
  if (route === "comfyui") {
    const comfy = record(status?.comfyui);
    return comfy.reachable === true && comfy.imageNodesReady === true && Boolean(configuredModel(status, route));
  }
  const profile = record(record(status?.profiles)[route]);
  return profile.configured === true && Boolean(configuredModel(status, route));
}

function paidConsent(count, input) {
  const statement = `I authorize ${count} paid image request${count === 1 ? "" : "s"} for this Character Visual Development package.`;
  const consent = record(input?.paidConsent);
  return {
    statement,
    approved: consent.acknowledged === true
      && Number(consent.maximumRequests) === count
      && text(consent.statement, 500) === statement,
  };
}

function specificationsByStudy(input) {
  const byStudy = new Map();
  for (const item of Array.isArray(input?.studySpecifications) ? input.studySpecifications : []) {
    const studyId = text(item?.studyId, 320);
    if (studyId && !byStudy.has(studyId)) byStudy.set(studyId, item);
  }
  return byStudy;
}

function generationBody(candidatePackage, study, specification, paid) {
  const prompt = text(specification?.prompt, 30_000);
  const identityLocks = safeStructured(specification?.identityLocks);
  const continuityMetadata = safeStructured({
    packageId: candidatePackage.packageId,
    studyId: study.id,
    studyType: study.type,
    ppfBaseRevision: candidatePackage.ppfBaseRevision,
    sourceEvidenceRefs: study.sourceEvidenceRefs,
    canonicalEvidenceRefs: candidatePackage.canonicalEvidenceRefs,
    continuity: specification?.continuityMetadata,
  });
  return {
    prompt,
    characterId: candidatePackage.characterId,
    assetId: `character-study-${safeId(candidatePackage.characterId, "character")}-${safeId(study.type, "study")}-${Number(study.version || 1)}`,
    aspect: specification?.aspect === "portrait" ? "portrait" : "landscape",
    quality: ["low", "medium", "high"].includes(specification?.quality) ? specification.quality : "medium",
    approvedCharacterReferences: localAssets(candidatePackage.approvedVisualRefs),
    referenceImages: localAssets(candidatePackage.observedRefs),
    environmentReferences: localAssets(specification?.environmentReferences),
    identityLocks: identityLocks && Object.keys(identityLocks).length ? identityLocks : undefined,
    wardrobeLookIds: strings(specification?.wardrobeLookIds, 12, 240),
    composition: text(specification?.composition, 1_500),
    negativeConstraints: strings(specification?.negativeConstraints, 32, 500),
    continuityMetadata,
    billingAcknowledged: paid,
    requestCount: 1,
  };
}

export function createCharacterDevelopmentGenerationPlan(candidatePackage, mediaStatus, input = {}) {
  if (!candidatePackage?.packageId || !candidatePackage?.ppfBaseRevision || !Array.isArray(candidatePackage?.studies)) {
    return blocked("package-contract", "A revision-bound Character Visual Development package is required.");
  }
  const route = text(mediaStatus?.imageRoute, 40);
  const approvedRoute = text(candidatePackage.providerRoute?.provider, 40);
  if (!SUPPORTED_ROUTES.has(route)) {
    return blocked("provider-unavailable", "The active image route is Manual Import, Off, or unsupported for generated character studies.");
  }
  if (route !== approvedRoute) {
    return blocked("provider-route-changed", `The active image route changed from ${approvedRoute || "the package route"} to ${route}. Re-authorize the package route instead of silently switching providers.`);
  }
  if (!routeReady(mediaStatus, route)) {
    return blocked("provider-unavailable", `The active ${route} image route is not generation-ready.`);
  }
  const model = configuredModel(mediaStatus, route);
  if (!model || model !== text(candidatePackage.providerRoute?.model, 240)) {
    return blocked("provider-model-changed", "The configured image model/checkpoint no longer matches the revision-bound package provider route.");
  }

  const requestedIds = new Set(strings(input?.studyIds, 32, 320));
  const specifications = specificationsByStudy(input);
  const candidates = candidatePackage.studies.filter((study) => {
    if (requestedIds.size && !requestedIds.has(study.id)) return false;
    if (study.notApplicable === true) return false;
    const generated = strings(study.generatedCandidateRefs, 16, 500);
    return study.stale === true || generated.length === 0;
  });
  if (!candidates.length) return blocked("nothing-to-generate", "No requested missing or stale character-development studies need generation.");

  const jobs = [];
  for (const study of candidates) {
    const specification = specifications.get(study.id);
    const prompt = text(specification?.prompt, 30_000);
    if (!prompt) return blocked("study-specification", `Study ${study.id} requires an explicit revision-bound generation specification.`);
    const ppfRevision = text(specification?.ppfRevision, 120);
    if (ppfRevision !== candidatePackage.ppfBaseRevision) {
      return blocked("revision-mismatch", `Study ${study.id} specification must target exact PPF revision ${candidatePackage.ppfBaseRevision}.`);
    }
    jobs.push({
      studyId: study.id,
      studyType: study.type,
      specificationFingerprint: text(specification?.specificationFingerprint, 200),
      coverageLabels: strings(specification?.coverageLabels, 32, 160),
      body: generationBody(candidatePackage, study, specification, route === "openai" || route === "minimax"),
    });
  }

  const paid = route === "openai" || route === "minimax";
  if (paid) {
    if (candidatePackage.providerRoute?.consentState !== "approved" || candidatePackage.providerRoute?.budgetState !== "approved") {
      return blocked("provider-policy", "Cloud character-study generation requires current consent and budget approval recorded on the package.");
    }
    const consent = paidConsent(jobs.length, input);
    if (!consent.approved) return blocked("paid-consent", `No paid request was sent. Required consent: ${consent.statement}`);
  }

  return {
    status: "ready",
    plan: {
      route,
      model,
      paid,
      requestedCount: jobs.length,
      studyIds: jobs.map((job) => job.studyId),
      jobs,
    },
  };
}

async function jsonRequest(server, pathname, method, body, fetchImpl) {
  const response = await fetchImpl(`${server}${pathname}`, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(240_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.message === "string" ? payload.message : `PlotPickle returned HTTP ${response.status}.`;
    throw new Error(message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]"));
  }
  return payload;
}

function publicPlan(plan) {
  return {
    route: plan.route,
    model: plan.model,
    paid: plan.paid,
    requestedCount: plan.requestedCount,
    studyIds: [...plan.studyIds],
  };
}

export async function runCharacterDevelopmentGeneration(server, candidatePackage, mediaStatus, input = {}, fetchImpl = fetch) {
  const planned = createCharacterDevelopmentGenerationPlan(candidatePackage, mediaStatus, input);
  if (planned.status !== "ready") return { ...planned, package: candidatePackage, generated: [], failed: [] };

  let current = candidatePackage;
  const generated = [];
  const failed = [];
  for (const job of planned.plan.jobs) {
    try {
      const result = await jsonRequest(server, IMAGE_API, "POST", job.body, fetchImpl);
      const assetUrl = text(result.assetUrl, 2_000);
      if (!LOCAL_ASSET.test(assetUrl)) throw new Error("The configured image route did not return a saved local PlotPickle candidate asset.");
      if (text(result.route, 40) !== planned.plan.route) throw new Error("The image response route did not match the approved active package route.");
      const recorded = recordCharacterDevelopmentStudyOutput(current, job.studyId, {
        ppfRevision: current.ppfBaseRevision,
        providerRoute: current.providerRoute,
        generatedCandidateRefs: [assetUrl],
        coverageLabels: job.coverageLabels,
        summary: `${job.studyType} candidate generated through the configured ${planned.plan.route} image route using ${planned.plan.model}.`,
        specificationFingerprint: job.specificationFingerprint,
        createdAt: new Date().toISOString(),
      });
      if (recorded.status !== "ready") throw new Error(recorded.blocker?.detail || "The generated study could not be recorded.");
      current = recorded.package;
      generated.push({
        studyId: job.studyId,
        studyType: job.studyType,
        assetUrl,
        route: planned.plan.route,
        model: planned.plan.model,
        providerRequestId: text(result.providerRequestId, 300),
      });
    } catch (error) {
      failed.push({
        studyId: job.studyId,
        studyType: job.studyType,
        error: error instanceof Error ? error.message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]") : "Character-study generation failed.",
      });
    }
  }

  return {
    status: failed.length ? (generated.length ? "partial" : "failed") : "ready",
    package: current,
    plan: publicPlan(planned.plan),
    generated,
    failed,
  };
}

export const CHARACTER_DEVELOPMENT_IMAGE_API = IMAGE_API;
