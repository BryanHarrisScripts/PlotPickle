"use client";

import type { PlotPickleProject } from "@/lib/project";
import {
  approvedVisualCanon,
  readVisualCanonBinder,
  type VisualCanonItem,
} from "@/lib/visual-canon";

export default function VisualCanonBinder({
  project,
  onApprove,
  onReject,
}: {
  project: PlotPickleProject;
  onApprove: (itemId: string) => void;
  onReject: (itemId: string) => void;
}) {
  const binder = readVisualCanonBinder(project);
  const approved = approvedVisualCanon(project);

  return (
    <section className="editor-page visual-canon-binder" aria-label="Visual Canon Binder">
      <header className="section-heading">
        <div>
          <span className="eyebrow">Visual Canon Binder</span>
          <h2>Approve the visual facts that define this storyworld.</h2>
          <p>Proposals remain separate from canon until you explicitly approve them. Superseded and rejected items stay visible as history.</p>
        </div>
        <div className="canon-summary" aria-label="Visual canon summary">
          <strong>{approved.length}</strong>
          <span>approved visual facts</span>
        </div>
      </header>

      <div className="canon-status-key" aria-label="Canon status legend">
        <span>Proposed</span>
        <span>Approved</span>
        <span>Superseded</span>
        <span>Rejected</span>
      </div>

      <div className="canon-grid">
        {binder.items.length ? binder.items.map((item) => (
          <CanonCard key={item.id} item={item} onApprove={onApprove} onReject={onReject} />
        )) : (
          <div className="empty-state">
            <p>No visual canon proposals yet. Shortlist a candidate or reference, then propose the identity, location, prop, wardrobe, palette, style or composition fact you want to preserve.</p>
          </div>
        )}
      </div>

      <p className="field-help">The binder is stored in the PPF project and remains readable with AI disabled. Provider availability never changes canon state.</p>
    </section>
  );
}

function CanonCard({
  item,
  onApprove,
  onReject,
}: {
  item: VisualCanonItem;
  onApprove: (itemId: string) => void;
  onReject: (itemId: string) => void;
}) {
  const canDecide = item.status === "proposed";
  return (
    <article className={`canon-card canon-card-${item.status}`} tabIndex={0} aria-label={`${item.title}, ${item.status}`}>
      <div className="canon-card-heading">
        <div>
          <span className="eyebrow">{item.kind.replaceAll("-", " ")}</span>
          <h3>{item.title}</h3>
        </div>
        <span className="canon-status">{item.status}</span>
      </div>
      <p>{item.description || "No description added."}</p>
      <dl className="canon-meta">
        <div><dt>Target</dt><dd>{item.target.label}</dd></div>
        <div><dt>Source</dt><dd>{item.source.label || item.source.candidateId || item.source.referenceId || "Manual proposal"}</dd></div>
      </dl>
      {item.supersedesItemId ? <p className="field-help">Supersedes {item.supersedesItemId}</p> : null}
      {item.supersededByItemId ? <p className="field-help">Superseded by {item.supersededByItemId}</p> : null}
      {item.decisions.length ? (
        <details>
          <summary>Decision history</summary>
          <ul>
            {item.decisions.map((entry) => (
              <li key={entry.id}>{entry.action} · {entry.decidedBy || "Writer"}{entry.note ? ` · ${entry.note}` : ""}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {canDecide ? (
        <div className="canon-actions">
          <button type="button" className="small-button" onClick={() => onApprove(item.id)}>Approve as canon</button>
          <button type="button" className="text-button" onClick={() => onReject(item.id)}>Reject</button>
        </div>
      ) : null}
    </article>
  );
}
