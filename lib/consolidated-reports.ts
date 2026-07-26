import type { PlotPickleProject, ReviewPriority } from "./project";
import { createMiniBlockWallModel } from "./mini-block-wall";
import {
  countSpokenWords,
  createCharacterDialogueReport,
  createDirectorReport,
  createProducerReport,
  createScreenplayPopulationReport,
} from "./screenplay-reports";
import { createStoredFeedbackModel } from "./unified-feedback-store";
import type { FeedbackCategory, FeedbackSource, FeedbackStatus } from "./unified-feedback";
import { createProductionReportsModel } from "./production-reports";

export type ConsolidatedReportSection =
  | "project"
  | "story"
  | "characters"
  | "scenes"
  | "dialogue"
  | "production"
  | "feedback"
  | "connections";

export const CONSOLIDATED_REPORT_SECTIONS: Array<{
  id: ConsolidatedReportSection;
  label: string;
  description: string;
}> = [
  { id: "project", label: "Project", description: "Draft, format, scale, completion, storyboard, feedback and canonical state." },
  { id: "story", label: "Story", description: "Acts, sequences, 24/96 coverage, setup/payoff, arcs, storylines and escalation." },
  { id: "characters", label: "Characters", description: "Scenes, dialogue, appearances, shared scenes, arcs, visuals and shooting days." },
  { id: "scenes", label: "Scenes", description: "Headings, timing, locations, cast, Blocks, storyboard, feedback and production readiness." },
  { id: "dialogue", label: "Dialogue", description: "Lines, words, speeches, scene balance, repetition, voice, sides and duration." },
  { id: "production", label: "Production", description: "Locations, coverage, shoot groups, actor schedules, timelines, requirements and AI systems." },
  { id: "feedback", label: "Feedback", description: "Active and resolved review by source, reviewer, target, category and review room." },
  { id: "connections", label: "Connections", description: "GitHub, AI, plugins, Google, storage, backups, repository and sync state." },
];

export type ReportTarget = {
  workspace: "dashboard" | "plan" | "build" | "write" | "storyboard" | "refine" | "feedback" | "reports" | "settings";
  targetId: string;
  blockId: string;
  miniBlockId: string;
  sceneId: string;
  characterId: string;
};

export type ReportSignal = "good" | "attention" | "blocked" | "neutral" | "disconnected";

export type ReportMetric = {
  id: string;
  label: string;
  value: string | number;
  detail: string;
  signal: ReportSignal;
  target?: ReportTarget;
};

export type RuntimeConnectionStatus = "connected" | "disconnected" | "error" | "unknown";

export type RuntimeConnectionSnapshot = {
  status?: RuntimeConnectionStatus;
  label?: string;
  detail?: string;
  checkedAt?: string;
  lastSyncAt?: string;
  error?: string;
};

export type ReportsRuntimeConnections = {
  github?: RuntimeConnectionSnapshot;
  ai?: RuntimeConnectionSnapshot;
  plugins?: RuntimeConnectionSnapshot;
  google?: RuntimeConnectionSnapshot;
  storage?: RuntimeConnectionSnapshot;
  backups?: RuntimeConnectionSnapshot;
};

export type ConnectionReportRow = {
  id: "github" | "ai" | "plugins" | "google" | "storage" | "backups";
  label: string;
  status: RuntimeConnectionStatus;
  detail: string;
  checkedAt: string;
  lastSyncAt: string;
  error: string;
  settingsTarget: ReportTarget;
};

function target(
  workspace: ReportTarget["workspace"],
  targetId = "",
  options: Partial<Omit<ReportTarget, "workspace" | "targetId">> = {},
): ReportTarget {
  return {
    workspace,
    targetId,
    blockId: options.blockId ?? "",
    miniBlockId: options.miniBlockId ?? "",
    sceneId: options.sceneId ?? "",
    characterId: options.characterId ?? "",
  };
}

function filled(values: unknown[]) {
  return values.filter((value) => {
    if (typeof value === "string") return Boolean(value.trim());
    if (typeof value === "number") return Number.isFinite(value) && value > 0;
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  }).length;
}

function percentage(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function secondsLabel(seconds: number) {
  if (!seconds) return "0 sec";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.round(seconds % 60);
  return [hours ? `${hours} hr` : "", minutes ? `${minutes} min` : "", !hours && remainder ? `${remainder} sec` : ""].filter(Boolean).join(" ");
}

function words(value: string) {
  return value.toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? [];
}

function screenplayElements(project: PlotPickleProject) {
  return project.screenplay.draftElements.filter((element) => !element.omitted);
}

function completeMiniBlock(mini: PlotPickleProject["blocks"][number]["scenes"][number]["miniBlocks"][number]) {
  const values = [mini.function, mini.purpose, mini.objective, mini.resistance, mini.action, mini.revelation, mini.turn, mini.entryState, mini.exitState];
  return filled(values) >= 5;
}

function completeBlock(block: PlotPickleProject["blocks"][number]) {
  const values = [block.purpose, block.summary, block.goal, block.conflict, block.choice, block.action, block.consequence, block.emotionalTurn];
  return filled(values) >= 5;
}

function projectMetrics(project: PlotPickleProject) {
  const screenplay = createCharacterDialogueReport(project);
  const wall = createMiniBlockWallModel(project);
  const feedback = createStoredFeedbackModel(project);
  const population = createScreenplayPopulationReport(project);
  const blocksComplete = project.blocks.filter(completeBlock).length;
  const miniBlocksComplete = wall.cards.filter((card) => {
    const block = project.blocks.find((candidate) => candidate.id === card.blockId);
    const scene = block?.scenes.find((candidate) => candidate.id === card.sceneId);
    const mini = scene?.miniBlocks.find((candidate) => candidate.id === card.id);
    return mini ? completeMiniBlock(mini) : false;
  }).length;
  const storyboardFrames = project.blocks.flatMap((block) => block.visuals).filter((frame) => frame.src.trim()).length;
  const activeFeedback = feedback.records.filter((record) => !["accepted", "partially-accepted", "rejected", "resolved"].includes(record.status)).length;
  return {
    metrics: [
      { id: "draft", label: "Draft", value: project.metadata.status || "In progress", detail: project.screenplay.fileName || "Canonical editable draft", signal: "neutral" as const, target: target("write", project.screenplay.fileName) },
      { id: "format", label: "Format", value: project.metadata.format || "Not set", detail: `${project.metadata.genre || "Genre not set"} · ${project.metadata.tone || "Tone not set"}`, signal: project.metadata.format ? "good" as const : "attention" as const, target: target("plan", "storySetup") },
      { id: "runtime", label: "Runtime", value: secondsLabel(screenplay.summary.estimatedRuntimeSeconds), detail: `Target ${project.metadata.targetMinutes || 0} min`, signal: screenplay.summary.estimatedRuntimeSeconds ? "good" as const : "attention" as const, target: target("reports", "project") },
      { id: "pages", label: "Pages", value: screenplay.summary.pages, detail: `${screenplay.summary.elements} screenplay elements`, signal: screenplay.summary.pages ? "good" as const : "attention" as const, target: target("write", "screenplay") },
      { id: "scenes", label: "Scenes", value: screenplay.summary.scenes, detail: `${project.blocks.flatMap((block) => block.scenes).length} canonical scene records`, signal: screenplay.summary.scenes ? "good" as const : "attention" as const, target: target("reports", "scenes") },
      { id: "characters", label: "Characters", value: project.characters.length, detail: `${screenplay.summary.charactersWithDialogue} speaking roles`, signal: project.characters.length ? "good" as const : "attention" as const, target: target("reports", "characters") },
      { id: "locations", label: "Locations", value: project.world.locations.length, detail: "Canonical world locations", signal: project.world.locations.length ? "good" as const : "attention" as const, target: target("plan", "world") },
      { id: "blocks", label: "24 Blocks", value: `${blocksComplete}/${project.blocks.length}`, detail: `${percentage(blocksComplete, project.blocks.length)}% structurally populated`, signal: blocksComplete === project.blocks.length ? "good" as const : "attention" as const, target: target("build", "blocks") },
      { id: "mini-blocks", label: "96 mini-blocks", value: `${miniBlocksComplete}/${wall.cards.length}`, detail: `${wall.warnings.length} diagnostic signals`, signal: miniBlocksComplete === wall.cards.length && !wall.warnings.length ? "good" as const : "attention" as const, target: target("build", "mini-blocks") },
      { id: "storyboard", label: "Storyboard", value: `${storyboardFrames}/${wall.cards.length}`, detail: `${wall.counts.frames} mini-block cards have frames`, signal: storyboardFrames === wall.cards.length ? "good" as const : "attention" as const, target: target("storyboard", "visual-board") },
      { id: "feedback", label: "Unresolved feedback", value: activeFeedback, detail: `${feedback.counts.resolved} resolved records retained`, signal: activeFeedback ? "attention" as const : "good" as const, target: target("feedback", "overview") },
      { id: "canonical", label: "Canonical state", value: project.schemaVersion, detail: `Updated ${project.metadata.updatedAt || "not yet saved"}`, signal: "good" as const, target: target("dashboard", project.id) },
    ] satisfies ReportMetric[],
    population,
    screenplay,
    wall,
    feedback,
  };
}

function storyReport(project: PlotPickleProject) {
  const wall = createMiniBlockWallModel(project);
  const acts = [1, 2, 3, 4].map((act) => {
    const blocks = project.blocks.filter((block) => block.act === act);
    const sequences = project.structure.sequences.filter((sequence) => sequence.act === act);
    return {
      act,
      blocks: blocks.length,
      completedBlocks: blocks.filter(completeBlock).length,
      sequences: sequences.length,
      targetMinutes: sequences.reduce((total, sequence) => total + sequence.targetMinutes, 0),
      sceneSeconds: blocks.flatMap((block) => block.scenes).reduce((total, scene) => total + scene.estimatedSeconds, 0),
      target: target("build", `act-${act}`),
    };
  });
  const sequences = project.structure.sequences.map((sequence) => {
    const blocks = project.blocks.filter((block) => block.sequenceNumber === sequence.number);
    return {
      id: sequence.id,
      number: sequence.number,
      act: sequence.act,
      title: sequence.title,
      targetMinutes: sequence.targetMinutes,
      sceneSeconds: blocks.flatMap((block) => block.scenes).reduce((total, scene) => total + scene.estimatedSeconds, 0),
      completedBlocks: blocks.filter(completeBlock).length,
      blockCount: blocks.length,
      escalation: sequence.escalation,
      turningPoint: sequence.turningPoint,
      target: target("build", sequence.id),
    };
  });
  const setups = project.blocks.flatMap((block) => block.scenes.flatMap((scene) => scene.miniBlocks.filter((mini) => mini.setup.trim()).map((mini) => ({ id: mini.id, text: mini.setup.trim(), blockId: block.id }))));
  const payoffs = project.blocks.flatMap((block) => block.scenes.flatMap((scene) => scene.miniBlocks.filter((mini) => mini.payoff.trim()).map((mini) => ({ id: mini.id, text: mini.payoff.trim(), blockId: block.id }))));
  const pairedSetups = setups.filter((setup) => payoffs.some((payoff) => payoff.text.toLocaleLowerCase() === setup.text.toLocaleLowerCase())).length;
  return {
    acts,
    sequences,
    completion: {
      blocks: project.blocks.filter(completeBlock).length,
      totalBlocks: project.blocks.length,
      miniBlocks: wall.cards.filter((card) => card.status === "ready").length,
      totalMiniBlocks: wall.cards.length,
    },
    diagnostics: wall.warnings,
    setupPayoff: {
      setups: setups.length,
      payoffs: payoffs.length,
      paired: pairedSetups,
      unresolvedSetups: Math.max(0, setups.length - pairedSetups),
      unresolvedPayoffs: Math.max(0, payoffs.length - pairedSetups),
    },
    characterArcs: project.characters.map((character) => ({
      id: character.id,
      name: character.name,
      checkpoints: character.arcMatrix.checkpoints.length,
      completedCheckpoints: character.arcMatrix.checkpoints.filter((checkpoint) => filled([checkpoint.belief, checkpoint.strategy, checkpoint.pressure, checkpoint.choice, checkpoint.consequence, checkpoint.evidence]) >= 3).length,
      opening: character.arcMatrix.startingState,
      ending: character.arcMatrix.endingState,
      target: target("plan", character.id, { characterId: character.id }),
    })),
    storylines: project.storyThreads.map((thread) => ({
      id: thread.id,
      name: thread.name,
      kind: thread.kind,
      status: thread.status,
      scenes: thread.sceneIds.length,
      milestones: thread.milestones.length,
      unresolvedMilestones: thread.milestones.filter((milestone) => !milestone.resolved).length,
      target: target("build", thread.id),
    })),
    pacingProfile: project.structure.pacingProfile,
    averageShotSeconds: project.structure.averageShotSeconds,
  };
}

function characterReport(project: PlotPickleProject) {
  const dialogue = createCharacterDialogueReport(project);
  const sceneRows = project.blocks.flatMap((block) => block.scenes.map((scene) => ({ block, scene })));
  const schedules = project.production.schedule;
  return project.characters.map((character) => {
    const spoken = dialogue.characters.find((candidate) => candidate.id === character.id || candidate.name.toLocaleUpperCase() === character.name.toLocaleUpperCase());
    const scenes = sceneRows.filter(({ scene }) => scene.characterIds.includes(character.id));
    const shared = new Map<string, number>();
    scenes.forEach(({ scene }) => scene.characterIds.filter((id) => id !== character.id).forEach((id) => shared.set(id, (shared.get(id) ?? 0) + 1)));
    const breakdowns = project.production.breakdowns.filter((breakdown) => breakdown.castIds.includes(character.id));
    const visualFrames = project.blocks.flatMap((block) => block.visuals).filter((frame) => frame.src.trim() && project.blocks.some((block) => block.visuals.some((candidate) => candidate.id === frame.id) && block.characterIds.includes(character.id)));
    const shootingDays = schedules.filter((day) => day.sceneIds.some((sceneId) => scenes.some(({ scene }) => scene.id === sceneId))).length;
    return {
      id: character.id,
      name: character.name,
      role: character.role,
      scenes: scenes.length,
      dialogueLines: spoken?.dialogueLines ?? 0,
      dialogueEntries: spoken?.dialogueEntries ?? 0,
      words: spoken?.wordCount ?? 0,
      speakingSeconds: spoken?.estimatedSpeakingSeconds ?? 0,
      firstAppearance: scenes.map(({ scene }) => scene.number).sort((a, b) => a - b).at(0) ?? null,
      lastAppearance: scenes.map(({ scene }) => scene.number).sort((a, b) => a - b).at(-1) ?? null,
      sharedScenes: [...shared.entries()].map(([id, count]) => ({ id, name: project.characters.find((candidate) => candidate.id === id)?.name || id, count })).sort((left, right) => right.count - left.count),
      arcProgress: percentage(character.arcMatrix.checkpoints.filter((checkpoint) => checkpoint.choice.trim() || checkpoint.evidence.trim()).length, Math.max(character.arcMatrix.checkpoints.length, 1)),
      visualContinuity: {
        identityImage: Boolean(character.image.trim()),
        linkedFrames: visualFrames.length,
      },
      actorRequirements: {
        breakdowns: breakdowns.length,
        wardrobe: breakdowns.filter((item) => item.wardrobe.trim()).length,
        makeup: breakdowns.filter((item) => item.makeup.trim()).length,
        stunts: breakdowns.filter((item) => item.stunts.trim()).length,
      },
      shootingDays,
      target: target("plan", character.id, { characterId: character.id }),
    };
  });
}

function headingParts(heading: string) {
  const upper = heading.toLocaleUpperCase();
  const interiorExterior = upper.startsWith("INT./EXT") || upper.startsWith("INT/EXT") ? "INT./EXT." : upper.startsWith("INT") ? "INT." : upper.startsWith("EXT") ? "EXT." : "Not specified";
  const dayNight = /\bNIGHT\b/.test(upper) ? "Night" : /\bDAY\b/.test(upper) ? "Day" : /\bDAWN\b/.test(upper) ? "Dawn" : /\bDUSK\b/.test(upper) ? "Dusk" : "Not specified";
  return { interiorExterior, dayNight };
}

function sceneReport(project: PlotPickleProject) {
  const director = createDirectorReport(project);
  const feedback = createStoredFeedbackModel(project);
  const frameByScene = new Map<string, number>();
  project.blocks.forEach((block) => block.scenes.forEach((scene) => {
    const miniNumbers = new Set(scene.miniBlocks.map((mini) => mini.number));
    frameByScene.set(scene.id, block.visuals.filter((frame) => miniNumbers.has(frame.miniBlockNumber) && frame.src.trim()).length);
  }));
  return director.map((row) => {
    const canonical = project.blocks.flatMap((block) => block.scenes.map((scene) => ({ block, scene }))).find(({ scene }) => scene.id === row.id);
    const heading = row.title;
    const parts = headingParts(heading);
    const breakdown = project.production.breakdowns.find((candidate) => candidate.sceneId === row.id);
    const feedbackCount = feedback.records.filter((record) => record.target.sceneId === row.id || record.target.targetId === row.id).length;
    return {
      ...row,
      ...parts,
      location: row.locations.join(", ") || "No location linked",
      characters: row.cast,
      feedback: feedbackCount,
      storyboardFrames: frameByScene.get(row.id) ?? 0,
      readiness: breakdown?.readiness ?? "not-started",
      requirements: breakdown ? [breakdown.props, breakdown.wardrobe, breakdown.vehicles, breakdown.effects, breakdown.stunts, breakdown.extras, breakdown.makeup, breakdown.sound].filter((value) => value.trim()).length : 0,
      target: target("write", row.id, { sceneId: row.id, blockId: canonical?.block.id ?? "" }),
    };
  });
}

function dialogueReport(project: PlotPickleProject) {
  const report = createCharacterDialogueReport(project);
  const elements = screenplayElements(project);
  const dialogueElements = elements.filter((element) => element.type === "dialogue" || element.type === "dual-dialogue");
  const sceneDialogue = new Map<number, number>();
  dialogueElements.forEach((element) => sceneDialogue.set(element.sceneNumber, (sceneDialogue.get(element.sceneNumber) ?? 0) + countSpokenWords(element.text)));
  const speeches = dialogueElements.map((element) => ({
    id: element.id,
    sceneNumber: element.sceneNumber,
    blockNumber: element.blockNumber,
    words: countSpokenWords(element.text),
    text: element.text,
    target: target("write", element.id, { sceneId: element.sceneId ?? "" }),
  })).sort((left, right) => right.words - left.words).slice(0, 20);
  const phraseCounts = new Map<string, number>();
  dialogueElements.forEach((element) => {
    const tokens = words(element.text);
    for (let index = 0; index <= tokens.length - 3; index += 1) {
      const phrase = tokens.slice(index, index + 3).join(" ");
      phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
    }
  });
  const repeatedPhrases = [...phraseCounts.entries()].filter(([, count]) => count > 1).map(([phrase, count]) => ({ phrase, count })).sort((left, right) => right.count - left.count || left.phrase.localeCompare(right.phrase)).slice(0, 25);
  const sceneRows = project.blocks.flatMap((block) => block.scenes.map((scene) => ({ id: scene.id, number: scene.number, title: scene.title, blockNumber: block.number, words: sceneDialogue.get(scene.number) ?? 0, estimatedSeconds: scene.estimatedSeconds })));
  const average = sceneRows.length ? sceneRows.reduce((total, scene) => total + scene.words, 0) / sceneRows.length : 0;
  return {
    summary: report.summary,
    characters: report.characters,
    longestSpeeches: speeches,
    dialogueHeavyScenes: sceneRows.filter((scene) => scene.words > Math.max(100, average * 1.5)).sort((left, right) => right.words - left.words),
    silentScenes: sceneRows.filter((scene) => scene.words === 0),
    repeatedPhrases,
    voiceConsistency: project.characters.map((character) => ({
      id: character.id,
      name: character.name,
      hasVoiceProfile: filled([character.voice, character.rhythmSentenceShape, character.vocabularyMetaphors, character.verbalFingerprints, character.persuasionStrategy]) >= 2,
      spokenWords: report.characters.find((candidate) => candidate.id === character.id)?.wordCount ?? 0,
      target: target("plan", character.id, { characterId: character.id }),
    })),
  };
}

function feedbackReport(project: PlotPickleProject) {
  const model = createStoredFeedbackModel(project);
  const statuses = Object.entries(model.byStatus).map(([status, count]) => ({ status: status as FeedbackStatus, count }));
  const sources = [...new Set(model.records.map((record) => record.source))].map((source) => ({ source: source as FeedbackSource, count: model.records.filter((record) => record.source === source).length }));
  const reviewers = [...new Set(model.records.map((record) => record.author).filter(Boolean))].map((reviewer) => ({ reviewer, count: model.records.filter((record) => record.author === reviewer).length })).sort((left, right) => right.count - left.count);
  const categories = [...new Set(model.records.map((record) => record.category))].map((category) => ({ category: category as FeedbackCategory, count: model.records.filter((record) => record.category === category).length })).sort((left, right) => right.count - left.count);
  const priorities = (["critical", "high", "normal", "low"] as ReviewPriority[]).map((priority) => ({ priority, count: model.records.filter((record) => record.priority === priority).length }));
  const distribution = {
    blocks: project.blocks.map((block) => ({ id: block.id, number: block.number, title: block.title, count: model.records.filter((record) => record.target.blockId === block.id || record.target.targetId === block.id).length })).filter((item) => item.count),
    miniBlocks: model.records.filter((record) => record.target.miniBlockId).length,
    scenes: model.records.filter((record) => record.target.sceneId || record.target.kind === "scene").length,
  };
  return {
    counts: model.counts,
    statuses,
    sources,
    reviewers,
    categories,
    priorities,
    distribution,
    writersRoom: model.records.filter((record) => record.source === "writers-room"),
    tableRead: model.records.filter((record) => record.source === "table-read" || record.category === "performance"),
    records: model.records,
  };
}

function connectionRow(
  id: ConnectionReportRow["id"],
  label: string,
  runtime: RuntimeConnectionSnapshot | undefined,
  fallback: Omit<RuntimeConnectionSnapshot, "label"> = {},
): ConnectionReportRow {
  const status = runtime?.status ?? fallback.status ?? "disconnected";
  return {
    id,
    label: runtime?.label || label,
    status,
    detail: runtime?.detail || fallback.detail || "Not connected. Core reporting remains available.",
    checkedAt: runtime?.checkedAt || fallback.checkedAt || "",
    lastSyncAt: runtime?.lastSyncAt || fallback.lastSyncAt || "",
    error: runtime?.error || fallback.error || "",
    settingsTarget: target("settings", id),
  };
}

function connectionsReport(project: PlotPickleProject, runtime: ReportsRuntimeConnections) {
  const githubCanonical: RuntimeConnectionSnapshot = project.collaboration.provider === "github"
    ? {
        status: project.collaboration.repositoryUrl ? "connected" : "unknown",
        detail: project.collaboration.repositoryUrl || `${project.collaboration.owner}/${project.collaboration.repo}` || "GitHub collaboration metadata exists.",
        checkedAt: project.collaboration.updatedAt,
        lastSyncAt: project.collaboration.lastPushedCommit || project.collaboration.lastPulledCommit,
      }
    : { status: "disconnected", detail: "No project repository is configured." };
  return {
    rows: [
      connectionRow("github", "GitHub", runtime.github, githubCanonical),
      connectionRow("ai", "AI provider", runtime.ai),
      connectionRow("plugins", "Plugins", runtime.plugins),
      connectionRow("google", "Google", runtime.google),
      connectionRow("storage", "Local storage", runtime.storage, { status: "unknown", detail: `Canonical project updated ${project.metadata.updatedAt || "not yet saved"}.` }),
      connectionRow("backups", "Backups", runtime.backups, { status: project.revisions.length ? "connected" : "disconnected", detail: `${project.revisions.length} revision snapshot${project.revisions.length === 1 ? "" : "s"} retained.` }),
    ],
    repository: {
      provider: project.collaboration.provider,
      url: project.collaboration.repositoryUrl,
      branch: project.collaboration.branch,
      projectPath: project.collaboration.projectPath,
      syncEnabled: project.collaboration.syncEnabled,
      lastPulledCommit: project.collaboration.lastPulledCommit,
      lastPushedCommit: project.collaboration.lastPushedCommit,
    },
  };
}

export function createConsolidatedReportsModel(
  project: PlotPickleProject,
  runtimeConnections: ReportsRuntimeConnections = {},
) {
  const projectReport = projectMetrics(project);
  return {
    generatedAt: project.metadata.updatedAt || "",
    project: projectReport,
    story: storyReport(project),
    characters: characterReport(project),
    scenes: sceneReport(project),
    dialogue: dialogueReport(project),
    production: {
      ...createProductionReportsModel(project),
      summary: createProducerReport(project),
      scenes: createDirectorReport(project),
      shots: project.production.shots,
      cues: project.production.cues,
      breakdowns: project.production.breakdowns,
      schedule: project.production.schedule,
      distribution: project.production.distribution,
    },
    feedback: feedbackReport(project),
    connections: connectionsReport(project, runtimeConnections),
  };
}

export type ConsolidatedReportsModel = ReturnType<typeof createConsolidatedReportsModel>;
