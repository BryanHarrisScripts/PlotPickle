"use client";

import { narrationOverallStory } from "@/core/media/storyboard-sequence-evidence.mjs";

/* eslint-disable @next/next/no-img-element -- locked Storyboard images are local PlotPickle assets. */

import { useRef, useState } from "react";
import type {
  PrevisGraphicNovelReviewedShotBrief,
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
import { prepareStoryboardNarrationSequence, storyboardNarrationAuthoredIntention } from "@/core/media/storyboard-sequence-evidence.mjs";
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
  storyboardNarrationSourcePassagesInStoryOrder,
} from "../storyboard/storyboard-editorial-model";
import styles from "../storyboard/storyboard-readiness-workspace.module.css";

type ReviewedShotBrief = PrevisGraphicNovelReviewedShotBrief;
type ShotBriefResponse = Readonly<{ analysis: string; proposals: Readonly<Record<string, string>> }>;
type NarrationDraft = Readonly<{
  sourceKey: string;
  narration: string;
  bubbles: readonly PrevisGraphicNovelTextBubble[];
  reviewedShotBrief: ReviewedShotBrief;
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
  position,
  embedded = false,
  onProjectChange,
}: {
  readonly project: LibraryPPFProject;
  readonly legacyProject: PlotPickleProject | null;
  readonly targetId: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly position?: number;
  readonly embedded?: boolean;
  readonly onProjectChange: (project: PPFProject) => void;
}) {
  const acceptedIds = new Set(project.build.foundations.acceptedVisualArtifactIds);
  const anchorRef = storyboardAnchorTargetRef(targetId, miniBlockNumber);
  const evidence = storyboardAnchorEvidence(project, targetId, miniBlockNumber);
  const visualStory = projectVisualStory({ project, legacyProject, blockNumber, miniBlockNumber });
  const authoredSequencePassages = storyboardNarrationSourcePassagesInStoryOrder(project, targetId, miniBlockNumber);
  const anchor = visualStory.anchors.find((candidate) => candidate.anchorRef === anchorRef) ?? null;
  const anchorScenes = visualStory.scenes.map((scene) => scene.title).filter(Boolean);
  const sceneNumbers = [...new Set(evidence.passages.map((passage) => passage.sceneNumber).filter(Boolean))].map(String);
  const storyContext = {
    overallStory: narrationOverallStory(project),
    title: project.title,
    act: Math.ceil(blockNumber / 6),
    block: blockNumber,
    miniBlock: miniBlockNumber,
    blockTitle: evidence.blockTitle,
    dramaticResponsibility: evidence.responsibility,
  };
  const lockedArtifacts = Array.from({ length: 25 }, (_, index) => index + 1)
    .filter((shotPosition) => position === undefined || position === shotPosition)
    .flatMap((shotPosition) => {
    const artifact = project.build.foundations.visualArtifacts
      .filter((candidate) => (
        candidate.workflow === "storyboard-frame-webp-v2"
        && candidate.frameNumber === shotPosition
        && candidate.reviewState === "accepted"
        && acceptedIds.has(candidate.id)
        && isSavedLockedStoryboardImage(candidate, acceptedIds)
        && (candidate.sourceDecisionKeys ?? []).includes(anchorRef)
      ))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
    return artifact ? [{ position: shotPosition, artifact }] : [];
  });
  const sequenceShots = Array.from({ length: 25 }, (_, index) => {
    const position = index + 1;
    const artifact = lockedArtifacts.find((item) => item.position === position)?.artifact;
    const shot = anchor?.shots.find((item) => item.order === position);
    return {
      position,
      intention: compact([
        storyboardNarrationAuthoredIntention(artifact?.narrativeIntention),
        shot?.narrativePurpose,
        shot?.visualIntent,
      ]).slice(0, 1600),
    };
  });
  const approvals = (project.production.graphicNovelTextApprovals ?? [])
    .filter((approval) => approval.anchorRef === anchorRef);
  const [drafts, setDrafts] = useState<Readonly<Record<number, NarrationDraft>>>({});
  const [shotBriefs, setShotBriefs] = useState<Readonly<Record<number, ReviewedShotBrief>>>({});
  const [busyPosition, setBusyPosition] = useState<number | null>(null);
  const [savingPosition, setSavingPosition] = useState<number | null>(null);
  const saveInFlight = useRef(false);
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

  function currentApproval(panel: PrevisGraphicNovelPanel, reviewedShotBrief?: ReviewedShotBrief) {
    const approval = approvals.find((candidate) => candidate.position === panel.position) ?? null;
    const artifact = lockedArtifacts.find((item) => item.position === panel.position)?.artifact ?? null;
    const sourceBrief = reviewedShotBrief ?? approval?.reviewedShotBrief;
    const sourceKey = graphicNovelTextSourceKey(panel, evidence.passages, storyContext, graphicNovelTextSourceSnapshot(project, anchorRef, panel.position, artifact, sourceBrief));
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
    reviewedShotBrief?: ReviewedShotBrief,
  ) {
    // Synchronous guard: the second Save & Lock / No Bubble click cannot race
    // the first encrypted write before React has rerendered disabled controls.
    if (saveInFlight.current || busyPosition !== null) return;
    saveInFlight.current = true;
    setSavingPosition(panel.position);
    setNotices((current) => ({ ...current, [panel.position]: "Saving the Bubble decision to your profile…" }));
    try {
    const now = new Date().toISOString();
    const approval: PrevisGraphicNovelTextApproval = {
      anchorRef,
      position: panel.position,
      sourceKey,
      narration,
      bubbles,
      noText,
      ...(reviewedShotBrief ? { reviewedShotBrief } : {}),
      approvedAt: now,
    };
    const base = loadFoundationProject();
    if (base.id !== project.id || base.revision !== latestProject.current.revision) throw new Error("The story changed while this narration was being reviewed. Refresh the shot before approving.");
    const artifactId = lockedArtifacts.find((item) => item.position === panel.position)?.artifact.id;
    const liveArtifact = base.build.foundations.visualArtifacts.find((item) => item.id === artifactId) ?? null;
    const liveKey = graphicNovelTextSourceKey(panel, evidence.passages, storyContext, graphicNovelTextSourceSnapshot(base, anchorRef, panel.position, liveArtifact, reviewedShotBrief));
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
      setNotices((current) => ({ ...current, [panel.position]: `ERROR · BUBBLE_SAVE_FAILED · stage=PERSISTENCE · Shot ${String(panel.position).padStart(2, "0")} · Save & Lock failed: ${error instanceof Error ? error.message : "Encrypted save was not acknowledged."} · Next: retry Save & Lock after checking your unlocked profile. The previous approval is unchanged.` }));
    } finally {
      saveInFlight.current = false;
      setSavingPosition(null);
    }
  }

  async function prepareShotBrief(panel: PrevisGraphicNovelPanel, shotFacts: Readonly<Record<string, string>>) {
    if (busyPosition !== null) return;
    let sequenceEvidence;
    try {
      sequenceEvidence = prepareStoryboardNarrationSequence({ passages: authoredSequencePassages, shots: sequenceShots, position: panel.position });
    } catch (error) {
      setNotices((current) => ({ ...current, [panel.position]: "ERROR · INVALID_NARRATION_EVIDENCE · stage=STORY_EVIDENCE · " + (error instanceof Error ? error.message : "Review the selected Shot and screenplay before continuing.") }));
      return;
    }
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setBusyPosition(panel.position);
    setNotices((current) => ({ ...current, [panel.position]: "Analyzing the Shot and preparing reviewable proposals…" }));
    try {
      const profileResponse = await fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
      const profileStatus = await profileResponse.json() as { authenticated?: boolean; csrfToken?: string; message?: string };
      if (!profileResponse.ok) throw new Error(profileStatus.message || "PlotPickle could not verify the current session.");
      if (!profileStatus.authenticated) throw new Error("Sign in to authorize a Shot brief.");
      if (!profileStatus.csrfToken) throw new Error("The active Human session proof is missing or expired. Refresh the page or sign in again.");
      const response = await fetch("/api/previs/narration", {
        method: "POST", credentials: "same-origin", signal: controller.signal,
        headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": profileStatus.csrfToken },
        body: JSON.stringify({ mode: "storyboard-shot-brief", storyContext, passages: sequenceEvidence.passages,
          sequence: sequenceEvidence.sequence,
          panels: [{ position: panel.position, intention: storyboardNarrationAuthoredIntention(panel.narration) }], shot: shotFacts }),
      });
      const result = await response.json() as { ok?: boolean; message?: string; code?: string; stage?: string; shotBrief?: ShotBriefResponse };
      if (!response.ok || !result.ok || !result.shotBrief) throw new Error("ERROR · " + (result.code || "SHOT_BRIEF_FAILED") + " · stage=" + (result.stage || "RESPONSE") + " · " + (result.message || "Shot brief preparation failed."));
      if (controller.signal.aborted) return;
      const facts = { ...shotFacts };
      for (const [field, proposal] of Object.entries(result.shotBrief.proposals)) if (!facts[field]?.trim() && proposal.trim()) facts[field] = proposal.trim();
      setShotBriefs((current) => ({ ...current, [panel.position]: { analysis: result.shotBrief!.analysis, facts } }));
      setDrafts((current) => { const next = { ...current }; delete next[panel.position]; return next; });
      setNotices((current) => ({ ...current, [panel.position]: "Shot brief ready. Review the analysis and edit proposed fields before creating narration." }));
    } catch (error) {
      if (!controller.signal.aborted) setNotices((current) => ({ ...current, [panel.position]: error instanceof Error && error.message.startsWith("ERROR · ") ? error.message : "ERROR · SHOT_BRIEF_FAILED · stage=REQUEST · " + (error instanceof Error ? error.message : "Shot brief preparation failed.") }));
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      setBusyPosition((current) => current === panel.position ? null : current);
    }
  }

  async function generateNarration(panel: PrevisGraphicNovelPanel, shotFacts: Readonly<Record<string, string>>, reviewedShotBrief: ReviewedShotBrief) {
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
        [panel.position]: `ERROR · INVALID_NARRATION_EVIDENCE · stage=STORY_EVIDENCE · ${error instanceof Error ? error.message : "This Shot needs an authored dramatic moment."} · Next: review the locked Shot and screenplay before retrying.`,
      }));
      return;
    }
    const requestedSourceKey = currentApproval(panel, reviewedShotBrief).sourceKey;
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
          panels: [{ position: panel.position, intention: storyboardNarrationAuthoredIntention(panel.narration) }],
          shot: shotFacts,
          shotAnalysis: reviewedShotBrief.analysis,
        }),
      });
      const result = await response.json() as {
        ok?: boolean;
        message?: string;
        code?: string;
        stage?: string;
        route?: string;
        reason?: string;
        panels?: { position: number; narration: string; bubbles: PrevisGraphicNovelTextBubble[] }[];
      };
      if (!response.ok || !result.ok || result.panels?.length !== 1) {
        throw new Error(`ERROR · ${result.code || "NARRATION_REQUEST_FAILED"} · stage=${result.stage || "RESPONSE"} · route=${result.route || "local-writing"} · HTTP ${response.status} · ${result.message || "Narration generation failed."} ${result.reason ? `· reason=${result.reason}` : ""} · Next: check Connections → Writing and the local provider test; retry this Shot without changing the existing lock.`);
      }
      if (controller.signal.aborted) return;
      if (latestProject.current !== project || currentApproval(panel, reviewedShotBrief).sourceKey !== requestedSourceKey) {
        setNotices((current) => ({ ...current, [panel.position]: "Shot or story changed during generation. Old draft discarded; retry the current Shot." }));
        return;
      }
      const sourceKey = requestedSourceKey;
      const proposed = result.panels[0];
      if (!proposed.narration?.trim() && !proposed.bubbles?.length) {
        setNotices((current) => ({ ...current, [panel.position]: "ERROR · EMPTY_NARRATION_OUTPUT · stage=OUTPUT_VALIDATION · The selected local writer returned no printed text. Next: Regenerate, or intentionally choose No Bubble." }));
        return;
      }
      setDrafts((current) => ({
        ...current,
        [panel.position]: {
          sourceKey,
          narration: proposed.narration,
          bubbles: proposed.bubbles,
          reviewedShotBrief,
        },
      }));
      setNotices((current) => ({ ...current, [panel.position]: "Draft ready for review. Save & Lock, Regenerate, or choose No Bubble." }));
    } catch (error) {
      if (!controller.signal.aborted) {
        setNotices((current) => ({
          ...current,
          [panel.position]: error instanceof Error && error.message.startsWith("ERROR · ") ? error.message : `ERROR · NARRATION_REQUEST_FAILED · stage=REQUEST · ${error instanceof Error ? error.message : "Narration generation failed."} · Next: verify your unlocked profile and selected local Writing route.`,
        }));
      }
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      setBusyPosition((current) => current === panel.position ? null : current);
    }
  }

  return (
    <section className={styles.lockedShotHandoff} data-storyboard-locked-shot-handoff="previs" data-embedded={embedded ? "true" : "false"} aria-label={embedded ? `Previs handoff for Shot ${position}` : undefined} aria-labelledby={!embedded ? "storyboard-locked-shot-handoff-title" : undefined}>
      {!embedded ? <header>
        <div>
          <span className={styles.eyebrow}>Storyboard detail</span>
          <h3 id="storyboard-locked-shot-handoff-title">Locked Shot handoff to Previs</h3>
        </div>
        <strong>{lockedArtifacts.length} of 25 Shots locked · {25 - lockedArtifacts.length} still open</strong>
      </header> : null}

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
            const brief = shotBriefs[position];
            const approvalState = currentApproval(panel, brief);
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
            const beatContext = compact((anchor?.beats ?? []).map((beat) => compact([beat.label, beat.visualAction, beat.purpose])));
            const sceneBeat = compact([
              anchorScenes.length ? `Scene context for this Mini-Block: ${anchorScenes.join("; ")}` : "",
              beatContext ? `Authored Mini-Block Beat context (not assigned to this Shot): ${beatContext}` : "No authored Beat is mapped to this Mini-Block",
            ]);
            const shotFacts = {
              story: compact([storyboardNarrationAuthoredIntention(artifact.narrativeIntention), shot?.narrativePurpose, shot?.visualIntent]),
              sceneBeat,
              camera,
              performance,
              lighting: shot?.lightingIntent ?? "",
              timing: duration !== null ? `${duration}s authored` : "~3s Storyboard planning target",
              informationBoundary: directives,
              continuity: transitions || compact([shot?.transitionIn, shot?.transitionOut]),
              imagePrompt: artifact.prompt?.trim() ?? "",
            };
            return (
              <article className={styles.handoffRow} data-storyboard-handoff-shot={position} key={artifact.id}>
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
                  {!shotFacts.story ? (
                    <small>Recovered-image provenance is not an authored Shot intention. This Local text writer uses screenplay context; it has not inspected this image. Review any proposal against the image before approving.</small>
                  ) : null}
                  {brief ? (
                    <div className={styles.handoffDraft} aria-label={"Reviewed Shot brief for Shot " + position}>
                      <strong>Shot brief · review only</strong>
                      <p>{brief.analysis}</p>
                      <small>Existing authored fields remain unchanged. Edit proposed missing details below; the text-only writer cannot inspect image pixels.</small>
                      {Object.entries(brief.facts).filter(([field]) => !shotFacts[field]?.trim()).map(([field, value]) => (
                        <label key={field}>{field === "imagePrompt" ? "Image prompt proposal" : field.replace(/[A-Z]/gu, (letter) => " " + letter.toLowerCase())}
                          <textarea value={value} maxLength={field === "imagePrompt" ? 8_000 : 1_200} onChange={(event) => setShotBriefs((current) => ({ ...current, [position]: { ...brief, facts: { ...brief.facts, [field]: event.currentTarget.value } } }))} />
                        </label>
                      ))}
                      <button type="button" disabled={busyPosition !== null || savingPosition !== null} onClick={() => void generateNarration(panel, brief.facts, brief)}>{busyPosition === position ? "Creating…" : "Create Narration from Reviewed Brief"}</button>
                    </div>
                  ) : null}
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
                      <button type="button" disabled={busyPosition !== null || savingPosition !== null || (!draft.narration && !draft.bubbles.length)} onClick={() => void saveApproval(panel, draft.sourceKey, draft.narration, draft.bubbles, false, draft.reviewedShotBrief)}>{savingPosition === position ? "Saving…" : "Save & Lock"}</button>
                    </div>
                  ) : null}

                  <div className={styles.handoffNarrationActions}>
                    <button
                      disabled={busyPosition !== null || savingPosition !== null || (!authoredSequencePassages.length && !sequenceShots[position - 1]?.intention)}
                      type="button"
                      onClick={() => void prepareShotBrief(panel, shotFacts)}
                    >
                      {busyPosition === position ? "Preparing…" : brief ? "Reprepare Shot Brief" : "Analyze Shot & Prepare Brief"}
                    </button>
                    {draft && brief ? <button type="button" onClick={() => void generateNarration(panel, brief.facts, brief)} disabled={busyPosition !== null || savingPosition !== null}>Regenerate Narration</button> : null}
                    <button
                      disabled={busyPosition !== null || savingPosition !== null}
                      type="button"
                      onClick={() => void saveApproval(panel, approvalState.sourceKey, "", [], true, brief ?? approvalState.current?.reviewedShotBrief)}
                    >{savingPosition === position ? "Saving…" : "No Bubble"}</button>
                  </div>
                  <small role={notices[position]?.startsWith("ERROR · ") ? "alert" : "status"} data-narration-failure={notices[position]?.startsWith("ERROR · ") ? "true" : "false"}>{notices[position] ?? (approvalState.current ? "Saved and locked decision will appear unchanged in Storyboard and Previs." : "Human approval is required before generated text becomes current.")}</small>
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
