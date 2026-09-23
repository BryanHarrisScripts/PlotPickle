"use client";

/* eslint-disable @next/next/no-img-element -- Storyboard references are bundled local assets routed through PlotPickle's local asset boundary. */

import { useEffect, useMemo, useState } from "react";
import { applyStoryCommand } from "@/core/project/apply-command";
import type { PPFProject } from "@/core/project/project";
import { hasQaWorkspaceAccess, isQaAccessOverride } from "@/core/progression/qa-access";
import { saveFoundationProject } from "@/core/storage/foundation-project-browser";
import type { VisualReadinessTarget } from "@/modules/build/visual-readiness";
import {
  createStoryboardReferenceArtifact,
  currentStoryboardArtifactForFrame,
  storyboardAnchorEvidence,
  storyboardAnchorTargetRef,
  storyboardArtifactStaleReasons,
  storyboardReferenceCandidates,
  STORYBOARD_REFERENCE_WORKFLOW,
} from "./storyboard-editorial-model";
import { planCreativeRevisionPropagation } from "@/lib/preproduction/creative-revision-propagation";
import styles from "./storyboard-editorial-workspace.module.css";

export default function StoryboardEditorialWorkspace({
  project,
  target,
  requestedCandidateId,
  onProjectChange,
  onOpenBuild,
}: {
  readonly project: PPFProject;
  readonly target: VisualReadinessTarget;
  readonly requestedCandidateId?: string;
  readonly onProjectChange: (project: PPFProject) => void;
  readonly onOpenBuild: () => void;
}) {
  const candidates = useMemo(() => storyboardReferenceCandidates(project, target.id), [project, target.id]);
  const [selectedId, setSelectedId] = useState(requestedCandidateId || candidates[0]?.id || "");
  const [comparing, setComparing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (requestedCandidateId && candidates.some((candidate) => candidate.id === requestedCandidateId)) {
      setSelectedId(requestedCandidateId);
      return;
    }
    if (!candidates.some((candidate) => candidate.id === selectedId)) {
      setSelectedId(candidates[0]?.id ?? "");
    }
  }, [candidates, requestedCandidateId, selectedId]);

  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0] ?? null;
  const selectedMiniBlockNumber = selected?.miniBlockNumber ?? 1;
  const anchorCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.miniBlockNumber === selectedMiniBlockNumber),
    [candidates, selectedMiniBlockNumber],
  );
  const current = useMemo(
    () => currentStoryboardArtifactForFrame(project, target.id, selectedMiniBlockNumber),
    [project, selectedMiniBlockNumber, target.id],
  );
  const staleReasons = useMemo(
    () => storyboardArtifactStaleReasons(project, target.id, selectedMiniBlockNumber, current),
    [current, project, selectedMiniBlockNumber, target.id],
  );
  const visualRevisionImpact = useMemo(() => {
    if (!current || !selected || (current.id === selected.acceptedArtifactId && staleReasons.length === 0)) return null;
    try {
      return planCreativeRevisionPropagation({
        project,
        target: { kind: "accepted-visual", artifactId: current.id },
        beforeValue: {
          artifactId: current.id,
          sourceDecisionKeys: current.sourceDecisionKeys ?? [],
        },
        afterValue: {
          candidateId: selected.id,
          sourceRef: selected.sourceRef,
          provenanceRefs: selected.provenanceRefs,
        },
        changeSetId: `storyboard-impact-${project.revision}-${current.id}`,
        summary: `Replace the Human-kept Storyboard visual at ${target.id} · Mini-Block ${selectedMiniBlockNumber}.`,
        occurredAt: project.updatedAt,
      });
    } catch {
      return null;
    }
  }, [current, project, selected, selectedMiniBlockNumber, staleReasons.length, target.id]);
  const editorialAccessible = hasQaWorkspaceAccess(target.storyboardAllowed);
  const qaOnlyAccess = isQaAccessOverride(target.storyboardAllowed);

  if (!selected || !editorialAccessible) return null;

  const anchorTargetRef = storyboardAnchorTargetRef(target.id, selected.miniBlockNumber);
  const sourceEvidence = storyboardAnchorEvidence(project, target.id, selected.miniBlockNumber);
  const selectedIsStale = staleReasons.length > 0;
  const selectedIsKept = Boolean(selected.acceptedArtifactId) && !selectedIsStale;
  const keptCount = candidates.filter((candidate) => candidate.acceptedArtifactId).length;

  function keepSelected() {
    if (qaOnlyAccess) {
      setMessage("QA access can inspect and compare this visual, but Keep remains protected until BUILD makes the target canonically authorable.");
      return;
    }
    if (selectedIsKept) {
      setMessage(`${selected.label} is already the Human-kept Storyboard reference for this anchor.`);
      return;
    }

    const now = new Date().toISOString();
    let next = project;
    const anchorKey = storyboardAnchorTargetRef(target.id, selected.miniBlockNumber);
    const accepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
    const currentlyAccepted = project.build.foundations.visualArtifacts.filter((artifact) => (
      accepted.has(artifact.id)
      && artifact.workflow === STORYBOARD_REFERENCE_WORKFLOW
      && (artifact.sourceDecisionKeys ?? []).includes(anchorKey)
    ));

    for (const artifact of currentlyAccepted) {
      next = applyStoryCommand(next, {
        type: "foundations.visual.unaccept",
        artifactId: artifact.id,
        occurredAt: now,
      });
    }

    const artifact = createStoryboardReferenceArtifact({
      project,
      targetId: target.id,
      candidate: selected,
      occurredAt: now,
    });
    next = applyStoryCommand(next, {
      type: "foundations.visual.store",
      artifact,
      occurredAt: now,
    });
    next = applyStoryCommand(next, {
      type: "foundations.visual.accept",
      artifactId: artifact.id,
      occurredAt: now,
    });
    saveFoundationProject(next);
    onProjectChange(next);
    const affectedShots = visualRevisionImpact?.staleProductionShotIds.length ?? 0;
    setMessage(
      `${selected.label} kept as the current preferred visual for this anchor. `
      + `${affectedShots} dependent Previs Shot${affectedShots === 1 ? "" : "s"} now require review; unrelated accepted work remains intact. PlotPickle did not regenerate or approve replacement production work automatically.`,
    );
  }

  function changeCandidate() {
    if (anchorCandidates.length < 2) {
      setMessage("No alternate visual is attached to this Mini-Block anchor yet. Change/Try remains non-canonical until another candidate exists.");
      return;
    }
    const index = anchorCandidates.findIndex((candidate) => candidate.id === selected.id);
    const next = anchorCandidates[(index + 1) % anchorCandidates.length];
    setSelectedId(next.id);
    setMessage(`Changed the working visual to ${next.label}. The kept PPF choice is unchanged until you choose Keep.`);
  }

  return (
    <section
      className={styles.editorial}
      aria-labelledby="storyboard-editorial-title"
      data-story-decision-target={anchorTargetRef}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Storyboard editorial · canonical Mini-Block anchor</p>
          <h2 id="storyboard-editorial-title">{selected.label}</h2>
          <p>{qaOnlyAccess
            ? "QA access opens visual inspection, Change/Try and Compare before BUILD readiness. Keep remains protected so testing cannot silently promote an unearned visual into PPF acceptance."
            : "Each Mini-Block is a stable visual address, not a one-frame quota. Keep chooses the current preferred visual for this anchor; Change/Try and Compare stay within the same anchor as more variations accumulate."}</p>
        </div>
        <span className={styles.status}>{keptCount} / 4 anchors with kept visuals{selectedIsStale ? " · selected needs review" : qaOnlyAccess ? " · QA access" : ""}</span>
      </header>

      {selectedIsStale ? (
        <div className={styles.stale} role="status">
          <strong>Kept visual needs review.</strong>
          <span>{staleReasons.join(" ")}</span>
        </div>
      ) : null}

      {visualRevisionImpact ? (
        <div className={styles.impact} aria-label="Accepted visual change consequence preview">
          <strong>CHANGE CONSEQUENCE · #2035 CHANGE SET</strong>
          <span>{visualRevisionImpact.staleProductionShotIds.length} dependent Previs Shot{visualRevisionImpact.staleProductionShotIds.length === 1 ? "" : "s"} would require review.</span>
          <span>{visualRevisionImpact.unaffectedProductionShotIds.length} unrelated Previs Shot{visualRevisionImpact.unaffectedProductionShotIds.length === 1 ? "" : "s"} remain current.</span>
          <small>Keep changes the accepted visual authority only. Invalidation does not trigger regeneration, provider spend or downstream approval.</small>
        </div>
      ) : null}

      <div className={styles.focus}>
        <div className={styles.preview}>
          <img alt={selected.caption} decoding="async" loading="lazy" src={selected.assetUrl} />
        </div>
        <div className={styles.details}>
          <div>
            <p className={styles.kicker}>{selectedIsStale ? "Kept · needs review" : selectedIsKept ? "Kept" : selected.sourceKind === "historical-storyboard" ? "Historical reference candidate" : "Replacement concept candidate"}</p>
            <h3>{anchorTargetRef}</h3>
          </div>
          <p>{selected.caption}</p>
          <div className={styles.actions} aria-label="Storyboard editorial decisions">
            <button disabled={selectedIsKept || qaOnlyAccess} onClick={keepSelected} type="button">{qaOnlyAccess ? "Keep requires BUILD" : "Keep"}</button>
            <button onClick={changeCandidate} type="button">Change / Try</button>
            <button onClick={() => setComparing((value) => !value)} type="button">Compare</button>
          </div>
          <button className={styles.secondary} onClick={onOpenBuild} type="button">Change the upstream story in BUILD</button>
          <p className={styles.message} role="status">{message}</p>
        </div>
      </div>

      <details className={styles.sourceEvidence} aria-label="Evidence and provenance for selected Storyboard anchor">
        <summary>Evidence &amp; provenance</summary>
        <header>
          <div>
            <p className={styles.kicker}>Source inspection · same canonical address</p>
            <h3>{sourceEvidence.blockTitle || `Block ${String(sourceEvidence.blockNumber).padStart(2, "0")}`} · Mini-Block {sourceEvidence.miniBlockNumber}</h3>
          </div>
          <span data-visual-review-state={selectedIsKept ? "accepted" : "candidate"}>
            {selectedIsKept ? "KEPT VISUAL" : "CANDIDATE / REFERENCE"} · {selected.sourceKind === "historical-storyboard" ? "historical Storyboard" : "PlotPickle replacement concept"}
          </span>
        </header>

        <div className={styles.sourceColumns}>
          <div className={styles.sourceText}>
            <strong>SCREENPLAY EVIDENCE</strong>
            {sourceEvidence.passages.length ? (
              sourceEvidence.passages.map((passage) => (
                <article key={passage.id}>
                  <small>Scene {passage.sceneNumber} · {passage.type} · {passage.id}</small>
                  <p>{passage.text}</p>
                </article>
              ))
            ) : (
              <p>No screenplay passage is mapped to this Mini-Block. PlotPickle does not manufacture written evidence to justify a visual.</p>
            )}
          </div>

          <div className={styles.provenance}>
            <strong>STRUCTURE & PROVENANCE</strong>
            <p>{sourceEvidence.responsibility || "No structural responsibility is recorded for this Block."}</p>
            <p>Human structural finding: <b>{sourceEvidence.structuralFinding.replaceAll("-", " / ")}</b></p>
            {sourceEvidence.sourceMappings.map((mapping) => (
              <small key={`${mapping.sourceVersion}:${mapping.sourceRef}`}>
                {mapping.sourceVersion.toUpperCase()} · {mapping.sourceRole.replaceAll("-", " ")} · {mapping.mappingMethod.replaceAll("-", " ")}
                {mapping.candidateOnly ? " · comparison only" : ""} · {mapping.sourceRef}
              </small>
            ))}
            {sourceEvidence.sourceSections.map((section) => (
              <small key={section.id}>Source section: {section.title} · p.{section.page} · {section.mappingMethod.replaceAll("-", " ")}</small>
            ))}
            <small>{sourceEvidence.characterEvidenceRefs.length} character-evidence refs · {sourceEvidence.acceptedVisualRefs.length} accepted target-scoped visual refs</small>
          </div>
        </div>
        <p className={styles.evidenceBoundary}>The #2168 evidence matrix explains where source material came from; it does not make this image canon. Keep/accepted state remains the existing PPF visual-artifact authority, and shot/reveal intent remains owned by the existing Storyboard Shot contract.</p>
      </details>

      {comparing ? (
        <div className={styles.compare} aria-label="Storyboard variations for this Mini-Block anchor">
          {anchorCandidates.map((candidate) => (
            <button
              className={styles.candidate}
              data-selected={candidate.id === selected.id ? "true" : "false"}
              data-story-decision-target={anchorTargetRef}
              key={candidate.id}
              onClick={() => setSelectedId(candidate.id)}
              type="button"
            >
              <img alt={candidate.caption} decoding="async" loading="lazy" src={candidate.assetUrl} />
              <strong>{candidate.label}</strong>
              <span>{candidate.acceptedArtifactId ? "Kept in PPF" : candidate.sourceKind === "historical-storyboard" ? "Historical reference candidate" : "Replacement concept candidate"}</span>
            </button>
          ))}
        </div>
      ) : null}

      <p className={styles.boundary}>
        The 24/96 model supplies canonical addresses, not a fixed final image count. Candidates and later visual beats may expand beneath an anchor; viewing, changing or comparing them never promotes a reference or silently rewrites story canon. SHOW_NOW / WITHHOLD_NOW reveal timing belongs only to real Storyboard Editorial Shots under the #2107 information boundary; selecting a visual never invents those directives.
      </p>
    </section>
  );
}
