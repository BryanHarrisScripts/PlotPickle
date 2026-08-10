const SECRET_KEY = /(api[_-]?key|secret|token|password|authorization|bearer|private[_-]?key|credential)/i;

const STATUS = Object.freeze({
  COMPLETE: "Complete",
  DRAFT: "Draft",
  REVIEW: "Needs review",
  BLOCKED: "Blocked",
  NA: "Not applicable",
  NOT_REQUESTED: "Not requested",
});

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function present(value) {
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== null && value !== undefined;
}

function pathValue(source, path) {
  return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function missingPaths(source, paths) {
  return paths.filter((path) => !present(pathValue(source, path)));
}

function category(status, detail = {}) {
  return { status, ...detail };
}

function completionStatus(missing, review = false) {
  if (missing.length) return STATUS.DRAFT;
  return review ? STATUS.REVIEW : STATUS.COMPLETE;
}

const STORY_PATHS = [
  "story.premise", "story.logline", "story.theme", "story.antiTheme", "story.dramaticQuestion",
  "story.hook", "story.catalyst", "story.stakes", "story.ending",
];

const WORLD_PATHS = [
  "world.ordinaryWorld", "world.newWorld", "world.period", "world.history", "world.cultures",
  "world.rules", "world.technology", "world.visualLanguage",
];

const RIGHTS_PATHS = [
  "rights.adaptationStatus", "rights.projectOwner", "rights.aiProvenance",
];

function auditCharacters(project) {
  const missing = [];
  array(project.characters).forEach((character, index) => {
    for (const field of ["id", "name", "role", "description", "want", "need", "arc", "voice", "arcMatrix"]) {
      if (!present(character?.[field])) missing.push(`characters[${index}].${field}`);
    }
  });
  if (!array(project.characters).length) missing.push("characters");
  if (!array(project.world?.locations).length) missing.push("world.locations");
  return missing;
}

function auditStructure(project) {
  const missing = [];
  const blocks = array(project.blocks);
  if (blocks.length !== 24) missing.push(`blocks (expected 24, found ${blocks.length})`);
  const scenes = blocks.flatMap((block) => array(block.scenes));
  const minis = scenes.flatMap((scene) => array(scene.miniBlocks));
  if (minis.length !== 96) missing.push(`miniBlocks (expected 96, found ${minis.length})`);
  blocks.forEach((block, index) => {
    for (const field of ["summary", "goal", "conflict", "choice", "action", "consequence", "storyboardDirection"]) {
      if (!present(block?.[field])) missing.push(`blocks[${index}].${field}`);
    }
  });
  scenes.forEach((scene, index) => {
    for (const field of ["objective", "opposition", "reversal", "outcome"]) {
      if (!present(scene?.[field])) missing.push(`scenes[${index}].${field}`);
    }
  });
  minis.forEach((mini, index) => {
    for (const field of ["objective", "resistance", "action", "revelation", "turn", "visualBeat", "dialogueIntention"]) {
      if (!present(mini?.[field])) missing.push(`miniBlocks[${index}].${field}`);
    }
  });
  return { missing, blocks: blocks.length, scenes: scenes.length, miniBlocks: minis.length };
}

function candidateAssets(project) {
  const projectAssets = array(project.assets?.assets);
  const blockFrames = array(project.blocks).flatMap((block) => array(block.visuals));
  return { projectAssets, blockFrames };
}

export function auditProjectCoverage(projectInput = {}) {
  const project = object(projectInput);
  const structure = auditStructure(project);
  const charactersMissing = auditCharacters(project);
  const storyMissing = missingPaths(project, STORY_PATHS);
  const worldMissing = missingPaths(project, WORLD_PATHS);
  const rightsMissing = missingPaths(project, RIGHTS_PATHS);
  const screenplayMissing = missingPaths(project, ["screenplay.format", "screenplay.sourceText", "screenplay.draftElements"]);
  const productionMissing = missingPaths(project, ["production.shots", "production.breakdowns", "production.schedule"]);
  const { projectAssets, blockFrames } = candidateAssets(project);
  const visualCandidates = projectAssets.filter((asset) => present(asset?.variations) || present(asset?.src) || present(asset?.url));
  const populatedFrames = blockFrames.filter((frame) => present(frame?.src) || present(frame?.assetUrl) || present(frame?.versions));
  const videoAssets = projectAssets.filter((asset) => /video|animatic|trailer/i.test(`${asset?.type || ""} ${asset?.kind || ""} ${asset?.mediaType || ""}`));
  const graphicNovelAssets = projectAssets.filter((asset) => /graphic|panel|page|comic/i.test(`${asset?.type || ""} ${asset?.kind || ""} ${asset?.role || ""}`));
  const posterAssets = projectAssets.filter((asset) => /poster|key.?art/i.test(`${asset?.type || ""} ${asset?.kind || ""} ${asset?.role || ""} ${asset?.title || ""}`));

  const categories = {
    storyStructureAndScreenplay: category(completionStatus([...storyMissing, ...structure.missing, ...screenplayMissing]), {
      missing: [...storyMissing, ...structure.missing, ...screenplayMissing],
      counts: { blocks: structure.blocks, scenes: structure.scenes, miniBlocks: structure.miniBlocks },
    }),
    canonicalFieldCoverage: category(completionStatus([...storyMissing, ...worldMissing, ...charactersMissing, ...rightsMissing]), {
      missing: [...storyMissing, ...worldMissing, ...charactersMissing, ...rightsMissing],
    }),
    characterWorldLocationCoverage: category(completionStatus([...worldMissing, ...charactersMissing]), { missing: [...worldMissing, ...charactersMissing] }),
    posterKeyArt: category(posterAssets.length ? STATUS.REVIEW : STATUS.DRAFT, { candidateCount: posterAssets.length, missing: posterAssets.length ? [] : ["poster/key-art candidate"] }),
    imageCoverage: category(populatedFrames.length ? STATUS.REVIEW : STATUS.DRAFT, { populatedFrames: populatedFrames.length, plannedFrames: blockFrames.length, candidateAssetCount: visualCandidates.length }),
    videoAnimaticCoverage: category(videoAssets.length ? STATUS.REVIEW : STATUS.DRAFT, { candidateCount: videoAssets.length, missing: videoAssets.length ? [] : ["video/animatic candidate or explicit blocker"] }),
    graphicNovelBuildAssets: category(graphicNovelAssets.length ? STATUS.REVIEW : STATUS.DRAFT, { candidateCount: graphicNovelAssets.length }),
    productionReportingData: category(completionStatus(productionMissing), { missing: productionMissing }),
    rightsProvenanceApprovalState: category(completionStatus(rightsMissing, true), { missing: rightsMissing }),
    uiContinuity: category(STATUS.NOT_REQUESTED, { evidence: [] }),
    inputAndEndToEndUat: category(STATUS.NOT_REQUESTED, { evidence: [] }),
    integrationsAndBlockers: category(STATUS.NOT_REQUESTED, { blockers: [] }),
  };

  const completeCount = Object.values(categories).filter((entry) => entry.status === STATUS.COMPLETE).length;
  const reviewCount = Object.values(categories).filter((entry) => entry.status === STATUS.REVIEW).length;
  const total = Object.keys(categories).length;
  const wholeProjectComplete = Object.values(categories).every((entry) => [STATUS.COMPLETE, STATUS.NA].includes(entry.status));

  return {
    projectId: project.id || "",
    title: project.title || project.story?.title || "",
    statusVocabulary: STATUS,
    categories,
    summary: {
      completeCount,
      needsReviewCount: reviewCount,
      totalCategories: total,
      completionPercent: Math.round((completeCount / total) * 100),
      wholeProjectComplete,
    },
  };
}

function safeProvider(provider = {}, operation) {
  const source = object(provider);
  return {
    operation,
    enabled: source.enabled === true || source.status === "enabled" || source.status === "ready",
    reachable: source.reachable === true || source.ready === true || source.health === "ready" || source.status === "ready",
    configured: source.configured === true || source.hasCredential === true || source.hasCredentials === true || source.status === "ready",
    route: typeof source.route === "string" ? source.route : "",
    model: typeof source.model === "string" ? source.model : typeof source.selectedModel === "string" ? source.selectedModel : "",
    endpoint: typeof source.endpoint === "string" && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(source.endpoint) ? source.endpoint : "",
    autoStart: source.autoStart === true,
    paid: source.paid === true || source.billing === "paid" || source.kind === "cloud",
  };
}

function removeSecrets(value) {
  if (Array.isArray(value)) return value.map(removeSecrets);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET_KEY.test(key)).map(([key, nested]) => [key, removeSecrets(nested)]));
}

export function createCapabilitySnapshot(settingsInput = {}) {
  const settings = removeSecrets(object(settingsInput));
  const integrations = object(settings.integrations || settings.providers || settings.ai || settings);
  const ollama = safeProvider(integrations.ollama, "text");
  const comfyui = safeProvider(integrations.comfyui, "image/video");
  const openai = safeProvider(integrations.openai, "text/image");
  const minimax = safeProvider(integrations.minimax || integrations.h3, "image/video");
  const buzz = safeProvider(integrations.buzz, "collaboration/community");

  const routes = object(settings.routes || settings.routing || {});
  const snapshot = {
    generatedAt: new Date().toISOString(),
    routes: {
      text: typeof routes.text === "string" ? routes.text : typeof settings.textRoute === "string" ? settings.textRoute : "",
      image: typeof routes.image === "string" ? routes.image : typeof settings.imageRoute === "string" ? settings.imageRoute : "",
      video: typeof routes.video === "string" ? routes.video : typeof settings.videoRoute === "string" ? settings.videoRoute : "",
      collaboration: typeof routes.collaboration === "string" ? routes.collaboration : "buzz",
    },
    providers: { ollama, comfyui, openai, minimax, buzz },
    policy: {
      localOnlyByDefault: settings.localOnlyByDefault !== false,
      paidCloudRequiresPerJobConsent: settings.paidCloudRequiresPerJobConsent !== false,
      maximumRequests: Number.isFinite(Number(settings.maximumRequests)) ? Math.max(0, Math.round(Number(settings.maximumRequests))) : 0,
      maximumCost: Number.isFinite(Number(settings.maximumCost)) ? Math.max(0, Number(settings.maximumCost)) : 0,
      publishingAllowed: settings.publishingAllowed === true,
      collaborationAllowed: settings.collaborationAllowed === true,
    },
  };

  const serialized = JSON.stringify(snapshot);
  if (SECRET_KEY.test(serialized) || /sk-[a-z0-9_-]{8,}/i.test(serialized)) throw new Error("Capability snapshot contains secret-like material.");
  return snapshot;
}

export function supervisorFoundationReport(project, settings) {
  const coverage = auditProjectCoverage(project);
  const capabilities = createCapabilitySnapshot(settings);
  const blockers = [];
  if (!capabilities.providers.comfyui.reachable && !capabilities.providers.minimax.reachable) blockers.push("No ready image/video execution route reported.");
  if (!capabilities.providers.ollama.reachable && !capabilities.providers.openai.reachable) blockers.push("No ready text execution route reported.");
  if (!coverage.summary.wholeProjectComplete) blockers.push("Project coverage still contains Draft, Needs review, Blocked or Not requested categories.");
  coverage.categories.integrationsAndBlockers = category(blockers.length ? STATUS.BLOCKED : STATUS.COMPLETE, { blockers });
  return { coverage, capabilities, blockers };
}
