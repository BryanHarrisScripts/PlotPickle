import type { ConceptCanvasTargetKind, PlotPickleProject } from "./project";

export type VisualCanonKind =
  | "character-identity"
  | "location"
  | "prop"
  | "wardrobe"
  | "palette"
  | "style"
  | "composition";

export type VisualCanonStatus = "proposed" | "approved" | "superseded" | "rejected";

export type VisualCanonSource = {
  candidateId: string;
  referenceId: string;
  label: string;
};

export type VisualCanonTarget = {
  kind: ConceptCanvasTargetKind;
  id: string;
  label: string;
};

export type VisualCanonDecision = {
  id: string;
  action: "approve" | "supersede" | "reject" | "restore";
  decidedBy: string;
  note: string;
  createdAt: string;
};

export type VisualCanonItem = {
  id: string;
  kind: VisualCanonKind;
  status: VisualCanonStatus;
  title: string;
  description: string;
  target: VisualCanonTarget;
  source: VisualCanonSource;
  supersedesItemId: string;
  supersededByItemId: string;
  decisions: VisualCanonDecision[];
  createdAt: string;
  updatedAt: string;
};

export type VisualCanonBinder = {
  version: 1;
  items: VisualCanonItem[];
};

const EXTENSION_KEY = "visualCanon";
const KINDS: VisualCanonKind[] = ["character-identity", "location", "prop", "wardrobe", "palette", "style", "composition"];
const STATUSES: VisualCanonStatus[] = ["proposed", "approved", "superseded", "rejected"];
const TARGET_KINDS: ConceptCanvasTargetKind[] = ["project", "character", "location", "block", "mini-block", "scene"];

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeDecision(value: unknown, index: number): VisualCanonDecision | null {
  const candidate = record(value);
  if (!Object.keys(candidate).length) return null;
  const action = ["approve", "supersede", "reject", "restore"].includes(text(candidate.action))
    ? text(candidate.action) as VisualCanonDecision["action"]
    : "approve";
  return {
    id: text(candidate.id) || `visual-canon-decision-${index + 1}`,
    action,
    decidedBy: text(candidate.decidedBy),
    note: text(candidate.note),
    createdAt: text(candidate.createdAt) || new Date().toISOString(),
  };
}

export function normalizeVisualCanonItem(value: unknown, index = 0): VisualCanonItem | null {
  const candidate = record(value);
  if (!Object.keys(candidate).length) return null;
  const target = record(candidate.target);
  const source = record(candidate.source);
  const now = new Date().toISOString();
  const kind = KINDS.includes(candidate.kind as VisualCanonKind) ? candidate.kind as VisualCanonKind : "style";
  const status = STATUSES.includes(candidate.status as VisualCanonStatus) ? candidate.status as VisualCanonStatus : "proposed";
  const targetKind = TARGET_KINDS.includes(target.kind as ConceptCanvasTargetKind) ? target.kind as ConceptCanvasTargetKind : "project";
  return {
    id: text(candidate.id) || `visual-canon-${index + 1}`,
    kind,
    status,
    title: text(candidate.title) || "Untitled visual fact",
    description: text(candidate.description),
    target: {
      kind: targetKind,
      id: text(target.id) || "project",
      label: text(target.label) || "Whole project",
    },
    source: {
      candidateId: text(source.candidateId),
      referenceId: text(source.referenceId),
      label: text(source.label),
    },
    supersedesItemId: text(candidate.supersedesItemId),
    supersededByItemId: text(candidate.supersededByItemId),
    decisions: Array.isArray(candidate.decisions) ? candidate.decisions.flatMap((decision, decisionIndex) => {
      const normalized = normalizeDecision(decision, decisionIndex);
      return normalized ? [normalized] : [];
    }) : [],
    createdAt: text(candidate.createdAt) || now,
    updatedAt: text(candidate.updatedAt) || text(candidate.createdAt) || now,
  };
}

export function readVisualCanonBinder(project: PlotPickleProject): VisualCanonBinder {
  const extensions = record(project.extensions);
  const raw = record(extensions[EXTENSION_KEY]);
  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    version: 1,
    items: items.flatMap((item, index) => {
      const normalized = normalizeVisualCanonItem(item, index);
      return normalized ? [normalized] : [];
    }),
  };
}

function writeVisualCanonBinder(project: PlotPickleProject, binder: VisualCanonBinder): PlotPickleProject {
  return {
    ...project,
    extensions: {
      ...record(project.extensions),
      [EXTENSION_KEY]: binder,
    },
  };
}

export function proposeVisualCanonItem(
  project: PlotPickleProject,
  input: Omit<VisualCanonItem, "status" | "decisions" | "createdAt" | "updatedAt" | "supersededByItemId"> & { createdAt?: string },
): PlotPickleProject {
  const binder = readVisualCanonBinder(project);
  const now = input.createdAt || new Date().toISOString();
  const item: VisualCanonItem = {
    ...input,
    status: "proposed",
    supersededByItemId: "",
    decisions: [],
    createdAt: now,
    updatedAt: now,
  };
  return writeVisualCanonBinder(project, { version: 1, items: [...binder.items, item] });
}

function decision(action: VisualCanonDecision["action"], decidedBy: string, note: string, createdAt: string): VisualCanonDecision {
  return {
    id: `visual-canon-decision-${createdAt.replace(/[^0-9]/g, "")}`,
    action,
    decidedBy,
    note,
    createdAt,
  };
}

export function approveVisualCanonItem(project: PlotPickleProject, itemId: string, decidedBy: string, note = "", createdAt = new Date().toISOString()) {
  const binder = readVisualCanonBinder(project);
  return writeVisualCanonBinder(project, {
    version: 1,
    items: binder.items.map((item) => item.id === itemId ? {
      ...item,
      status: "approved" as const,
      decisions: [...item.decisions, decision("approve", decidedBy, note, createdAt)],
      updatedAt: createdAt,
    } : item),
  });
}

export function rejectVisualCanonItem(project: PlotPickleProject, itemId: string, decidedBy: string, note = "", createdAt = new Date().toISOString()) {
  const binder = readVisualCanonBinder(project);
  return writeVisualCanonBinder(project, {
    version: 1,
    items: binder.items.map((item) => item.id === itemId ? {
      ...item,
      status: "rejected" as const,
      decisions: [...item.decisions, decision("reject", decidedBy, note, createdAt)],
      updatedAt: createdAt,
    } : item),
  });
}

export function supersedeVisualCanonItem(
  project: PlotPickleProject,
  priorItemId: string,
  replacementItemId: string,
  decidedBy: string,
  note = "",
  createdAt = new Date().toISOString(),
) {
  const binder = readVisualCanonBinder(project);
  return writeVisualCanonBinder(project, {
    version: 1,
    items: binder.items.map((item) => {
      if (item.id === priorItemId) {
        return {
          ...item,
          status: "superseded" as const,
          supersededByItemId: replacementItemId,
          decisions: [...item.decisions, decision("supersede", decidedBy, note, createdAt)],
          updatedAt: createdAt,
        };
      }
      if (item.id === replacementItemId) {
        return {
          ...item,
          status: "approved" as const,
          supersedesItemId: priorItemId,
          decisions: [...item.decisions, decision("approve", decidedBy, note, createdAt)],
          updatedAt: createdAt,
        };
      }
      return item;
    }),
  });
}

export function approvedVisualCanon(project: PlotPickleProject) {
  return readVisualCanonBinder(project).items.filter((item) => item.status === "approved");
}
