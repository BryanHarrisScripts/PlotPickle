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
  storyboardArtifactStaleReasons,
  storyboardFrameTargetRef,
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
  const current = useMemo(
    () => currentStoryboardArtifactForFrame(project, target.id, selectedMiniBlockNumber),
    [project, selectedMiniBlockNumber, target.id],
  );
  const staleReasons = useMemo(
    () => storyboardArtifactStaleReasons(project, target.id, selectedMiniBlockNumber, current),
    [current, project, selectedMiniBlockNumber, target.id],
  );

  if (!selected || !target.storyboardAllowed) return null;

  const frameTargetRef = storyboardFrameTargetRef(target.id, selected.miniBlockNumber);
  const selectedIsStale = staleReasons.length > 0;
  const selectedIsKept = Boolean(selected.acceptedArtifactId) && !selectedIsStale;
  const keptCount = candidates.filter((candidate) => candidate.acceptedArtifactId).length;

  function keepSelected() {
    if (selectedIsKept) {
      setMessage(`${selected.label} is already the Human-kept Storyboard reference for this frame.`);
      return;
    }

    const now = new Date().toISOString();
    let next = project;
    const frameKey = storyboardFrameTargetRef(target.id, selected.miniBlockNumber);
    const accepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
    const currentlyAccepted = project.build.foundations.visualArtifacts.filter((artifact) => (
      accepted.has(artifact.id)
      && artifact.workflow === STORYBOARD_REFERENCE_WORKFLOW
      && (artifact.sourceDecisionKeys ?? []).includes(frameKey)
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
    setMessage(`${selected.label} kept. PlotPickle recorded this frame approval in the canonical PPF without changing story canon.`);
  }

  function changeCandidate() {
    const index = candidates.findIndex((candidate) => candidate.id === selected.id);
    const next = candidates[(index + 1) % candidates.length];
    setSelectedId(next.id);
    setMessage(`Changed the working frame to ${next.label}. Existing kept PPF choices are unchanged until you choose Keep on that frame.`);
  }

  return (
    <section
      className={styles.editorial}
      aria-labelledby="storyboard-editorial-title"
      data-story-decision-target={frameTargetRef}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Storyboard editorial · canonical frame target</p>
          <h2 id="storyboard-editorial-title">{selected.label}</h2>
          <p>Review one Mini-Block frame at a time. Keep approves only this frame; Change moves to another frame in the Block, and Compare shows the four-frame sequence without changing canon.</p>
        </div>
        <span className={styles.status}>{keptCount} / 4 kept{selectedIsStale ? " · selected needs review" : ""}</span>
      </header>

      {selectedIsStale ? (
        <div className={styles.stale} role="status">
          <strong>Kept frame needs review.</strong>
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
            <h3>{frameTargetRef}</h3>
          </div>
          <p>{selected.caption}</p>
          <div className={styles.actions} aria-label="Storyboard editorial decisions">
            <button disabled={selectedIsKept} onClick={keepSelected} type="button">Keep</button>
            <button onClick={changeCandidate} type="button">Change</button>
            <button onClick={() => setComparing((value) => !value)} type="button">Compare</button>
          </div>
          <button className={styles.secondary} onClick={onOpenBuild} type="button">Change the upstream story in BUILD</button>
          <p className={styles.message} role="status">{message}</p>
        </div>
      </div>

      {comparing ? (
        <div className={styles.compare} aria-label="Storyboard four-frame Block comparison">
          {candidates.map((candidate) => (
            <button
              className={styles.candidate}
              data-selected={candidate.id === selected.id ? "true" : "false"}
              data-story-decision-target={storyboardFrameTargetRef(target.id, candidate.miniBlockNumber)}
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
        This reuses the previous Storyboard's Keep / Change / Compare editorial behavior without its legacy project store. Change is the non-canonical Try-equivalent for moving among available frame choices; no reference is promoted merely because it is viewed, and no paid media generation occurs here.
      </p>
    </section>
  );
}
