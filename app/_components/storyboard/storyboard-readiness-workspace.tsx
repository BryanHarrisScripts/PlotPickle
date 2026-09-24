"use client";

/* eslint-disable @next/next/no-img-element -- bundled Storyboard references are local PlotPickle assets. */

import { useEffect, useMemo, useRef, useState } from "react";
import type { PPFProject } from "@/core/project/project";
import type { FoundationsVisualArtifact } from "@/core/contracts/build-progress";
import { applyStoryCommand } from "@/core/project/apply-command";
import { loadFoundationProject, saveFoundationProject } from "@/core/storage/foundation-project-browser";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import { hasQaWorkspaceAccess, isQaAccessOverride } from "@/core/progression/qa-access";
import { sequenceDirectorAnchorRef } from "@/core/contracts/sequence-director";
import { deriveVisualReadiness, type VisualReadinessTarget } from "@/modules/build/visual-readiness";
import { currentOutlineAssessment } from "@/modules/plan/outline-agent-assessment";
import { deriveOutlineReadiness } from "@/modules/plan/outline-readiness";
import type { PlotPickleProject } from "@/lib/projects/project";
import type { ProviderInstructionBundle } from "@/lib/preproduction/provider-instruction-compiler";
import { projectPreproductionSemantics } from "@/lib/preproduction/semantic-projection";
import { projectVisualStory } from "@/lib/preproduction/visual-story-projection";
import { storyboardFramePrompt, storyboardPositionDirection } from "./storyboard-editorial-model";
import VisualStoryWorkspace from "./visual-story-workspace";
import {
  storyboardAnchorEvidence,
  storyboardAnchorTargetRef,
  storyboardReferenceCandidates,
} from "./storyboard-editorial-model";
import styles from "./storyboard-readiness-workspace.module.css";

const STATE_LABELS = {
  defined: "DEFINED",
  observed: "OBSERVED",
  emerging: "EMERGING",
  missing: "MISSING",
  locked: "LOCKED",
} as const;

function blockNumber(target: VisualReadinessTarget) {
  const match = target.id.match(/^block:block-(\d{2})$/);
  return match ? Number(match[1]) : 0;
}

function boundedBlockNumber(value: number | undefined) {
  return Number.isFinite(value) ? Math.min(24, Math.max(1, Math.trunc(value ?? 1))) : 1;
}

function boundedMiniBlockNumber(value: number | undefined) {
  return Number.isFinite(value) ? Math.min(4, Math.max(1, Math.trunc(value ?? 1))) : 1;
}

export default function StoryboardReadinessWorkspace({
  project,
  legacyProject,
  providerInstructions = null,
  onProjectChange,
  onAddressChange,
  initialBlockNumber,
  initialMiniBlockNumber,
  initialSceneId,
  initialShotId,
  initialVisualView,
  embeddedNavigation = false,
}: {
  readonly project: LibraryPPFProject;
  readonly legacyProject: PlotPickleProject | null;
  readonly providerInstructions?: ProviderInstructionBundle | null;
  readonly onProjectChange: (project: PPFProject) => void;
  readonly onOpenBuild: (blockNumber: number, miniBlockNumber: number) => void;
  readonly onAddressChange?: (address: { blockNumber: number; miniBlockNumber: number }) => void;
  readonly initialBlockNumber?: number;
  readonly initialMiniBlockNumber?: number;
  readonly initialSceneId?: string;
  readonly initialShotId?: string;
  readonly initialVisualView?: "story" | "timeline";
  readonly embeddedNavigation?: boolean;
  readonly onOpenPrevis: (blockNumber: number, miniBlockNumber: number) => void;
}) {
  const readiness = deriveVisualReadiness({ project });
  const blocks = readiness.targets
    .filter((target) => target.kind === "block")
    .sort((left, right) => blockNumber(left) - blockNumber(right));
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(() => boundedBlockNumber(initialBlockNumber));
  const [selectedMiniBlockNumber, setSelectedMiniBlockNumber] = useState(() => boundedMiniBlockNumber(initialMiniBlockNumber));
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedBlockNumber(boundedBlockNumber(initialBlockNumber));
      setSelectedMiniBlockNumber(boundedMiniBlockNumber(initialMiniBlockNumber));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialBlockNumber, initialMiniBlockNumber]);
  const [selectedImageByPosition, setSelectedImageByPosition] = useState<Readonly<Record<string, string>>>({});
  const [promptPosition, setPromptPosition] = useState<number | null>(null);
  const activePromptPositionRef = useRef<number | null>(null);
  const [framePrompt, setFramePrompt] = useState("");
  const [frameConsent, setFrameConsent] = useState(false);
  const [frameBusy, setFrameBusy] = useState(false);
  const [agentConsent, setAgentConsent] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [frameNotice, setFrameNotice] = useState("");
  const selectedTarget = blocks.find((target) => blockNumber(target) === selectedBlockNumber) ?? blocks[0] ?? null;
  const selectedNumber = selectedTarget ? blockNumber(selectedTarget) : 1;
  const activeAddressRef = useRef({ block: selectedNumber, mini: selectedMiniBlockNumber });
  activeAddressRef.current = { block: selectedNumber, mini: selectedMiniBlockNumber };
  const selectedStructureBlock = project.structure.blocks.find((block) => block.number === selectedNumber) ?? null;
  const selectedSequenceNumber = selectedStructureBlock?.sequenceNumber ?? Math.ceil(selectedNumber / 2);
  const selectedSequenceBlocks = project.structure.blocks
    .filter((block) => block.sequenceNumber === selectedSequenceNumber)
    .map((block) => block.number)
    .sort((left, right) => left - right);
  const selectedAct = Math.ceil(selectedNumber / 6);
  const actBlocks = blocks.filter((target) => Math.ceil(blockNumber(target) / 6) === selectedAct);
  const outline = deriveOutlineReadiness(project).find((item) => item.blockNumber === selectedNumber);
  const outlineAssessment = currentOutlineAssessment(project, selectedNumber);
  const storyboardAccessible = selectedTarget ? hasQaWorkspaceAccess(selectedTarget.storyboardAllowed) : false;
  const qaOnlyAccess = selectedTarget ? isQaAccessOverride(selectedTarget.storyboardAllowed) : false;
  const selectedReferences = useMemo(
    () => selectedTarget ? storyboardReferenceCandidates(project, selectedTarget.id) : [],
    [project, selectedTarget],
  );
  const semantics = useMemo(() => projectPreproductionSemantics(project, legacyProject), [project, legacyProject]);
  const selectedMiniId = project.structure.blocks.find((block) => block.number === selectedNumber)?.miniBlocks.find((mini) => mini.ordinal === selectedMiniBlockNumber)?.id;
  const sceneIds = semantics.miniBlockSceneRelations.find((relation) => relation.miniBlockId === selectedMiniId)?.sceneIds ?? [];
  const selectedScenes = semantics.scenes.filter((scene) => sceneIds.includes(scene.id));
  const blockMiniIds = new Set(project.structure.blocks.find((block) => block.number === selectedNumber)?.miniBlocks.map((mini) => mini.id) ?? []);
  const blockSceneIds = new Set(semantics.miniBlockSceneRelations.filter((relation) => blockMiniIds.has(relation.miniBlockId)).flatMap((relation) => relation.sceneIds));
  const blockScenes = semantics.scenes.filter((scene) => blockSceneIds.has(scene.id));
  const visualStory = projectVisualStory({ project, legacyProject, blockNumber: selectedNumber, miniBlockNumber: selectedMiniBlockNumber });
  const blockBeats = visualStory.anchors.flatMap((anchor) => anchor.beats.map((beat) => ({ ...beat, anchorRef: anchor.anchorRef })));
  const selectedVisualAnchor = visualStory.anchors.find((anchor) => anchor.anchorRef === sequenceDirectorAnchorRef(selectedNumber, selectedMiniBlockNumber));
  const miniReferences = selectedReferences.filter((candidate) => candidate.miniBlockNumber === selectedMiniBlockNumber);
  const availablePositionImages = [
    ...project.build.foundations.visualArtifacts.filter((artifact) => (artifact.sourceDecisionKeys ?? []).includes(`storyboard-anchor:block:block-${String(selectedNumber).padStart(2, "0")}:mini-${selectedMiniBlockNumber}`) && artifact.reviewState !== "rejected").map((artifact) => ({ id: artifact.id, assetUrl: artifact.assetUrl, label: artifact.narrativeIntention || "Generated frame candidate" })),
    ...(selectedVisualAnchor?.frames ?? []).map((frame) => ({
      id: frame.id,
      assetUrl: frame.assetUrl,
      label: `${frame.accepted ? "Kept" : "Candidate"} · ${frame.narrativePurpose || frame.id}`,
    })),
    ...miniReferences.map((reference) => ({
      id: reference.id,
      assetUrl: reference.assetUrl,
      label: reference.caption,
    })),
  ].filter((image, index, all) => all.findIndex((candidate) => candidate.assetUrl === image.assetUrl) === index);

  function prepareFramePrompt(position: number) {
    const shot = selectedVisualAnchor?.shots.find((candidate) => candidate.order === position);
    const evidence = storyboardAnchorEvidence(project, `block:block-${String(selectedNumber).padStart(2, "0")}`, selectedMiniBlockNumber);
    setFramePrompt(storyboardFramePrompt({
      title: project.title,
      blockNumber: selectedNumber,
      miniBlockNumber: selectedMiniBlockNumber,
      position,
      scene: selectedScenes.map((scene) => [scene.title, scene.purpose].filter(Boolean).join(" — ")).join("; "),
      beat: selectedVisualAnchor?.beats.map((beat) => beat.visualAction || beat.purpose || beat.label).filter(Boolean).join("; ") ?? "",
      shot: shot ? [shot.narrativePurpose, shot.visualIntent, shot.shotSize, shot.angle, shot.movement].filter(Boolean).join("; ") : "",
      source: evidence.passages.map((passage) => passage.text).join(" "),
    }));
    activePromptPositionRef.current = position;
    setPromptPosition(position);
    setFrameConsent(false);
    setAgentConsent(false);
    setFrameNotice("");
  }

  async function refineFramePrompt() {
    if (agentBusy || !agentConsent || promptPosition === null || !framePrompt.trim()) return;
    const address = { ...activeAddressRef.current, position: promptPosition, projectId: project.id };
    setAgentBusy(true);
    setFrameNotice("Asking PlotPickle's Visual Director to refine this position…");
    try {
      const response = await fetch("/api/writing-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "visual-director", tone: "direct", history: [],
          message: `Use this Storyboard prompt skill to refine ONE image prompt for position ${address.position}. Keep the unique shot purpose, observed scene, source window and any authored shot. Check story causality and visual continuity. Do not invent a Beat, Shot, person, prop, or canonical fact. Return only an image generation prompt; no commentary.\n\n${framePrompt.trim().slice(0, 9000)}`,
        }),
      });
      const result = await response.json() as { ok?: boolean; text?: string; message?: string; runtime?: string; agentId?: string };
      if (!response.ok || !result.ok || result.runtime !== "mastra" || result.agentId !== "visual-director" || !result.text?.trim()) {
        throw new Error(result.message || "The Visual Director did not return a usable prompt.");
      }
      if (activeAddressRef.current.block !== address.block || activeAddressRef.current.mini !== address.mini || activePromptPositionRef.current !== address.position || loadFoundationProject().id !== address.projectId) {
        throw new Error("The story address changed. The late Agent response was not applied.");
      }
      setFramePrompt(result.text.trim());
      setFrameNotice("Visual Director proposal ready to edit. Review it before approving an image request.");
      setFrameConsent(false);
    } catch (error) {
      setFrameNotice(error instanceof Error ? error.message : "The Agent request failed; the position prompt remains available.");
    } finally {
      setAgentBusy(false);
    }
  }

  async function generateFrame() {
    if (frameBusy || promptPosition === null || !frameConsent || !framePrompt.trim()) return;
    const block = selectedNumber;
    const mini = selectedMiniBlockNumber;
    const position = promptPosition;
    const projectId = project.id;
    const prompt = framePrompt.trim();
    setFrameBusy(true);
    setFrameNotice("Creating a WebP frame candidate…");
    try {
      const response = await fetch("/api/local-ai/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, assetId: `storyboard-${projectId}-${block}-${mini}-${position}-${Date.now()}`, aspect: "landscape", quality: "low", outputFormat: "webp", requestCount: 1, billingAcknowledged: true }),
      });
      const result = await response.json() as { ok?: boolean; assetUrl?: string; provider?: string; model?: string; message?: string };
      if (!response.ok || !result.ok || !result.assetUrl?.endsWith(".webp")) throw new Error(result.message || "The image route did not return a WebP frame.");
      const current = loadFoundationProject();
      if (current.id !== projectId || activeAddressRef.current.block !== block || activeAddressRef.current.mini !== mini) throw new Error("The active story address changed while generating. The late image was not attached.");
      const now = new Date().toISOString();
      const artifact: FoundationsVisualArtifact = {
        id: globalThis.crypto.randomUUID(),
        assetUrl: result.assetUrl,
        prompt,
        createdAt: now,
        provider: result.provider || "configured image route",
        model: result.model || "",
        frameNumber: position,
        narrativeIntention: `Storyboard frame candidate · position ${String(position).padStart(2, "0")}`,
        sourceDecisionKeys: [`storyboard-target:block:block-${String(block).padStart(2, "0")}`, `storyboard-anchor:block:block-${String(block).padStart(2, "0")}:mini-${mini}`, `storyboard-position:${position}`, `ppf-revision:${current.revision}`],
        workflow: "storyboard-frame-webp-v1",
        reviewState: "draft",
        parentArtifactId: null,
      };
      const next = applyStoryCommand(current, { type: "foundations.visual.store", artifact, occurredAt: now });
      saveFoundationProject(next);
      onProjectChange(next);
      setSelectedImageByPosition((values) => ({ ...values, [`${block}.${mini}.${position}`]: artifact.id }));
      setFrameNotice("WebP frame candidate saved for review. It has not been kept or made canon.");
    } catch (error) {
      setFrameNotice(error instanceof Error ? error.message : "Frame generation failed.");
    } finally {
      setFrameBusy(false);
    }
  }

  function preserveStoryboardAddress(block: number, mini: number) {
    const url = new URL(window.location.href);
    url.searchParams.set("block", String(block));
    url.searchParams.set("mini", String(mini));
    window.history.replaceState(window.history.state, "", url);
  }

  function selectStoryboardAddress(block: number, mini: number) {
    setSelectedBlockNumber(block);
    setSelectedMiniBlockNumber(mini);
    activePromptPositionRef.current = null;
    setPromptPosition(null);
    setFrameConsent(false);
    setAgentConsent(false);
    preserveStoryboardAddress(block, mini);
    onAddressChange?.({ blockNumber: block, miniBlockNumber: mini });
  }

  return (
    <main className={styles.workspace} aria-labelledby="storyboard-readiness-title">
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Sequence → Block → Mini-Block → Scene → Beat → Shot → Frame</span>
          <h1 id="storyboard-readiness-title">Storyboard · {project.title || "Untitled Story"}</h1>
          <p>
            Storyboard inherits Scene and Beat from the story structure, then adds Shot and Frame. Shot is the director/cinematographer view of the moment; Frame is the still image representing that Shot. The 25 positions are available Shot/Frame capacity, not 25 Beats.
          </p>
        </div>
        <dl className={styles.summary}>
          <div><dt>Sequence</dt><dd>{String(selectedSequenceNumber).padStart(2, "0")} · Blocks {selectedSequenceBlocks.map((number) => String(number).padStart(2, "0")).join("–")}</dd></div>
          <div><dt>Mini-Block</dt><dd>{selectedNumber}.{selectedMiniBlockNumber} · ≈75 sec</dd></div>
          <div><dt>Visual anchors</dt><dd>96</dd></div>
          <div><dt>Act {selectedAct} mapped Blocks</dt><dd>{actBlocks.filter((target) => target.storyboardAllowed).length} / 6</dd></div>
        </dl>
      </header>

      {!embeddedNavigation ? <nav aria-label="Storyboard Acts" className={styles.actRail} role="tablist">
        {[1, 2, 3, 4].map((act) => (
          <button aria-controls="storyboard-act-panel" aria-selected={selectedAct === act} className={styles.actTab} key={act} onClick={() => {
            const firstBlock = (act - 1) * 6 + 1;
            selectStoryboardAddress(firstBlock, 1);
          }} role="tab" type="button">Act {act}</button>
        ))}
      </nav> : null}

      {!embeddedNavigation ? <section id="storyboard-act-panel" aria-label={`Act ${selectedAct} Storyboard`} role="tabpanel">
        <nav aria-label="Storyboard Block tabs" className={styles.tabRail}>
          {actBlocks.map((target) => {
            const number = blockNumber(target);
            return <button aria-current={number === selectedNumber ? "true" : undefined} aria-label={`Act ${selectedAct} Block ${number - (selectedAct - 1) * 6}, ${STATE_LABELS[target.state]}`} className={styles.blockTab} data-state={target.state} key={target.id} onClick={() => {
              selectStoryboardAddress(number, 1);
            }} type="button"><i aria-hidden="true" className={styles.stateLight} /><span>Block {number - (selectedAct - 1) * 6}</span></button>;
          })}
        </nav>
      </section> : null}

      {selectedTarget ? (
        <section
          aria-label={`Block ${String(selectedNumber).padStart(2, "0")} Storyboard workspace`}
          className={styles.blockWorkspace}
          data-state={selectedTarget.state}
          id="storyboard-block-panel"
          role="tabpanel"
        >
          <header className={styles.blockHeader}>
            <div>
              <p className={styles.blockKicker}>Block {String(selectedNumber).padStart(2, "0")}</p>
              <h2>{selectedTarget.label.replace(/^Block \d+: /, "")}</h2>
              <p>{selectedTarget.storyboardAllowed
                ? "Screenplay placement allows visual exploration. Select a Mini-Block in the Storyboard map above; its Scenes, Beats and image positions stay on this page."
                : qaOnlyAccess
                  ? `QA access is open for this Block. Canonical prerequisites remain unresolved: ${selectedTarget.missingPrerequisites.join(" · ") || "BUILD evidence is incomplete."}`
                  : selectedTarget.missingPrerequisites.join(" · ") || "This Block remains visible but is not ready for visual authoring."}</p>
            </div>
            <span aria-label={`Status: ${STATE_LABELS[selectedTarget.state]}`} className={styles.blockState} data-state={selectedTarget.state}>
              <i aria-hidden="true" className={styles.stateLight} />
              <strong>{STATE_LABELS[selectedTarget.state]}</strong>
            </span>
          </header>
          <details className={styles.outlineHandoff} aria-label={`Block ${selectedNumber} Outline to Storyboard handoff`} data-outline-handoff={outline?.status ?? "review"}>
            <summary>Outline handoff · {outline?.status === "needs-support" ? "Needs support" : outline?.status === "review" ? "Review" : "Evidence ready"}</summary>
            <p>{outlineAssessment ? `${outlineAssessment.structural.state.replaceAll("-", " / ")}: ${outlineAssessment.structural.reason}` : "Story Architect has not assessed this Block against the screenplay. Observed passage placement is not a structural finding."}</p>
            {outline?.issues.length ? <ul>{outline.issues.slice(0, 4).map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
            <a href={`/?workspace=dashboard&block=${selectedNumber}&mini=${selectedMiniBlockNumber}`}>Back to Dashboard · open Outline at this Block</a>
          </details>

          <div className={styles.miniBlockGrid} aria-label={`Block ${selectedNumber} Mini-Block visual anchors`}>
            {[1, 2, 3, 4].map((miniNumber) => {
              const reference = selectedReferences.find((candidate) => candidate.miniBlockNumber === miniNumber);
              const anchorEvidence = storyboardAnchorEvidence(project, selectedTarget.id, miniNumber);
              return (
                <article
                  className={styles.miniBlock}
                  data-authorable={storyboardAccessible ? "true" : "false"}
                  data-selected={selectedMiniBlockNumber === miniNumber ? "true" : undefined}
                  data-story-decision-target={storyboardAnchorTargetRef(selectedTarget.id, miniNumber)}
                  key={miniNumber}
                >
                  <div className={styles.miniPreview}>
                    {reference
                      ? <img alt={reference.caption} decoding="async" loading="lazy" src={reference.assetUrl} />
                      : <span aria-hidden="true" className={styles.emptyFrame}>+</span>}
                  </div>
                  <header>
                    <div>
                      <span>Mini-Block anchor</span>
                      <strong>{selectedNumber}.{miniNumber}</strong>
                    </div>
                    <i aria-label={`Status: ${STATE_LABELS[selectedTarget.state]}`} className={styles.stateLight} data-state={selectedTarget.state} />
                  </header>
                  <p>{reference?.caption || (selectedTarget.storyboardAllowed
                    ? "Visual anchor is ready, but no candidate has been attached yet."
                    : qaOnlyAccess
                      ? "QA access is open. A real visual candidate is still required before this anchor can be reviewed."
                      : "Visual anchor reserved. BUILD evidence must mature before authoring begins.")}</p>
                  {outlineAssessment?.miniBlocks[miniNumber - 1] ? <p className={styles.outlineCue}>Outline cue · {outlineAssessment.miniBlocks[miniNumber - 1].storyboardCue || outlineAssessment.miniBlocks[miniNumber - 1].reason}</p> : null}
                  <small className={styles.anchorEvidence}>
                    {anchorEvidence.passages.length} screenplay passage{anchorEvidence.passages.length === 1 ? "" : "s"} · {reference
                      ? reference.acceptedArtifactId
                        ? "kept visual"
                        : reference.sourceKind === "historical-storyboard"
                          ? "historical reference candidate"
                          : "replacement concept candidate"
                      : "no visual candidate"}
                  </small>
                </article>
              );
            })}
          </div>

          <section className={styles.visualBreakdown} data-storyboard-scene-beat-detail="inline" aria-label={`Block ${selectedNumber} Mini-Block ${selectedMiniBlockNumber} Scene and Beat visuals`}>
            <header>
              <div>
                <span className={styles.eyebrow}>Scene → Beat → Shot → Frame</span>
                <h3>Mini-Block {selectedNumber}.{selectedMiniBlockNumber} · Scenes &amp; Beats</h3>
                <p>{selectedScenes.length} mapped Scene{selectedScenes.length === 1 ? "" : "s"} at this anchor. The Storyboard navigation remains visible above while you work.</p>
              </div>
              <small>25 available Shot / Frame positions · no fixed Shot quota</small>
            </header>
            <div className={styles.sceneList}>
              {blockScenes.length ? blockScenes.map((scene) => <article key={scene.id} data-storyboard-scene-id={scene.id}><strong>{scene.title}</strong><small>Scene spans {scene.relatedMiniBlockIds.length} Mini-Block{scene.relatedMiniBlockIds.length === 1 ? "" : "s"}</small><p>{scene.purpose || "Scene mapped from screenplay; visual Beat planning remains open."}</p></article>) : <p>No Scene is mapped to this Block yet. Visual positions remain available without inventing a Scene.</p>}
            </div>
            <div className={styles.beatList}><strong>Authored Beats</strong>{blockBeats.length ? blockBeats.map((beat) => <p key={`${beat.anchorRef}-${beat.id}`}>{beat.anchorRef} · {String(beat.order).padStart(2, "0")} · {beat.label || beat.visualAction || beat.purpose}</p>) : <p>No authored Beat is mapped to this Block yet. Scene passages are evidence, not automatically named Beats.</p>}</div>
            <div className={styles.visualSequence}>
              <strong>Storyboard Positions 01–25 · Shot / Frame capacity</strong>
              <p>These are available visual positions, not 25 Beats. A Beat may use several Shots, and unused positions stay empty. Existing authored Shots and linked Frames appear at their Shot order without manufacturing missing story structure.</p>
              <div className={styles.positionList} aria-label="25 storyboard Shot and Frame positions">
                {Array.from({ length: 25 }, (_, index) => {
                  const position = index + 1;
                  const shot = selectedVisualAnchor?.shots.find((candidate) => candidate.order === position) ?? null;
                  const selectionKey = `${selectedNumber}.${selectedMiniBlockNumber}.${position}`;
                  const selectedImageId = selectedImageByPosition[selectionKey] ?? shot?.frames[0]?.id ?? "";
                  const selectedImage = availablePositionImages.find((image) => image.id === selectedImageId) ?? null;
                  const shotLabel = shot
                    ? [`Shot ${String(shot.order).padStart(2, "0")}`, shot.shotSize || shot.angle, shot.narrativePurpose || shot.visualIntent].filter(Boolean).join(" · ")
                    : storyboardPositionDirection(position)[0];
                  return (
                    <div className={styles.positionRow} data-storyboard-position={position} key={position}>
                      <div className={styles.positionIdentity}>
                        <strong>Position {String(position).padStart(2, "0")}</strong>
                        <span>{shotLabel}</span>
                      </div>
                      <div className={styles.positionImage}>
                        {selectedImage
                          ? <img alt={selectedImage.label} decoding="async" loading="lazy" src={selectedImage.assetUrl} />
                          : <span>No Frame selected</span>}
                      </div>
                      <label className={styles.positionSelector}>
                        <span>Frame</span>
                        <select
                          aria-label={`Select Frame for Storyboard position ${position}`}
                          value={selectedImageId}
                          onChange={(event) => setSelectedImageByPosition((current) => ({ ...current, [selectionKey]: event.target.value }))}
                        >
                          <option value="">No Frame selected</option>
                          {availablePositionImages.map((image) => <option key={image.id} value={image.id}>{image.label}</option>)}
                        </select>
                      </label>
                      <button className={styles.framePromptButton} type="button" onClick={() => prepareFramePrompt(position)}>Prepare position prompt</button>
                    </div>
                  );
                })}
              </div>
              {promptPosition !== null ? (
                <section className={styles.framePromptPanel} aria-label={`Frame prompt for position ${promptPosition}`}>
                  <h4>Position {String(promptPosition).padStart(2, "0")} · WebP frame candidate</h4>
                  <p>Position {promptPosition} has its own shot purpose and a focused screenplay passage. PlotPickle's story, visual direction and continuity instructions guide this editable brief. Preparing it makes no provider request.</p>
                  <textarea aria-label="Editable storyboard frame prompt" rows={6} value={framePrompt} onChange={(event) => setFramePrompt(event.target.value)} />
                  <label><input type="checkbox" checked={agentConsent} onChange={(event) => setAgentConsent(event.target.checked)} /> I approve sending this story excerpt to my configured PlotPickle Agent provider; cloud routes may charge my account.</label>
                  <button type="button" disabled={!agentConsent || agentBusy || frameBusy || !framePrompt.trim()} onClick={() => void refineFramePrompt()}>{agentBusy ? "Refining with Visual Director…" : "Refine with PlotPickle Visual Director"}</button>
                  <label><input type="checkbox" checked={frameConsent} onChange={(event) => setFrameConsent(event.target.checked)} /> I approve this single image request through my configured provider; cloud routes may charge my account.</label>
                  <button type="button" disabled={!frameConsent || !framePrompt.trim() || frameBusy || agentBusy} onClick={() => void generateFrame()}>{frameBusy ? "Creating WebP frame…" : "Generate WebP frame"}</button>
                  <p role="status">{frameNotice}</p>
                </section>
              ) : null}
            </div>

            <section className={styles.inlineVisualStory} aria-labelledby="storyboard-beat-shot-frame-title">
              <header>
                <div>
                  <span className={styles.eyebrow}>Storyboard detail</span>
                  <h3 id="storyboard-beat-shot-frame-title">Beat · Shot · Frame</h3>
                </div>
                <small>Inline for Mini-Block {selectedNumber}.{selectedMiniBlockNumber}</small>
              </header>
              <VisualStoryWorkspace
                blockNumber={selectedNumber}
                initialSceneId={initialSceneId}
                initialShotId={initialShotId}
                initialView={initialVisualView}
                allowTimeline={false}
                embedded
                legacyProject={legacyProject}
                miniBlockNumber={selectedMiniBlockNumber}
                onProjectChange={onProjectChange}
                onReturnToStoryboard={() => undefined}
                project={project}
                providerInstructions={providerInstructions}
              />
            </section>
          </section>
        </section>
      ) : null}

      <footer className={styles.footer}>
        Four Acts contain twelve Sequences, twenty-four Blocks and ninety-six Mini-Blocks. Outline owns story structure through Scene and Beat. Storyboard adds Shot and Frame. Scene, Beat and Shot counts remain flexible; the 25 positions are visual capacity, not a creative quota.
      </footer>
    </main>
  );
}
