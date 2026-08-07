import type { Character, PlotPickleProject, VisualReference } from "./project";
import { approvedVisualCanon, type VisualCanonItem } from "./visual-canon";
import { effectiveContinuityLocks } from "./continuity-locks";
import { assembleVisualStoryContext } from "./visual-context";

export type CharacterLookDimension = "face" | "silhouette" | "age" | "wardrobe" | "expression" | "movement" | "relationship-presentation";

export type CharacterLookBrief = {
  character: Pick<Character, "id" | "name" | "role" | "description" | "want" | "need" | "arc" | "voice" | "image">;
  dimensions: Record<CharacterLookDimension, string>;
  references: VisualReference[];
  approvedIdentity: VisualCanonItem[];
  continuity: ReturnType<typeof effectiveContinuityLocks>;
  storyContext: ReturnType<typeof assembleVisualStoryContext>;
  manualReferenceOnlyReady: boolean;
};

export type CharacterLookDraft = {
  characterId: string;
  dimensions: Record<CharacterLookDimension, string>;
  notes: string;
  updatedAt: string;
};

const EXTENSION_KEY = "characterLookDevelopment";
export const CHARACTER_LOOK_DIMENSIONS: CharacterLookDimension[] = ["face", "silhouette", "age", "wardrobe", "expression", "movement", "relationship-presentation"];

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

function blankDimensions(): Record<CharacterLookDimension, string> {
  return {
    face: "",
    silhouette: "",
    age: "",
    wardrobe: "",
    expression: "",
    movement: "",
    "relationship-presentation": "",
  };
}

export function readCharacterLookDraft(project: PlotPickleProject, characterId: string): CharacterLookDraft {
  const extensions = record(project.extensions);
  const store = record(extensions[EXTENSION_KEY]);
  const drafts = record(store.drafts);
  const raw = record(drafts[characterId]);
  const rawDimensions = record(raw.dimensions);
  const dimensions = blankDimensions();
  for (const dimension of CHARACTER_LOOK_DIMENSIONS) dimensions[dimension] = text(rawDimensions[dimension]);
  return {
    characterId,
    dimensions,
    notes: text(raw.notes),
    updatedAt: text(raw.updatedAt),
  };
}

export function writeCharacterLookDraft(project: PlotPickleProject, draft: CharacterLookDraft): PlotPickleProject {
  const extensions = record(project.extensions);
  const store = record(extensions[EXTENSION_KEY]);
  const drafts = record(store.drafts);
  return {
    ...project,
    extensions: {
      ...extensions,
      [EXTENSION_KEY]: {
        version: 1,
        ...store,
        drafts: {
          ...drafts,
          [draft.characterId]: draft,
        },
      },
    },
  };
}

function characterReferences(project: PlotPickleProject, characterId: string) {
  return project.development.visualReferences.filter((reference) =>
    reference.targetKind === "project" || (reference.targetKind === "character" && reference.targetId === characterId),
  );
}

function characterCanon(project: PlotPickleProject, characterId: string) {
  return approvedVisualCanon(project).filter((item) =>
    item.kind === "character-identity" && item.target.kind === "character" && item.target.id === characterId,
  );
}

export function buildCharacterLookBrief(project: PlotPickleProject, characterId: string): CharacterLookBrief | null {
  const character = project.characters.find((entry) => entry.id === characterId);
  if (!character) return null;
  const draft = readCharacterLookDraft(project, characterId);
  const context = assembleVisualStoryContext(project, { kind: "character", id: character.id, label: character.name || "Character" });
  const references = characterReferences(project, characterId);
  return {
    character: {
      id: character.id,
      name: character.name,
      role: character.role,
      description: character.description,
      want: character.want,
      need: character.need,
      arc: character.arc,
      voice: character.voice,
      image: character.image,
    },
    dimensions: draft.dimensions,
    references,
    approvedIdentity: characterCanon(project, characterId),
    continuity: effectiveContinuityLocks(project, {}),
    storyContext: context,
    manualReferenceOnlyReady: true,
  };
}

export function reusableCharacterIdentity(project: PlotPickleProject, characterId: string) {
  const brief = buildCharacterLookBrief(project, characterId);
  if (!brief) return null;
  return {
    characterId,
    approvedIdentity: brief.approvedIdentity,
    references: brief.references,
    continuity: brief.continuity.filter((lock) => ["identity", "wardrobe"].includes(lock.kind)),
  };
}
