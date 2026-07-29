"use client";

import { useMemo, useState } from "react";
import type { PlotPickleProject, RevisionColour, ScreenplayDraftElement } from "@/lib/project";
import {
  addProductionAnnotation,
  closeProductionRevision,
  convertToProductionDraft,
  lockProductionPagination,
  productionDraftHtml,
  productionDraftReport,
  productionPageLabel,
  productionSceneLabel,
  startProductionRevision,
} from "@/lib/production-draft";
import styles from "./script-workspace.module.css";

type Props = {
  project: PlotPickleProject;
  selected?: ScreenplayDraftElement;
  onProjectChange: (project: PlotPickleProject) => void;
};

const revisionColours: Array<Exclude<RevisionColour, "none">> = [
  "blue", "pink", "yellow", "green", "goldenrod", "buff", "salmon", "cherry", "tan", "gray",
];

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "screenplay";
}

function download(name: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: "text/html" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function printHtml(contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: "text/html" }));
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function ProductionDraftPanel({ project, selected, onProjectChange }: Props) {
  const [authorizedBy, setAuthorizedBy] = useState("Project owner");
  const [revisionLabel, setRevisionLabel] = useState("");
  const [revisionColour, setRevisionColour] = useState<Exclude<RevisionColour, "none">>("blue");
  const [revisionMarks, setRevisionMarks] = useState("*");
  const [annotationDepartment, setAnnotationDepartment] = useState("");
  const [annotationBody, setAnnotationBody] = useState("");
  const report = useMemo(() => productionDraftReport(project), [project]);
  const productionDraft = project.screenplay.productionDraft;
  const activeRevision = productionDraft.revisionSets.find((revision) => revision.id === productionDraft.activeRevisionSetId);
  const selectedPage = selected ? productionPageLabel(project.screenplay, selected.id) : "";
  const selectedScene = selected ? productionSceneLabel(project.screenplay, selected) : "";

  function convert() {
    if (!project.screenplay.draftElements.length) return;
    if (!window.confirm("Convert this writer draft into a production draft? PlotPickle will create a recoverable writer-draft snapshot before adding production numbering.")) return;
    onProjectChange(convertToProductionDraft(project, authorizedBy));
  }

  function beginRevision() {
    onProjectChange(startProductionRevision(project, {
      label: revisionLabel,
      colour: revisionColour,
      marks: revisionMarks,
      authorizedBy,
    }));
    setRevisionLabel("");
  }

  function saveAnnotation() {
    if (!selected) return;
    onProjectChange(addProductionAnnotation(project, {
      targetType: "screenplay-element",
      targetId: selected.id,
      department: annotationDepartment,
      body: annotationBody,
      author: authorizedBy,
    }));
    setAnnotationBody("");
  }

  if (report.mode === "writer") {
    return (
      <section className={styles.productionDraftPanel}>
        <div>
          <span>Shooting Script</span>
          <h2>Keep the writer draft flexible until production is ready.</h2>
          <p>Conversion creates a recoverable baseline, then enables scene numbering, locked pagination, revision sets, changed pages and production annotations.</p>
        </div>
        <label>Authorized by<input value={authorizedBy} onChange={(event) => setAuthorizedBy(event.target.value)} /></label>
        <button type="button" onClick={convert} disabled={!project.screenplay.draftElements.length}>Convert to production draft</button>
      </section>
    );
  }

  return (
    <section className={styles.productionDraftPanel}>
      <header>
        <div><span>Shooting Script</span><h2>Production draft</h2><p>Writer baseline preserved · every production action remains traceable.</p></div>
        <div className={styles.productionMetrics}>
          <b>{report.paginationLocked ? `${report.pages} locked pages` : "Pagination unlocked"}</b>
          <b>{report.scenes} numbered scenes</b>
          <b>{report.revisionSets} revision sets</b>
          <b>{report.annotations} annotations</b>
        </div>
      </header>

      <div className={styles.productionActions}>
        <label>Authorized by<input value={authorizedBy} onChange={(event) => setAuthorizedBy(event.target.value)} /></label>
        {!report.paginationLocked
          ? <button type="button" onClick={() => onProjectChange(lockProductionPagination(project, authorizedBy))}>Lock pagination</button>
          : <button type="button" onClick={() => printHtml(productionDraftHtml(project))}>Print / PDF production draft</button>}
        <button type="button" onClick={() => download(`${slug(project.metadata.title)}-production-draft.html`, productionDraftHtml(project))}>Export production draft</button>
        <button type="button" onClick={() => download(`${slug(project.metadata.title)}-changed-pages.html`, productionDraftHtml(project, true))} disabled={!report.changedPages}>Export changed pages</button>
      </div>

      <div className={styles.productionGrid}>
        <div>
          <h3>{activeRevision ? activeRevision.label : "Begin a revision set"}</h3>
          {activeRevision ? (
            <>
              <p>{activeRevision.colour} · {activeRevision.date} · mark {activeRevision.marks} · {activeRevision.changedPageLabels.length} changed page(s)</p>
              <button type="button" onClick={() => onProjectChange(closeProductionRevision(project, authorizedBy))}>Close revision set</button>
            </>
          ) : (
            <div className={styles.revisionForm}>
              <label>Revision name<input value={revisionLabel} onChange={(event) => setRevisionLabel(event.target.value)} placeholder="Blue revision" /></label>
              <label>Colour<select value={revisionColour} onChange={(event) => setRevisionColour(event.target.value as Exclude<RevisionColour, "none">)}>{revisionColours.map((colour) => <option key={colour}>{colour}</option>)}</select></label>
              <label>Revision mark<input value={revisionMarks} onChange={(event) => setRevisionMarks(event.target.value)} /></label>
              <button type="button" onClick={beginRevision}>Start revision set</button>
            </div>
          )}
        </div>

        <div>
          <h3>Selected screenplay element</h3>
          {selected ? (
            <>
              <p>Scene {selectedScene} · Page {selectedPage || "unlocked"} · {selected.revisionColour === "none" ? "No revision mark" : `${selected.revisionColour} revision`}</p>
              <div className={styles.revisionForm}>
                <label>Department<input value={annotationDepartment} onChange={(event) => setAnnotationDepartment(event.target.value)} placeholder="Director, Camera, Art…" /></label>
                <label>Production annotation<textarea value={annotationBody} onChange={(event) => setAnnotationBody(event.target.value)} rows={3} /></label>
                <button type="button" onClick={saveAnnotation} disabled={!annotationBody.trim()}>Attach annotation</button>
              </div>
            </>
          ) : <p>Select a screenplay element to see its locked page, production scene number and annotations.</p>}
        </div>
      </div>

      {productionDraft.approvalHistory.length ? (
        <details className={styles.productionHistory}>
          <summary>Revision and approval history ({productionDraft.approvalHistory.length})</summary>
          <ol>{productionDraft.approvalHistory.slice().reverse().map((item) => <li key={item.id}><strong>{item.summary}</strong><span>{item.authorizedBy} · {item.createdAt}</span></li>)}</ol>
        </details>
      ) : null}
    </section>
  );
}
