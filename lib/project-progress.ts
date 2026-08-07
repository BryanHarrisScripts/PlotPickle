import { completionFor, type PlotPickleProject, type StoryBlock } from "./project";

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

export function projectSectionProgress(project: PlotPickleProject): Record<ProjectProgressSection, number> {
  const characterScores = project.characters.map((character) =>
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

  const sequenceScores = project.structure.sequences.map((sequence) =>
    score([
      sequence.question,
      sequence.promise,
      sequence.escalation,
      sequence.climax,
      sequence.turningPoint,
      sequence.result,
    ]),
  );

  const sceneScores = project.blocks.flatMap((block) =>
    block.scenes.map((scene) =>
      score([scene.objective, scene.conflict, scene.turn, scene.resolution, scene.outcome]),
    ),
  );

  const miniBlockScores = project.blocks.flatMap((block) =>
    block.scenes.flatMap((scene) =>
      scene.miniBlocks.map((mini) =>
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

  const storyboardScores = project.blocks.map((block) => {
    const frameScore = block.visuals.length
      ? average(block.visuals.map((frame) => score([frame.caption, frame.prompt, frame.shot, frame.continuity])))
      : 0;
    return average([score([block.storyboardDirection]), frameScore]);
  });

  return {
    overview: completionFor(project),
    storySetup: score([
      project.metadata.title,
      project.metadata.format,
      project.metadata.targetMinutes,
      project.development.storySetup.audience,
      project.development.storySetup.contentRating,
      project.development.storySetup.language,
      project.development.storySetup.scope,
      project.development.storySetup.collaborators,
    ]),
    concept: score([
      project.development.conceptCanvas.conceptText,
      project.development.conceptCanvas.emotionalPurpose,
      project.development.conceptCanvas.audienceExperience,
      project.development.conceptCanvas.desiredVisualImpact,
      project.development.conceptCanvas.mustKeepConstraints,
      project.development.conceptCanvas.openExploration,
      project.development.conceptCanvas.targetLabel,
    ]),
    references: score([
      project.development.visualReferences.length,
      project.development.visualReferences.some((reference) => isFilled(reference.title)),
      project.development.visualReferences.some((reference) => isFilled(reference.sourceUrl) || isFilled(reference.importFileName)),
      project.development.visualReferences.some((reference) => reference.purpose !== "inspiration"),
      project.development.visualReferences.some((reference) => reference.rightsStatus !== "unknown"),
      project.development.visualReferences.some((reference) => isFilled(reference.permittedUse)),
      project.development.visualReferences.some((reference) => isFilled(reference.attribution)),
      project.development.visualReferences.some((reference) => isFilled(reference.targetLabel)),
    ]),
    pitch: score([
      project.story.premise,
      project.story.logline,
      project.development.pitch.oneSentence,
      project.development.pitch.shortPitch,
      project.development.pitch.audiencePromise,
      project.development.pitch.emotionalExperience,
      project.development.pitch.comparableTitles,
      project.development.pitch.visualVision,
    ]),
    world: score([
      project.world.ordinaryWorld,
      project.world.newWorld,
      project.world.period,
      project.world.history,
      project.world.cultures,
      project.world.rules,
      project.world.technology,
      project.world.visualLanguage,
      project.world.locations.some((location) => isFilled(location.description)),
    ]),
    characters: average(characterScores),
    ghost: score([
      project.development.ghost.centralWound,
      project.development.ghost.origin,
      project.development.ghost.lie,
      project.development.ghost.trigger,
      project.development.ghost.presentPattern,
      project.development.ghost.truth,
    ]),
    catalyst: score([
      project.story.catalyst,
      project.development.catalyst.event,
      project.development.catalyst.timing,
      project.development.catalyst.immediateImpact,
      project.development.catalyst.choiceForced,
      project.development.catalyst.resistance,
      project.development.catalyst.doorway,
    ]),
    foundations: score([
      project.development.foundations.protagonist,
      project.development.foundations.objective,
      project.development.foundations.opposition,
      project.development.foundations.urgency,
      project.development.foundations.storyEngine,
      project.development.foundations.transformation,
      project.development.foundations.endingProof,
      project.story.theme,
      project.story.dramaticQuestion,
      project.story.stakes,
    ]),
    pickle: score(Object.values(project.development.pickle)),
    dialogue: score([
      project.development.dialogue.principles,
      project.development.dialogue.voiceContrast,
      project.development.dialogue.subtext,
      project.development.dialogue.expositionRules,
      project.development.dialogue.recurringLanguage,
      project.development.dialogue.worldVernacular,
      project.development.dialogue.monologueRules,
      project.development.dialogue.subtextSeeds,
      project.development.dialogue.fieldworkNotes,
      project.characters.some((character) => isFilled(character.voice)),
    ]),
    coreModel: average([
      score([project.storyThreads.length]),
      average(project.characters.map((character) => score(Object.values(character.arcMatrix ?? {})))),
      score([project.rights.projectOwner, project.rights.rightsStatement, project.rights.defaultCreativeLicence]),
      score([project.revisions.length]),
    ]),
    structureMap: average([...sequenceScores, ...sceneScores, ...miniBlockScores]),
    blocks: average(project.blocks.map(blockProgress)),
    storyboard: average(storyboardScores),
    notes: score(Object.values(project.development.notes)),
  };
}

export function sectionHasAlert(project: PlotPickleProject, section: ProjectProgressSection) {
  if (section !== "notes") return false;
  return Boolean(
    project.development.notes.openQuestions.trim() ||
      project.development.notes.continuity.trim(),
  );
}

export function nextRecommendedSection(project: PlotPickleProject) {
  const progress = projectSectionProgress(project);
  return recommendedSectionOrder.find((section) => progress[section] < 70) ?? "notes";
}
