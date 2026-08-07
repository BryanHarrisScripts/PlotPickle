"use client";

import type { CreativeExplorationCandidate } from "@/lib/creative-candidates";
import type { CandidateComparisonRecord } from "@/lib/candidate-comparison";

export default function CandidateComparisonBoard({
  candidates,
  records,
  onChange,
}: {
  candidates: CreativeExplorationCandidate[];
  records: Record<string, CandidateComparisonRecord>;
  onChange: (record: CandidateComparisonRecord) => void;
}) {
  const recordFor = (candidateId: string): CandidateComparisonRecord => records[candidateId] ?? {
    candidateId,
    rank: null,
    decision: "none",
    annotation: { strengths: "", problems: "", reusableQualities: "" },
    updatedAt: "",
  };

  const patch = (candidateId: string, next: Partial<CandidateComparisonRecord>) => {
    onChange({ ...recordFor(candidateId), ...next });
  };

  return (
    <section className="candidate-comparison-board" aria-label="Compare creative candidates">
      <header className="subsection-title">
        <div>
          <span>Compare possibilities</span>
          <p className="field-help">Review candidates side by side. Shortlisting, rejecting or ranking never changes story canon.</p>
        </div>
      </header>

      <div className="candidate-comparison-grid" role="list">
        {candidates.map((candidate) => {
          const record = recordFor(candidate.id);
          return (
            <article className="candidate-comparison-card" role="listitem" tabIndex={0} key={candidate.id}>
              <header>
                <strong>{candidate.target.label}</strong>
                <span>{candidate.mediaType} · {candidate.status}</span>
              </header>

              {candidate.payload.previewRef ? <img src={candidate.payload.previewRef} alt="Creative candidate preview" /> : null}
              {candidate.payload.text ? <p>{candidate.payload.text}</p> : null}

              <div className="candidate-decision-actions" role="group" aria-label={`Decision for ${candidate.id}`}>
                <button type="button" aria-pressed={record.decision === "shortlisted"} onClick={() => patch(candidate.id, { decision: "shortlisted" })}>Shortlist</button>
                <button type="button" aria-pressed={record.decision === "rejected"} onClick={() => patch(candidate.id, { decision: "rejected" })}>Reject</button>
                <button type="button" onClick={() => patch(candidate.id, { decision: "none" })}>Restore</button>
              </div>

              <label className="form-field">
                <span className="field-label">Rank</span>
                <input
                  inputMode="numeric"
                  type="number"
                  min={1}
                  value={record.rank ?? ""}
                  onChange={(event) => patch(candidate.id, { rank: event.target.value ? Math.max(1, Number(event.target.value)) : null })}
                />
              </label>

              <label className="form-field">
                <span className="field-label">Strengths</span>
                <textarea value={record.annotation.strengths} onChange={(event) => patch(candidate.id, { annotation: { ...record.annotation, strengths: event.target.value } })} />
              </label>
              <label className="form-field">
                <span className="field-label">Problems</span>
                <textarea value={record.annotation.problems} onChange={(event) => patch(candidate.id, { annotation: { ...record.annotation, problems: event.target.value } })} />
              </label>
              <label className="form-field">
                <span className="field-label">Reusable qualities</span>
                <textarea value={record.annotation.reusableQualities} onChange={(event) => patch(candidate.id, { annotation: { ...record.annotation, reusableQualities: event.target.value } })} />
              </label>
            </article>
          );
        })}
      </div>
    </section>
  );
}
