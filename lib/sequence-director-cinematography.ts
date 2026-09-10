import type { SequenceDirectorBeat, SequenceDirectorDraft, SequenceDirectorSurface } from "../core/contracts/sequence-director";
import {
  compileCinematographySelection,
  selectCinematographyPrimitives,
} from "./cinematography-grammar";

function compact(values: readonly string[]) {
  return values.map((value) => value.trim()).filter(Boolean).join(". ");
}

export function compileSequenceCinematography(
  draft: SequenceDirectorDraft,
  surface: SequenceDirectorSurface,
) {
  const medium = surface === "plan" ? "still" : "video";
  const intent = compact([
    draft.purpose,
    draft.rhythm,
    draft.motionFlow,
    ...draft.beats.flatMap((beat) => [beat.purpose, beat.visualAction, beat.cameraIntent]),
  ]);
  return compileCinematographySelection(selectCinematographyPrimitives(intent, { medium, limit: 5 }));
}

export function compileBeatCinematography(
  draft: SequenceDirectorDraft,
  beats: readonly SequenceDirectorBeat[],
) {
  const intent = compact([
    draft.purpose,
    draft.rhythm,
    draft.motionFlow,
    ...beats.flatMap((beat) => [beat.purpose, beat.visualAction, beat.cameraIntent, beat.soundIntent]),
  ]);
  return compileCinematographySelection(selectCinematographyPrimitives(intent, { medium: "video", limit: 4 }));
}
