"use client";

/* eslint-disable @next/next/no-img-element -- bundled Storyboard references are local PlotPickle assets. */

import { useEffect, useMemo, useState } from "react";
import type { PPFProject } from "@/core/project/project";
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
  const selectedTarget = blocks.find((target) => blockNumber(target) === selectedBlockNumber) ?? blocks[0] ?? null;
  const selectedNumber = selectedTarget ? blockNumber(selectedTarget) : 1;
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

  function preserveStoryboardAddress(block: number, mini: number) {
    const url = new URL(window.location.href);
    url.searchParams.set("block", String(block));
    url.searchParams.set("mini", String(mini));
    window.history.replaceState(window.history.state, "", url);
  }

  function selectStoryboardAddress(block: number, mini: number) {
    setSelectedBlockNumber(block);
    setSelectedMiniBlockNumber(mini);
    preserveStoryboardAddress(block, mini);
    onAddressChange?.({ blockNumber: block, miniBlockNumber: mini });
  }

  return (
    <main className={styles.workspace} aria-labelledby="storyboard-readiness-title">
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Storyboard · 4 Acts / 24 Blocks / 96 Mini-Block anchors</span>
          <h1 id="storyboard-readiness-title">Storyboard · {project.title || "Untitled Story"}</h1>
          <p>
            Choose an Act, then a Block and Mini-Block. Scenes and Beats shape a sequence of storyboard images at each address. The 24/96 scaffold keeps visuals traceable; it is not a fixed final-frame quota.
          </p>
        </div>
        <dl className={styles.summary}>
          <div><dt>PPF revision</dt><dd>{project.revision}</dd></div>
          <div><dt>Visual anchors</dt><dd>96</dd></div>
          <div><dt>Act {selectedAct} Blocks with mapped text</dt><dd>{actBlocks.filter((target) => target.storyboardAllowed).length} / 6</dd></div>
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
                <span className={styles.eyebrow}>Scene → Beat → Storyboard images</span>
                <h3>Mini-Block {selectedNumber}.{selectedMiniBlockNumber} · Scenes &amp; Beats</h3>
                <p>{selectedScenes.length} mapped Scene{selectedScenes.length === 1 ? "" : "s"} at this anchor. The Storyboard navigation remains visible above while you work.</p>
              </div>
              <small>25 vertical planning positions · no fixed image quota</small>
            </header>
            <div className={styles.sceneList}>
              {blockScenes.length ? blockScenes.map((scene) => <article key={scene.id} data-storyboard-scene-id={scene.id}><strong>{scene.title}</strong><small>Scene spans {scene.relatedMiniBlockIds.length} Mini-Block{scene.relatedMiniBlockIds.length === 1 ? "" : "s"}</small><p>{scene.purpose || "Scene mapped from screenplay; visual Beat planning remains open."}</p></article>) : <p>No Scene is mapped to this Block yet. Visual positions remain available without inventing a Scene.</p>}
            </div>
            <div className={styles.beatList}><strong>Authored Beats</strong>{blockBeats.length ? blockBeats.map((beat) => <p key={`${beat.anchorRef}-${beat.id}`}>{beat.anchorRef} · {String(beat.order).padStart(2, "0")} · {beat.label || beat.visualAction || beat.purpose}</p>) : <p>No authored Beat is mapped to this Block yet. Scene passages are evidence, not automatically named Beats.</p>}</div>
            <div className={styles.visualSequence}>
              <strong>Scene / Beat positions 01–25</strong>
              <p>Each row keeps the planning position, its current image and an image selector together. Working selections here do not silently change the canonical kept Storyboard visual.</p>
              <div className={styles.positionList} aria-label="25 storyboard Scene and Beat positions">
                {Array.from({ length: 25 }, (_, index) => {
                  const position = index + 1;
                  const beat = blockBeats[index];
                  const selectionKey = `${selectedNumber}.${selectedMiniBlockNumber}.${position}`;
                  const selectedImageId = selectedImageByPosition[selectionKey] ?? availablePositionImages[index]?.id ?? "";
                  const selectedImage = availablePositionImages.find((image) => image.id === selectedImageId) ?? null;
                  return (
                    <div className={styles.positionRow} data-storyboard-position={position} key={position}>
                      <div className={styles.positionIdentity}>
                        <strong>Scene / Beat {String(position).padStart(2, "0")}</strong>
                        <span>{beat ? beat.label || beat.visualAction || beat.purpose || `Beat ${beat.order}` : "Open planning position"}</span>
                      </div>
                      <div className={styles.positionImage}>
                        {selectedImage
                          ? <img alt={selectedImage.label} decoding="async" loading="lazy" src={selectedImage.assetUrl} />
                          : <span>No image selected</span>}
                      </div>
                      <label className={styles.positionSelector}>
                        <span>Image</span>
                        <select
                          aria-label={`Select image for Scene and Beat position ${position}`}
                          value={selectedImageId}
                          onChange={(event) => setSelectedImageByPosition((current) => ({ ...current, [selectionKey]: event.target.value }))}
                        >
                          <option value="">No image selected</option>
                          {availablePositionImages.map((image) => <option key={image.id} value={image.id}>{image.label}</option>)}
                        </select>
                      </label>
                    </div>
                  );
                })}
              </div>
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
        Four Acts contain six Blocks each, with four Mini-Block visual anchors per Block. Scenes and Beats can call for any number of storyboard images. The 25 planning positions help organize coverage without prescribing a fixed image count.
      </footer>
    </main>
  );
}
