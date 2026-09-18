import {
  afterglowCharacterProfileSources,
  afterglowCharacterTruthClaims,
} from "../../../data/reference/afterglow/character-profiles";
import { createAfterglowProject as createCompleteAfterglowProject } from "../../../data/afterglow-complete";
import type { ImportedScreenplayEvidence } from "../../../core/contracts/imported-screenplay-evidence";
import type {
  CharacterArcCheckpointEvidence,
  CharacterArcEvidenceCell,
  CharacterTruthEvidence,
} from "../../../core/contracts/character-truth-evidence";

export const AFTERGLOW_CHARACTER_TRUTH_FIXTURE_ID = "afterglow-character-truth-v1" as const;

const principalCharacterAliases = {
  ren: ["REN"],
  amy: ["AMY"],
  isobel: ["ISOBEL", "SUMMER"],
  joy: ["JOY"],
  kai: ["KAI"],
  jai: ["JAI"],
} as const;

type PrincipalCharacterId = keyof typeof principalCharacterAliases;

const checkpointWindows = [
  { kind: "opening", targetArcField: "startingState", blockNumbers: [1, 2] },
  { kind: "midpoint", targetArcField: "midpointShift", blockNumbers: [11, 12, 13] },
  { kind: "crisis", targetArcField: "crisisChoice", blockNumbers: [15, 16, 17] },
  { kind: "climax", targetArcField: "climaxChoice", blockNumbers: [21, 22, 23] },
  { kind: "ending", targetArcField: "endingState", blockNumbers: [23, 24] },
] as const;

function cueName(value: string) {
  return value
    .toUpperCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textMentionsAlias(text: string, alias: string) {
  const escaped = alias.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function passageMatchesCharacter(
  passage: ImportedScreenplayEvidence["passages"][number],
  aliases: readonly string[],
) {
  if (passage.type === "character") {
    const cue = cueName(passage.text);
    return aliases.some((alias) => cue === cueName(alias) || cue.startsWith(`${cueName(alias)} `));
  }
  return aliases.some((alias) => textMentionsAlias(passage.text, alias));
}

function evidenceForCharacter(
  screenplay: ImportedScreenplayEvidence,
  characterId: PrincipalCharacterId,
  blockNumbers: readonly number[],
) {
  const aliases = principalCharacterAliases[characterId];
  const passages = screenplay.passages.filter((passage) => (
    blockNumbers.includes(passage.blockNumber)
    && passageMatchesCharacter(passage, aliases)
  ));
  return {
    passages,
    passageIds: passages.map((passage) => passage.id),
    sceneNumbers: [...new Set(passages.map((passage) => passage.sceneNumber))].sort((left, right) => left - right),
  };
}

function claimIds(characterId: PrincipalCharacterId) {
  return afterglowCharacterTruthClaims
    .filter((claim) => claim.characterIds.includes(characterId))
    .map((claim) => claim.id);
}

function arcCell(
  screenplay: ImportedScreenplayEvidence,
  characterId: PrincipalCharacterId,
  blockNumber: number,
): CharacterArcEvidenceCell {
  const evidence = evidenceForCharacter(screenplay, characterId, [blockNumber]);
  const hasEvidence = evidence.passageIds.length > 0;
  return {
    characterId,
    blockNumber,
    state: hasEvidence ? "unresolved-insufficient-evidence" : "not-present-no-evidence",
    reviewState: "unreviewed",
    passageIds: evidence.passageIds,
    sceneNumbers: evidence.sceneNumbers,
    profileClaimIds: claimIds(characterId),
    note: hasEvidence
      ? "Observed v9 screenplay evidence mentions or cues this character in the projected Block. Human review must decide whether the evidence is arc-neutral, pressure, reinforcement, challenge, choice, consequence, relationship movement or an arc transition."
      : "No observed v9 passage in this projected Block mentions or cues this character under the known aliases. This is an evidence absence, not automatic proof that the character is narratively absent or that the arc has a gap.",
    reviewedAt: null,
  };
}

function checkpoint(
  screenplay: ImportedScreenplayEvidence,
  characterId: PrincipalCharacterId,
  window: typeof checkpointWindows[number],
): CharacterArcCheckpointEvidence {
  const evidence = evidenceForCharacter(screenplay, characterId, window.blockNumbers);
  return {
    characterId,
    kind: window.kind,
    targetArcField: window.targetArcField,
    blockNumbers: [...window.blockNumbers],
    passageIds: evidence.passageIds,
    sceneNumbers: evidence.sceneNumbers,
    note: `Flexible ${window.kind} comparison window for the existing Arc Matrix field ${window.targetArcField}. The window gathers observed screenplay evidence only; it does not require the character to change here or declare the field satisfied.`,
  };
}

/**
 * Build Afterglow Character Truth as source/evidence attached to the current PPF.
 *
 * This does not create a second Character or Arc Matrix authority. Profile claims
 * remain source-only until Human review. Screenplay observations point to the
 * existing rich-project character IDs and Arc Matrix field names without writing
 * profile material into screenplay or current canon.
 */
export function createAfterglowCharacterTruthEvidence(
  screenplay: ImportedScreenplayEvidence,
): CharacterTruthEvidence {
  const currentProject = createCompleteAfterglowProject();
  const availableIds = new Set(currentProject.characters.map((character) => character.id));
  const principalCharacterIds = Object.keys(principalCharacterAliases) as PrincipalCharacterId[];
  const missing = principalCharacterIds.filter((characterId) => !availableIds.has(characterId));
  if (missing.length) {
    throw new Error(`#2178 Afterglow character evidence points to unknown current character IDs: ${missing.join(", ")}`);
  }

  return {
    schemaVersion: 1,
    fixtureId: AFTERGLOW_CHARACTER_TRUTH_FIXTURE_ID,
    sources: afterglowCharacterProfileSources,
    claims: afterglowCharacterTruthClaims,
    principalCharacterIds,
    arcCells: principalCharacterIds.flatMap((characterId) => (
      Array.from({ length: 24 }, (_, index) => arcCell(screenplay, characterId, index + 1))
    )),
    checkpoints: principalCharacterIds.flatMap((characterId) => (
      checkpointWindows.map((window) => checkpoint(screenplay, characterId, window))
    )),
    governingRule: "Character Truth is writer knowledge, not automatically audience knowledge. Profile claims may explain motivation and arc intention, but only screenplay evidence can show what the audience observes. Human review controls canon promotion and arc classification; no profile claim is converted into screenplay exposition automatically.",
  };
}
