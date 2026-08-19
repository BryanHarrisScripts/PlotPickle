import type { PPFProject } from "../project/project";
import * as core from "./account-learn-sync-core.mjs";

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

export type PortableLearnStateInput = {
  readonly activeLessonId?: string | null;
  readonly activeLessonUpdatedAt: string;
  readonly completedLessonIds?: readonly string[];
  readonly bookmarks?: Readonly<Record<string, string>>;
  readonly notes?: readonly LearnNoteVersion[];
  readonly curriculumAnswers?: readonly PortableCurriculumAnswerVersion[];
  readonly sageMessages?: readonly PortableSageMessage[];
  readonly lessonVersions?: Readonly<Record<string, string>>;
  readonly visualWriterFrontier?: PortableLearnState["visualWriterFrontier"];
};

export function createAccountSyncState(personId: string): PlotPickleAccountSyncState {
  return core.createAccountSyncState(personId) as PlotPickleAccountSyncState;
}

export function authorizeNode(
  account: PlotPickleAccountSyncState,
  input: { readonly nodeId: string; readonly publicKeyPem: string; readonly authorizedAt: string },
): PlotPickleAccountSyncState {
  return core.authorizeNode(account, input) as PlotPickleAccountSyncState;
}

export function revokeNode(account: PlotPickleAccountSyncState, nodeId: string, revokedAt: string): PlotPickleAccountSyncState {
  return core.revokeNode(account, nodeId, revokedAt) as PlotPickleAccountSyncState;
}

export function assertAuthorizedNode(account: PlotPickleAccountSyncState, nodeId: string): AuthorizedNode {
  return core.assertAuthorizedNode(account, nodeId) as AuthorizedNode;
}

export function claimOrAdoptAvatar(
  account: PlotPickleAccountSyncState,
  nodeId: string,
  localDraft: PortableAvatarDraft,
  input: { readonly avatarId: string; readonly now: string },
): {
  readonly account: PlotPickleAccountSyncState;
  readonly canonicalAvatar: CanonicalAvatar;
  readonly localDraft: PortableAvatarDraft;
  readonly adoptedExistingAvatar: boolean;
} {
  return core.claimOrAdoptAvatar(account, nodeId, localDraft, input) as {
    readonly account: PlotPickleAccountSyncState;
    readonly canonicalAvatar: CanonicalAvatar;
    readonly localDraft: PortableAvatarDraft;
    readonly adoptedExistingAvatar: boolean;
  };
}

export function createPortableLearnState(input: PortableLearnStateInput): PortableLearnState {
  return core.createPortableLearnState(input) as PortableLearnState;
}

export function portableLearnStateFromProject(project: PPFProject, now = new Date()): PortableLearnState {
  return core.portableLearnStateFromProject(project, now) as PortableLearnState;
}

export function reconcilePortableLearnState(left: PortableLearnState, right: PortableLearnState): LearnSyncReconciliation {
  return core.reconcilePortableLearnState(left, right) as LearnSyncReconciliation;
}

export function reconcileForAuthorizedNode(
  account: PlotPickleAccountSyncState,
  nodeId: string,
  localState: PortableLearnState,
  canonicalState: PortableLearnState,
): LearnSyncReconciliation {
  return core.reconcileForAuthorizedNode(account, nodeId, localState, canonicalState) as LearnSyncReconciliation;
}

export function applyPortableLearnStateToProject(project: PPFProject, state: PortableLearnState, now = new Date()): PPFProject {
  return core.applyPortableLearnStateToProject(project, state, now) as PPFProject;
}

export function nextLearnActionLessonId(orderedLessonIds: readonly string[], state: PortableLearnState): string | null {
  return core.nextLearnActionLessonId(orderedLessonIds, state) as string | null;
}

export const PORTABLE_LEARN_SYNC_ALLOWLIST = core.PORTABLE_LEARN_SYNC_ALLOWLIST as readonly string[];
