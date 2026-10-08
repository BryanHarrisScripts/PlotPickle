"use client";

/* eslint-disable @next/next/no-img-element -- locked Storyboard images are local PlotPickle assets. */

import { useRef, useState } from "react";
import type {
  PrevisGraphicNovelTextApproval,
  PrevisGraphicNovelTextBubble,
} from "@/core/contracts/previs";
import type { PPFProject } from "@/core/project/project";
import { isSavedLockedStoryboardImage } from "@/core/contracts/build-progress";
import { loadFoundationProject } from "@/core/storage/foundation-project-browser";
import { saveFoundationProjectDurably } from "@/core/storage/project-library/revision-safe-browser";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import type { PlotPickleProject } from "@/lib/projects/project";
import { projectVisualStory } from "@/lib/preproduction/visual-story-projection";
import { prepareStoryboardNarrationSequence } from "@/core/media/storyboard-sequence-evidence.mjs";
import {
  buildPrevisGraphicNovelPanel,
  graphicNovelTextSourceKey,
  graphicNovelTextSourceSnapshot,
  graphicNovelTextStaleReasons,
  type PrevisGraphicNovelPanel,
} from "../previs/previs-graphic-novel-presentation";
import {
  storyboardAnchorEvidence,
  storyboardAnchorTargetRef,
  storyboardPositionProgression,
  storyboardNarrationPassagesForPosition,
  storyboardNarrationSourcePassagesInStoryOrder,
} from "../storyboard/storyboard-editorial-model";
import styles from "../storyboard/storyboard-readiness-workspace.module.css";

type NarrationDraft = Readonly<{
  sourceKey: string;
  narration: string;
  bubbles: readonly PrevisGraphicNovelTextBubble[];
}>;

function compact(values: readonly (string | null | undefined)[]) {
  return values.map((value) => value?.trim()).filter(Boolean).join(" · ");
}

export default function StoryboardLockedShotHandoff({
  project,
  legacyProject,
  targetId,
  blockNumber,
  miniBlockNumber,
  onProjectChange,
}: {
  readonly project: LibraryPPFProject;
  readonly legacyProject: PlotPickleProject | null;
  readonly targetId: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly onProjectChange: (project: PPFProject) => void;
}) {
  const acceptedIds = new Set(project.build.foundations.acceptedVisualArtifactIds);
  const anchorRef = storyboardAnchorTargetRef(targetId, miniBlockNumber);
  const evidence = storyboardAnchorEvidence(project, targetId, miniBlockNumber);
  const visualStory = projectVisualStory({ project, legacyProject, blockNumber, miniBlockNumber });
  const authoredSequencePassages = storyboardNarrationSourcePassagesInStoryOrder(project, targetId, miniBlockNumber);
  const anchor = visualStory.anchors.find((candidate) => candidate.anchorRef === anchorRef) ?? null;
  const sceneNumbers = [...new Set(evidence.passages.map((passage) => passage.sceneNumber).filter(Boolean))].map(String);
  const storyContext = {
    title: project.title,
    act: Math.ceil(blockNumber / 6),
    block: blockNumber,
    miniBlock: miniBlockNumber,
    blockTitle: evidence.blockTitle,
    dramaticResponsibility: evidence.responsibility,
  };
  const lockedArtifacts = Array.from({ length: 25 }, (_, index) => index + 1).flatMap((position) => {
    const artifact = project.build.foundations.visualArtifacts
      .filter((candidate) => (
        candidate.workflow === "storyboard-frame-webp-v2"
        && candidate.frameNumber === position
        && candidate.reviewState === "accepted"
        && acceptedIds.has(candidate.id)
        && isSavedLockedStoryboardImage(candidate, acceptedIds)
        && (candidate.sourceDecisionKeys ?? []).includes(anchorRef)
      ))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
    return artifact ? [{ position, artifact }] : [];
  });
  const sequenceShots = Array.from({ length: 25 }, (_, index) => {
    const position = index + 1;
    const artifact = lockedArtifacts.find((item) => item.position === position)?.artifact;
    const shot = anchor?.shots.find((item) => item.order === position);
    return {
      position,
      intention: compact([
        artifact?.narrativeIntention,
        shot?.narrativePurpose,
        shot?.visualIntent,
      ]).slice(0, 1600),
    };
  });
  const approvals = (project.production.graphicNovelTextApprovals ?? [])
    .filter((approval) => approval.anchorRef === anchorRef);
  const [drafts, setDrafts] = useState<Readonly<Record<number, NarrationDraft>>>({});
  const [busyPosition, setBusyPosition] = useState<number | null>(null);
  const [notices, setNotices] = useState<Readonly<Record<number, string>>>({});
  const activeRequest = useRef<AbortController | null>(null);
  const latestProject = useRef(project);
  latestProject.current = project;

  function panelFor(position: number, artifact: (typeof lockedArtifacts)[number]["artifact"]): PrevisGraphicNovelPanel {
    const progression = storyboardPositionProgression(position);
    const shot = anchor?.shots.find((candidate) => candidate.order === position) ?? null;
    return buildPrevisGraphicNovelPanel({
      position,
      assetUrl: artifact.assetUrl,
      authoritative: true,
      narrativeIntention: artifact.narrativeIntention ?? "",
      sceneNumbers,
      beatLabel: progression.label,
      beatDirection: progression.direction,
      shotLabel: `Shot ${String(position).padStart(2, "0")} of 25`,
      shotContext: "~3-second planning target",
      passages: evidence.passages,
    });
  }

  function currentApproval(panel: PrevisGraphicNovelPanel) {
    const approval = approvals.find((candidate) => candidate.position === panel.position) ?? null;
    const artifact = lockedArtifacts.find((item) => item.position === panel.position)?.artifact ?? null;
    const sourceKey = graphicNovelTextSourceKey(panel, evidence.passages, storyContext, graphicNovelTextSourceSnapshot(project, anchorRef, panel.position, artifact));
    return {
      sourceKey,
      current: approval?.sourceKey === sourceKey ? approval : null,
      stale: approval && approval.sourceKey !== sourceKey ? approval : null,
    };
  }

  async function saveApproval(
    panel: PrevisGraphicNovelPanel,
    sourceKey: string,
    narration: string,
    bubbles: readonly PrevisGraphicNovelTextBubble[],
    noText: boolean,
  ) {
    const now = new Date().toISOString();
    const approval: PrevisGraphicNovelTextApproval = {
      anchorRef,
      position: panel.position,
      sourceKey,
      narration,
      bubbles,
      noText,
      approvedAt: now,
    };
    try {
    const base = loadFoundationProject();
    if (base.id !== project.id || base.revision !== latestProject.current.revision) throw new Error("The story changed while this narration was being reviewed. Refresh the shot before approving.");
    const artifactId = lockedArtifacts.find((item) => item.position === panel.position)?.artifact.id;
    const liveArtifact = base.build.foundations.visualArtifacts.find((item) => item.id === artifactId) ?? null;
    const liveKey = graphicNovelTextSourceKey(panel, evidence.passages, storyContext, graphicNovelTextSourceSnapshot(base, anchorRef, panel.position, liveArtifact));
    if (!liveArtifact || liveKey !== sourceKey) throw new Error("This Shot or image changed. Generate or review narration against the current saved image.");
    const next: PPFProject = {
      ...base,
      revision: base.revision + 1,
      updatedAt: now,
      production: {
        ...base.production,
        graphicNovelTextApprovals: [
          ...(base.production.graphicNovelTextApprovals ?? []).filter((item) => (
            item.anchorRef !== anchorRef || item.position !== panel.position
          )),
          approval,
        ],
      },
    };
    const saved = await saveFoundationProjectDurably(next, base.revision);
    latestProject.current = saved;
    onProjectChange(saved);
    setDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[panel.position];
      return nextDrafts;
    });
    setNotices((current) => ({
      ...current,
      [panel.position]: noText ? "No Bubble saved and locked for Storyboard and Previs." : "Bubble / caption saved and locked for Storyboard and Previs.",
    }));
    } catch (error) {
      setNotices((current) => ({ ...current, [panel.position]: `Bubble Save & Lock failed: ${error instanceof Error ? error.message : "Persistence failed."}` }));
    }
  }

  async function generateNarration(panel: PrevisGraphicNovelPanel, shotFacts: Readonly<Record<string, string>>) {
    if (busyPosition !== null) return;
    let sequenceEvidence;
    try {
      sequenceEvidence = prepareStoryboardNarrationSequence({
        passages: authoredSequencePassages,
        shots: sequenceShots,
        position: panel.position,
      });
    } catch (error) {
      setNotices((current) => ({
        ...current,
        [panel.position]: error instanceof Error ? error.message : "This Shot needs an authored dramatic moment.",
      }));
      return;
    }
    const requestedSourceKey = currentApproval(panel).sourceKey;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setBusyPosition(panel.position);
    setNotices((current) => ({ ...current, [panel.position]: "Creating a Graphic Novel narration draft…" }));
    try {
      const profileResponse = await fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
      const profileStatus = await profileResponse.json() as { authenticated?: boolean; csrfToken?: string; message?: string };
      if (!profileResponse.ok) throw new Error(profileStatus.message || "PlotPickle could not verify the current session.");
      if (!profileStatus.authenticated) throw new Error("Sign in to authorize narration generation.");
      if (!profileStatus.csrfToken) throw new Error("The active Human session proof is missing or expired. Refresh the page or sign in again.");
      const response = await fetch("/api/previs/narration", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": profileStatus.csrfToken },
        body: JSON.stringify({
          mode: "storyboard-shot",
          storyContext,
          passages: sequenceEvidence.passages,
          sequence: sequenceEvidence.sequence,
          panels: [{ position: panel.position, intention: panel.narration }],
          shot: shotFacts,
        }),
      });
      const result = await response.json() as {
        ok?: boolean;
        message?: string;
        panels?: { position: number; narration: string; bubbles: PrevisGraphicNovelTextBubble[] }[];
      };
      if (!response.ok || !result.ok || result.panels?.length !== 1) {
        throw new Error(result.message || "Narration generation failed.");
      }
      if (controller.signal.aborted) return;
      if (latestProject.current !== project || currentApproval(panel).sourceKey !== requestedSourceKey) {
        setNotices((current) => ({ ...current, [panel.position]: "Shot or story changed during generation. Old draft discarded; retry the current Shot." }));
        return;
      }
      const sourceKey = requestedSourceKey;
      const proposed = result.panels[0];
      if (!proposed.narration?.trim() && !proposed.bubbles?.length) {
        setNotices((current) => ({ ...current, [panel.position]: "Local writer returned no printed text for this Shot. Regenerate, or choose No Bubble deliberately." }));
        return;
      }
      setDrafts((current) => ({
        ...current,
        [panel.position]: {
          sourceKey,
          narration: proposed.narration,
          bubbles: proposed.bubbles,
        },
      }));
      setNotices((current) => ({ ...current, [panel.position]: "Draft ready for review. Save & Lock, Regenerate, or choose No Bubble." }));
    } catch (error) {
      if (!controller.signal.aborted) {
        setNotices((current) => ({
          ...current,
          [panel.position]: error instanceof Error ? error.message : "Narration generation failed.",
        }));
      }
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      setBusyPosition((current) => current === panel.position ? null : current);
    }
  }

  return (
    <section className={styles.lockedShotHandoff} data-storyboard-locked-shot-handoff="previs" aria-labelledby="storyboard-locked-shot-handoff-title">
      <header>
        <div>
          <span className={styles.eyebrow}>Storyboard detail</span>
          <h3 id="storyboard-locked-shot-handoff-title">Locked Shot handoff to Previs</h3>
        </div>
        <strong>{lockedArtifacts.length} of 25 Shots locked · {25 - lockedArtifacts.length} still open</strong>
      </header>

      {lockedArtifacts.length ? (
        <div className={styles.handoffRows}>
          {lockedArtifacts.map(({ position, artifact }) => {
            const shot = anchor?.shots.find((candidate) => candidate.order === position) ?? null;
            const productionShots = project.production.shots
              .filter((candidate) => candidate.anchorRef === anchorRef && candidate.storyboardArtifactId === artifact.id)
              .sort((left, right) => left.order - right.order);
            const production = productionShots[0] ?? null;
            const progression = storyboardPositionProgression(position);
            const panel = panelFor(position, artifact);
            const approvalState = currentApproval(panel);
            const draft = drafts[position]?.sourceKey === approvalState.sourceKey ? drafts[position] : null;
            const directives = shot?.informationDirectives.map((directive) => `${directive.mode}: ${directive.statement}`).join(" · ") ?? "";
            const camera = compact([
              production?.shotSize || shot?.shotSize,
              production?.angle || shot?.angle,
              production?.movement || shot?.movement,
              production?.lens || shot?.lens,
            ]);
            const performance = compact(productionShots.flatMap((candidate) => [
              candidate.blockingIntent,
              candidate.performanceEnergy,
              candidate.pacingIntent,
            ]));
            const transitions = compact(productionShots.flatMap((candidate) => [candidate.transitionIn, candidate.transitionOut]));
            const duration = production?.durationSeconds ?? shot?.durationSeconds ?? null;
            // This same authored evidence is displayed to the Human AND supplied to
            // text-only narration. Never infer story details from the image pixels.
            const shotPassages = storyboardNarrationPassagesForPosition(evidence.passages, position);
            const shotScenes = [...new Set(shotPassages.map((passage) => passage.sceneNumber).filter(Boolean))];
            const shotFacts = {
              story: compact([artifact.narrativeIntention, shot?.narrativePurpose, shot?.visualIntent, evidence.responsibility]),
              sceneBeat: compact([shotScenes.length ? shotScenes.map((scene) => `Scene ${scene}`).join(", ") : "", shot?.narrativePurpose]),
              camera,
              performance,
              lighting: shot?.lightingIntent ?? "",
              timing: duration !== null ? `${duration}s authored` : "~3s Storyboard planning target",
              informationBoundary: directives,
              continuity: transitions || compact([shot?.transitionIn, shot?.transitionOut]),
            };
            return (
              <article className={styles.handoffRow} data-storyboard-handoff-shot={position} key={artifact.id}>
                <div className={styles.handoffIdentity}>
                  <strong>Shot {String(position).padStart(2, "0")}</strong>
                  <span>{progression.label}</span>
                  <small>Locked · authoritative Storyboard Image</small>
                </div>

                <div className={styles.handoffImage}>
                  <img alt={artifact.narrativeIntention || `Locked Storyboard Image for Shot ${position}`} src={artifact.assetUrl} />
                </div>

                <dl className={styles.handoffFacts}>
                  <div><dt>Story</dt><dd>{shotFacts.story || "No additional story responsibility authored."}</dd></div>
                  <div><dt>Scene / Beat</dt><dd>{shotFacts.sceneBeat}</dd></div>
                  <div><dt>Camera</dt><dd>{shotFacts.camera || "Not authored"}</dd></div>
                  <div><dt>Performance / Blocking</dt><dd>{shotFacts.performance || "Not authored"}</dd></div>
                  <div><dt>Lighting / Look</dt><dd>{shotFacts.lighting || "Not authored"}</dd></div>
                  <div><dt>Timing</dt><dd>{shotFacts.timing}</dd></div>
                  <div><dt>Information boundary</dt><dd>{shotFacts.informationBoundary || "No special reveal/withhold directive"}</dd></div>
                  <div><dt>Continuity / Handoff</dt><dd>{shotFacts.continuity || "No authored transition / continuity handoff"}</dd></div>
                </dl>

                <div className={styles.handoffNarration}>
                  <strong>Graphic Novel bubble / caption</strong>
                  {approvalState.current?.noText ? <p>No Bubble · Saved & Locked</p> : null}
                  {approvalState.current && !approvalState.current.noText ? (
                    <>
                      {approvalState.current.bubbles.map((bubble) => <p className={styles.handoffBubble} key={bubble.speaker + bubble.text}><strong>{bubble.speaker}</strong> {bubble.text}</p>)}
                      {approvalState.current.narration ? <p>{approvalState.current.narration}</p> : null}
                    </>
                  ) : null}
                  {!approvalState.current && approvalState.stale ? <p>Narration exists but is stale for the current locked image/story source ({graphicNovelTextStaleReasons(approvalState.stale.sourceKey, approvalState.sourceKey).join(", ")}).</p> : null}
                  {!approvalState.current && !approvalState.stale && !draft ? <p>{notices[position] ? "No approved narration for this Shot." : "Not authored yet."}</p> : null}

                  {draft ? (
                    <div className={styles.handoffDraft} aria-label={`Narration draft for Shot ${position}`}>
                      <small>Draft · not saved or locked</small>
                      {draft.bubbles.map((bubble) => <p className={styles.handoffBubble} key={bubble.speaker + bubble.text}><strong>{bubble.speaker}</strong> {bubble.text}</p>)}
                      {draft.narration ? <p>{draft.narration}</p> : (!draft.bubbles.length ? <p>No text proposed.</p> : null)}
                      <button type="button" disabled={busyPosition !== null || (!draft.narration && !draft.bubbles.length)} onClick={() => void saveApproval(panel, draft.sourceKey, draft.narration, draft.bubbles, false)}>Save &amp; Lock</button>
                    </div>
                  ) : null}

                  <div className={styles.handoffNarrationActions}>
                    <button
                      disabled={busyPosition !== null || (!authoredSequencePassages.length && !sequenceShots[position - 1]?.intention)}
                      type="button"
                      onClick={() => void generateNarration(panel, shotFacts)}
                    >
                      {busyPosition === position ? "Creating…" : draft || approvalState.current ? "Regenerate" : "Create Narration"}
                    </button>
                    <button
                      disabled={busyPosition !== null}
                      type="button"
                      onClick={() => void saveApproval(panel, approvalState.sourceKey, "", [], true)}
                    >No Bubble</button>
                  </div>
                  <small role="status">{notices[position] ?? (approvalState.current ? "Saved and locked decision will appear unchanged in Storyboard and Previs." : "Human approval is required before generated text becomes current.")}</small>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className={styles.handoffEmpty}>No Storyboard Shots are locked for this Mini-Block. Lock a Shot above to add it to the Previs handoff.</p>
      )}
    </section>
  );
}
