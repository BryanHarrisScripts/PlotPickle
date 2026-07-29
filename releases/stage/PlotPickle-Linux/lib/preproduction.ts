import { cloneProject, type PlotPickleProject, type ProductionBreakdown, type ProductionScheduleDay, type ProductionShot, type SonicCue } from "./project";

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function timestamp() {
  return new Date().toISOString();
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function ensureProductionWorkspace(project: PlotPickleProject): PlotPickleProject {
  if (project.production) return project;
  const now = timestamp();
  return {
    ...project,
    production: {
      shots: [],
      cues: [],
      breakdowns: [],
      schedule: [],
      animatic: { defaultFrameSeconds: 4, includeDialogue: true, showCueLabels: true, updatedAt: now },
      distribution: {
        audience: project.development.storySetup.audience || "",
        positioning: project.development.pitch.audiencePromise || "",
        releasePath: "",
        festivalTargets: "",
        distributorTargets: "",
        salesMaterials: "",
        trailerPlan: "",
        posterPlan: "",
        socialCampaign: "",
        pressAngles: "",
        milestones: [],
        updatedAt: now,
      },
    },
  };
}

export function createShotFromFrame(
  project: PlotPickleProject,
  blockNumber: number,
  sceneId: string,
  frameId: string,
): PlotPickleProject {
  const active = ensureProductionWorkspace(project);
  const block = active.blocks.find((candidate) => candidate.number === blockNumber);
  if (!block) return active;
  const scene = block.scenes.find((candidate) => candidate.id === sceneId) ?? block.scenes[0];
  const frame = block.visuals.find((candidate) => candidate.id === frameId) ?? block.visuals[0];
  const existing = active.production.shots.filter((shot) => shot.blockNumber === blockNumber && shot.sceneId === scene?.id);
  const shot: ProductionShot = {
    id: makeId("shot"),
    blockNumber,
    miniBlockNumber: frame?.miniBlockNumber ?? scene?.miniBlocks[0]?.number ?? 1,
    sceneId: scene?.id ?? "",
    screenplayElementIds: active.screenplay.draftElements.filter((element) => element.sceneId === scene?.id).map((element) => element.id),
    frameId: frame?.id ?? "",
    shotNumber: existing.length + 1,
    shotSize: frame?.shot || "Wide",
    angle: "Eye level",
    movement: "Locked",
    lens: "Natural perspective",
    composition: frame?.caption || block.storyboardDirection || block.summary,
    purpose: scene?.purpose || block.goal || block.summary,
    continuity: frame?.continuity || block.notes,
    keyframeSrc: frame?.src || "",
    keyframeAlt: frame?.alt || `${active.metadata.title} Block ${blockNumber} production keyframe`,
    status: frame?.src ? "approved" : "planned",
    durationSeconds: Math.max(2, Math.round((scene?.estimatedSeconds || block.targetMinutes * 60) / Math.max(1, existing.length + 4))),
    notes: "",
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };
  return { ...active, production: { ...active.production, shots: [...active.production.shots, shot] } };
}

export function updateProductionShot(project: PlotPickleProject, shotId: string, patch: Partial<ProductionShot>): PlotPickleProject {
  const active = ensureProductionWorkspace(project);
  return {
    ...active,
    production: {
      ...active.production,
      shots: active.production.shots.map((shot) => shot.id === shotId ? { ...shot, ...patch, id: shot.id, updatedAt: timestamp() } : shot),
    },
  };
}

export function removeProductionShot(project: PlotPickleProject, shotId: string): PlotPickleProject {
  const active = ensureProductionWorkspace(project);
  return { ...active, production: { ...active.production, shots: active.production.shots.filter((shot) => shot.id !== shotId) } };
}

export function createSonicCue(project: PlotPickleProject, blockNumber: number, sceneId: string): PlotPickleProject {
  const active = ensureProductionWorkspace(project);
  const block = active.blocks.find((candidate) => candidate.number === blockNumber);
  const scene = block?.scenes.find((candidate) => candidate.id === sceneId) ?? block?.scenes[0];
  if (!block) return active;
  const existing = active.production.cues.filter((cue) => cue.blockNumber === blockNumber);
  const cue: SonicCue = {
    id: makeId("cue"),
    cueNumber: `M${blockNumber}.${existing.length + 1}`,
    blockNumber,
    sceneId: scene?.id ?? "",
    type: "score",
    title: `${block.title} cue`,
    motif: "",
    cueIn: scene?.entryCondition || "At the first visible turn",
    cueOut: scene?.exitCondition || "At the scene handoff",
    purpose: scene?.purpose || block.emotionalTurn || block.summary,
    status: "temp",
    rights: "Original or clearance required before release",
    durationSeconds: Math.max(5, Math.round(scene?.estimatedSeconds || block.targetMinutes * 60)),
    notes: "",
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };
  return { ...active, production: { ...active.production, cues: [...active.production.cues, cue] } };
}

export function updateSonicCue(project: PlotPickleProject, cueId: string, patch: Partial<SonicCue>): PlotPickleProject {
  const active = ensureProductionWorkspace(project);
  return {
    ...active,
    production: {
      ...active.production,
      cues: active.production.cues.map((cue) => cue.id === cueId ? { ...cue, ...patch, id: cue.id, updatedAt: timestamp() } : cue),
    },
  };
}

export function removeSonicCue(project: PlotPickleProject, cueId: string): PlotPickleProject {
  const active = ensureProductionWorkspace(project);
  return { ...active, production: { ...active.production, cues: active.production.cues.filter((cue) => cue.id !== cueId) } };
}

export function buildShotCoverage(project: PlotPickleProject) {
  const active = ensureProductionWorkspace(project);
  return active.blocks.map((block) => {
    const shots = active.production.shots.filter((shot) => shot.blockNumber === block.number);
    const cues = active.production.cues.filter((cue) => cue.blockNumber === block.number);
    const coveredFrames = new Set(shots.map((shot) => shot.frameId).filter(Boolean));
    const sceneIds = new Set(shots.map((shot) => shot.sceneId).filter(Boolean));
    return {
      blockNumber: block.number,
      title: block.title,
      scenes: block.scenes.length,
      coveredScenes: sceneIds.size,
      frames: block.visuals.length,
      coveredFrames: coveredFrames.size,
      shots: shots.length,
      keyframes: shots.filter((shot) => Boolean(shot.keyframeSrc)).length,
      cues: cues.length,
      missingSceneIds: block.scenes.filter((scene) => !sceneIds.has(scene.id)).map((scene) => scene.id),
      missingFrameIds: block.visuals.filter((frame) => !coveredFrames.has(frame.id)).map((frame) => frame.id),
      complete: block.scenes.length > 0 && sceneIds.size === block.scenes.length && block.visuals.length > 0 && coveredFrames.size === block.visuals.length && cues.length > 0,
    };
  });
}

export function buildAnimaticTimeline(project: PlotPickleProject) {
  const active = ensureProductionWorkspace(project);
  return active.blocks.flatMap((block) => block.visuals.map((frame) => {
    const shots = active.production.shots.filter((shot) => shot.blockNumber === block.number && (shot.frameId === frame.id || shot.miniBlockNumber === frame.miniBlockNumber));
    const cues = active.production.cues.filter((cue) => cue.blockNumber === block.number && (!cue.sceneId || shots.some((shot) => shot.sceneId === cue.sceneId)));
    const dialogue = active.screenplay.draftElements
      .filter((element) => element.blockNumber === block.number && element.miniBlockNumber === frame.miniBlockNumber && ["dialogue", "dual-dialogue"].includes(element.type))
      .map((element) => element.text)
      .join(" ");
    return {
      id: frame.id,
      blockNumber: block.number,
      miniBlockNumber: frame.miniBlockNumber,
      title: `Block ${block.number}.${frame.miniBlockNumber} — ${block.title}`,
      image: frame.src,
      alt: frame.alt || frame.caption,
      caption: frame.caption || block.summary,
      dialogue,
      shots,
      cues,
      durationSeconds: shots.reduce((sum, shot) => sum + Math.max(1, shot.durationSeconds), 0) || active.production.animatic.defaultFrameSeconds,
    };
  }));
}

export function generateProductionBreakdowns(project: PlotPickleProject): PlotPickleProject {
  const active = ensureProductionWorkspace(project);
  const current = new Map(active.production.breakdowns.map((item) => [item.sceneId, item]));
  const breakdowns: ProductionBreakdown[] = active.blocks.flatMap((block) => block.scenes.map((scene) => {
    const existing = current.get(scene.id);
    const screenplayText = active.screenplay.draftElements.filter((element) => element.sceneId === scene.id).map((element) => element.text).join(" ");
    return {
      id: existing?.id || makeId("breakdown"),
      blockNumber: block.number,
      sceneId: scene.id,
      castIds: unique(existing?.castIds ?? [...block.characterIds, ...scene.charactersEntering]),
      locationIds: unique(existing?.locationIds ?? block.locationIds),
      props: existing?.props || "",
      wardrobe: existing?.wardrobe || "",
      vehicles: existing?.vehicles || (/car|vehicle|truck|motorcycle|boat/i.test(screenplayText) ? "Review vehicles in screenplay evidence" : ""),
      effects: existing?.effects || (/explosion|fire|rain|storm|glitch|screen|hologram/i.test(screenplayText) ? "Review practical and visual effects" : ""),
      stunts: existing?.stunts || (/fight|fall|crash|chase|jump|gun|wave/i.test(screenplayText) ? "Stunt or safety review required" : ""),
      extras: existing?.extras || "",
      makeup: existing?.makeup || "",
      sound: existing?.sound || active.production.cues.filter((cue) => cue.sceneId === scene.id).map((cue) => cue.title).join(", "),
      estimatedHours: existing?.estimatedHours || Math.max(1, Math.ceil((scene.pageEstimate || 1) * 1.5)),
      readiness: existing?.readiness || "draft",
      notes: existing?.notes || "",
      updatedAt: timestamp(),
    };
  }));
  return { ...active, production: { ...active.production, breakdowns } };
}

export function updateProductionBreakdown(project: PlotPickleProject, breakdownId: string, patch: Partial<ProductionBreakdown>): PlotPickleProject {
  const active = ensureProductionWorkspace(project);
  return {
    ...active,
    production: {
      ...active.production,
      breakdowns: active.production.breakdowns.map((item) => item.id === breakdownId ? { ...item, ...patch, id: item.id, updatedAt: timestamp() } : item),
    },
  };
}

export function generateProductionSchedule(project: PlotPickleProject): PlotPickleProject {
  const withBreakdowns = project.production?.breakdowns.length ? ensureProductionWorkspace(project) : generateProductionBreakdowns(project);
  const byLocation = new Map<string, ProductionBreakdown[]>();
  withBreakdowns.production.breakdowns.forEach((breakdown) => {
    const key = breakdown.locationIds[0] || "location-tbd";
    byLocation.set(key, [...(byLocation.get(key) || []), breakdown]);
  });
  const days: ProductionScheduleDay[] = [];
  for (const [locationId, entries] of byLocation) {
    let batch: ProductionBreakdown[] = [];
    let hours = 0;
    for (const entry of entries) {
      if (batch.length && hours + entry.estimatedHours > 10) {
        days.push(makeScheduleDay(days.length + 1, locationId, batch));
        batch = [];
        hours = 0;
      }
      batch.push(entry);
      hours += entry.estimatedHours;
    }
    if (batch.length) days.push(makeScheduleDay(days.length + 1, locationId, batch));
  }
  return { ...withBreakdowns, production: { ...withBreakdowns.production, schedule: days } };
}

function makeScheduleDay(dayNumber: number, locationId: string, entries: ProductionBreakdown[]): ProductionScheduleDay {
  return {
    id: makeId("shoot-day"),
    dayNumber,
    date: "",
    sceneIds: entries.map((entry) => entry.sceneId),
    locationId,
    callTime: "08:00",
    estimatedHours: entries.reduce((sum, entry) => sum + entry.estimatedHours, 0),
    status: "planned",
    notes: "Generated from scene breakdowns; adjust for cast, daylight, company moves and location availability.",
    updatedAt: timestamp(),
  };
}

export function updateScheduleDay(project: PlotPickleProject, dayId: string, patch: Partial<ProductionScheduleDay>): PlotPickleProject {
  const active = ensureProductionWorkspace(project);
  return {
    ...active,
    production: {
      ...active.production,
      schedule: active.production.schedule.map((day) => day.id === dayId ? { ...day, ...patch, id: day.id, updatedAt: timestamp() } : day),
    },
  };
}

export function productionCoverage(project: PlotPickleProject) {
  const active = ensureProductionWorkspace(project);
  const coverage = buildShotCoverage(active);
  const sceneCount = active.blocks.reduce((sum, block) => sum + block.scenes.length, 0);
  const coveredScenes = new Set(active.production.shots.map((shot) => shot.sceneId).filter(Boolean)).size;
  return {
    sceneCount,
    coveredScenes,
    shots: active.production.shots.length,
    keyframes: active.production.shots.filter((shot) => Boolean(shot.keyframeSrc)).length,
    cues: active.production.cues.length,
    breakdowns: active.production.breakdowns.length,
    scheduleDays: active.production.schedule.length,
    completedBlocks: coverage.filter((row) => row.complete).length,
  };
}
