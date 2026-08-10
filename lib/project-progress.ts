import { completionFor, createBlankDevelopment, type PlotPickleProject, type StoryBlock } from "./project";

export type ProjectProgressSection =
  | "overview"
  | "storySetup"
  | "concept"
  | "references"
  | "pitch"
  | "world"
  | "characters"
  | "ghost"
  | "catalyst"
  | "foundations"
  | "pickle"
  | "dialogue"
  | "coreModel"
  | "structureMap"
  | "blocks"
  | "storyboard"
  | "notes";

export const recommendedSectionOrder: ProjectProgressSection[] = [
  "storySetup",
  "concept",
  "references",
  "pitch",
  "world",
  "characters",
  "ghost",
  "catalyst",
  "foundations",
  "pickle",
  "dialogue",
  "coreModel",
  "structureMap",
  "blocks",
  "storyboard",
  "notes",
];

function isFilled(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

function score(values: unknown[]) {
  if (!values.length) return 0;
  return Math.round((values.filter(isFilled).length / values.length) * 100);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function blockProgress(block: StoryBlock) {
  return score([
    block.summary,
    block.goal,
    block.conflict,
    block.choice,
    block.action,
    block.consequence,
    block.emotionalTurn,
    block.audienceExpectation,
    block.pickleTurn,
  ]);
}

function developmentWithDefaults(project: PlotPickleProject) {
  const defaults = createBlankDevelopment();
  const development = project.development ?? defaults;
  return {
    conceptCanvas: { ...defaults.conceptCanvas, ...(development.conceptCanvas ?? {}) },
    visualReferences: Array.isArray(development.visualReferences) ? development.visualReferences : [],
    storySetup: { ...defaults.storySetup, ...(development.storySetup ?? {}) },
    pitch: { ...defaults.pitch, ...(development.pitch ?? {}) },
    ghost: { ...defaults.ghost, ...(development.ghost ?? {}) },
    catalyst: { ...defaults.catalyst, ...(development.catalyst ?? {}) },
    foundations: { ...defaults.foundations, ...(development.foundations ?? {}) },
    pickle: { ...defaults.pickle, ...(development.pickle ?? {}) },
    dialogue: { ...defaults.dialogue, ...(development.dialogue ?? {}) },
    notes: { ...defaults.notes, ...(development.notes ?? {}) },
  };
}

export function projectSectionProgress(project: PlotPickleProject): Record<ProjectProgressSection, number> {
  const development = developmentWithDefaults(project);
  const safeProject = { ...project, development } as PlotPickleProject;
  const characters = Array.isArray(project.characters) ? project.characters : [];
  const blocks = Array.isArray(project.blocks) ? project.blocks : [];
  const sequences = Array.isArray(project.structure?.sequences) ? project.structure.sequences : [];

  const characterScores = characters.map((character) =>
    score([
      character.name,
      character.role,
      character.description,
      character.want,
      character.need,
      character.ghost,
      character.fatalFlaw,
      character.arc,
      character.voice,
    ]),
  );

  const sequenceScores = sequences.map((sequence) =>
    score([
      sequence.question,
      sequence.promise,
      sequence.escalation,
      sequence.climax,
      sequence.turningPoint,
      sequence.result,
    ]),
  );

  const sceneScores = blocks.flatMap((block) =>
    (Array.isArray(block.scenes) ? block.scenes : []).map((scene) =>
      score([scene.objective, scene.conflict, scene.turn, scene.resolution, scene.outcome]),
    ),
  );

  const miniBlockScores = blocks.flatMap((block) =>
    (Array.isArray(block.scenes) ? block.scenes : []).flatMap((scene) =>
      (Array.isArray(scene.miniBlocks) ? scene.miniBlocks : []).map((mini) =>
        score([
          mini.purpose,
          mini.objective,
          mini.resistance,
          mini.action,
          mini.revelation,
          mini.turn,
          mini.visualBeat,
          mini.dialogueIntention,
        ]),
      ),
    ),
  );

  const storyboardScores = blocks.map((block) => {
    const visuals = Array.isArray(block.visuals) ? block.visuals : [];
    const frameScore = visuals.length
      ? average(visuals.map((frame) => score([frame.caption, frame.prompt, frame.shot, frame.continuity])))
      : 0;
    return average([score([block.storyboardDirection]), frameScore]);
  });

  const metadata = project.metadata ?? ({} as PlotPickleProject["metadata"]);
  const story = project.story ?? ({} as PlotPickleProject["story"]);
  const world = project.world ?? ({} as PlotPickleProject["world"]);
  const locations = Array.isArray(world.locations) ? world.locations : [];
  const storyThreads = Array.isArray(project.storyThreads) ? project.storyThreads : [];
  const revisions = Array.isArray(project.revisions) ? project.revisions : [];
  const rights = project.rights ?? ({} as PlotPickleProject["rights"]);

  return {
    overview: completionFor(safeProject),
    storySetup: score([
      metadata.title,
      metadata.format,
      metadata.targetMinutes,
      development.storySetup.audience,
      development.storySetup.contentRating,
      development.storySetup.language,
      development.storySetup.scope,
      development.storySetup.collaborators,
    ]),
    concept: score([
      development.conceptCanvas.conceptText,
      development.conceptCanvas.emotionalPurpose,
      development.conceptCanvas.audienceExperience,
      development.conceptCanvas.desiredVisualImpact,
      development.conceptCanvas.mustKeepConstraints,
      development.conceptCanvas.openExploration,
      development.conceptCanvas.targetLabel,
    ]),
    references: score([
      development.visualReferences.length,
      development.visualReferences.some((reference) => isFilled(reference.title)),
      development.visualReferences.some((reference) => isFilled(reference.sourceUrl) || isFilled(reference.importFileName)),
      development.visualReferences.some((reference) => reference.purpose !== "inspiration"),
      development.visualReferences.some((reference) => reference.rightsStatus !== "unknown"),
      development.visualReferences.some((reference) => isFilled(reference.permittedUse)),
      development.visualReferences.some((reference) => isFilled(reference.attribution)),
      development.visualReferences.some((reference) => isFilled(reference.targetLabel)),
    ]),
    pitch: score([
      story.premise,
      story.logline,
      development.pitch.oneSentence,
      development.pitch.shortPitch,
      development.pitch.audiencePromise,
      development.pitch.emotionalExperience,
      development.pitch.comparableTitles,
      development.pitch.visualVision,
    ]),
    world: score([
      world.ordinaryWorld,
      world.newWorld,
      world.period,
      world.history,
      world.cultures,
      world.rules,
      world.technology,
      world.visualLanguage,
      locations.some((location) => isFilled(location.description)),
    ]),
    characters: average(characterScores),
    ghost: score([
      development.ghost.centralWound,
      development.ghost.origin,
      development.ghost.lie,
      development.ghost.trigger,
      development.ghost.presentPattern,
      development.ghost.truth,
    ]),
    catalyst: score([
      story.catalyst,
      development.catalyst.event,
      development.catalyst.timing,
      development.catalyst.immediateImpact,
      development.catalyst.choiceForced,
      development.catalyst.resistance,
      development.catalyst.doorway,
    ]),
    foundations: score([
      development.foundations.protagonist,
      development.foundations.objective,
      development.foundations.opposition,
      development.foundations.urgency,
      development.foundations.storyEngine,
      development.foundations.transformation,
      development.foundations.endingProof,
      story.theme,
      story.dramaticQuestion,
      story.stakes,
    ]),
    pickle: score(Object.values(development.pickle)),
    dialogue: score([
      development.dialogue.principles,
      development.dialogue.voiceContrast,
      development.dialogue.subtext,
      development.dialogue.expositionRules,
      development.dialogue.recurringLanguage,
      development.dialogue.worldVernacular,
      development.dialogue.monologueRules,
      development.dialogue.subtextSeeds,
      development.dialogue.fieldworkNotes,
      characters.some((character) => isFilled(character.voice)),
    ]),
    coreModel: average([
      score([storyThreads.length]),
      average(characters.map((character) => score(Object.values(character.arcMatrix ?? {})))),
      score([rights.projectOwner, rights.rightsStatement, rights.defaultCreativeLicence]),
      score([revisions.length]),
    ]),
    structureMap: average([...sequenceScores, ...sceneScores, ...miniBlockScores]),
    blocks: average(blocks.map(blockProgress)),
    storyboard: average(storyboardScores),
    notes: score(Object.values(development.notes)),
  };
}

export function sectionHasAlert(project: PlotPickleProject, section: ProjectProgressSection) {
  if (section !== "notes") return false;
  const notes = developmentWithDefaults(project).notes;
  return Boolean(notes.openQuestions.trim() || notes.continuity.trim());
}

export function nextRecommendedSection(project: PlotPickleProject) {
  const progress = projectSectionProgress(project);
  return recommendedSectionOrder.find((section) => progress[section] < 70) ?? "notes";
}
