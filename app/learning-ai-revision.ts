import {
  aiRevisionPlaybooks,
  revisionPlaybookSearchText,
  revisionResponseContract,
  type AiRevisionPlaybook,
  type RevisionDestination,
} from "@/lib/ai-revision-playbooks";
import type { LearningModule } from "./learning-library";

export type AiRevisionLesson = LearningModule & {
  collection: "AI-Assisted Revision";
  playbookId: string;
  layer: AiRevisionPlaybook["layer"];
  defaultOperation: AiRevisionPlaybook["defaultOperation"];
  canonicalScopes: AiRevisionPlaybook["reads"];
  destination: RevisionDestination;
  workspaceHref: string;
  useWhen: string[];
  avoidWhen: string[];
  evaluation: string[];
  failureModes: string[];
  sourceResources: string[];
  sourceNote: string;
};

const destinationHref: Record<RevisionDestination, string> = {
  Structure: "/structure",
  DraftLens: "/draftlens",
  Voiceprint: "/voiceprint",
  "Dialogue Lab": "/labs",
  PageFlow: "/pageflow",
  Resonance: "/resonance",
  "Story Planner": "/",
  "Pitch & Review": "/pitch-review",
  Distribution: "/production",
};

function destinationApply(destination: RevisionDestination): LearningModule["apply"] {
  if (["DraftLens", "Voiceprint", "Dialogue Lab", "PageFlow"].includes(destination)) return "Screenplay";
  if (["Pitch & Review", "Distribution"].includes(destination)) return "Treatment";
  return "Block plan";
}

export const aiRevisionLessons: AiRevisionLesson[] = aiRevisionPlaybooks.map((playbook, index) => ({
  id: `ai-revision-${playbook.id}`,
  number: 25 + index,
  path: "Responsible AI",
  title: playbook.title,
  duration: "15–25 min",
  overview: playbook.problem,
  objectives: [
    `Recognize when the ${playbook.title.toLowerCase()} is the smallest useful revision pass.`,
    `Choose an explicit operation and canonical scope before sharing project context.`,
    `Evaluate the response before routing approved work to ${playbook.destination}.`,
  ],
  sections: [
    {
      heading: "When this pass helps",
      paragraphs: ["Start with the craft problem, not with a request to rewrite. Confirm that the selected pass matches the evidence currently visible in the project."],
      points: playbook.useWhen,
    },
    {
      heading: "When to choose another pass",
      paragraphs: ["A guided pass should remain narrow. If the underlying story layer is unstable, move upward to diagnosis or structure before polishing local language."],
      points: playbook.avoidWhen,
    },
    {
      heading: "Set the operation and scope",
      paragraphs: [`The recommended starting operation is “${playbook.defaultOperation}.” Revision text remains opt-in; critique, questions, evidence, alternatives and checklists can be requested without asking the system to rewrite anything.`, `Use only the canonical context required for the task. This pass is designed for: ${playbook.reads.join(", ")}.`],
      points: [`Layer: ${playbook.layer}`, `Default operation: ${playbook.defaultOperation}`, `Canonical scope: ${playbook.reads.join(" · ")}`, `Recommended destination: ${playbook.destination}`],
    },
    {
      heading: "Review the response before approval",
      paragraphs: ["PlotPickle separates evidence, diagnosis, questions, optional suggestions, canon risk and human verification. A proposed change must preserve the original beside the alternative and must never be applied automatically."],
      points: revisionResponseContract,
    },
    {
      heading: "Recognize predictable AI failure modes",
      paragraphs: ["A confident answer is not the same as a useful answer. Reject output that invents canon, replaces writer intent, hides uncertainty or expands beyond the selected pass."],
      points: playbook.failureModes,
    },
  ],
  definitions: [
    { term: "Operation", meaning: "The exact kind of assistance requested, such as questions, critique, evidence, alternatives, comparison, checklist or a revision proposed for review." },
    { term: "Canonical scope", meaning: "The smallest approved project area supplied to the pass, from the complete project down to selected screenplay elements." },
    { term: "Approval boundary", meaning: "The rule that generated or suggested material remains separate until the writer explicitly reviews and accepts it." },
  ],
  example: {
    title: `${playbook.title} setup`,
    text: `Select “${playbook.defaultOperation},” include only ${playbook.reads.slice(0, 2).join(" and ")}, state the writer’s goal, then require labelled evidence, diagnosis, questions, suggestions, risks and verification needs. Route approved next steps to ${playbook.destination}.`,
  },
  checklist: playbook.evaluation,
  mistakes: playbook.failureModes,
  exercise: `Open the active project and identify one piece of evidence that supports this problem: ${playbook.problem} Choose the smallest scope, keep the default operation unless a different one is necessary, and prepare the prompt without applying any change.`,
  apply: destinationApply(playbook.destination),
  tags: [...playbook.searchTerms, ...playbook.sourceResources, playbook.layer, playbook.defaultOperation, playbook.destination],
  collection: "AI-Assisted Revision",
  playbookId: playbook.id,
  layer: playbook.layer,
  defaultOperation: playbook.defaultOperation,
  canonicalScopes: playbook.reads,
  destination: playbook.destination,
  workspaceHref: destinationHref[playbook.destination],
  useWhen: playbook.useWhen,
  avoidWhen: playbook.avoidWhen,
  evaluation: playbook.evaluation,
  failureModes: playbook.failureModes,
  sourceResources: playbook.sourceResources,
  sourceNote: `Consolidated from the legacy PlotPickle prompt resources: ${playbook.sourceResources.join(", ")}.`,
}));

export function aiRevisionLessonSearchText(lesson: AiRevisionLesson) {
  const playbook = aiRevisionPlaybooks.find((item) => item.id === lesson.playbookId);
  return [
    lesson.collection,
    lesson.layer,
    lesson.defaultOperation,
    ...lesson.canonicalScopes,
    lesson.destination,
    lesson.sourceNote,
    ...(playbook ? [revisionPlaybookSearchText(playbook)] : []),
  ].join(" ").toLowerCase();
}
