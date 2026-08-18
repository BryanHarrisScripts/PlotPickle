const DEFAULT_SCENE_MS = 3200;
const MAX_SCENE_TEXT = 180;

function text(value, maximum = MAX_SCENE_TEXT) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

export function lazyFramesSlug(value, fallback = "plotpickle") {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || fallback;
}

function approvalRecords(project) {
  const records = project?.extensions?.buildSequenceApprovals;
  if (!Array.isArray(records)) return [];
  return records
    .filter((record) => record && typeof record === "object")
    .map((record) => ({
      id: text(record.id, 120),
      blockNumber: Number(record.blockNumber) || 0,
      miniBlockNumber: Number(record.miniBlockNumber) || 0,
      sceneId: text(record.sceneId, 120),
      sourceIds: Array.isArray(record.sourceIds) ? record.sourceIds.map((id) => text(id, 180)).filter(Boolean).slice(0, 64) : [],
      approvedAt: text(record.approvedAt, 80),
    }))
    .filter((record) => record.blockNumber >= 1 && record.blockNumber <= 24 && record.miniBlockNumber >= 1 && record.miniBlockNumber <= 4)
    .sort((left, right) => left.blockNumber - right.blockNumber || left.miniBlockNumber - right.miniBlockNumber || left.id.localeCompare(right.id));
}

function screenplayCopy(project, blockNumber, miniBlockNumber) {
  const elements = Array.isArray(project?.screenplay?.draftElements) ? project.screenplay.draftElements : [];
  const copy = elements
    .filter((element) => element?.blockNumber === blockNumber && element?.miniBlockNumber === miniBlockNumber && !element?.omitted)
    .filter((element) => ["action", "dialogue", "synopsis", "scene-heading"].includes(element?.type))
    .map((element) => text(element?.text, 120))
    .filter(Boolean)
    .join(" · ");
  return text(copy, MAX_SCENE_TEXT);
}

function visualCandidate(project, blockNumber, miniBlockNumber) {
  const block = Array.isArray(project?.blocks) ? project.blocks[blockNumber - 1] : null;
  const frames = Array.isArray(block?.visuals) ? block.visuals : [];
  const frame = frames.find((item) => item?.miniBlockNumber === miniBlockNumber && item?.approvedImageVersionId);
  if (!frame) return null;
  const versions = Array.isArray(frame.versions) ? frame.versions : [];
  const approved = versions.find((version) => version?.id === frame.approvedImageVersionId && version?.status === "approved");
  return {
    frameId: text(frame.id, 120),
    versionId: text(frame.approvedImageVersionId, 120),
    src: text(approved?.src || frame.src, 500),
    caption: text(frame.caption || frame.alt || frame.shot, 180),
  };
}

export function deriveLazyFramesAnimatic(project, options = {}) {
  const approvals = approvalRecords(project);
  const projectId = lazyFramesSlug(project?.id || project?.metadata?.title || "plotpickle-project");
  const title = text(project?.metadata?.title || project?.title || "PlotPickle Animatic", 120) || "PlotPickle Animatic";
  const sceneDurationMs = Math.max(1000, Math.min(10_000, Number(options.sceneDurationMs) || DEFAULT_SCENE_MS));
  const scenes = [];
  const provenanceScenes = [];
  let startMs = 0;

  for (const approval of approvals) {
    const block = Array.isArray(project?.blocks) ? project.blocks[approval.blockNumber - 1] : null;
    const heading = text(block?.title || `Block ${approval.blockNumber}`, 96);
    const fallbackCopy = text(block?.summary || block?.purpose || block?.storyboardDirection || "Approved Build sequence", MAX_SCENE_TEXT);
    const copy = screenplayCopy(project, approval.blockNumber, approval.miniBlockNumber) || fallbackCopy;
    const sceneId = lazyFramesSlug(`b${approval.blockNumber}-m${approval.miniBlockNumber}-${approval.id || scenes.length + 1}`, `scene-${scenes.length + 1}`);
    const visual = visualCandidate(project, approval.blockNumber, approval.miniBlockNumber);

    scenes.push({
      type: "typography",
      id: sceneId,
      startMs,
      durationMs: sceneDurationMs,
      transitionIn: { type: scenes.length ? "fade" : "cut", ms: scenes.length ? 350 : 100 },
      transitionOut: { type: "fade", ms: 350 },
      params: {
        lines: [
          { text: `BLOCK ${approval.blockNumber} · ${approval.blockNumber}.${approval.miniBlockNumber}`, size: 34, weight: 600, font: "body", color: "accent", tracking: 2, delayMs: 0 },
          { text: heading || "Approved sequence", size: 76, weight: 700, font: "display", color: "fg", tracking: 0, delayMs: 140 },
          ...(copy ? [{ text: copy, size: 34, weight: 400, font: "body", color: "fg", tracking: 0, delayMs: 320 }] : []),
        ],
        align: "center",
        reveal: "fade-up",
        staggerMs: 140,
        revealMs: 520,
        bg: { type: "solid", color: "#07110F" },
      },
    });

    provenanceScenes.push({
      lazyFramesSceneId: sceneId,
      approvalId: approval.id,
      blockNumber: approval.blockNumber,
      miniBlockNumber: approval.miniBlockNumber,
      sceneId: approval.sceneId,
      sourceIds: approval.sourceIds,
      approvedAt: approval.approvedAt,
      approvedVisualCandidate: visual,
      materialization: "typography-fallback",
    });
    startMs += sceneDurationMs;
  }

  return {
    spec: {
      specVersion: 1,
      meta: {
        id: `${projectId}-animatic`,
        width: 1280,
        height: 720,
        fps: 24,
        durationMs: startMs,
        qualityTier: "draft",
      },
      style: {
        tokens: {
          palette: ["#07110F", "#2DD4BF", "#F5F1E8"],
          fontDisplay: "Space Grotesk",
          fontBody: "Inter",
          stageBg: "#07110F",
        },
        grade: "contrast",
      },
      scenes,
      outputs: [
        { format: "mp4", path: "out/plotpickle-animatic.mp4", codec: "h264" },
      ],
    },
    provenance: {
      schemaVersion: 1,
      kind: "plotpickle-derived-lazy-frames-animatic",
      canonicalAuthority: "PPF",
      projectId: text(project?.id, 160),
      projectUpdatedAt: text(project?.metadata?.updatedAt, 80),
      title,
      approvalCount: approvals.length,
      scenes: provenanceScenes,
      rules: {
        derivedOnly: true,
        ppfMutationAllowed: false,
        providerSelectionAllowed: false,
        externalAssetFetchAllowed: false,
      },
    },
  };
}
