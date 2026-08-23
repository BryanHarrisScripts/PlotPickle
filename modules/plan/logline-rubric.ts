import type { LoglineEvidenceGroup, LoglineEvidenceItem, LoglineEvidenceResult } from "./logline-lab";

export { evaluateLoglineEvidence as scoreLogline } from "./logline-lab";

export type LoglineRubricCriterion = LoglineEvidenceItem;
export type LoglineRubricResult = LoglineEvidenceResult;

export const LOGLINE_EVIDENCE_GROUPS: LoglineEvidenceGroup[] = [
  "Core dramatic engine",
  "Promise and distinction",
  "Clarity and delivery",
];
