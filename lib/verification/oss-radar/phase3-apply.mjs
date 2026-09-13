import { phase3Decision } from "./phase3-decision.mjs";

export function applyPhase3(candidates, labels) {
  for (const candidate of candidates || []) {
    candidate.primaryDisposition = labels[phase3Decision(candidate)] || labels[4];
  }
  return candidates || [];
}
