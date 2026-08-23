const VIDEO_ROUTES = new Set(["minimax-direct", "minimax-comfyui"]);

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function title(project) {
  return text(project?.metadata?.title, text(project?.story?.title, text(project?.title, "Untitled Story")));
}

function candidateSource(project) {
  const assets = array(project?.assets?.assets);
  for (const asset of assets) {
    const role = `${asset?.type || ""} ${asset?.kind || ""} ${asset?.role || ""} ${asset?.title || ""}`;
    if (!/poster|story-image|story-anchor|opening-anchor/i.test(role)) continue;
    const variation = array(asset?.variations).find((item) => text(item?.src, text(item?.url, text(item?.source))));
    const source = text(variation?.src, text(variation?.url, text(variation?.source)));
    if (source) return { sourceAssetUrl: source, sourceAssetId: text(asset?.id) };
  }
  for (const block of array(project?.blocks)) {
    for (const frame of array(block?.visuals)) {
      const source = text(frame?.src, text(frame?.assetUrl));
      if (source) return { sourceAssetUrl: source, sourceAssetId: text(frame?.id) };
    }
  }
  return { sourceAssetUrl: "", sourceAssetId: "" };
}

function motionPrompt(project) {
  const story = object(project?.story);
  const world = object(project?.world);
  const opening = array(project?.blocks)[0] || {};
  return [
    `Create a restrained cinematic animatic candidate for “${title(project)}”.`,
    text(story.logline, text(story.premise)),
    text(opening.storyboardDirection) ? `Opening direction: ${text(opening.storyboardDirection)}.` : "",
    text(world.visualLanguage) ? `Visual language: ${text(world.visualLanguage)}.` : "",
    "Use subtle subject movement, motivated environmental motion and a slow readable camera move. Preserve established character, wardrobe, location and palette identity. Do not add titles, logos, captions or dialogue text. This is an unreviewed candidate, not approved canon.",
  ].filter(Boolean).join(" ").slice(0, 7000);
}

export function exactVideoConsentStatement(count = 1) {
  return `I authorize ${count} paid MiniMax H3 video request${count === 1 ? "" : "s"} for this Production Supervisor video job and acknowledge that the selected prompt and source image will be sent to MiniMax.`;
}

export function buildVideoProductionPlan(mediaStatusInput = {}, projectInput = {}, requestInput = {}) {
  const mediaStatus = object(mediaStatusInput);
  const project = object(projectInput);
  const request = object(requestInput);
  const route = text(mediaStatus.videoRoute, "none");
  const source = candidateSource(project);
  const requestedCount = 1;
  const consent = object(request.paidConsent);
  const expectedConsentStatement = exactVideoConsentStatement(requestedCount);
  const consentValid = consent.acknowledged === true
    && Number(consent.maximumRequests) === requestedCount
    && text(consent.statement) === expectedConsentStatement;
  const routeReady = route === "minimax-direct"
    ? mediaStatus?.profiles?.minimax?.configured === true
    : route === "minimax-comfyui"
      ? mediaStatus?.hybridGate?.ready === true
      : false;

  let allowed = VIDEO_ROUTES.has(route) && routeReady && consentValid;
  let reason = "Video routing is Off. Select a tested MiniMax H3 route in Settings.";
  if (VIDEO_ROUTES.has(route) && !routeReady) reason = route === "minimax-comfyui"
    ? "MiniMax H3 through ComfyUI is selected, but its reviewed workflow gate is not ready."
    : "MiniMax H3 Direct is selected, but the MiniMax video profile is not ready.";
  else if (VIDEO_ROUTES.has(route) && !source.sourceAssetUrl) {
    allowed = false;
    reason = "A saved poster or story-image candidate is required as the first-frame source before this bounded animatic job can run.";
  } else if (VIDEO_ROUTES.has(route) && !consentValid) reason = `No paid video request was sent. Required consent: ${expectedConsentStatement}`;
  else if (allowed) reason = `Exact consent authorizes one bounded ${route} animatic request.`;

  return {
    route,
    allowed,
    paid: VIDEO_ROUTES.has(route),
    requestedCount,
    expectedConsentStatement,
    sourceAssetUrl: source.sourceAssetUrl,
    sourceAssetId: source.sourceAssetId,
    prompt: motionPrompt(project),
    durationSeconds: 4,
    aspectRatio: "16:9",
    reason,
    fallback: "none",
    approvalBoundary: "Completed video remains an unreviewed candidate until explicit human approval.",
  };
}

export function attachVideoCandidate(projectInput = {}, planInput = {}, jobInput = {}) {
  const project = object(projectInput);
  const plan = object(planInput);
  const job = object(jobInput);
  const outputAssetUrl = text(job.outputAssetUrl);
  if (!/^\/api\/local-ai\/assets\/[a-z0-9][a-z0-9._-]*\.(?:mp4|webm)$/i.test(outputAssetUrl)) return false;
  if (!project.assets || typeof project.assets !== "object" || Array.isArray(project.assets)) project.assets = {};
  if (!Array.isArray(project.assets.assets)) project.assets.assets = [];
  const createdAt = text(job.updatedAt, text(job.createdAt, new Date().toISOString()));
  const id = `animatic-${text(project.id, "project")}-${text(job.id, String(Date.now()))}`;
  project.assets.assets.push({
    id,
    type: "video",
    kind: "animatic",
    role: "story-animatic",
    title: `${title(project)} animatic candidate`,
    prompt: text(plan.prompt),
    sourceAssetId: text(plan.sourceAssetId),
    sourceAssetUrl: text(plan.sourceAssetUrl),
    approvalState: "candidate",
    approvedVariationId: "",
    variations: [{
      id: `${id}-variation-1`,
      src: outputAssetUrl,
      url: outputAssetUrl,
      route: text(job.route, text(plan.route)),
      provider: text(job.provider, "minimax"),
      model: text(job.model),
      status: "candidate",
      approval: "unreviewed",
      createdAt,
    }],
    createdAt,
    updatedAt: createdAt,
    extensions: { candidate: true, canonApproved: false, supervisorJobId: text(job.id) },
  });
  return true;
}
