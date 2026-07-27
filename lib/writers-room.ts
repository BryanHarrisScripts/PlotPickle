import type { PlotPickleProject, ReviewThread } from "./project";
import type { FeedbackTargetReference } from "./unified-feedback";
import { createFeedback } from "./unified-feedback-store";

const PREFIX = "plotpickle:writers-room:v1:";

export type WritersRoomParticipant = {
  id: string;
  name: string;
  role: string;
};

export type WritersRoomAction = {
  id: string;
  text: string;
  assignee: string;
  completed: boolean;
};

export type WritersRoomProposal = {
  id: string;
  target: FeedbackTargetReference;
  summary: string;
  status: "proposed" | "approved" | "rejected";
};

export type WritersRoomSession = {
  id: string;
  title: string;
  startsAt: string;
  participants: WritersRoomParticipant[];
  agenda: string[];
  targets: FeedbackTargetReference[];
  activeTargetId: string;
  notes: string;
  decisions: string[];
  unresolvedQuestions: string[];
  actions: WritersRoomAction[];
  proposals: WritersRoomProposal[];
  summary: string;
  meetUrl: string;
  calendarEventId: string;
  recordingReference: string;
  createdAt: string;
  updatedAt: string;
};

function makeId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function encode(session: WritersRoomSession) {
  return `${PREFIX}${JSON.stringify(session)}`;
}

function decode(thread: ReviewThread): WritersRoomSession | null {
  const comment = thread.comments.find((item) => item.body.startsWith(PREFIX));
  if (!comment) return null;
  try {
    const value = JSON.parse(comment.body.slice(PREFIX.length)) as WritersRoomSession;
    return value?.id && value?.title ? value : null;
  } catch {
    return null;
  }
}

export function writersRoomSessions(project: PlotPickleProject) {
  return project.review.threads
    .map((thread) => ({ thread, session: decode(thread) }))
    .filter((item): item is { thread: ReviewThread; session: WritersRoomSession } => Boolean(item.session))
    .sort((left, right) => right.session.startsAt.localeCompare(left.session.startsAt));
}

export function createWritersRoomSession(
  project: PlotPickleProject,
  input: Pick<WritersRoomSession, "title" | "startsAt" | "meetUrl" | "calendarEventId">,
): PlotPickleProject {
  const now = new Date().toISOString();
  const session: WritersRoomSession = {
    id: makeId("writers-room"),
    title: input.title.trim() || "Writers’ Room session",
    startsAt: input.startsAt || now,
    participants: [],
    agenda: [],
    targets: [],
    activeTargetId: "",
    notes: "",
    decisions: [],
    unresolvedQuestions: [],
    actions: [],
    proposals: [],
    summary: "",
    meetUrl: input.meetUrl.trim(),
    calendarEventId: input.calendarEventId.trim(),
    recordingReference: "",
    createdAt: now,
    updatedAt: now,
  };
  const thread: ReviewThread = {
    id: session.id,
    title: session.title,
    anchor: { kind: "story-field", targetId: project.id, field: "writers-room" },
    status: "open",
    priority: "normal",
    assignedTo: [],
    labels: ["writers-room", "session"],
    comments: [{ id: makeId("writers-room-record"), author: "PlotPickle", body: encode(session), createdAt: now }],
    createdAt: now,
    updatedAt: now,
  };
  return { ...project, review: { ...project.review, threads: [...project.review.threads, thread] } };
}

export function updateWritersRoomSession(
  project: PlotPickleProject,
  sessionId: string,
  updater: (session: WritersRoomSession) => WritersRoomSession,
): PlotPickleProject {
  const now = new Date().toISOString();
  return {
    ...project,
    review: {
      ...project.review,
      threads: project.review.threads.map((thread) => {
        const session = thread.id === sessionId ? decode(thread) : null;
        if (!session) return thread;
        const next = { ...updater(session), id: session.id, createdAt: session.createdAt, updatedAt: now };
        return {
          ...thread,
          title: next.title,
          updatedAt: now,
          comments: [
            ...thread.comments.filter((comment) => !comment.body.startsWith(PREFIX)),
            { id: makeId("writers-room-record"), author: "PlotPickle", body: encode(next), createdAt: now },
          ],
        };
      }),
    },
  };
}

export function approveWritersRoomProposal(project: PlotPickleProject, sessionId: string, proposalId: string) {
  const item = writersRoomSessions(project).find(({ session }) => session.id === sessionId);
  const proposal = item?.session.proposals.find((candidate) => candidate.id === proposalId);
  if (!proposal || proposal.status !== "proposed") return project;
  const updated = updateWritersRoomSession(project, sessionId, (session) => ({
    ...session,
    proposals: session.proposals.map((candidate) => candidate.id === proposalId ? { ...candidate, status: "approved" } : candidate),
  }));
  return createFeedback(updated, {
    title: `Approved Writers’ Room proposal: ${item.session.title}`,
    body: proposal.summary,
    author: "Writers’ Room",
    role: "reviewer",
    source: "writers-room",
    status: "accepted",
    priority: "normal",
    category: "story",
    proposedChange: proposal.summary,
    target: proposal.target,
  });
}

export function createWritersRoomProposal(target: FeedbackTargetReference, summary: string): WritersRoomProposal {
  return { id: makeId("writers-room-proposal"), target, summary: summary.trim(), status: "proposed" };
}
