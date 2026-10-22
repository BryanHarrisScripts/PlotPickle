"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { LibraryPPFProject } from "@/core/storage/library-project";
import { CONSOLIDATED_REPORT_SECTIONS, type ConsolidatedReportSection } from "@/lib/consolidated-reports";
import { summarizeLibraryPpfReport } from "@/modules/reports/model/library-ppf-report.mjs";
import { observeHollywoodProductionReadiness } from "@/modules/intent/model/hollywood-production-readiness";
import styles from "./library-ppf-reports-workspace.module.css";

type Props = {
  readonly project: LibraryPPFProject | null;
  readonly selectedId: string | null;
  readonly authorizedProfileId: string | null;
  readonly checked: boolean;
  readonly section: ConsolidatedReportSection;
  readonly onSectionChange: (value: ConsolidatedReportSection) => void;
  readonly onRefresh: () => void;
};

function Statistic({ label, value, detail }: { readonly label: string; readonly value: string | number; readonly detail?: string }) {
  return <article className={styles.stat}>
    <span>{label}</span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}
  </article>;
}
function Unavailable({ children }: { readonly children: string }) {
  return <p className={styles.unavailable} data-reports-evidence="unavailable">
    <strong>Not verified from the active Library PPF.</strong> {children}
  </p>;
}

export default function LibraryPpfReportsWorkspace({ project, selectedId, authorizedProfileId, checked, section, onSectionChange, onRefresh }: Props) {
  const router = useRouter();
  const report = useMemo(() => project ? summarizeLibraryPpfReport(project) : null, [project]);
  const source = report?.imported;
  const readiness = useMemo(() => project && selectedId && authorizedProfileId
    ? observeHollywoodProductionReadiness({
      capability: "project-status.observe",
      profileId: authorizedProfileId,
      projectId: selectedId,
      projectRevision: project.revision,
      providerPolicy: "LOCAL_READ_ONLY",
    }, { activeProfileId: authorizedProfileId, activeProject: project })
    : null, [project, selectedId, authorizedProfileId]);
  return <section className={styles.workspace} aria-label="Library PPF Reports" data-reports-authority="active-library-ppf">
    <header className={styles.header}>
      <div><small>EXPLORE / REPORTS · READ ONLY</small><h1>Reports</h1><p>Evidence from the selected Human Library story—not a separate Reports database.</p></div>
      <nav className={styles.actions} aria-label="Reports navigation">
        <button type="button" onClick={() => router.push("/skin-v1")}>Back to Dashboard</button>
        <button type="button" onClick={() => router.push("/library")}>Library</button>
        <button type="button" onClick={onRefresh}>Reload Reports</button>
        <button type="button" onClick={onRefresh}>Refresh Library selection</button>
      </nav>
    </header>
    {!checked ? <p role="status">Checking the current Library selection…</p>
      : !project || !report ? <div className={styles.empty} role="status" data-reports-state="no-active-library-story">
          <h2>{selectedId ? "Selected story is unavailable" : "No active Library story selected"}</h2>
          <p>{selectedId ? "Reports could not verify the selected Library PPF story. No legacy project or placeholder has been substituted." : "Select a saved story in Library to see its verified Reports. No blank legacy project has been substituted."}</p>
          <p>Return to Dashboard → Library to select a story, then reopen or refresh Reports.</p>
        </div>
      : <>
        <div className={styles.identity} data-reports-active-project-id={report.id}>
          <span>ACTIVE LIBRARY STORY</span><strong>{report.title}</strong>
          <small>Project ID: {report.id} · PPF revision {report.revision}{report.updatedAt ? ` · Last project update ${report.updatedAt}` : ""}</small>
        </div>
        <nav className={styles.tabs} aria-label="Reports sections">
          {CONSOLIDATED_REPORT_SECTIONS.map(item =>
            <button type="button" key={item.id} aria-current={section === item.id ? "page" : undefined}
              onClick={() => onSectionChange(item.id)}>{item.label}</button>
          )}
        </nav>
        <div className={styles.body} data-reports-section={section}>
          {section === "project" ? <>
            <h2>Current project evidence</h2>
            <div className={styles.statGrid}>
              <Statistic label="Project revision" value={report.revision} detail="PPF record revision; not film completion" />
              <Statistic label="Structured Blocks" value={report.structure.blocks} detail="Structural addresses, not finished scenes" />
              <Statistic label="Structured Mini-Blocks" value={report.structure.miniBlocks} detail="Structural addresses, not generated footage" />
              <Statistic label="Mini-Blocks with working text" value={report.writing.miniBlocksWithText} />
              <Statistic label="Accepted development fields" value={report.development.acceptedFields} />
              <Statistic label="Unaccepted Agent proposals" value={report.development.unacceptedProposals} detail="These do not count as accepted canon" />
            </div>
            <Unavailable>{report.unavailable.runtime}</Unavailable>
          </> : null}
          {section === "story" ? <>
            <h2>Story structure and acceptance</h2>
            <div className={styles.statGrid}>
              <Statistic label="Structured Acts" value={report.structure.acts} />
              <Statistic label="Blocks" value={report.structure.blocks} />
              <Statistic label="Mini-Blocks" value={report.structure.miniBlocks} />
              <Statistic label="Mini-Blocks with accepted Plan stage" value={report.structure.planAccepted} detail="Stored acceptance timestamp only" />
              <Statistic label="Mini-Blocks with accepted Storyboard stage" value={report.structure.storyboardAccepted} detail="Not verified locked image or playable video" />
              <Statistic label="Authored Block notes/titles" value={report.structure.authoredBlocks} />
            </div>
            <Unavailable>{report.unavailable.runtime}</Unavailable>
          </> : null}
          {section === "characters" ? <>
            <h2>Character evidence</h2>
            <div className={styles.statGrid}><Statistic label="Approved writer-reference claims" value={report.characters.approvedReferenceClaims} detail="Claims, not distinct characters" /></div>
            <Unavailable>{report.unavailable.characters}</Unavailable>
          </> : null}
          {section === "scenes" ? <>
            <h2>Imported scene references</h2>
            <div className={styles.statGrid}><Statistic label="Distinct retained scene references" value={report.importedEvidence.knownSceneReferences} detail="Only evidence retained in this PPF" /></div>
            <Unavailable>{report.unavailable.scenes}</Unavailable>
          </> : null}
          {section === "dialogue" ? <>
            <h2>Imported dialogue evidence</h2>
            <div className={styles.statGrid}><Statistic label="Retained dialogue passages" value={report.importedEvidence.dialoguePassages} detail="Not a complete source dialogue census" /></div>
            <Unavailable>{report.unavailable.dialogue}</Unavailable>
          </> : null}
          {section === "production" ? <>
            <h2>Hollywood production readiness · 10 stages</h2>
            <p>Derived from the selected PPF revision only. OBSERVED means retained project metadata, not a completed or independently verified film stage.</p>
            {!readiness ? <Unavailable>Unlock the current Human profile and select a saved Library project before observing production evidence.</Unavailable>
              : readiness.state !== "OBSERVED" ? <p role="status" data-production-readiness-state="BLOCKED">
                Observation blocked: {readiness.code}. No project or revision fallback was used.
              </p> : <>
                <p data-production-readiness-state="OBSERVED" data-production-readiness-project={readiness.project?.id}>
                  Observed Library revision {readiness.project?.revision}. Source coverage is partial or unverified; film readiness is not certified.
                </p>
                <div className={styles.statGrid} data-hollywood-stage-count={readiness.stages.length}>
                  {readiness.stages.map((stage, index) => <article className={styles.stat} key={stage.id}
                    data-hollywood-stage={stage.id} data-hollywood-stage-state={stage.state}>
                    <span>STAGE {index + 1}</span>
                    <strong>{stage.label}</strong>
                    <small>{stage.state === "OBSERVED" ? "Observed PPF metadata only" : "Insufficient evidence"}</small>
                    {stage.evidence.map((item) => <small key={item.source}>{item.count} retained records · {item.source}</small>)}
                    <small>{stage.limitation}</small>
                    {stage.editorLink ? <a href={stage.editorLink}>Open existing editor</a> : null}
                  </article>)}
                </div>
                <p role="status">Next Human decision: {readiness.nextDecision?.kind === "REVIEW_BLOCK_SOURCE_EVIDENCE"
                  ? `Review source support for Block ${readiness.nextDecision.blockNumber} in Outline.`
                  : "Review the source baseline and production plan."} No Save &amp; Lock, paid generation or release is authorized.</p>
              </>}
            <Unavailable>{report.unavailable.production}</Unavailable>
          </> : null}
          {section === "feedback" ? <><h2>Feedback evidence</h2><Unavailable>{report.unavailable.feedback}</Unavailable></> : null}
          {section === "connections" ? <><h2>Connection evidence</h2><Unavailable>{report.unavailable.connections}</Unavailable></> : null}
          {section === "provenance" ? <>
            <h2>Imported screenplay and project provenance</h2>
            {source ? <>
              <dl className={styles.details}>
                <div><dt>Source file</dt><dd>{source.name}</dd></div>
                <div><dt>Source format</dt><dd>{source.format}</dd></div>
                <div><dt>Reported source passages</dt><dd>{source.reportedPassages}</dd></div>
                <div><dt>Retained source passages</dt><dd>{source.retainedPassages}</dd></div>
                <div><dt>Source coverage</dt><dd>{source.truncated ? "Partial / truncated — do not infer complete counts" : "No truncation reported in saved evidence"}</dd></div>
              </dl>
              {source.truncated ? <Unavailable>Only retained passages are counted in scene and dialogue cards.</Unavailable> : null}
            </> : <Unavailable>This Library project has no recorded imported screenplay evidence. A missing source is not evidence of an empty movie.</Unavailable>}
            <p>Reports never changes imported source, accepted decisions or the active story.</p>
          </> : null}
        </div>
      </>}
  </section>;
}
