"use client";

import type { PlotPickleProject } from "@/lib/project";
import { effectiveCreativeMemory, historicalCreativeMemory, type CreativeMemoryTarget } from "@/lib/creative-memory";

export default function CreativeMemory({ project, target }: { project: PlotPickleProject; target?: CreativeMemoryTarget }) {
  const active = effectiveCreativeMemory(project, target);
  const historical = historicalCreativeMemory(project);
  return (
    <section className="editor-page creative-memory" aria-label="Creative memory">
      <header className="section-heading">
        <div>
          <span className="eyebrow">Creative Memory</span>
          <h2>Remember why the story looks and works this way.</h2>
          <p>PlotPickle follows current creative decisions and their lineage rather than recycling old prompts.</p>
        </div>
      </header>
      <section className="form-section">
        <h3>Effective decisions{target ? ` · ${target.label}` : ""}</h3>
        {active.length ? <div className="candidate-grid">{active.map((node) => (
          <article className="candidate-card" key={node.id} tabIndex={0}>
            <span className="eyebrow">{node.kind}</span>
            <strong>{node.target.label}</strong>
            <p>{node.summary || "Decision recorded"}</p>
            <small>{node.sourceIds.length ? `Sources: ${node.sourceIds.join(", ")}` : "Project decision"}</small>
          </article>
        ))}</div> : <p>No active creative decisions apply to this target yet.</p>}
      </section>
      <details className="form-section">
        <summary>Historical and superseded decisions</summary>
        {historical.length ? <ul>{historical.map((node) => <li key={node.id}><strong>{node.kind}</strong> · {node.target.label} · {node.summary}</li>)}</ul> : <p>No historical decisions yet.</p>}
      </details>
      <p className="field-help">Creative memory is derived from portable project data. Credentials, provider configuration and unrelated private content are excluded.</p>
    </section>
  );
}
