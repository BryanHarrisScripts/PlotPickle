import type { PlotPickleProject, ScreenplayDraftElementType } from "./project";
import { parseScreenplay } from "./screenplay";

export type CharacterDialogueReport = {
  id: string;
  name: string;
  role: string;
  description: string;
  dialogueLines: number;
  dialogueEntries: number;
  wordCount: number;
  sceneNumbers: number[];
  sceneHeadings: Array<{ number: number; heading: string }>;
  firstScene: number | null;
  lastScene: number | null;
  speakingSceneCoverage: number;
  estimatedSpeakingSeconds: number;
};

export type ScreenplayReportSummary = {
  characters: number;
  charactersWithDialogue: number;
  dialogueLines: number;
  dialogueEntries: number;
  spokenWords: number;
  scenes: number;
  pages: number;
  elements: number;
  actionParagraphs: number;
  transitions: number;
  estimatedSpeakingSeconds: number;
  estimatedRuntimeSeconds: number;
  populatedSections: number;
  totalSections: number;
};

export type ScreenplayPopulationSection = {
  id: string;
  label: string;
  populated: number;
  total: number;
  status: "complete" | "partial" | "empty";
};

type ReportElement = {
  type: ScreenplayDraftElementType | "section" | "note";
  text: string;
  scene: number;
  blockNumber: number;
  miniBlockNumber: number;
};

const technicalExtensions = /\s*\((?:V\.?O\.?|O\.?S\.?|O\.?C\.?|CONT['’]?D|CONTINUED|PRE-?LAP|FILTERED|ON (?:THE )?PHONE|INTO (?:THE )?PHONE)\)\s*$/i;

export function normalizeCharacterCue(value: string) {
  let normalized = value.replace(/^@/, "").replace(/\^$/, "").trim();
  while (technicalExtensions.test(normalized)) normalized = normalized.replace(technicalExtensions, "").trim();
  return normalized.replace(/\s+/g, " ").toUpperCase();
}

export function countSpokenWords(value: string) {
  return value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function dialogueLineCount(value: string) {
  return Math.max(1, value.split(/\r?\n/).filter((line) => line.trim()).length);
}

function reportElements(project: PlotPickleProject): ReportElement[] {
  if (project.screenplay.draftElements.length) {
    return project.screenplay.draftElements
      .filter((element) => !element.omitted)
      .map((element) => ({
        type: element.type,
        text: element.text,
        scene: Math.max(1, element.sceneNumber),
        blockNumber: Math.max(1, element.blockNumber),
        miniBlockNumber: Math.max(1, element.miniBlockNumber),
      }));
  }
  return parseScreenplay(project.screenplay).map((element) => ({
    type: element.type,
    text: element.text,
    scene: Math.max(1, element.scene),
    blockNumber: Math.max(1, element.blockNumber),
    miniBlockNumber: Math.min(4, Math.max(1, Math.ceil(((element.page - 1) % 5 + 1) / 1.25))),
  }));
}

function valueCount(values: unknown[]) {
  return values.filter((value) => {
    if (typeof value === "string") return Boolean(value.trim());
    if (typeof value === "number") return Number.isFinite(value) && value > 0;
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  }).length;
}

function section(id: string, label: string, values: unknown[]): ScreenplayPopulationSection {
  const populated = valueCount(values);
  return {
    id,
    label,
    populated,
    total: values.length,
    status: populated === values.length ? "complete" : populated ? "partial" : "empty",
  };
}

export function createScreenplayPopulationReport(project: PlotPickleProject): ScreenplayPopulationSection[] {
  const allScenes = project.blocks.flatMap((block) => block.scenes);
  const allMiniBlocks = allScenes.flatMap((sceneItem) => sceneItem.miniBlocks);
  return [
    section("metadata", "Project metadata", Object.values(project.metadata).filter((_, index) => index < 7)),
    section("story", "Story foundation", Object.values(project.story)),
    section("world", "World and locations", [...Object.values(project.world).filter((value) => !Array.isArray(value)), project.world.locations]),
    section("development", "Planner forms", Object.values(project.development).flatMap((group) => Object.values(group))),
    section("characters", "Characters, arcs and voiceprints", project.characters.flatMap((character) => [
      character.name, character.role, character.description, character.want, character.need, character.ghost,
      character.fatalFlaw, character.strengths, character.arc, character.voice, character.originEnvironment,
      character.socialContext, character.educationExpertise, character.worldviewBoundaries,
      character.rhythmSentenceShape, character.vocabularyMetaphors, character.verbalFingerprints,
      character.emotionalAccess, character.statusShift, character.persuasionStrategy,
      ...Object.values(character.arcMatrix).filter((value) => !Array.isArray(value)), character.arcMatrix.checkpoints,
    ])),
    section("structure", "Sequences and story clock", project.structure.sequences.flatMap((sequence) => Object.values(sequence))),
    section("blocks", "24 Blocks", project.blocks.flatMap((block) => [block.summary, block.goal, block.conflict, block.choice, block.action, block.consequence, block.emotionalTurn, block.audienceExpectation, block.pickleTurn, block.setup, block.payoff, block.scriptExcerpt, block.storyboardDirection, block.notes])),
    section("scenes", "Scenes", allScenes.flatMap((sceneItem) => [sceneItem.title, sceneItem.purpose, sceneItem.entryCondition, sceneItem.exitCondition, sceneItem.objective, sceneItem.opposition, sceneItem.conflict, sceneItem.action, sceneItem.reversal, sceneItem.turn, sceneItem.resolution, sceneItem.outcome, sceneItem.characterIds, sceneItem.locationIds])),
    section("mini-blocks", "96 Mini-Blocks", allMiniBlocks.flatMap((mini) => [mini.function, mini.purpose, mini.objective, mini.resistance, mini.action, mini.revelation, mini.turn, mini.visualBeat, mini.dialogueIntention, mini.entryState, mini.exitState, mini.setup, mini.payoff, mini.notes])),
    section("screenplay", "Screenplay document", [project.screenplay.fileName, project.screenplay.sourceText || project.screenplay.draftElements, project.screenplay.importedAt, project.screenplay.analyzedAt]),
    section("threads", "Story Threads", project.storyThreads),
    section("rights", "Rights and provenance", [project.rights.projectOwner, project.rights.copyrightNotice, project.rights.rightsStatement, project.rights.defaultCreativeLicence, project.rights.sourceWorkTitle, project.rights.sourceWorkAuthor, project.rights.collaborators, project.rights.attributions]),
    section("review", "Review and pitch package", [project.review.threads, project.review.loglineCandidates, ...Object.values(project.review.pitchPackage)]),
    section("production", "Production planning", [project.production.breakdowns, project.production.schedule, ...Object.values(project.production.distribution)]),
    section("collaboration", "Collaboration metadata", [project.collaboration.branch, project.collaboration.projectPath]),
  ];
}

export function createCharacterDialogueReport(project: PlotPickleProject) {
  const elements = reportElements(project);
  const reports = new Map<string, CharacterDialogueReport>();
  const headings = new Map<number, string>();
  const sceneNumbers = new Set<number>();

  project.characters.forEach((character) => {
    const cue = normalizeCharacterCue(character.name);
    if (!cue) return;
    reports.set(cue, {
      id: character.id,
      name: character.name,
      role: character.role,
      description: character.description,
      dialogueLines: 0,
      dialogueEntries: 0,
      wordCount: 0,
      sceneNumbers: [],
      sceneHeadings: [],
      firstScene: null,
      lastScene: null,
      speakingSceneCoverage: 0,
      estimatedSpeakingSeconds: 0,
    });
  });

  elements.forEach((element) => {
    if (element.scene) sceneNumbers.add(element.scene);
    if (element.type === "scene-heading") headings.set(element.scene, element.text);
  });

  let currentCharacter = "";
  elements.forEach((element) => {
    if (element.type === "character") {
      currentCharacter = normalizeCharacterCue(element.text);
      return;
    }
    if (element.type === "parenthetical") return;
    if (element.type !== "dialogue" && element.type !== "dual-dialogue") {
      currentCharacter = "";
      return;
    }
    if (!currentCharacter || !element.text.trim()) return;

    const existing = reports.get(currentCharacter) ?? {
      id: `script-character-${currentCharacter.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: currentCharacter,
      role: "Detected in screenplay",
      description: "",
      dialogueLines: 0,
      dialogueEntries: 0,
      wordCount: 0,
      sceneNumbers: [],
      sceneHeadings: [],
      firstScene: null,
      lastScene: null,
      speakingSceneCoverage: 0,
      estimatedSpeakingSeconds: 0,
    };
    existing.dialogueLines += dialogueLineCount(element.text);
    existing.dialogueEntries += 1;
    existing.wordCount += countSpokenWords(element.text);
    if (!existing.sceneNumbers.includes(element.scene)) existing.sceneNumbers.push(element.scene);
    reports.set(currentCharacter, existing);
  });

  const totalScenes = Math.max(sceneNumbers.size, headings.size, 0);
  const characterReports = [...reports.values()].map((report) => {
    const speakingScenes = [...report.sceneNumbers].sort((a, b) => a - b);
    return {
      ...report,
      sceneNumbers: speakingScenes,
      sceneHeadings: speakingScenes.map((number) => ({ number, heading: headings.get(number) || "Scene heading not available" })),
      firstScene: speakingScenes.at(0) ?? null,
      lastScene: speakingScenes.at(-1) ?? null,
      speakingSceneCoverage: totalScenes ? Math.round((speakingScenes.length / totalScenes) * 100) : 0,
      estimatedSpeakingSeconds: Math.round((report.wordCount / 130) * 60),
    };
  });

  const pages = project.screenplay.draftElements.length
    ? Math.max(1, Math.ceil(project.screenplay.draftElements.filter((item) => !item.omitted).length / 55))
    : elements.length ? Math.max(1, Math.ceil(elements.length / 55)) : 0;
  const population = createScreenplayPopulationReport(project);
  const summary = characterReports.reduce<ScreenplayReportSummary>((total, report) => ({
    ...total,
    charactersWithDialogue: total.charactersWithDialogue + (report.dialogueLines ? 1 : 0),
    dialogueLines: total.dialogueLines + report.dialogueLines,
    dialogueEntries: total.dialogueEntries + report.dialogueEntries,
    spokenWords: total.spokenWords + report.wordCount,
    estimatedSpeakingSeconds: total.estimatedSpeakingSeconds + report.estimatedSpeakingSeconds,
  }), {
    characters: characterReports.length,
    charactersWithDialogue: 0,
    dialogueLines: 0,
    dialogueEntries: 0,
    spokenWords: 0,
    scenes: totalScenes,
    pages,
    elements: elements.length,
    actionParagraphs: elements.filter((item) => item.type === "action").length,
    transitions: elements.filter((item) => item.type === "transition").length,
    estimatedSpeakingSeconds: 0,
    estimatedRuntimeSeconds: Math.max(pages * 60, project.metadata.targetMinutes * 60),
    populatedSections: population.filter((item) => item.status === "complete").length,
    totalSections: population.length,
  });

  const source = project.screenplay.draftElements.length ? "editable canonical draft" : project.screenplay.sourceText ? "imported screenplay source" : "project character records";
  const signature = [project.id, project.metadata.updatedAt, project.screenplay.fileName, project.screenplay.importedAt, elements.length, summary.spokenWords].join(":");
  return { characters: characterReports, summary, population, source, signature, refreshedAt: project.metadata.updatedAt || project.screenplay.analyzedAt || project.screenplay.importedAt };
}


export function createProducerReport(project: PlotPickleProject) {
  const scenes = project.blocks.flatMap((block) => block.scenes.map((scene) => ({ blockNumber: block.number, scene })));
  const scheduledSceneIds = new Set(project.production.schedule.flatMap((day) => day.sceneIds));
  const castIds = new Set(scenes.flatMap(({ scene }) => scene.characterIds));
  project.production.breakdowns.forEach((breakdown) => breakdown.castIds.forEach((id) => castIds.add(id)));
  const locationIds = new Set(scenes.flatMap(({ scene }) => scene.locationIds));
  project.production.breakdowns.forEach((breakdown) => breakdown.locationIds.forEach((id) => locationIds.add(id)));
  const ready = project.production.breakdowns.filter((item) => item.readiness === "ready").length;
  const blocked = project.production.breakdowns.filter((item) => item.readiness === "blocked").length;
  const productionLoads = project.production.breakdowns.reduce((total, item) => total + [item.props, item.wardrobe, item.vehicles, item.effects, item.stunts, item.extras, item.makeup, item.sound].filter((value) => value.trim()).length, 0);
  return {
    scenes: scenes.length,
    pages: project.screenplay.draftElements.length ? Math.max(1, Math.ceil(project.screenplay.draftElements.filter((item) => !item.omitted).length / 55)) : 0,
    cast: castIds.size,
    locations: locationIds.size,
    breakdowns: project.production.breakdowns.length,
    breakdownsReady: ready,
    blockedBreakdowns: blocked,
    productionLoads,
    scheduleDays: project.production.schedule.length,
    scheduledHours: project.production.schedule.reduce((total, day) => total + day.estimatedHours, 0),
    unscheduledScenes: scenes.filter(({ scene }) => !scheduledSceneIds.has(scene.id)).length,
    distributionMilestones: project.production.distribution.milestones.length,
  };
}

export function createDirectorReport(project: PlotPickleProject) {
  const characterNames = new Map(project.characters.map((character) => [character.id, character.name]));
  const locationNames = new Map(project.world.locations.map((location) => [location.id, location.name]));
  return project.blocks.flatMap((block) => block.scenes.map((scene) => {
    const elements = project.screenplay.draftElements.filter((element) => element.sceneId === scene.id || (!element.sceneId && element.sceneNumber === scene.number));
    const dialogueWords = elements.filter((element) => element.type === "dialogue" || element.type === "dual-dialogue").reduce((total, element) => total + countSpokenWords(element.text), 0);
    const actionParagraphs = elements.filter((element) => element.type === "action").length;
    const shots = project.production.shots.filter((shot) => shot.sceneId === scene.id);
    return {
      id: scene.id,
      number: scene.number,
      blockNumber: block.number,
      title: scene.title || elements.find((element) => element.type === "scene-heading")?.text || "Untitled scene",
      purpose: scene.purpose,
      cast: scene.characterIds.map((id) => characterNames.get(id) || id),
      locations: scene.locationIds.map((id) => locationNames.get(id) || id),
      pageEstimate: scene.pageEstimate,
      estimatedSeconds: scene.estimatedSeconds,
      dialogueWords,
      actionParagraphs,
      shots: shots.length,
      approvedShots: shots.filter((shot) => shot.status === "approved" || shot.status === "captured").length,
      status: scene.status,
      locked: scene.locked,
      turn: scene.turn || scene.reversal || scene.outcome,
    };
  })).sort((left, right) => left.number - right.number);
}
