import type { PlotPickleProject } from "./project";
import { evaluateLoglineEvidence, type LoglineEvidenceGroup, type LoglineEvidenceItem, type LoglineEvidenceResult } from "./logline-lab";

export type LoglineRubricCriterion = LoglineEvidenceItem;
export type LoglineRubricResult = LoglineEvidenceResult;

export const LOGLINE_EVIDENCE_GROUPS: LoglineEvidenceGroup[] = [
  "Core dramatic engine",
  "Promise and distinction",
  "Clarity and delivery",
];

export function scoreLogline(project: PlotPickleProject, input: string, deliberateOmissions: string[] = []): LoglineRubricResult {
  return evaluateLoglineEvidence(project, input, deliberateOmissions);
}
