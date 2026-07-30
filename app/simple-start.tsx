"use client";

import type { PlotPickleProject } from "@/lib/project";

export default function SimpleStart({
  project,
  onContinue,
  onNew,
  onLearn,
  onImport,
  onAfterglow,
}: {
  project: PlotPickleProject;
  onContinue: () => void;
  onNew: () => void;
  onLearn: () => void;
  onImport: () => void;
  onAfterglow: () => void;
}) {
  return (
    <div className="editor-page simple-start-page">
      <div className="guide-hero">
        <div>
          <p className="eyebrow">SS · Simple Start</p>
          <h1>Choose a clear way into the story.</h1>
          <p>Simple Start is always available for beginners, but it never blocks a returning writer from opening the main workspace.</p>
        </div>
        <div className="guide-number" aria-hidden="true"><span>SS</span><small>Optional</small></div>
      </div>
      <div className="guide-grid simple-start-grid">
        <article className="guide-card">
          <p className="eyebrow">Continue</p>
          <h2>{project.metadata.title || "Untitled screenplay"}</h2>
          <p>Return to the project overview and continue from the current loaded project.</p>
          <button type="button" className="primary-button" onClick={onContinue}>Open project dashboard</button>
        </article>
        <article className="guide-card">
          <p className="eyebrow">Begin</p>
          <h2>Start a new screenplay</h2>
          <p>Create a blank project and begin with Story Setup.</p>
          <button type="button" className="secondary-button" onClick={onNew}>Create blank project</button>
        </article>
        <article className="guide-card">
          <p className="eyebrow">Bring your work</p>
          <h2>Import a screenplay</h2>
          <p>Load PlotPickle JSON, Final Draft, Fountain, SPMD or plain text.</p>
          <button type="button" className="secondary-button" onClick={onImport}>Choose a file</button>
        </article>
        <article className="guide-card">
          <p className="eyebrow">Learn</p>
          <h2>Open Read &amp; Learn</h2>
          <p>Use the complete learning library and screenplay terminology.</p>
          <button type="button" className="secondary-button" onClick={onLearn}>Open learning studio</button>
        </article>
        <article className="guide-card">
          <p className="eyebrow">Example</p>
          <h2>Explore the bundled example project</h2>
          <p>Load the complete demonstration across planning, screenplay and visuals.</p>
          <button type="button" className="secondary-button" onClick={onAfterglow}>Load example project</button>
        </article>
      </div>
    </div>
  );
}
