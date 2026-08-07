"use client";

import type { PlotPickleProject } from "@/lib/project";
import {
  buildVisualWritingSession,
  type VisualWritingSessionState,
  type VisualWritingTarget,
} from "@/lib/visual-writing-session";

export default function VisualWritingSession({
  project,
  target,
  onSave,
  onExplore,
}: {
  project: PlotPickleProject;
  target: VisualWritingTarget;
  onSave: (state: VisualWritingSessionState) => void;
  onExplore?: (target: VisualWritingTarget) => void;
}) {
  const session = buildVisualWritingSession(project, target);
  const { context, state } = session;

  const save = (key: "textNotes" | "visualDirection", value: string) => {
    onSave({ ...state, [key]: value, updatedAt: new Date().toISOString() });
  };

  return (
    <section className="editor-page visual-writing-session" aria-label="Visual writing session">
      <header className="section-heading">
        <div>
          <span className="eyebrow">Visual Writing Session</span>
          <h2>{target.label}</h2>
          <p>Develop story action, emotion and staging without leaving this story moment. Text notes and visual candidates stay linked to the same target.</p>
        </div>
        {onExplore ? <button type="button" className="small-button" onClick={() => onExplore(target)}>Explore candidates</button> : null}
      </header>

      <div className="form-grid two-columns">
        <section className="form-section">
          <h3>Story purpose</h3>
          {context.block ? <p>{context.block.purpose || context.block.summary}</p> : null}
          {context.scene ? <p>{context.scene.purpose || context.scene.objective}</p> : null}
          {context.miniBlock ? <p>{context.miniBlock.purpose || context.miniBlock.objective}</p> : null}
          <dl className="canon-meta">
            <div><dt>Characters</dt><dd>{context.characters.map((character) => character.name).join(", ") || "None attached"}</dd></div>
            <div><dt>Locations</dt><dd>{context.locations.map((location) => location.name).join(", ") || "None attached"}</dd></div>
            <div><dt>Action</dt><dd>{context.scene?.action || context.block?.action || context.miniBlock?.action || "Not set"}</dd></div>
            <div><dt>Emotional turn</dt><dd>{context.block?.emotionalTurn || context.scene?.turn || context.miniBlock?.turn || "Not set"}</dd></div>
          </dl>
        </section>

        <section className="form-section">
          <h3>Current visual canon</h3>
          {session.approvedCanon.length ? session.approvedCanon.map((item) => (
            <article className="canon-card canon-card-approved" key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </article>
          )) : <p>No approved visual canon applies yet.</p>}
          {context.continuityWarnings.length ? (
            <div className="continuity-warning" role="alert">
              <strong>Continuity review</strong>
              <ul>{context.continuityWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          ) : null}
        </section>
      </div>

      <section className="form-section">
        <h3>Write and direct together</h3>
        <div className="form-grid two-columns">
          <label className="form-field">
            <span className="field-label">Story notes</span>
            <span className="field-help">Changes or discoveries you may later apply to the story. Nothing rewrites canon automatically.</span>
            <textarea value={state.textNotes} onChange={(event) => save("textNotes", event.target.value)} />
          </label>
          <label className="form-field">
            <span className="field-label">Visual direction</span>
            <span className="field-help">Staging, camera, mood, movement, light, composition or other direction for this exact story moment.</span>
            <textarea value={state.visualDirection} onChange={(event) => save("visualDirection", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h3>Connected candidates</h3>
        {session.candidates.length ? (
          <div className="candidate-grid">
            {session.candidates.map((candidate) => (
              <article key={candidate.id} className="candidate-card" tabIndex={0}>
                <strong>{candidate.mediaType} candidate</strong>
                <span>{candidate.status}</span>
                <p>{candidate.directionSummary || candidate.payload.text || candidate.payload.assetRef || "Visual candidate"}</p>
              </article>
            ))}
          </div>
        ) : <p>No candidates yet. You can continue writing manually or explore visual options without leaving this session.</p>}
      </section>

      <p className="field-help">This session is stored against {target.kind} {target.id}; navigating away and back resumes the same notes, selected candidates and approved outputs.</p>
    </section>
  );
}
