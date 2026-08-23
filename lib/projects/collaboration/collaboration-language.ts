import collaborationCopy from "@/config/collaboration-copy.json";

export const COLLABORATION_LANGUAGE = collaborationCopy.terms;

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
