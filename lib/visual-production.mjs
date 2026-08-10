const PAID_ROUTES = new Set(["openai", "minimax", "h3"]);

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function positiveInteger(value, fallback, maximum) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? Math.min(maximum, number) : fallback;
}

function routeProvider(capabilities, route) {
  const providers = object(capabilities?.providers);
  if (route === "h3") return object(providers.minimax);
  return object(providers[route]);
}

function storyTitle(project) {
  return text(project?.metadata?.title, text(project?.story?.title, text(project?.title, "Untitled Story")));
}

function posterPrompt(project) {
  const title = storyTitle(project);
  const premise = text(project?.story?.premise, text(project?.story?.logline));
  const theme = text(project?.story?.theme);
  const setting = text(project?.world?.ordinaryWorld, text(project?.world?.newWorld));
  const visualLanguage = text(project?.world?.visualLanguage, text(project?.extensions?.fullStoryBuilder?.visualLanguage));
  const protagonist = array(project?.characters).find((character) => /protagonist/i.test(text(character?.role))) || array(project?.characters)[0] || {};
  return [
    `Create cinematic poster/key art for “${title}”.`,
    premise ? `Story: ${premise}` : "",
    protagonist?.name ? `Lead character: ${protagonist.name}. ${text(protagonist.description)}` : "",
    setting ? `World: ${setting}` : "",
    theme ? `Emotional idea: ${theme}` : "",
    visualLanguage ? `Visual language: ${visualLanguage}` : "",
    "Prioritize one instantly readable dramatic image, strong silhouette and depth, restrained title-safe negative space, no logos, no invented credits, no text rendering.",
    "This is a candidate only and must preserve approved character/location references when supplied.",
  ].filter(Boolean).join(" ");
}

function framePrompt(project, block, frame) {
  const title = storyTitle(project);
  const base = text(frame?.prompt, text(frame?.visualBeat, text(block?.storyboardDirection)));
  const continuity = text(frame?.continuity);
  const visualLanguage = text(project?.world?.visualLanguage, text(project?.extensions?.fullStoryBuilder?.visualLanguage));
  return [
    `Create a cinematic story image for “${title}”, Block ${block?.number || "?"}.${frame?.miniBlockNumber || "?"}.`,
    base,
    continuity ? `Continuity: ${continuity}` : "",
    visualLanguage ? `Visual language: ${visualLanguage}` : "",
    "Preserve approved character, location, wardrobe and palette identity. Do not add captions or interface text.",
  ].filter(Boolean).join(" ");
}

function anchorFrames(project) {
  const blocks = array(project?.blocks);
  const preferred = [1, 6, 12, 18, 24];
  const targets = [];
  for (const number of preferred) {
    const block = blocks.find((item) => Number(item?.number) === number) || blocks[number - 1];
    if (!block) continue;
    const frames = array(block.visuals);
    const frame = frames.find((item) => Number(item?.miniBlockNumber) === 4) || frames[0];
    if (!frame) continue;
    targets.push({ block, frame });
  }
  return targets;
}

function exactPaidConsent(route, count, request) {
  const consent = object(request?.paidConsent);
  return consent.acknowledged === true
    && Number(consent.maximumRequests) === count
    && text(consent.statement) === `I authorize up to ${count} paid ${route} image requests for this Visual Production job.`;
}

export function buildVisualProductionPlan(projectInput = {}, capabilitiesInput = {}, requestInput = {}) {
  const project = object(projectInput);
  const capabilities = object(capabilitiesInput);
  const request = object(requestInput);
  const route = text(capabilities?.routes?.image, "manual").toLowerCase();
  const provider = routeProvider(capabilities, route);
  const requestedStoryImages = positiveInteger(request.storyImageCount, 4, 5);
  const includePoster = request.includePoster !== false;
  const frames = anchorFrames(project).slice(0, requestedStoryImages);
  const targets = [];

  if (includePoster) {
    targets.push({
      id: `poster-${text(project.id, "project")}`,
      kind: "poster",
      role: "key-art",
      aspect: "portrait",
      blockNumber: 0,
      miniBlockNumber: 0,
      prompt: posterPrompt(project),
    });
  }

  frames.forEach(({ block, frame }, index) => {
    targets.push({
      id: `story-image-${text(project.id, "project")}-${block.number || index + 1}-${frame.miniBlockNumber || 1}`,
      kind: "story-image",
      role: index === 0 ? "opening-anchor" : "story-anchor",
      aspect: "landscape",
      blockNumber: Number(block.number) || index + 1,
      miniBlockNumber: Number(frame.miniBlockNumber) || 1,
      prompt: framePrompt(project, block, frame),
    });
  });

  const count = targets.length;
  const policy = object(capabilities.policy);
  const localReady = route === "comfyui" && provider.enabled !== false && provider.reachable === true;
  const paidRoute = PAID_ROUTES.has(route) || provider.paid === true;
  const paidReady = paidRoute && provider.enabled !== false && provider.configured === true && provider.reachable !== false;
  const policyMaximum = Number(policy.maximumRequests) > 0 ? Number(policy.maximumRequests) : count;
  const withinPolicy = count <= policyMaximum;
  const consent = exactPaidConsent(route, count, request);

  let allowed = false;
  let reason = "No ready image route is selected in Settings; prompts remain available for recovery.";
  if (localReady) {
    allowed = true;
    reason = "Ready local ComfyUI route selected in Settings.";
  } else if (paidRoute) {
    allowed = paidReady && withinPolicy && policy.paidCloudRequiresPerJobConsent !== false && consent;
    if (!paidReady) reason = `The selected ${route} image route is not ready.`;
    else if (!withinPolicy) reason = `The job requests ${count} images but the configured maximum is ${policyMaximum}.`;
    else if (!consent) reason = `The selected ${route} route may charge money and requires exact per-job consent for ${count} image requests.`;
    else reason = `Exact capped consent authorizes ${count} paid ${route} image requests.`;
  } else if (route === "comfyui") {
    reason = "Local ComfyUI is selected but is not currently ready; no cloud fallback will occur.";
  }

  return {
    route,
    allowed,
    paid: paidRoute,
    reason,
    targets,
    requestedCount: count,
    approvalBoundary: "Generated results remain candidates until explicit human approval.",
    fallback: "none",
  };
}

function ensureAssets(project) {
  if (!project.assets || typeof project.assets !== "object" || Array.isArray(project.assets)) project.assets = {};
  if (!Array.isArray(project.assets.assets)) project.assets.assets = [];
  return project.assets.assets;
}

function candidateVariation(target, generation) {
  const createdAt = text(generation?.createdAt, new Date().toISOString());
  return {
    id: `${target.id}-variation-${Date.parse(createdAt) || Date.now()}`,
    url: text(generation?.assetUrl, text(generation?.url)),
    src: text(generation?.assetUrl, text(generation?.url)),
    approval: "unreviewed",
    status: "candidate",
    provider: text(generation?.provider),
    model: text(generation?.model),
    workflow: text(generation?.workflow),
    route: text(generation?.route),
    prompt: target.prompt,
    createdAt,
  };
}

export function attachVisualProductionCandidate(projectInput, targetInput, generationInput = {}) {
  const project = object(projectInput);
  const target = object(targetInput);
  const generation = object(generationInput);
  const assetUrl = text(generation.assetUrl, text(generation.url));
  if (!assetUrl || !target.id || !target.kind) return false;
  const assets = ensureAssets(project);
  const variation = candidateVariation(target, generation);
  let asset = assets.find((item) => item?.id === target.id);
  if (!asset) {
    asset = {
      id: target.id,
      type: target.kind,
      kind: target.kind,
      role: target.role || target.kind,
      title: target.kind === "poster" ? `${storyTitle(project)} poster candidate` : `Block ${target.blockNumber}.${target.miniBlockNumber} story image`,
      prompt: target.prompt,
      approvalState: "candidate",
      approvedVariationId: "",
      blockNumber: target.blockNumber || 0,
      miniBlockNumber: target.miniBlockNumber || 0,
      variations: [],
    };
    assets.push(asset);
  }
  if (!Array.isArray(asset.variations)) asset.variations = [];
  asset.variations.push(variation);
  asset.approvalState = "candidate";
  asset.approvedVariationId = "";

  if (target.kind === "story-image") {
    const block = array(project.blocks).find((item) => Number(item?.number) === Number(target.blockNumber)) || array(project.blocks)[Number(target.blockNumber) - 1];
    const frame = array(block?.visuals).find((item) => Number(item?.miniBlockNumber) === Number(target.miniBlockNumber));
    if (frame) {
      if (!Array.isArray(frame.versions)) frame.versions = [];
      frame.versions.push({ ...variation });
      frame.src = assetUrl;
      frame.approvalState = "candidate";
    }
  }
  return true;
}

export function visualProductionResult(projectInput = {}, planInput = {}) {
  const project = object(projectInput);
  const plan = object(planInput);
  const assets = array(project?.assets?.assets);
  const posterCandidates = assets.filter((asset) => /poster|key.?art/i.test(`${asset?.type || ""} ${asset?.kind || ""} ${asset?.role || ""}`));
  const storyImages = assets.filter((asset) => /story-image|story-anchor|opening-anchor/i.test(`${asset?.type || ""} ${asset?.kind || ""} ${asset?.role || ""}`));
  return {
    route: text(plan.route, "manual"),
    requestedCount: Number(plan.requestedCount) || 0,
    posterCandidates: posterCandidates.length,
    storyImageCandidates: storyImages.length,
    approvalRequired: true,
    wholeVisualJobApproved: false,
  };
}
