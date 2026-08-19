import type { PPFProject } from "../project/project";

export type PortableAvatarDraft = {
  readonly draftId: string;
  readonly displayName: string;
  readonly bio?: string;
  readonly visualAssetRef?: string;
};

export type CanonicalAvatar = {
  readonly avatarId: string;
  readonly ownerPersonId: string;
  readonly displayName: string;
  readonly bio?: string;
  readonly visualAssetRef?: string;
  readonly claimedAt: string;
  readonly updatedAt: string;
};

export type AuthorizedNode = {
  readonly nodeId: string;
  readonly publicKeyPem: string;
  readonly authorizedAt: string;
  readonly revokedAt: string | null;
};

export type PlotPickleAccountSyncState = {
  readonly version: 1;
  readonly personId: string;
  readonly avatar: CanonicalAvatar | null;
  readonly nodes: Readonly<Record<string, AuthorizedNode>>;
};

export type LearnNoteVersion = {
  readonly versionId: string;
  readonly noteId: string;
  readonly lessonId: string;
  readonly body: string;
  readonly nodeId: string;
  readonly updatedAt: string;
};

export type PortableCurriculumAnswerVersion = {
  readonly versionId: string;
  readonly answerId: string;
  readonly lessonId: string;
  readonly value: string;
  readonly nodeId: string;
  readonly updatedAt: string;
};

export type PortableSageMessage = {
  readonly messageId: string;
  readonly role: "writer" | "guide";
  readonly text: string;
  readonly createdAt: string;
};

export type PortableLearnState = {
  readonly version: 1;
  readonly activeLessonId: string | null;
  readonly activeLessonUpdatedAt: string;
  readonly completedLessonIds: readonly string[];
  readonly bookmarks: Readonly<Record<string, string>>;
  readonly notes: readonly LearnNoteVersion[];
  readonly curriculumAnswers: readonly PortableCurriculumAnswerVersion[];
  readonly sageMessages: readonly PortableSageMessage[];
  readonly lessonVersions: Readonly<Record<string, string>>;
  readonly visualWriterFrontier: {
    readonly lessonId: string | null;
    readonly label: string;
    readonly updatedAt: string;
  } | null;
};

export type LearnSyncReconciliation = {
  readonly state: PortableLearnState;
  readonly lessonVersionConflicts: readonly {
    readonly lessonId: string;
    readonly versions: readonly string[];
  }[];
};

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{1,127}$/i;
const PRIVATE_OR_PROJECT_FIELD_PATTERN = /(private.?key|credential|provider.?token|filesystem|local.?path|ppf|build.?prompt|hidden.?reasoning|system.?reasoning)/i;

function stableId(value: string, label: string) {
  const normalized = value.trim();
  if (!ID_PATTERN.test(normalized)) throw new Error(`${label} must be a stable 2-128 character identifier.`);
  return normalized;
}

function cleanText(value: string, label: string, maximum: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
  if (/[\u0000-\u001F\u007F]/.test(normalized)) throw new Error(`${label} contains unsupported control characters.`);
  return normalized;
}

function validIso(value: string, label: string) {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be an ISO date-time.`);
  return value;
}

function publicKeyPem(value: string) {
  const normalized = value.trim();
  if (!normalized.includes("BEGIN PUBLIC KEY") || !normalized.includes("END PUBLIC KEY")) {
    throw new Error("Node public key must be an exported public key PEM.");
  }
  if (/PRIVATE KEY/.test(normalized)) throw new Error("Node authorization cannot contain a private key.");
  return normalized;
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values.filter((value) => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()))].sort();
}

function sanitizedAvatarDraft(draft: PortableAvatarDraft) {
  return {
    draftId: stableId(draft.draftId, "Avatar draft id"),
    displayName: cleanText(draft.displayName, "Avatar display name", 80),
    ...(draft.bio?.trim() ? { bio: cleanText(draft.bio, "Avatar bio", 500) } : {}),
    ...(draft.visualAssetRef?.trim() ? { visualAssetRef: cleanText(draft.visualAssetRef, "Avatar visual asset reference", 500) } : {}),
  };
}

export function createAccountSyncState(personId: string): PlotPickleAccountSyncState {
  return {
    version: 1,
    personId: stableId(personId, "Person id"),
    avatar: null,
    nodes: {},
  };
}

export function authorizeNode(
  account: PlotPickleAccountSyncState,
  input: { readonly nodeId: string; readonly publicKeyPem: string; readonly authorizedAt: string },
): PlotPickleAccountSyncState {
  const nodeId = stableId(input.nodeId, "Node id");
  const nextNode: AuthorizedNode = {
    nodeId,
    publicKeyPem: publicKeyPem(input.publicKeyPem),
    authorizedAt: validIso(input.authorizedAt, "Node authorization time"),
    revokedAt: null,
  };
  return {
    ...account,
    nodes: {
      ...account.nodes,
      [nodeId]: nextNode,
    },
  };
}

export function revokeNode(account: PlotPickleAccountSyncState, nodeId: string, revokedAt: string): PlotPickleAccountSyncState {
  const id = stableId(nodeId, "Node id");
  const existing = account.nodes[id];
  if (!existing) throw new Error("Cannot revoke a Node that is not authorized for this account.");
  return {
    ...account,
    nodes: {
      ...account.nodes,
      [id]: {
        ...existing,
        revokedAt: validIso(revokedAt, "Node revocation time"),
      },
    },
  };
}

export function assertAuthorizedNode(account: PlotPickleAccountSyncState, nodeId: string) {
  const id = stableId(nodeId, "Node id");
  const node = account.nodes[id];
  if (!node || node.revokedAt) throw new Error("This Node is not authorized for account synchronization.");
  return node;
}

export function claimOrAdoptAvatar(
  account: PlotPickleAccountSyncState,
  nodeId: string,
  localDraft: PortableAvatarDraft,
  input: { readonly avatarId: string; readonly now: string },
) {
  assertAuthorizedNode(account, nodeId);
  const preservedDraft = sanitizedAvatarDraft(localDraft);
  if (account.avatar) {
    return {
      account,
      canonicalAvatar: account.avatar,
      localDraft: preservedDraft,
      adoptedExistingAvatar: true as const,
    };
  }

  const now = validIso(input.now, "Avatar claim time");
  const canonicalAvatar: CanonicalAvatar = {
    avatarId: stableId(input.avatarId, "Avatar id"),
    ownerPersonId: account.personId,
    displayName: preservedDraft.displayName,
    ...(preservedDraft.bio ? { bio: preservedDraft.bio } : {}),
    ...(preservedDraft.visualAssetRef ? { visualAssetRef: preservedDraft.visualAssetRef } : {}),
    claimedAt: now,
    updatedAt: now,
  };
  return {
    account: { ...account, avatar: canonicalAvatar },
    canonicalAvatar,
    localDraft: preservedDraft,
    adoptedExistingAvatar: false as const,
  };
}

function validPortableFieldNames(value: Record<string, unknown>) {
  for (const key of Object.keys(value)) {
    if (PRIVATE_OR_PROJECT_FIELD_PATTERN.test(key)) {
      throw new Error(`LEARN sync field is outside the portable allowlist: ${key}`);
    }
  }
}

export function createPortableLearnState(input: {
  readonly activeLessonId?: string | null;
  readonly activeLessonUpdatedAt: string;
  readonly completedLessonIds?: readonly string[];
  readonly bookmarks?: Readonly<Record<string, string>>;
  readonly notes?: readonly LearnNoteVersion[];
  readonly curriculumAnswers?: readonly PortableCurriculumAnswerVersion[];
  readonly sageMessages?: readonly PortableSageMessage[];
  readonly lessonVersions?: Readonly<Record<string, string>>;
  readonly visualWriterFrontier?: PortableLearnState["visualWriterFrontier"];
}): PortableLearnState {
  validPortableFieldNames(input as unknown as Record<string, unknown>);
  return {
    version: 1,
    activeLessonId: input.activeLessonId?.trim() || null,
    activeLessonUpdatedAt: validIso(input.activeLessonUpdatedAt, "Active lesson update time"),
    completedLessonIds: uniqueSorted(input.completedLessonIds ?? []),
    bookmarks: Object.fromEntries(Object.entries(input.bookmarks ?? {}).map(([lessonId, updatedAt]) => [lessonId.trim(), validIso(updatedAt, "Bookmark update time")])),
    notes: [...(input.notes ?? [])],
    curriculumAnswers: [...(input.curriculumAnswers ?? [])],
    sageMessages: [...(input.sageMessages ?? [])].filter((message) => message.role === "writer" || message.role === "guide"),
    lessonVersions: { ...(input.lessonVersions ?? {}) },
    visualWriterFrontier: input.visualWriterFrontier ?? null,
  };
}

export function portableLearnStateFromProject(project: PPFProject, now = new Date()): PortableLearnState {
  return createPortableLearnState({
    activeLessonId: project.learning.activeLessonId,
    activeLessonUpdatedAt: now.toISOString(),
    completedLessonIds: project.learning.completedLessonIds,
  });
}

function mergeTimestampRecord(left: Readonly<Record<string, string>>, right: Readonly<Record<string, string>>) {
  const merged: Record<string, string> = { ...left };
  for (const [key, value] of Object.entries(right)) {
    const current = merged[key];
    if (!current || Date.parse(value) > Date.parse(current)) merged[key] = value;
  }
  return merged;
}

function appendVersions<T extends { readonly versionId: string; readonly updatedAt: string }>(left: readonly T[], right: readonly T[]) {
  const byId = new Map<string, T>();
  for (const item of [...left, ...right]) {
    const existing = byId.get(item.versionId);
    if (!existing || Date.parse(item.updatedAt) > Date.parse(existing.updatedAt)) byId.set(item.versionId, item);
  }
  return [...byId.values()].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.versionId.localeCompare(b.versionId));
}

function mergeVisibleMessages(left: readonly PortableSageMessage[], right: readonly PortableSageMessage[]) {
  const byId = new Map<string, PortableSageMessage>();
  for (const item of [...left, ...right]) byId.set(item.messageId, item);
  return [...byId.values()]
    .filter((message) => message.role === "writer" || message.role === "guide")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.messageId.localeCompare(b.messageId))
    .slice(-200);
}

function newerFrontier(left: PortableLearnState["visualWriterFrontier"], right: PortableLearnState["visualWriterFrontier"]) {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(right.updatedAt) > Date.parse(left.updatedAt) ? right : left;
}

export function reconcilePortableLearnState(left: PortableLearnState, right: PortableLearnState): LearnSyncReconciliation {
  const rightCursorIsNewer = Date.parse(right.activeLessonUpdatedAt) > Date.parse(left.activeLessonUpdatedAt);
  const lessonVersionKeys = uniqueSorted([...Object.keys(left.lessonVersions), ...Object.keys(right.lessonVersions)]);
  const lessonVersionConflicts = lessonVersionKeys
    .map((lessonId) => ({
      lessonId,
      versions: uniqueSorted([left.lessonVersions[lessonId], right.lessonVersions[lessonId]].filter((value): value is string => Boolean(value))),
    }))
    .filter((entry) => entry.versions.length > 1);

  return {
    state: {
      version: 1,
      activeLessonId: rightCursorIsNewer ? right.activeLessonId : left.activeLessonId,
      activeLessonUpdatedAt: rightCursorIsNewer ? right.activeLessonUpdatedAt : left.activeLessonUpdatedAt,
      completedLessonIds: uniqueSorted([...left.completedLessonIds, ...right.completedLessonIds]),
      bookmarks: mergeTimestampRecord(left.bookmarks, right.bookmarks),
      notes: appendVersions(left.notes, right.notes),
      curriculumAnswers: appendVersions(left.curriculumAnswers, right.curriculumAnswers),
      sageMessages: mergeVisibleMessages(left.sageMessages, right.sageMessages),
      lessonVersions: { ...left.lessonVersions, ...right.lessonVersions },
      visualWriterFrontier: newerFrontier(left.visualWriterFrontier, right.visualWriterFrontier),
    },
    lessonVersionConflicts,
  };
}

export function reconcileForAuthorizedNode(
  account: PlotPickleAccountSyncState,
  nodeId: string,
  localState: PortableLearnState,
  canonicalState: PortableLearnState,
) {
  assertAuthorizedNode(account, nodeId);
  return reconcilePortableLearnState(localState, canonicalState);
}

export function applyPortableLearnStateToProject(project: PPFProject, state: PortableLearnState, now = new Date()): PPFProject {
  return {
    ...project,
    revision: project.revision + 1,
    updatedAt: now.toISOString(),
    learning: {
      activeLessonId: state.activeLessonId,
      completedLessonIds: state.completedLessonIds,
    },
  };
}

export function nextLearnActionLessonId(orderedLessonIds: readonly string[], state: PortableLearnState) {
  const completed = new Set(state.completedLessonIds);
  if (!orderedLessonIds.length) return null;
  const activeIndex = state.activeLessonId ? orderedLessonIds.indexOf(state.activeLessonId) : -1;
  for (let offset = 1; offset <= orderedLessonIds.length; offset += 1) {
    const index = (Math.max(activeIndex, -1) + offset) % orderedLessonIds.length;
    if (!completed.has(orderedLessonIds[index])) return orderedLessonIds[index];
  }
  return null;
}

export const PORTABLE_LEARN_SYNC_ALLOWLIST = Object.freeze([
  "activeLessonId",
  "activeLessonUpdatedAt",
  "completedLessonIds",
  "bookmarks",
  "notes",
  "curriculumAnswers",
  "sageMessages",
  "lessonVersions",
  "visualWriterFrontier",
]);
