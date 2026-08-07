"use client";

import type { PlotPickleProject } from "@/lib/project";
import {
  buildCharacterLookBrief,
  CHARACTER_LOOK_DIMENSIONS,
  type CharacterLookDraft,
} from "@/lib/character-look-development";

export default function CharacterLookDevelopment({
  project,
  characterId,
  onSaveDraft,
  onExplore,
}: {
  project: PlotPickleProject;
  characterId: string;
  onSaveDraft: (draft: CharacterLookDraft) => void;
  onExplore?: (characterId: string) => void;
}) {
  const brief = buildCharacterLookBrief(project, characterId);
  if (!brief) return <section className="empty-state"><p>Select a character to develop their visual identity.</p></section>;

  const saveDimension = (dimension: (typeof CHARACTER_LOOK_DIMENSIONS)[number], value: string) => {
    onSaveDraft({
      characterId,
      dimensions: { ...brief.dimensions, [dimension]: value },
      notes: "",
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <section className="editor-page character-look-development" aria-label="Character Look Development">
      <header className="section-heading">
        <div>
          <span className="eyebrow">Character Look Development</span>
          <h2>{brief.character.name || "Unnamed character"}</h2>
          <p>Begin with who the character is in the story, then shape the visual identity. AI exploration is optional; manual references remain a complete path.</p>
        </div>
        {onExplore ? <button type="button" className="small-button" onClick={() => onExplore(characterId)}>Explore looks</button> : null}
      </header>

      <div className="form-grid two-columns">
        <section className="form-section">
          <h3>Story foundation</h3>
          <dl className="canon-meta">
            <div><dt>Role</dt><dd>{brief.character.role || "Not set"}</dd></div>
            <div><dt>Description</dt><dd>{brief.character.description || "Not set"}</dd></div>
            <div><dt>Want</dt><dd>{brief.character.want || "Not set"}</dd></div>
            <div><dt>Need</dt><dd>{brief.character.need || "Not set"}</dd></div>
            <div><dt>Arc</dt><dd>{brief.character.arc || "Not set"}</dd></div>
            <div><dt>Voice</dt><dd>{brief.character.voice || "Not set"}</dd></div>
          </dl>
        </section>

        <section className="form-section">
          <h3>Approved identity</h3>
          {brief.approvedIdentity.length ? brief.approvedIdentity.map((item) => (
            <article key={item.id} className="canon-card canon-card-approved">
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </article>
          )) : <p>No approved visual identity yet. References and exploration remain proposals until you approve them in the Visual Canon Binder.</p>}
        </section>
      </div>

      <section className="form-section">
        <h3>Develop the look</h3>
        <div className="form-grid two-columns">
          {CHARACTER_LOOK_DIMENSIONS.map((dimension) => (
            <label className="form-field" key={dimension}>
              <span className="field-label">{dimension.replaceAll("-", " ")}</span>
              <textarea value={brief.dimensions[dimension]} onChange={(event) => saveDimension(dimension, event.target.value)} />
            </label>
          ))}
        </div>
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
        ) : <p>No references attached yet. You can use the workspace entirely with manually added references and no AI provider enabled.</p>}
      </section>

      <section className="form-section">
        <h3>Reusable continuity</h3>
        {brief.continuity.length ? (
          <ul>{brief.continuity.map((lock) => <li key={lock.id}>{lock.kind}: {lock.effectiveValue}</li>)}</ul>
        ) : <p>No inherited continuity locks yet.</p>}
        <p className="field-help">Approved identity and continuity can be reused by scenes, Storyboard and Graphic Novel without regenerating or rewriting prior work.</p>
      </section>
    </section>
  );
}
