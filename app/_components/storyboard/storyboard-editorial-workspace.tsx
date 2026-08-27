"use client";

/* eslint-disable @next/next/no-img-element -- Storyboard references are bundled local assets routed through PlotPickle's local asset boundary. */

import { useEffect, useMemo, useState } from "react";
import { applyStoryCommand } from "@/core/project/apply-command";
import type { PPFProject } from "@/core/project/project";
import { saveFoundationProject } from "@/core/storage/foundation-project-browser";
import type { VisualReadinessTarget } from "@/modules/build/visual-readiness";
import {
  createStoryboardReferenceArtifact,
  currentStoryboardArtifactForFrame,
  storyboardAnchorTargetRef,
  storyboardArtifactStaleReasons,
  storyboardReferenceCandidates,
  STORYBOARD_REFERENCE_WORKFLOW,
} from "./storyboard-editorial-model";
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

  if (!selected || !target.storyboardAllowed) return null;

  const anchorTargetRef = storyboardAnchorTargetRef(target.id, selected.miniBlockNumber);
  const selectedIsStale = staleReasons.length > 0;
  const selectedIsKept = Boolean(selected.acceptedArtifactId) && !selectedIsStale;
  const keptCount = candidates.filter((candidate) => candidate.acceptedArtifactId).length;

  function keepSelected() {
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
    setMessage(`${selected.label} kept as the current preferred visual for this anchor. PlotPickle did not change story canon or remove room for later variations.`);
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
          <p>Each Mini-Block is a stable visual address, not a one-frame quota. Keep chooses the current preferred visual for this anchor; Change/Try and Compare stay within the same anchor as more variations accumulate.</p>
        </div>
        <span className={styles.status}>{keptCount} / 4 anchors with kept visuals{selectedIsStale ? " · selected needs review" : ""}</span>
      </header>

      {selectedIsStale ? (
        <div className={styles.stale} role="status">
          <strong>Kept visual needs review.</strong>
          <span>{staleReasons.join(" ")}</span>
        </div>
      ) : null}

      <div className={styles.focus}>
        <div className={styles.preview}>
          <img alt={selected.caption} decoding="async" loading="lazy" src={selected.assetUrl} />
        </div>
        <div className={styles.details}>
          <div>
            <p className={styles.kicker}>{selectedIsStale ? "Kept · needs review" : selectedIsKept ? "Kept" : "Observed reference"}</p>
            <h3>{anchorTargetRef}</h3>
          </div>
          <p>{selected.caption}</p>
          <div className={styles.actions} aria-label="Storyboard editorial decisions">
            <button disabled={selectedIsKept} onClick={keepSelected} type="button">Keep</button>
            <button onClick={changeCandidate} type="button">Change / Try</button>
            <button onClick={() => setComparing((value) => !value)} type="button">Compare</button>
          </div>
          <button className={styles.secondary} onClick={onOpenBuild} type="button">Change the upstream story in BUILD</button>
          <p className={styles.message} role="status">{message}</p>
        </div>
      </div>

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
              <span>{candidate.acceptedArtifactId ? "Kept in PPF" : "Observed reference"}</span>
            </button>
          ))}
        </div>
      ) : null}

      <p className={styles.boundary}>
        The 24/96 model supplies canonical addresses, not a fixed final image count. Candidates and later visual beats may expand beneath an anchor; viewing, changing or comparing them never promotes a reference or silently rewrites story canon.
      </p>
    </section>
  );
}
