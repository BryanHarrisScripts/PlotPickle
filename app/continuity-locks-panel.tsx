"use client";

import type { PlotPickleProject } from "@/lib/project";
import { continuityWarnings, effectiveContinuityLocks, type ContinuityTarget } from "@/lib/continuity-locks";

export default function ContinuityLocksPanel({ project, target }: { project: PlotPickleProject; target: ContinuityTarget }) {
  const locks = effectiveContinuityLocks(project, target);
  const warnings = continuityWarnings(project, target);

  return (
    <section className="form-section continuity-locks-panel" aria-label="Continuity locks">
      <div className="subsection-title">
        <div>
          <span>Continuity locks</span>
          <p className="field-help">Approved visual facts inherit by scope. Override only when the story needs a deliberate exception.</p>
        </div>
      </div>

      {warnings.length ? (
        <div className="continuity-warning" role="alert">
          <strong>Review before generation</strong>
          <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </div>
      ) : null}

      <div className="continuity-lock-list">
        {locks.length ? locks.map((lock) => (
          <article className="continuity-lock-card" key={lock.id} tabIndex={0}>
            <div>
              <span className="eyebrow">{lock.kind}</span>
              <strong>{lock.effectiveValue || "No value recorded"}</strong>
            </div>
            <small>{lock.scope.label}</small>
            {lock.override ? <span className="continuity-override-label">Scoped override</span> : <span>Inherited</span>}
            {lock.warning ? <p>{lock.warning}</p> : null}
          </article>
        )) : <p>No active continuity locks apply to this target.</p>}
      </div>

      <p className="field-help">Unlocking or changing a rule affects future context only. Previously approved assets and canon history are never rewritten.</p>
    </section>
  );
}
