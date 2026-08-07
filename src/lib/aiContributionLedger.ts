export type ContributionKind = 'suggestion' | 'generation' | 'writer-edit' | 'approval'
export type RetentionState = 'active' | 'deleted-redacted' | 'retained-for-lineage'

export type ContributionEntry = {
  id: string
  projectId: string
  assetId?: string
  targetId?: string
  kind: ContributionKind
  actor: 'writer' | 'ai' | 'system'
  sourceIds?: string[]
  summary: string
  createdAt: string
  retention: RetentionState
  providerLabel?: string
  privateProviderPayload?: never
  secret?: never
}

export function recordContribution(entry: ContributionEntry): ContributionEntry {
  if (!entry.summary.trim()) throw new Error('Contribution summary is required')
  return { ...entry, sourceIds: [...(entry.sourceIds ?? [])] }
}

export function deleteCandidateContribution(entries: ContributionEntry[], id: string, preserveLineage: boolean): ContributionEntry[] {
  return entries.map((entry) => entry.id === id
    ? { ...entry, retention: preserveLineage ? 'retained-for-lineage' : 'deleted-redacted', summary: preserveLineage ? entry.summary : '[deleted]' }
    : entry)
}

export function summarizeContributions(entries: ContributionEntry[], assetId?: string) {
  const scoped = assetId ? entries.filter((entry) => entry.assetId === assetId) : entries
  return scoped.reduce((counts, entry) => {
    counts[entry.kind] += 1
    return counts
  }, { suggestion: 0, generation: 0, 'writer-edit': 0, approval: 0 } as Record<ContributionKind, number>)
}

export function exportContributionLedger(entries: ContributionEntry[]) {
  return entries.map(({ providerLabel, ...entry }) => ({
    ...entry,
    provider: providerLabel || undefined,
  }))
}
