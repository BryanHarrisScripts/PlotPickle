import type { PlotPickleProject, ScreenplayDraftElementType } from "./project";

export const SCREENPLAY_REVISIONS_EXTENSION_KEY = "screenplayRevisions" as const;
export const SCREENPLAY_REVISIONS_VERSION = 1 as const;

export type ScreenplayRevisionDecision =
  | "pending"
  | "keep-baseline"
  | "replace-with-revision"
  | "merge-selected"
  | "write-new"
  | "discard-revision";

export type ScreenplayRevisionElement = {
  id: string;
  type: ScreenplayDraftElementType;
  text: string;
  blockNumber: number;
  miniBlockNumber: number;
  sceneNumber: number;
};

export type ScreenplayRevisionSource = {
  id: string;
  label: string;
  role: "canonical-baseline" | "partial-rewrite" | "alternate-draft";
  immutable: boolean;
  sourceFileName: string;
  sourceSha: string;
  sourceVersion: string;
  elementMode: "canonical-project" | "embedded";
  attemptedBlocks: number[];
  notAttemptedBlocks: number[];
  elements: ScreenplayRevisionElement[];
  notes: string;
};

export type ScreenplayRevisionDecisionRecord = {
  id: string;
  baselineSourceId: string;
  revisionSourceId: string;
  blockNumber: number;
  miniBlockNumber: number | null;
  sceneNumber: number | null;
  baselineElementIds: string[];
  revisionElementIds: string[];
  decision: ScreenplayRevisionDecision;
  beforeText: string;
  proposedText: string;
  acceptedText: string;
  decisionNote: string;
  decidedAt: string;
};

export type ScreenplayRevisionWorkspace = {
  version: typeof SCREENPLAY_REVISIONS_VERSION;
  canonicalSourceId: string;
  sources: ScreenplayRevisionSource[];
  decisions: ScreenplayRevisionDecisionRecord[];
  createdAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function getScreenplayRevisionWorkspace(project: PlotPickleProject): ScreenplayRevisionWorkspace | null {
  const candidate = project.extensions?.[SCREENPLAY_REVISIONS_EXTENSION_KEY];
  if (!isRecord(candidate) || candidate.version !== SCREENPLAY_REVISIONS_VERSION) return null;
  if (typeof candidate.canonicalSourceId !== "string" || !Array.isArray(candidate.sources) || !Array.isArray(candidate.decisions)) return null;
  return candidate as unknown as ScreenplayRevisionWorkspace;
}

export function withScreenplayRevisionWorkspace(project: PlotPickleProject, workspace: ScreenplayRevisionWorkspace): PlotPickleProject {
  return {
    ...project,
    extensions: {
      ...(project.extensions ?? {}),
      [SCREENPLAY_REVISIONS_EXTENSION_KEY]: workspace,
    },
  };
}

export function createScreenplayRevisionWorkspace(input: {
  canonicalSourceId: string;
  sources: ScreenplayRevisionSource[];
  createdAt?: string;
}): ScreenplayRevisionWorkspace {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const sourceIds = new Set(input.sources.map((source) => source.id));
  if (!sourceIds.has(input.canonicalSourceId)) throw new Error("The canonical screenplay revision source is missing.");
  for (const source of input.sources) {
    const attempted = new Set(source.attemptedBlocks);
    if (source.notAttemptedBlocks.some((block) => attempted.has(block))) throw new Error(`Revision source ${source.id} marks a Block as both attempted and not attempted.`);
  }
  return {
    version: SCREENPLAY_REVISIONS_VERSION,
    canonicalSourceId: input.canonicalSourceId,
    sources: input.sources,
    decisions: [],
    createdAt,
    updatedAt: createdAt,
  };
}

export function recordScreenplayRevisionDecision(workspace: ScreenplayRevisionWorkspace, decision: ScreenplayRevisionDecisionRecord): ScreenplayRevisionWorkspace {
  const withoutPrior = workspace.decisions.filter((entry) => entry.id !== decision.id);
  return {
    ...workspace,
    decisions: [...withoutPrior, decision],
    updatedAt: decision.decidedAt || workspace.updatedAt,
  };
}
