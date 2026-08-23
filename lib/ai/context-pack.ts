import type { CharacterIdentityLock, CharacterLook, ContinuityLock, KnowledgeSource } from "./contracts";

const DEFAULT_CONTEXT_LIMIT = 24_000;

export type ContextProject = {
  metadata: { title: string; format: string; genre: string; tone: string };
  story: Record<string, unknown>;
  world: Record<string, unknown>;
  characters: { id: string; name: string; role?: string; description?: string; want?: string; need?: string; arc?: string; voice?: string }[];
  blocks: { id: string; number: number; title?: string; summary?: string; goal?: string; conflict?: string; choice?: string; consequence?: string; storyboardDirection?: string }[];
};

export type ContextSelection = {
  blockIds?: string[];
  characterIds?: string[];
  knowledgeSourceIds?: string[];
  includeWorld?: boolean;
  maxCharacters?: number;
};

function compact(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) return value.map(compact).filter((item) => item !== undefined);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, compact(item)] as const)
      .filter(([, item]) => item !== undefined));
  }
  return value;
}

function bounded(value: string, maxCharacters: number) {
  if (value.length <= maxCharacters) return value;
  return `${value.slice(0, Math.max(0, maxCharacters - 84))}\n[Context truncated by PlotPickle; select fewer sources for complete text.]`;
}

export function buildProjectContextPack(
  project: ContextProject,
  selection: ContextSelection = {},
  knowledge: KnowledgeSource[] = [],
) {
  const selectedCharacters = selection.characterIds?.length
    ? project.characters.filter((character) => selection.characterIds?.includes(character.id))
    : project.characters;
  const selectedBlocks = selection.blockIds?.length
    ? project.blocks.filter((block) => selection.blockIds?.includes(block.id))
    : [];
  const selectedKnowledge = knowledge
    .filter((source) => source.includeByDefault || selection.knowledgeSourceIds?.includes(source.id))
    .map((source) => ({ id: source.id, title: source.title, sourceLabel: source.sourceLabel, text: source.text }));
  const payload = compact({
    project: project.metadata,
    story: project.story,
    world: selection.includeWorld === false ? undefined : project.world,
    characters: selectedCharacters,
    blocks: selectedBlocks,
    knowledge: selectedKnowledge,
  });
  return bounded(JSON.stringify(payload, null, 2), selection.maxCharacters ?? DEFAULT_CONTEXT_LIMIT);
}

export function buildCharacterConsistencyPrompt(input: {
  characterName: string;
  identity: CharacterIdentityLock;
  look?: CharacterLook;
  continuity?: ContinuityLock[];
}) {
  const lines = [
    `CHARACTER IDENTITY LOCK — ${input.characterName}`,
    `Age range: ${input.identity.ageRange}`,
    `Face: ${input.identity.face}`,
    `Hair: ${input.identity.hair}`,
    `Body: ${input.identity.body}`,
    `Distinguishing features: ${input.identity.distinguishingFeatures.join("; ") || "Not specified"}`,
    `Never change: ${input.identity.neverChange.join("; ") || "No additional locks"}`,
    `Avoid: ${input.identity.avoid.join("; ") || "No additional exclusions"}`,
  ];
  if (input.look) {
    lines.push(
      `APPROVED LOOK — ${input.look.label}`,
      `Story phase: ${input.look.storyPhase}`,
      `Wardrobe: ${input.look.wardrobe}`,
      `Grooming: ${input.look.grooming}`,
      `Physical condition: ${input.look.physicalCondition}`,
      `Props: ${input.look.props.join("; ") || "None"}`,
      `Palette: ${input.look.palette.join("; ") || "Not specified"}`,
    );
  }
  const locks = input.continuity?.map((item) => `Continuity ${item.category}: ${item.instruction}`) ?? [];
  return [...lines, ...locks].join("\n");
}

export function buildStoryboardImagePrompt(input: {
  visualLanguage: string;
  blockSummary: string;
  storyboardDirection: string;
  shot: string;
  location: string;
  characters: string[];
  continuityLocks: string[];
  exclusions?: string[];
}) {
  return [
    "Create one cinematic storyboard frame. Preserve the supplied identity and continuity locks exactly.",
    `Project visual language: ${input.visualLanguage}`,
    `Story moment: ${input.blockSummary}`,
    `Visual action: ${input.storyboardDirection}`,
    `Shot: ${input.shot}`,
    `Location: ${input.location}`,
    ...input.characters.map((character) => `Character reference:\n${character}`),
    ...input.continuityLocks.map((lock) => `Continuity lock: ${lock}`),
    `Do not introduce: ${(input.exclusions ?? []).join("; ") || "unrequested characters, wardrobe, props, text, logos, or continuity changes"}.`,
  ].join("\n\n");
}
