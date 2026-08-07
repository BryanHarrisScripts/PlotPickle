import { describe, expect, it } from 'vitest'
import { deleteCandidateContribution, exportContributionLedger, recordContribution, summarizeContributions } from '../aiContributionLedger'

const base = {
  projectId: 'project-1',
  createdAt: '2026-08-07T19:00:00Z',
  retention: 'active' as const,
}

describe('AI contribution ledger', () => {
  it('distinguishes suggestion, generation, writer edit and approval', () => {
    const entries = [
      recordContribution({ ...base, id: '1', kind: 'suggestion', actor: 'ai', summary: 'Suggested tighter staging.' }),
      recordContribution({ ...base, id: '2', kind: 'generation', actor: 'ai', summary: 'Generated frame candidate.' }),
      recordContribution({ ...base, id: '3', kind: 'writer-edit', actor: 'writer', summary: 'Changed camera direction.' }),
      recordContribution({ ...base, id: '4', kind: 'approval', actor: 'writer', summary: 'Approved final frame.' }),
    ]
    expect(summarizeContributions(entries)).toEqual({ suggestion: 1, generation: 1, 'writer-edit': 1, approval: 1 })
  })

  it('applies explicit candidate retention rules', () => {
    const entries = [recordContribution({ ...base, id: '1', kind: 'generation', actor: 'ai', summary: 'Candidate A' })]
    expect(deleteCandidateContribution(entries, '1', true)[0].retention).toBe('retained-for-lineage')
    const deleted = deleteCandidateContribution(entries, '1', false)[0]
    expect(deleted.retention).toBe('deleted-redacted')
    expect(deleted.summary).toBe('[deleted]')
  })

  it('summarizes at asset level', () => {
    const entries = [
      recordContribution({ ...base, id: '1', assetId: 'a', kind: 'generation', actor: 'ai', summary: 'A' }),
      recordContribution({ ...base, id: '2', assetId: 'b', kind: 'generation', actor: 'ai', summary: 'B' }),
    ]
    expect(summarizeContributions(entries, 'a').generation).toBe(1)
  })

  it('exports provenance without raw provider responses or secrets', () => {
    const exported = exportContributionLedger([
      recordContribution({ ...base, id: '1', kind: 'generation', actor: 'ai', summary: 'Generated', providerLabel: 'OpenAI' }),
    ])
    expect(exported[0].provider).toBe('OpenAI')
    expect(exported[0]).not.toHaveProperty('privateProviderPayload')
    expect(exported[0]).not.toHaveProperty('secret')
  })
})
