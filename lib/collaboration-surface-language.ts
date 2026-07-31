import { COLLABORATION_LANGUAGE } from "./collaboration-language";

/**
 * Writer-facing collaboration copy shared by Dashboard, Collab, Settings,
 * Story Proposals, synchronization and recovery surfaces.
 *
 * Provider identifiers, routes and persisted Git field names remain unchanged.
 */
export const COLLABORATION_SURFACE_COPY = {
  dashboard: {
    localTitle: "Local story project",
    sharedTitle: "Shared story project",
    localSummary: "You are working only with files on this computer.",
    sharedSummary: "You are working with a story repository connected through GitHub.",
    approvedVersion: "Official story version",
    localChanges: "Local story changes",
  },
  settings: {
    connectionTitle: "Story repository connection",
    connectedProject: "Connected shared story project",
    chooseProject: "Choose a shared story project",
    defaultVersion: "Official story version",
    advancedTitle: "Advanced GitHub details",
    disconnect: "Disconnect shared story project",
  },
  proposals: {
    title: "Story Proposals",
    create: "Create Story Proposal",
    refresh: "Refresh Story Proposals",
    approve: "Approve into official story",
    decline: "Decline Story Proposal",
    changeWorkspace: "Change workspace",
    recordedRevision: "Recorded revision",
    officialRevision: "Official story revision",
    mergedState: "Approved into official story",
  },
  synchronization: {
    title: "Shared story synchronization",
    getApproved: "Get official story updates",
    shareChanges: "Share local story changes",
    upToDate: "Local story matches the official version",
    localAhead: "Local story has unshared changes",
    remoteAhead: "Official story has updates to receive",
    diverged: "Local and official story versions both changed",
  },
  recovery: {
    title: "Story recovery",
    officialHistory: "Official story history",
    localHistory: "Local story history",
    restoreRevision: "Restore recorded revision",
    compareVersions: "Compare story versions",
    competingChanges: "Competing story changes",
  },
  advanced: {
    repository: COLLABORATION_LANGUAGE.repository.technical,
    branch: COLLABORATION_LANGUAGE.branch.technical,
    pullRequest: COLLABORATION_LANGUAGE.pullRequest.technical,
    commit: COLLABORATION_LANGUAGE.commit.technical,
    merge: COLLABORATION_LANGUAGE.merge.technical,
    conflict: COLLABORATION_LANGUAGE.conflict.technical,
  },
} as const;

export type CollaborationSurfaceCopy = typeof COLLABORATION_SURFACE_COPY;
