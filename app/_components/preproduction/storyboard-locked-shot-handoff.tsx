"use client";

/* eslint-disable @next/next/no-img-element -- locked Storyboard images are local PlotPickle assets. */

import { useRef, useState } from "react";
import type {
  PrevisGraphicNovelTextApproval,
  PrevisGraphicNovelTextBubble,
} from "@/core/contracts/previs";
import type { PPFProject } from "@/core/project/project";
import { saveFoundationProject } from "@/core/storage/foundation-project-browser";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import type { PlotPickleProject } from "@/lib/projects/project";
import { projectVisualStory } from "@/lib/preproduction/visual-story-projection";
import {
  buildPrevisGraphicNovelPanel,
  graphicNovelTextSourceKey,
  type PrevisGraphicNovelPanel,
} from "../previs/previs-graphic-novel-presentation";
import {
  storyboardAnchorEvidence,
  storyboardAnchorTargetRef,
  storyboardPositionProgression,
} from "../storyboard/storyboard-editorial-model";
import styles from "../storyboard/storyboard-readiness-workspace.module.css";

type NarrationDraft = Readonly<{
  sourceKey: string;
  narration: string;
  bubbles: readonly PrevisGraphicNovelTextBubble[];
}>;

async function oneShotNarrationContactSheet(assetUrl: string, position: number, signal: AbortSignal) {
  const url = new URL(assetUrl, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/local-ai/assets/")) {
    throw new Error(`Shot ${position} needs a saved local Storyboard image before narration can be created.`);
  }
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", signal });
  if (!response.ok) throw new Error(`The locked image for Shot ${position} could not be read (${response.status}).`);
  const blob = await response.blob();
  if (!["image/png", "image/jpeg", "image/webp"].includes(blob.type) || blob.size > 12_000_000) {
    throw new Error(`The locked image for Shot ${position} is not a supported image.`);
  }
  const image = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 480;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The browser cannot prepare the locked Storyboard image for narration.");
    context.fillStyle = "#101513";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const mediaHeight = 430;
    const scale = Math.min(canvas.width / image.width, mediaHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, (canvas.width - width) / 2, (mediaHeight - height) / 2, width, height);
    context.fillStyle = "#101513";
    context.fillRect(0, mediaHeight, canvas.width, canvas.height - mediaHeight);
    context.fillStyle = "#ffffff";
    context.font = "bold 24px sans-serif";
    context.textBaseline = "middle";
    context.fillText(`Shot ${String(position).padStart(2, "0")}`, 18, mediaHeight + 25);
    const sheet = canvas.toDataURL("image/jpeg", 0.8);
    if (!sheet.startsWith("data:image/jpeg;base64,") || sheet.length > 3_000_000) {
      throw new Error("The locked Storyboard image is too large for narration.");
    }
    return sheet;
  } finally {
    image.close();
  }
}

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
        && (candidate.sourceDecisionKeys ?? []).includes(anchorRef)
      ))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
    return artifact ? [{ position, artifact }] : [];
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
    const sourceKey = graphicNovelTextSourceKey(panel, evidence.passages, storyContext);
    return {
      sourceKey,
      current: approval?.sourceKey === sourceKey ? approval : null,
      stale: approval && approval.sourceKey !== sourceKey ? approval : null,
    };
  }

  function saveApproval(
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
    const base = latestProject.current;
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
    saveFoundationProject(next);
    onProjectChange(next);
    setDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[panel.position];
      return nextDrafts;
    });
    setNotices((current) => ({
      ...current,
      [panel.position]: noText ? "Silent presentation approved." : "Narration / bubble approved for Previs and Timeline.",
    }));
  }

  async function generateNarration(panel: PrevisGraphicNovelPanel, artifactUrl: string) {
    if (busyPosition !== null) return;
    if (!evidence.passages.length) {
      setNotices((current) => ({ ...current, [panel.position]: "No mapped screenplay passage is available for grounded narration." }));
      return;
    }
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setBusyPosition(panel.position);
    setNotices((current) => ({ ...current, [panel.position]: "Creating a Graphic Novel narration draft…" }));
    try {
      const contactSheet = await oneShotNarrationContactSheet(artifactUrl, panel.position, controller.signal);
      const response = await fetch("/api/previs/narration", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactSheet,
          storyContext,
          passages: evidence.passages,
          panels: [{ position: panel.position, intention: panel.narration }],
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
      if (controller.signal.aborted || latestProject.current !== project) return;
      const proposed = result.panels[0];
      const sourceKey = graphicNovelTextSourceKey(panel, evidence.passages, storyContext);
      setDrafts((current) => ({
        ...current,
        [panel.position]: {
          sourceKey,
          narration: proposed.narration,
          bubbles: proposed.bubbles,
        },
      }));
      setNotices((current) => ({ ...current, [panel.position]: "Draft ready for Human review. Approve, regenerate, or mark the Shot silent." }));
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
                  <div><dt>Story</dt><dd>{compact([shot?.narrativePurpose, shot?.visualIntent, evidence.responsibility]) || "No additional story responsibility authored."}</dd></div>
                  <div><dt>Scene / Beat</dt><dd>{compact([sceneNumbers.length ? sceneNumbers.map((scene) => `Scene ${scene}`).join(", ") : "", progression.label, progression.direction])}</dd></div>
                  <div><dt>Camera</dt><dd>{camera || "Not authored"}</dd></div>
                  <div><dt>Performance / Blocking</dt><dd>{performance || "Not authored"}</dd></div>
                  <div><dt>Lighting / Look</dt><dd>{shot?.lightingIntent || "Not authored"}</dd></div>
                  <div><dt>Timing</dt><dd>{duration !== null ? `${duration}s authored` : "~3s Storyboard planning target"}</dd></div>
                  <div><dt>Information boundary</dt><dd>{directives || "No special reveal/withhold directive"}</dd></div>
                  <div><dt>Continuity / Handoff</dt><dd>{transitions || compact([shot?.transitionIn, shot?.transitionOut]) || "No authored transition / continuity handoff"}</dd></div>
                </dl>

                <div className={styles.handoffNarration}>
                  <strong>Narration / Graphic Novel bubble</strong>
                  {approvalState.current?.noText ? <p>Silent · Human approved</p> : null}
                  {approvalState.current && !approvalState.current.noText ? (
                    <>
                      {approvalState.current.bubbles.map((bubble) => <p className={styles.handoffBubble} key={bubble.speaker + bubble.text}><strong>{bubble.speaker}</strong> {bubble.text}</p>)}
                      {approvalState.current.narration ? <p>{approvalState.current.narration}</p> : null}
                    </>
                  ) : null}
                  {!approvalState.current && approvalState.stale ? <p>Narration exists but is stale for the current locked image/story source.</p> : null}
                  {!approvalState.current && !approvalState.stale ? <p>Not authored yet.</p> : null}

                  {draft ? (
                    <div className={styles.handoffDraft} aria-label={`Narration draft for Shot ${position}`}>
                      <small>Draft · review before approval</small>
                      {draft.bubbles.map((bubble) => <p className={styles.handoffBubble} key={bubble.speaker + bubble.text}><strong>{bubble.speaker}</strong> {bubble.text}</p>)}
                      {draft.narration ? <p>{draft.narration}</p> : (!draft.bubbles.length ? <p>No text proposed.</p> : null)}
                      <button type="button" onClick={() => saveApproval(panel, draft.sourceKey, draft.narration, draft.bubbles, !draft.narration && !draft.bubbles.length)}>Approve text</button>
                    </div>
                  ) : null}

                  <div className={styles.handoffNarrationActions}>
                    <button
                      disabled={busyPosition !== null || !evidence.passages.length}
                      type="button"
                      onClick={() => void generateNarration(panel, artifact.assetUrl)}
                    >
                      {busyPosition === position ? "Creating…" : approvalState.current ? "Regenerate" : "Create Narration"}
                    </button>
                    <button
                      disabled={busyPosition !== null}
                      type="button"
                      onClick={() => saveApproval(panel, approvalState.sourceKey, "", [], true)}
                    >Set silent</button>
                  </div>
                  <small role="status">{notices[position] ?? (approvalState.current ? "Current approval will flow unchanged into Previs and Timeline." : "Human approval is required before generated text becomes current.")}</small>
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
