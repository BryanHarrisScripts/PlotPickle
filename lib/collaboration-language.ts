export const COLLABORATION_LANGUAGE = {
  repository: {
    primary: "story repository",
    shared: "shared story project",
    technical: "GitHub repository",
  },
  branch: {
    primary: "approved story line",
    proposal: "change workspace",
    technical: "Git branch",
  },
  pullRequest: {
    primary: "Story Proposal",
    technical: "GitHub pull request",
  },
  commit: {
    primary: "recorded revision",
    saved: "saved change",
    technical: "Git commit",
  },
  merge: {
    primary: "approve into the official story",
    completed: "approved into the official story",
    technical: "merge",
  },
  refresh: {
    primary: "refresh approved story",
    technical: "pull from GitHub",
  },
  publish: {
    primary: "publish approved changes",
    technical: "push to GitHub",
  },
  divergence: {
    primary: "the approved story changed",
    detail: "Another approved version was recorded after your last refresh.",
    technical: "remote divergence",
  },
  conflict: {
    primary: "competing story changes",
    detail: "The same story material was changed in more than one version and needs a human decision.",
    technical: "merge conflict",
  },
} as const;

export const PRIMARY_COLLABORATION_TERMS = {
  repository: COLLABORATION_LANGUAGE.repository.primary,
  branch: COLLABORATION_LANGUAGE.branch.primary,
  pullRequest: COLLABORATION_LANGUAGE.pullRequest.primary,
  commit: COLLABORATION_LANGUAGE.commit.primary,
  merge: COLLABORATION_LANGUAGE.merge.primary,
  refresh: COLLABORATION_LANGUAGE.refresh.primary,
  publish: COLLABORATION_LANGUAGE.publish.primary,
  divergence: COLLABORATION_LANGUAGE.divergence.primary,
  conflict: COLLABORATION_LANGUAGE.conflict.primary,
} as const;

export type CollaborationLanguageKey = keyof typeof PRIMARY_COLLABORATION_TERMS;

export function collaborationTerm(key: CollaborationLanguageKey) {
  return PRIMARY_COLLABORATION_TERMS[key];
}
