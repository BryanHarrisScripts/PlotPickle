import type { Character } from "./project";

export type CharacterVisualIdentityStatus = "draft" | "reviewed" | "locked";
export type CharacterReferenceAngle = "master" | "front" | "profile" | "three-quarter" | "full-body";

export type CharacterVisualReference = {
  id: string;
  angle: CharacterReferenceAngle;
  src: string;
  prompt: string;
  approved: boolean;
  createdAt: string;
};

export type CharacterVisualTraits = {
  ageRange: string;
  heightBuild: string;
  postureMovement: string;
  faceShape: string;
  skin: string;
  eyes: string;
  hair: string;
  facialHair: string;
  distinguishingMarks: string;
  defaultWardrobe: string;
  accessories: string;
  colourCues: string;
};

export type CharacterVisualIdentityRevision = {
  version: number;
  prompt: string;
  negativePrompt: string;
  traits: CharacterVisualTraits;
  references: CharacterVisualReference[];
  reason: string;
  createdAt: string;
};

export type CharacterVisualIdentity = {
  status: CharacterVisualIdentityStatus;
  version: number;
  approvedPrompt: string;
  draftPrompt: string;
  negativePrompt: string;
  traits: CharacterVisualTraits;
  references: CharacterVisualReference[];
  wardrobeVariants: string;
  sceneContinuityNotes: string;
  approvedAt: string;
  lockedAt: string;
  pendingRevision: CharacterVisualIdentityRevision | null;
};

export type CharacterWithVisualIdentity = Character & { visualIdentity?: CharacterVisualIdentity };

export const blankCharacterVisualTraits = (): CharacterVisualTraits => ({
  ageRange: "",
  heightBuild: "",
  postureMovement: "",
  faceShape: "",
  skin: "",
  eyes: "",
  hair: "",
  facialHair: "",
  distinguishingMarks: "",
  defaultWardrobe: "",
  accessories: "",
  colourCues: "",
});

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeTraits(value: unknown): CharacterVisualTraits {
  const candidate = value && typeof value === "object" ? value as Partial<CharacterVisualTraits> : {};
  const defaults = blankCharacterVisualTraits();
  return Object.fromEntries(Object.keys(defaults).map((key) => [key, text(candidate[key as keyof CharacterVisualTraits])])) as CharacterVisualTraits;
}

function normalizeReferences(value: unknown, fallbackImage = ""): CharacterVisualReference[] {
  const incoming = Array.isArray(value) ? value : [];
  const allowed: CharacterReferenceAngle[] = ["master", "front", "profile", "three-quarter", "full-body"];
  const normalized = incoming.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const reference = item as Partial<CharacterVisualReference>;
    const angle = allowed.includes(reference.angle as CharacterReferenceAngle) ? reference.angle as CharacterReferenceAngle : "three-quarter";
    const src = text(reference.src);
    if (!src) return [];
    return [{
      id: text(reference.id) || `visual-reference-${angle}-${index + 1}`,
      angle,
      src,
      prompt: text(reference.prompt),
      approved: Boolean(reference.approved),
      createdAt: text(reference.createdAt) || new Date().toISOString(),
    }];
  });
  if (!normalized.length && fallbackImage) {
    normalized.push({ id: "visual-reference-master-legacy", angle: "master", src: fallbackImage, prompt: "", approved: false, createdAt: new Date().toISOString() });
  }
  return normalized;
}

export function buildCharacterIdentityPrompt(character: CharacterWithVisualIdentity, projectVisualLanguage = "", period = "") {
  const traits = normalizeTraits(character.visualIdentity?.traits);
  return [
    `Character identity lock for ${character.name}.`,
    character.role && `Story role: ${character.role}.`,
    character.description && `Character description: ${character.description}.`,
    traits.ageRange && `Apparent age: ${traits.ageRange}.`,
    traits.heightBuild && `Height and build: ${traits.heightBuild}.`,
    traits.postureMovement && `Posture and movement: ${traits.postureMovement}.`,
    traits.faceShape && `Facial structure: ${traits.faceShape}.`,
    traits.skin && `Skin: ${traits.skin}.`,
    traits.eyes && `Eyes: ${traits.eyes}.`,
    traits.hair && `Hair: ${traits.hair}.`,
    traits.facialHair && `Facial hair: ${traits.facialHair}.`,
    traits.distinguishingMarks && `Distinguishing marks: ${traits.distinguishingMarks}.`,
    traits.defaultWardrobe && `Default wardrobe: ${traits.defaultWardrobe}.`,
    traits.accessories && `Fixed accessories: ${traits.accessories}.`,
    traits.colourCues && `Character colour cues: ${traits.colourCues}.`,
    period && `Story period: ${period}.`,
    projectVisualLanguage && `Project visual language: ${projectVisualLanguage}.`,
    "Preserve facial geometry, apparent age, body proportions, skin, eyes, hairline, hairstyle, distinguishing marks and silhouette in every image.",
  ].filter(Boolean).join(" ");
}

export function createCharacterVisualIdentity(character: Character): CharacterVisualIdentity {
  const initial: CharacterVisualIdentity = {
    status: "draft",
    version: 1,
    approvedPrompt: "",
    draftPrompt: "",
    negativePrompt: "Do not change facial geometry, apparent age, ethnicity, skin tone, eye colour, hairline, hairstyle, body proportions, distinguishing marks or signature accessories. Do not merge this character with another person.",
    traits: blankCharacterVisualTraits(),
    references: normalizeReferences([], character.image),
    wardrobeVariants: "",
    sceneContinuityNotes: "",
    approvedAt: "",
    lockedAt: "",
    pendingRevision: null,
  };
  initial.draftPrompt = buildCharacterIdentityPrompt({ ...character, visualIdentity: initial });
  return initial;
}

export function getCharacterVisualIdentity(character: CharacterWithVisualIdentity): CharacterVisualIdentity {
  const candidate = character.visualIdentity;
  if (!candidate || typeof candidate !== "object") return createCharacterVisualIdentity(character);
  const statuses: CharacterVisualIdentityStatus[] = ["draft", "reviewed", "locked"];
  const normalized: CharacterVisualIdentity = {
    status: statuses.includes(candidate.status) ? candidate.status : "draft",
    version: Math.max(1, Number(candidate.version) || 1),
    approvedPrompt: text(candidate.approvedPrompt),
    draftPrompt: text(candidate.draftPrompt),
    negativePrompt: text(candidate.negativePrompt),
    traits: normalizeTraits(candidate.traits),
    references: normalizeReferences(candidate.references, character.image),
    wardrobeVariants: text(candidate.wardrobeVariants),
    sceneContinuityNotes: text(candidate.sceneContinuityNotes),
    approvedAt: text(candidate.approvedAt),
    lockedAt: text(candidate.lockedAt),
    pendingRevision: candidate.pendingRevision && typeof candidate.pendingRevision === "object" ? {
      version: Math.max(2, Number(candidate.pendingRevision.version) || (Number(candidate.version) || 1) + 1),
      prompt: text(candidate.pendingRevision.prompt),
      negativePrompt: text(candidate.pendingRevision.negativePrompt),
      traits: normalizeTraits(candidate.pendingRevision.traits),
      references: normalizeReferences(candidate.pendingRevision.references),
      reason: text(candidate.pendingRevision.reason),
      createdAt: text(candidate.pendingRevision.createdAt) || new Date().toISOString(),
    } : null,
  };
  if (!normalized.draftPrompt) normalized.draftPrompt = normalized.approvedPrompt || buildCharacterIdentityPrompt({ ...character, visualIdentity: normalized });
  return normalized;
}

export function setCharacterVisualIdentity(character: CharacterWithVisualIdentity, identity: CharacterVisualIdentity) {
  character.visualIdentity = identity;
  return character;
}

export function saveVisualIdentityDraft(character: CharacterWithVisualIdentity, next: CharacterVisualIdentity, reason = "Visual identity revision") {
  const current = getCharacterVisualIdentity(character);
  if (current.status === "locked") {
    return {
      ...current,
      pendingRevision: {
        version: current.version + 1,
        prompt: next.draftPrompt,
        negativePrompt: next.negativePrompt,
        traits: next.traits,
        references: next.references,
        reason,
        createdAt: new Date().toISOString(),
      },
    } satisfies CharacterVisualIdentity;
  }
  return { ...next, status: "draft", pendingRevision: null } satisfies CharacterVisualIdentity;
}

export function reviewCharacterVisualIdentity(identity: CharacterVisualIdentity) {
  return { ...identity, status: "reviewed" as const };
}

export function lockCharacterVisualIdentity(identity: CharacterVisualIdentity) {
  const now = new Date().toISOString();
  return {
    ...identity,
    status: "locked" as const,
    approvedPrompt: identity.draftPrompt,
    approvedAt: now,
    lockedAt: now,
    references: identity.references.map((reference) => ({ ...reference, approved: Boolean(reference.src) })),
    pendingRevision: null,
  };
}

export function approvePendingVisualIdentity(identity: CharacterVisualIdentity) {
  if (!identity.pendingRevision) return identity;
  const pending = identity.pendingRevision;
  const now = new Date().toISOString();
  return {
    ...identity,
    version: pending.version,
    status: "locked" as const,
    approvedPrompt: pending.prompt,
    draftPrompt: pending.prompt,
    negativePrompt: pending.negativePrompt,
    traits: pending.traits,
    references: pending.references.map((reference) => ({ ...reference, approved: Boolean(reference.src) })),
    approvedAt: now,
    lockedAt: now,
    pendingRevision: null,
  };
}

export function approvedCharacterReferenceImages(character: CharacterWithVisualIdentity) {
  const identity = getCharacterVisualIdentity(character);
  const approved = identity.references.filter((reference) => reference.approved && reference.src).map((reference) => reference.src);
  if (identity.status === "locked" && character.image && !approved.includes(character.image)) approved.unshift(character.image);
  return [...new Set(approved)];
}

export function approvedCharacterIdentityPrompt(character: CharacterWithVisualIdentity) {
  const identity = getCharacterVisualIdentity(character);
  return identity.status === "locked" && identity.approvedPrompt ? identity.approvedPrompt : identity.draftPrompt;
}

export type CharacterVisualIdentityDiagnostic = {
  characterId: string;
  characterName: string;
  severity: "blocked" | "review" | "clear";
  message: string;
};

export function characterVisualIdentityDiagnostic(character: CharacterWithVisualIdentity): CharacterVisualIdentityDiagnostic {
  const identity = getCharacterVisualIdentity(character);
  if (identity.status !== "locked") return { characterId: character.id, characterName: character.name, severity: "blocked", message: `${character.name} does not yet have a locked visual identity.` };
  if (!identity.approvedPrompt) return { characterId: character.id, characterName: character.name, severity: "blocked", message: `${character.name}'s locked identity has no approved prompt.` };
  if (identity.pendingRevision) return { characterId: character.id, characterName: character.name, severity: "review", message: `${character.name} has an unapproved visual identity revision.` };
  if (!approvedCharacterReferenceImages(character).length) return { characterId: character.id, characterName: character.name, severity: "review", message: `${character.name} has a locked prompt but no approved reference image.` };
  return { characterId: character.id, characterName: character.name, severity: "clear", message: `${character.name}'s visual identity is locked at version ${identity.version}.` };
}
