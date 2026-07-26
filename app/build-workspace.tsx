"use client";

import StructureMapSummary from "./structure-map-summary";
import type { PlotPickleProject } from "@/lib/project";

export default function BuildWorkspace({ project, onOpenBlock }: { project: PlotPickleProject; onOpenBlock: (number: number) => void }) {
  const sceneCount = project.blocks.reduce((total, block) => total + block.scenes.length, 0);
  const miniBlockCount = project.blocks.reduce((total, block) => total + block.miniBlocks.length, 0);

  return (
    <div className="dashboard-shell build-workspace">
      <aside className="workspace-subnav" aria-label="Build sections">
        <p className="eyebrow">Build</p>
        <strong>Arrange the film</strong>
        <a href="#build-map">Structure map</a>
        <a href="#build-blocks">24 Blocks</a>
        <a href="#build-scenes">Scenes and mini-blocks</a>
        <div className="method-note">
          <span>Canonical project</span>
          <strong>{project.blocks.length} Blocks · {sceneCount} scenes · {miniBlockCount} mini-blocks</strong>
          <p>Build edits the same structure used by Plan, Write, Storyboard, Feedback and Reports.</p>
        </div>
      </aside>
      <section className="dashboard-main" id="build-map">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Whole-film construction</p>
            <h1>Build the story from acts to scenes without duplicating the project.</h1>
            <p>Review the complete hierarchy, then open a Block in the existing canonical editor. Scene movement and detailed card tools continue to reuse the Structure Engine foundations.</p>
          </div>
        </div>
        <StructureMapSummary project={project} onOpenBlock={onOpenBlock} />
        <section className="guide-grid" id="build-blocks">
          <article className="guide-card"><p className="eyebrow">24 Blocks</p><h2>{project.blocks.length} canonical story movements</h2><p>Every Block keeps its stable ID, screenplay links, visuals, scenes, mini-blocks and feedback targets.</p></article>
          <article className="guide-card" id="build-scenes"><p className="eyebrow">Flexible scenes</p><h2>{sceneCount} current scenes</h2><p>The live scene count belongs to the story; forty-eight remains only a starting template.</p></article>
          <article className="guide-card"><p className="eyebrow">96 positions</p><h2>{miniBlockCount} current mini-block records</h2><p>Mini-blocks remain connected to treatment, screenplay, visual frames and diagnostics.</p></article>
        </section>
      </section>
    </div>
  );
}
