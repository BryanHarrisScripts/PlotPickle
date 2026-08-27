"use client";

/* eslint-disable @next/next/no-img-element -- Storyboard references are bundled local assets routed through PlotPickle's local asset boundary. */

import { useEffect, useMemo, useState } from "react";
import { applyStoryCommand } from "@/core/project/apply-command";
import type { PPFProject } from "@/core/project/project";
import { saveFoundationProject } from "@/core/storage/foundation-project-browser";
import type { VisualReadinessTarget } from "@/modules/build/visual-readiness";
import {
  createStoryboardReferenceArtifact,
  currentStoryboardArtifactForTarget,
  storyboardReferenceCandidates,
  storyboardTargetSourceKey,
  STORYBOARD_REFERENCE_WORKFLOW,
} from "./storyboard-editorial-model";
import styles from "./storyboard-editorial-workspace.module.css";

export default function StoryboardEditorialWorkspace({
  project,
  target,
  onProjectChange,
  onOpenBuild,
}: {
  readonly project: PPFProject;
  readonly target: VisualReadinessTarget;
  readonly onProjectChange: (project: PPFProject) => void;
  readonly onOpenBuild: () => void;
}) {
  const candidates = useMemo(() => storyboardReferenceCandidates(project, target.id), [project, target.id]);
  const current = useMemo(() => currentStoryboardArtifactForTarget(project, target.id), [project, target.id]);
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? "");
  const [comparing, setComparing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!candidates.some((candidate) => candidate.id === selectedId)) {
      setSelectedId(candidates[0]?.id ?? "");
    }
  }, [candidates, selectedId]);

  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0] ?? null;
  if (!selected || !target.storyboardAllowed) return null;

  const selectedIsKept = Boolean(selected.acceptedArtifactId);

  function keepSelected() {
    if (selectedIsKept) {
      setMessage(`${selected.label} is already the Human-kept Storyboard reference for this target.`);
      return;
    }

    const now = new Date().toISOString();
    let next = project;
    const targetKey = storyboardTargetSourceKey(target.id);
    const accepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
    const currentlyAccepted = project.build.foundations.visualArtifacts.filter((artifact) => (
      accepted.has(artifact.id)
      && artifact.workflow === STORYBOARD_REFERENCE_WORKFLOW
      && (artifact.sourceDecisionKeys ?? []).includes(targetKey)
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
    setMessage(`${selected.label} kept. PlotPickle recorded the visual approval in the canonical PPF without changing story canon.`);
  }

  function changeCandidate() {
    const index = candidates.findIndex((candidate) => candidate.id === selected.id);
    const next = candidates[(index + 1) % candidates.length];
    setSelectedId(next.id);
    setMessage(`Changed the working reference to ${next.label}. The kept PPF choice is unchanged until you choose Keep.`);
  }

  return (
    <section className={styles.editorial} aria-labelledby="storyboard-editorial-title">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Storyboard editorial · canonical target</p>
          <h2 id="storyboard-editorial-title">{target.label}</h2>
          <p>Reuse the bundled Afterglow references as observed candidates. A Human Keep decision approves a visual projection only; Change and Compare remain exploratory.</p>
        </div>
        <span className={styles.status}>{current ? "1 kept reference" : "No kept reference"}</span>
      </header>

      <div className={styles.focus}>
        <div className={styles.preview}>
          <img alt={selected.caption} src={selected.assetUrl} />
        </div>
        <div className={styles.details}>
          <div>
            <p className={styles.kicker}>{selectedIsKept ? "Kept" : "Observed reference"}</p>
            <h3>{selected.label}</h3>
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
        <div className={styles.compare} aria-label="Storyboard reference comparison">
          {candidates.map((candidate) => (
            <button
              className={styles.candidate}
              data-selected={candidate.id === selected.id ? "true" : "false"}
              key={candidate.id}
              onClick={() => setSelectedId(candidate.id)}
              type="button"
            >
              <img alt={candidate.caption} src={candidate.assetUrl} />
              <strong>{candidate.label}</strong>
              <span>{candidate.acceptedArtifactId ? "Kept in PPF" : "Observed reference"}</span>
            </button>
          ))}
        </div>
      ) : null}

      <p className={styles.boundary}>
        This slice reuses the previous Storyboard's Keep / Change / Compare editorial semantics but not its legacy project store. No reference is promoted merely because it exists, and no media generation occurs here.
      </p>
    </section>
  );
}
