"use client";

import type { PlotPickleProject } from "@/lib/project";
import {
  buildWorldLookBrief,
  WORLD_LOOK_DIMENSIONS,
  type WorldLookDraft,
} from "@/lib/world-look-development";

export default function WorldLookDevelopment({
  project,
  locationId,
  onSaveDraft,
  onExplore,
}: {
  project: PlotPickleProject;
  locationId: string;
  onSaveDraft: (draft: WorldLookDraft) => void;
  onExplore?: (locationId: string) => void;
}) {
  const brief = buildWorldLookBrief(project, locationId);
  if (!brief) return <section className="empty-state"><p>Select a location to develop its visual language.</p></section>;

  const saveDimension = (dimension: (typeof WORLD_LOOK_DIMENSIONS)[number], value: string) => {
    onSaveDraft({
      locationId,
      dimensions: { ...brief.dimensions, [dimension]: value },
      proposalNotes: "",
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <section className="editor-page world-look-development" aria-label="World and Location Look Development">
      <header className="section-heading">
        <div>
          <span className="eyebrow">World and Location Look Development</span>
          <h2>{brief.location.name || "Unnamed location"}</h2>
          <p>Discover the environmental language visually without silently rewriting the world bible. Manual references remain a complete path.</p>
        </div>
        {onExplore ? <button type="button" className="small-button" onClick={() => onExplore(locationId)}>Explore world looks</button> : null}
      </header>

      <div className="form-grid two-columns">
        <section className="form-section">
          <h3>World foundation</h3>
          <dl className="canon-meta">
            <div><dt>Location</dt><dd>{brief.location.description || "Not set"}</dd></div>
            <div><dt>Period</dt><dd>{brief.world.period || "Not set"}</dd></div>
            <div><dt>Culture</dt><dd>{brief.world.cultures || "Not set"}</dd></div>
            <div><dt>Technology</dt><dd>{brief.world.technology || "Not set"}</dd></div>
            <div><dt>Rules</dt><dd>{brief.world.rules || "Not set"}</dd></div>
            <div><dt>Visual language</dt><dd>{brief.world.visualLanguage || "Not set"}</dd></div>
          </dl>
        </section>

        <section className="form-section">
          <h3>Approved world canon</h3>
          {brief.approvedCanon.length ? brief.approvedCanon.map((item) => (
            <article key={item.id} className="canon-card canon-card-approved">
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </article>
          )) : <p>No approved environmental visual canon yet. Exploration remains proposed until approved in the Visual Canon Binder.</p>}
        </section>
      </div>

      <section className="form-section">
        <h3>Develop the environment</h3>
        <div className="form-grid two-columns">
          {WORLD_LOOK_DIMENSIONS.map((dimension) => (
            <label className="form-field" key={dimension}>
              <span className="field-label">{dimension}</span>
              <textarea value={brief.dimensions[dimension]} onChange={(event) => saveDimension(dimension, event.target.value)} />
            </label>
          ))}
        </div>
        <p className="field-help">These are visual proposals only. They do not overwrite period, culture, technology, history, rules or other world text.</p>
      </section>

      <section className="form-section">
        <h3>References</h3>
        {brief.references.length ? (
          <div className="reference-roster">
            {brief.references.map((reference) => (
              <article key={reference.id}>
                <strong>{reference.title || "Untitled reference"}</strong>
                <span>{reference.purpose} · {reference.rightsStatus}</span>
                <small>{reference.notes || reference.permittedUse}</small>
              </article>
            ))}
          </div>
        ) : <p>No references attached yet. Add manual references or continue without any AI provider configured.</p>}
      </section>

      <section className="form-section">
        <h3>Reusable location context</h3>
        {brief.continuity.length ? (
          <ul>{brief.continuity.map((lock) => <li key={lock.id}>{lock.kind}: {lock.effectiveValue}</li>)}</ul>
        ) : <p>No inherited continuity locks yet.</p>}
        <p className="field-help">Approved location and world visual language is available to later scene generation, Storyboard and Graphic Novel across local, cloud and no-AI paths.</p>
      </section>
    </section>
  );
}
