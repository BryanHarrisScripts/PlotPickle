"use client";

import type { PlotPickleProject } from "@/lib/project";
import { buildGraphicNovelExport, readGraphicNovelPackage, type GraphicNovelPanel } from "@/lib/graphic-novel-composition";

export default function GraphicNovelComposition({
  project,
  onReplacePanel,
  onApprovePanel,
}: {
  project: PlotPickleProject;
  onReplacePanel: (panel: GraphicNovelPanel) => void;
  onApprovePanel: (panelId: string) => void;
}) {
  const pkg = readGraphicNovelPackage(project);
  const exportPackage = buildGraphicNovelExport(project);

  return (
    <section className="editor-page graphic-novel-composition" aria-label="Graphic Novel composition">
      <header className="section-heading">
        <div>
          <span className="eyebrow">Graphic Novel</span>
          <h2>Compose the story from approved and shortlisted visual decisions.</h2>
          <p>Panels remain connected to their story moment, candidate lineage, dialogue, framing and continuity instead of becoming unrelated image generations.</p>
        </div>
        <div className="canon-summary">
          <strong>{pkg.pages.length}</strong>
          <span>pages</span>
        </div>
      </header>

      {exportPackage.unresolvedPanels.length ? (
        <div className="continuity-warning" role="status">
          <strong>{exportPackage.unresolvedPanels.length} unresolved panels</strong>
          <p>Export will include only the current approved package and will report these unresolved story moments.</p>
        </div>
      ) : null}

      <div className="graphic-page-list">
        {pkg.pages.length ? pkg.pages.sort((a, b) => a.number - b.number).map((page) => (
          <section key={page.id} className={`graphic-page graphic-page-${page.layout}`} aria-label={`Page ${page.number}`}>
            <header><strong>Page {page.number}</strong><span>{page.layout} layout</span></header>
            <div className="graphic-panel-grid">
              {page.panelIds.map((panelId) => {
                const panel = pkg.panels.find((entry) => entry.id === panelId && entry.status !== "replaced");
                if (!panel) return <div className="graphic-panel unresolved" key={panelId}>Unresolved panel</div>;
                return (
                  <article key={panel.id} className={`graphic-panel graphic-panel-${panel.status}`} tabIndex={0}>
                    <span className="eyebrow">{panel.target.label}</span>
                    <strong>{panel.caption || "Panel"}</strong>
                    {panel.dialogue ? <p>{panel.dialogue}</p> : null}
                    <small>{panel.framing || "Framing not set"}</small>
                    <small>{panel.sourceCandidateIds.length} source candidate{panel.sourceCandidateIds.length === 1 ? "" : "s"}</small>
                    {panel.status !== "approved" ? <button type="button" className="small-button" onClick={() => onApprovePanel(panel.id)}>Approve panel</button> : null}
                    <button type="button" className="text-button" onClick={() => onReplacePanel(panel)}>Replace panel</button>
                  </article>
                );
              })}
            </div>
          </section>
        )) : <div className="empty-state"><p>No Graphic Novel pages yet. Add approved or shortlisted scene panels from the connected Storyboard flow.</p></div>}
      </div>

      <p className="field-help">Page reflow changes composition only. It does not alter story canon, panel lineage, dialogue or visual approval history.</p>
    </section>
  );
}
