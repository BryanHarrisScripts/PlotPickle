import React from 'react'
import { ContributionEntry, summarizeContributions } from '../../lib/aiContributionLedger'

type Props = {
  entries: ContributionEntry[]
  assetId?: string
}

export function ContributionLedger({ entries, assetId }: Props) {
  const scoped = assetId ? entries.filter((entry) => entry.assetId === assetId) : entries
  const summary = summarizeContributions(scoped)

  return (
    <section aria-label="AI contribution and human approval ledger" className="contribution-ledger">
      <header>
        <div>
          <p className="eyebrow">Contribution history</p>
          <h3>{assetId ? 'Asset ledger' : 'Project ledger'}</h3>
        </div>
        <p>{summary.generation} generated · {summary['writer-edit']} writer edits · {summary.approval} approvals</p>
      </header>

      <ol>
        {scoped.map((entry) => (
          <li key={entry.id}>
            <strong>{entry.kind === 'writer-edit' ? 'Writer edit' : entry.kind[0].toUpperCase() + entry.kind.slice(1)}</strong>
            <span> · {entry.actor}</span>
            <p>{entry.summary}</p>
            {entry.retention !== 'active' && <small>{entry.retention}</small>}
          </li>
        ))}
      </ol>
    </section>
  )
}
