import { phase3LaneKinds } from "./phase3-fit.mjs";

function points(candidate, name) {
  return Number(candidate?.scoreEvidence?.dimensions?.[name]?.points || 0);
}

export function phase3Decision(candidate) {
  const score = Number(candidate?.score || 0);
  const kinds = phase3LaneKinds(candidate);
  if (candidate?.license?.status === "unknown") return 4;
  if (kinds.includes(6) && score >= 78 && candidate?.adoptionEligibleForHumanReview === true
      && points(candidate, "saveWorkValue") >= 6
      && Number(candidate?.scoreEvidence?.maturity?.signal || 0) >= 0.45) return 0;
  if (kinds.includes(4) && score >= 70 && points(candidate, "missingPieceValue") >= 4) return 2;
  if (kinds.includes(1) && score >= 65
      && Math.max(points(candidate, "writerValue"), points(candidate, "studentLearningValue")) >= 4) return 3;
  if (kinds.some((kind) => [2, 3, 5, 6].includes(kind))
      && score >= 70 && points(candidate, "evolutionValue") >= 6) return 1;
  return 4;
}
