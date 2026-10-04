import type { OutlineTaskRecord } from "../../../build/projects/outline-task-controller";
import type { LibraryPPFProject } from "../../../core/storage/library-project";
import type { OutlineAssessmentRunReceipt } from "../../../core/contracts/imported-screenplay-evidence/outline-agent-assessment";
import { normalizeProjectSourceEvidence } from "../../../core/contracts/imported-screenplay-evidence";
import { outlineAssessmentMaterialReceipt, outlineAssessmentFingerprint, validateOutlineAgentAssessment } from "../outline-agent-assessment";

export type OutlineTaskView = OutlineTaskRecord & { resumeRequired: boolean; running: boolean; error: string | null };

export async function readOutlineTasks(signal?: AbortSignal): Promise<OutlineTaskView[]> {
  const response = await fetch("/api/outline/tasks", { credentials: "same-origin", cache: "no-store", signal });
  const body = await response.json() as { tasks?: OutlineTaskView[]; message?: string };
  if (!response.ok || !Array.isArray(body.tasks)) throw new Error(body.message || "Story Architect recovery is unavailable.");
  return body.tasks;
}

export async function changeOutlineTask(action: "start" | "resume" | "cancel", project: LibraryPPFProject, options: { blocks?: readonly number[]; taskId?: string } = {}) {
  const profile = await fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" });
  const session = await profile.json() as { authenticated?: boolean; csrfToken?: string };
  if (!profile.ok || !session.authenticated || !session.csrfToken) throw new Error("Unlock the Human profile before changing Story Architect recovery.");
  const response = await fetch("/api/outline/tasks", { method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": session.csrfToken },
    body: JSON.stringify({ action, projectId: project.id, ...options,
      ...(action === "start" ? { materialReceipt: await outlineAssessmentMaterialReceipt(project) } : {}) }),
  });
  const body = await response.json() as { task?: OutlineTaskView; message?: string };
  if (!response.ok || !body.task) throw new Error(body.message || "Story Architect task action failed.");
  return body.task;
}

/** Import only validated advisory collections, once per stable task/result identity. */
export async function importOutlineTaskFindings(project: LibraryPPFProject, task: OutlineTaskView): Promise<LibraryPPFProject> {
  if (task.scope.projectId !== project.id || await outlineAssessmentMaterialReceipt(project) !== task.scope.contextReceipt) throw new Error("Saved Story Architect findings belong to different or changed story material.");
  if (!task.proposals.length) return project;
  const source = normalizeProjectSourceEvidence(project.sourceEvidence);
  const priorRun = source.outlineAssessmentRuns?.find((run) => run.id === task.scope.runId);
  // A stable receipt also prevents an old run from overwriting a newer review.
  const alreadyImported = new Set(priorRun?.completedBlockNumbers || []);
  const assessments = task.proposals.map(({ assessment }) => {
    if (outlineAssessmentFingerprint(project, assessment.blockNumber) !== assessment.inputFingerprint) throw new Error("Story Architect finding no longer matches this Block.");
    return validateOutlineAgentAssessment(JSON.stringify(assessment), project, assessment.blockNumber, assessment.model, assessment.assessedAt);
  });
  const newAssessments = assessments.filter((assessment) => !alreadyImported.has(assessment.blockNumber));
  const complete = assessments.length === task.steps.length;
  if (!newAssessments.length && priorRun?.status === (complete ? "completed" : "partial")) return project;
  const changed = new Set(priorRun?.changedBlockNumbers || []);
  for (const assessment of newAssessments) {
    const old = source.outlineAssessments?.find((item) => item.blockNumber === assessment.blockNumber);
    if (!old || JSON.stringify([old.structural, old.characters, old.miniBlocks]) !== JSON.stringify([assessment.structural, assessment.characters, assessment.miniBlocks])) changed.add(assessment.blockNumber);
  }
  const requested = task.steps.map((step) => Number(step.id.slice(6)));
  const run: OutlineAssessmentRunReceipt = { version: 1, id: task.scope.runId, scope: requested.length === 1 ? "block" : "act",
    actNumber: requested.length === 1 ? null : Math.ceil(requested[0] / 6), requestedBlockNumbers: requested,
    completedBlockNumbers: assessments.map((item) => item.blockNumber), changedBlockNumbers: [...changed], status: complete ? "completed" : "partial",
    assessedAt: assessments.at(-1)!.assessedAt, acceptedStoryContentChanged: false,
    blockSummaries: assessments.map((item) => ({ blockNumber: item.blockNumber, structuralState: item.structural.state,
      citedPassageCount: new Set([...item.structural.passageIds, ...item.characters.flatMap((cell) => cell.passageIds), ...item.miniBlocks.flatMap((mini) => mini.passageIds)]).size,
      characterFindingCount: item.characters.filter((cell) => cell.state !== "not-present-no-evidence").length,
      miniBlockStates: item.miniBlocks.map((mini) => mini.state), model: item.model })),
    ...(task.error ? { error: task.error } : {}),
  };
  return { ...project, revision: project.revision + 1, updatedAt: run.assessedAt,
    sourceEvidence: { ...source,
      outlineAssessments: [...(source.outlineAssessments || []).filter((item) => !newAssessments.some((assessment) => assessment.blockNumber === item.blockNumber)), ...newAssessments],
      outlineAssessmentRuns: [...(source.outlineAssessmentRuns || []).filter((item) => item.id !== run.id), run].slice(-40),
    },
  };
}
