import { cloneProject, type PlotPickleProject } from "./project";

export const GRAPHIC_NOVEL_STORY_BRIEF_EXTENSION = "plotpickle.graphicNovelStoryBrief.v1" as const;

export type GraphicNovelStoryBrief = {
  storyPromise: string;
  audienceExperience: string;
  emotionalArc: string;
  visualThesis: string;
  worldAtmosphere: string;
  cameraLanguage: string;
  lightingContrast: string;
  pacingRhythm: string;
  recurringMotifs: string;
  continuityRules: string;
  avoid: string;
  updatedAt: string;
};

const CORE_FIELDS: Array<keyof GraphicNovelStoryBrief> = [
  "storyPromise",
  "audienceExperience",
  "emotionalArc",
  "visualThesis",
  "worldAtmosphere",
  "cameraLanguage",
  "lightingContrast",
  "pacingRhythm",
  "recurringMotifs",
  "continuityRules",
  "avoid",
];

function text(value: unknown, maximum = 1_500) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximum) : "";
}

function first(...values: unknown[]) {
  return values.map((value) => text(value)).find(Boolean) || "";
}

function join(values: unknown[], maximum = 1_500) {
  return [...new Set(values.map((value) => text(value)).filter(Boolean))].join(". ").slice(0, maximum);
}

function shotLanguage(project: PlotPickleProject) {
  const examples = project.production.shots.slice(0, 6).flatMap((shot) => [
    join([shot.shotSize, shot.angle, shot.movement, shot.lens, shot.composition], 420),
  ]).filter(Boolean);
  return examples.length
    ? join(examples, 1_200)
    : `Clear cinematic geography with purposeful wides, character-led mediums, pressure close-ups and consequential reveal images; ${project.structure.pacingProfile} pacing.`;
}

export function deriveGraphicNovelStoryBrief(project: PlotPickleProject): GraphicNovelStoryBrief {
  const pitch = project.development.pitch;
  const foundations = project.development.foundations;
  const ghost = project.development.ghost;
  const pickle = project.development.pickle;
  const world = project.world;
  const now = new Date().toISOString();
  return {
    storyPromise: first(pitch.audiencePromise, project.review.pitchPackage.tagline, project.story.hook, project.story.logline, project.story.premise),
    audienceExperience: first(pitch.emotionalExperience, project.metadata.tone, pickle.storyPromise),
    emotionalArc: join([
      ghost.centralWound && `Begin from ${ghost.centralWound}`,
      ghost.lie && `protective lie: ${ghost.lie}`,
      foundations.transformation && `move toward ${foundations.transformation}`,
      foundations.endingProof && `prove the change through ${foundations.endingProof}`,
      project.story.theme && `thematic truth: ${project.story.theme}`,
    ]),
    visualThesis: first(pitch.visualVision, project.review.pitchPackage.visualStatement, world.visualLanguage),
    worldAtmosphere: join([
      world.period && `Period: ${world.period}`,
      world.ordinaryWorld && `Ordinary world: ${world.ordinaryWorld}`,
      world.newWorld && `Changed world: ${world.newWorld}`,
      world.rules && `World rules: ${world.rules}`,
      world.technology && `Technology: ${world.technology}`,
    ]),
    cameraLanguage: shotLanguage(project),
    lightingContrast: join([
      project.metadata.tone && `Use contrast that expresses ${project.metadata.tone}`,
      "Black-and-white graphite and ink with controlled negative space, readable silhouettes and motivated practical light",
    ]),
    pacingRhythm: join([
      `${project.structure.pacingProfile} story rhythm`,
      `average shot duration target ${project.structure.averageShotSeconds} seconds`,
      pickle.escalationPattern,
    ]),
    recurringMotifs: join([project.story.theme, pickle.signatureMove, project.development.dialogue.recurringLanguage, world.visualLanguage]),
    continuityRules: join([
      world.period && `Keep every object, costume and location consistent with ${world.period}`,
      world.rules,
      "Preserve locked character identities, wardrobe logic, scale, handedness, scars, props and spatial geography across all 96 panels",
    ]),
    avoid: "Avoid generic stock poses, duplicated characters, identity drift, unexplained costume changes, contradictory geography, decorative clutter, written words, captions, speech balloons, signs, logos and watermarks inside the image.",
    updatedAt: now,
  };
}

export function getGraphicNovelStoryBrief(project: PlotPickleProject): GraphicNovelStoryBrief {
  const defaults = deriveGraphicNovelStoryBrief(project);
  const stored = project.extensions?.[GRAPHIC_NOVEL_STORY_BRIEF_EXTENSION];
  if (!stored || typeof stored !== "object") return defaults;
  const candidate = stored as Partial<GraphicNovelStoryBrief>;
  const normalized = { ...defaults };
  for (const field of CORE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(candidate, field)) normalized[field] = text(candidate[field]);
  }
  normalized.updatedAt = typeof candidate.updatedAt === "string" ? candidate.updatedAt : defaults.updatedAt;
  return normalized;
}

export function withGraphicNovelStoryBrief(project: PlotPickleProject, brief: GraphicNovelStoryBrief) {
  const next = cloneProject(project);
  const now = new Date().toISOString();
  const normalized = getGraphicNovelStoryBrief({
    ...project,
    extensions: {
      ...project.extensions,
      [GRAPHIC_NOVEL_STORY_BRIEF_EXTENSION]: { ...brief, updatedAt: now },
    },
  });
  next.extensions = {
    ...next.extensions,
    [GRAPHIC_NOVEL_STORY_BRIEF_EXTENSION]: normalized,
  };
  next.metadata.updatedAt = now;
  next.review.pitchPackage.updatedAt = now;
  return next;
}

export function graphicNovelStoryBriefCompletion(brief: GraphicNovelStoryBrief) {
  const completed = CORE_FIELDS.filter((field) => text(brief[field])).length;
  return {
    completed,
    total: CORE_FIELDS.length,
    percent: Math.round((completed / CORE_FIELDS.length) * 100),
    missing: CORE_FIELDS.filter((field) => !text(brief[field])),
  };
}

export function graphicNovelStoryBriefPrompt(brief: GraphicNovelStoryBrief) {
  return [
    brief.storyPromise && `Whole-story promise: ${text(brief.storyPromise)}.`,
    brief.audienceExperience && `Audience experience: ${text(brief.audienceExperience)}.`,
    brief.emotionalArc && `Whole-story emotional arc: ${text(brief.emotionalArc)}.`,
    brief.visualThesis && `Visual thesis: ${text(brief.visualThesis)}.`,
    brief.worldAtmosphere && `World atmosphere: ${text(brief.worldAtmosphere)}.`,
    brief.cameraLanguage && `Camera language: ${text(brief.cameraLanguage)}.`,
    brief.lightingContrast && `Lighting and contrast: ${text(brief.lightingContrast)}.`,
    brief.pacingRhythm && `Panel rhythm: ${text(brief.pacingRhythm)}.`,
    brief.recurringMotifs && `Recurring visual motifs: ${text(brief.recurringMotifs)}.`,
    brief.continuityRules && `Continuity rules: ${text(brief.continuityRules)}.`,
    brief.avoid && `Project-specific exclusions: ${text(brief.avoid)}.`,
  ].filter(Boolean).join(" ");
}
