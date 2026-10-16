import type { LibraryPPFProject } from "../../../core/storage/library-project";
import { mindMapCharacterRoster } from "./mind-map-character-roster";

export type ScreenplayCastCandidate = Readonly<{
  /** Display identity from an exact imported screenplay character cue; not canon. */
  name: string;
  normalizedName: string;
  occurrenceCount: number;
  passageIds: readonly string[];
  sceneNumbers: readonly number[];
  canonicalCharacterId: string | null;
}>;

function key(name: string) {
  return name.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

function cueName(text: string) {
  // Dialogue cue decorations are not characters. Do not merge distinct names.
  let name = text.trim();
  for (let index = 0; index < 4; index++) {
    const next = name.replace(/\s*\((?:V\.?O\.?|O\.?S\.?|OFF\s*SCREEN|CONT['’]?D|CONTINUED)\)\s*$/iu, "").trim();
    if (next === name) break;
    name = next;
  }
  if (!name || name.length > 100 || /[\n\r]|[{}<>]/u.test(name)) return "";
  if (/^(?:INT\.|EXT\.|INT\/EXT\.|FADE\s+(?:IN|OUT)|CUT\s+TO|DISSOLVE\s+TO|THE\s+END)$/iu.test(name)) return "";
  return name.replace(/\s+/gu, " ");
}

/**
 * Exact-identity screenplay discovery, not AI extraction or canon creation.
 * Retains typed passage IDs/scenes so the Human can review evidence first.
 */
export function screenplayCastCandidates(project: LibraryPPFProject): readonly ScreenplayCastCandidate[] {
  const screenplay = project.sourceEvidence.screenplay;
  if (!screenplay) return [];
  const canon = mindMapCharacterRoster(project);
  const named = new Map<string, {
    name: string; passageIds: string[]; sceneNumbers: number[]; canonicalCharacterId: string | null;
  }>();
  for (const passage of screenplay.passages) {
    if (passage.type.trim().toLowerCase() !== "character") continue;
    const name = cueName(passage.text);
    if (!name) continue;
    const normalizedName = key(name);
    const matched = canon.find(item => key(item.name) === normalizedName);
    const current = named.get(normalizedName);
    if (current) {
      current.passageIds.push(passage.id);
      if (!current.sceneNumbers.includes(passage.sceneNumber)) current.sceneNumbers.push(passage.sceneNumber);
    } else {
      named.set(normalizedName, {
        name, passageIds: [passage.id], sceneNumbers: [passage.sceneNumber],
        canonicalCharacterId: matched?.id ?? null,
      });
    }
  }
  return Object.freeze([...named.entries()].map(([normalizedName, item]) => Object.freeze({
    name: item.name,
    normalizedName,
    occurrenceCount: item.passageIds.length,
    passageIds: Object.freeze(item.passageIds),
    sceneNumbers: Object.freeze(item.sceneNumbers),
    canonicalCharacterId: item.canonicalCharacterId,
  })));
}
