"use client";

/* eslint-disable @next/next/no-img-element -- generated visual candidates use the existing PlotPickle media route and may be local provider assets. */

import { useEffect, useMemo, useState } from "react";
import type { FoundationsVisualArtifact } from "../../../core/contracts/build-progress";
import { authenticatedProfileFetch } from "../../../core/auth/profile-request-browser";
import { FOUNDATION_SEQUENCE_SHIFT_METADATA_ID } from "../../../core/contracts/foundation-plan";
import { applyStoryCommand } from "../../../core/project/apply-command";
import type { PPFProject } from "../../../core/project/project";
import {
  loadFoundationProject,
  saveFoundationProject,
} from "../../../core/storage/foundation-project-browser";
import {
  hydratedStoryMapContext,
  persistStoryMapContext,
} from "../../../core/storage/profile-private-browser";
import {
  deriveVisualStoryDecisionMarkers,
  type VisualStoryDecisionMarker,
  type VisualStoryDecisionSource,
} from "../decisions/visual-story-decision-markers";
import {
  deriveProgressiveStoryMap,
  type BuildStoryEvidenceState,
} from "../progressive-story-map";
import baseStyles from "./progressive-story-map.module.css";
import v2Styles from "./progressive-story-map-v2.module.css";

const styles = { ...baseStyles, ...v2Styles };

const STATE_LABELS: Readonly<Record<BuildStoryEvidenceState, string>> = {
  defined: "DEFINED",
  observed: "OBSERVED",
  emerging: "EMERGING",
  missing: "AVAILABLE",
  locked: "LOCKED",
};

const STORY_MAP_VISUAL_WORKFLOW = "story-map-visual-candidate-v1" as const;

type SequenceShiftOption = { readonly id: string; readonly from: string; readonly to: string };
type StoryDecisionListResponse = { readonly decisions?: readonly VisualStoryDecisionSource[]; readonly message?: string };
type ImageRouteStatus = {
  readonly choice?: { readonly image?: string };
  readonly image?: {
    readonly selected?: string;
    readonly options?: Readonly<Record<string, {
      readonly ready?: boolean;
      readonly locality?: string;
      readonly model?: string;
      readonly error?: string;
    }>>;
  };
};
type ImageGenerationResponse = {
  readonly ok?: boolean;
  readonly assetUrl?: string;
  readonly revisedPrompt?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly message?: string;
};

const SEQUENCE_SHIFT_OPTIONS: readonly SequenceShiftOption[] = [
  { id: "fear-courage", from: "Fear", to: "Courage" },
  { id: "ignorance-awareness", from: "Ignorance", to: "Awareness" },
  { id: "isolation-alliance", from: "Isolation", to: "Alliance" },
  { id: "certainty-doubt", from: "Certainty", to: "Doubt" },
  { id: "strength-weakness", from: "Strength", to: "Weakness" },
  { id: "control-chaos", from: "Control", to: "Chaos" },
  { id: "conflict-resolution", from: "Conflict", to: "Resolution" },
  { id: "victory-defeat", from: "Victory", to: "Defeat" },
  { id: "guilt-redemption", from: "Guilt", to: "Redemption" },
  { id: "setback-triumph", from: "Setback", to: "Triumph" },
  { id: "despair-hope", from: "Despair", to: "Hope" },
  { id: "old-self-new-self", from: "Old Self", to: "New Self" },
];

const STRUCTURAL_MARKERS: Readonly<Record<number, { readonly badge: "A1 TP" | "A2 TP" | "A3 TP" | "FINALE"; readonly meaning: string }>> = {
  3: { badge: "A1 TP", meaning: "Act 1 turning point after Sequence 03 / Card 06" },
  6: { badge: "A2 TP", meaning: "Act 2 turning point after Sequence 06 / Card 12" },
  9: { badge: "A3 TP", meaning: "Act 3 turning point after Sequence 09 / Card 18" },
  12: { badge: "FINALE", meaning: "Finale and story resolution after Sequence 12 / Card 24" },
};

function sequenceId(number: number) { return `sequence-${String(number).padStart(2, "0")}`; }
function shiftOption(id: string | undefined, sequenceNumber: number) {
  return SEQUENCE_SHIFT_OPTIONS.find((option) => option.id === id) ?? SEQUENCE_SHIFT_OPTIONS[sequenceNumber - 1] ?? SEQUENCE_SHIFT_OPTIONS[0];
}
function decisionAction(marker: VisualStoryDecisionMarker) {
  return marker.needsWorkbench
    ? { href: `/story-workbench?decisionId=${encodeURIComponent(marker.decisionId)}`, label: "Open Workbench" }
    : { href: "/story-decisions", label: marker.stale ? "Review stale Decision" : "Open Story Decisions" };
}
function boundedLocation(name: "block" | "mini", maximum: number, fallback = 1) {
  if (typeof window === "undefined") return fallback;
  const raw = new URLSearchParams(window.location.search).get(name);
  const value = Number(raw ?? fallback);
  return Number.isFinite(value) ? Math.min(maximum, Math.max(1, Math.trunc(value))) : fallback;
}
function storyboardTargetId(blockId: string) { return `block:${blockId}`; }
function storyboardAnchorRef(blockId: string, miniBlockNumber: number) {
  return `storyboard-anchor:${storyboardTargetId(blockId)}:mini-${miniBlockNumber}`;
}
function artifactTargetsAnchor(artifact: FoundationsVisualArtifact, anchorRef: string) {
  return artifact.reviewState !== "rejected" && (artifact.sourceDecisionKeys ?? []).includes(anchorRef);
}
function newVisualId(blockNumber: number, miniBlockNumber: number) {
  return globalThis.crypto?.randomUUID?.() ?? `story-map-${blockNumber}-${miniBlockNumber}-${Date.now()}`;
}

export default function ProgressiveStoryMap({ project }: { readonly project: PPFProject }) {
  const storyMap = useMemo(() => deriveProgressiveStoryMap(project), [project]);
  const sequences = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    const blocks = storyMap.blocks.filter((block) => block.sequenceNumber === number);
    return { number, id: sequenceId(number), title: blocks[0]?.sequenceTitle ?? `Sequence ${number}`, blocks, marker: STRUCTURAL_MARKERS[number] };
  }), [storyMap.blocks]);
  const rememberedContext = hydratedStoryMapContext(project.id);
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(() => boundedLocation("block", 24, rememberedContext?.blockNumber ?? 1));
  const [selectedMiniBlockNumber, setSelectedMiniBlockNumber] = useState(() => boundedLocation("mini", 4, rememberedContext?.miniBlockNumber ?? 1));
  const [openShiftSequence, setOpenShiftSequence] = useState<number | null>(null);
  const [localShifts, setLocalShifts] = useState<Readonly<Record<string, string>>>({});
  const [decisionMarkers, setDecisionMarkers] = useState<readonly VisualStoryDecisionMarker[]>([]);
  const [decisionMarkerError, setDecisionMarkerError] = useState("");
  const [routeStatus, setRouteStatus] = useState<ImageRouteStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [billingAcknowledged, setBillingAcknowledged] = useState(false);
  const [visualMessage, setVisualMessage] = useState("");
  const markersByBlock = useMemo(() => {
    const grouped = new Map<string, VisualStoryDecisionMarker[]>();
    for (const marker of decisionMarkers) {
      const current = grouped.get(marker.blockId) ?? [];
      current.push(marker);
      grouped.set(marker.blockId, current);
    }
    return grouped;
  }, [decisionMarkers]);
  const selected = storyMap.blocks.find((block) => block.number === selectedBlockNumber) ?? storyMap.blocks[0];
  const selectedMini = selected.miniBlocks.find((mini) => mini.number === selectedMiniBlockNumber) ?? selected.miniBlocks[0];
  const selectedDecisionMarkers = markersByBlock.get(selected.id) ?? [];
  const persistedShifts = project.foundations.lessons[FOUNDATION_SEQUENCE_SHIFT_METADATA_ID]?.answers ?? {};
  const anchorRef = storyboardAnchorRef(selected.id, selectedMini.number);
  const candidates = project.build.foundations.visualArtifacts.filter((artifact) => artifactTargetsAnchor(artifact, anchorRef));
  const acceptedIds = new Set(project.build.foundations.acceptedVisualArtifactIds);
  const acceptedCandidate = candidates.find((artifact) => acceptedIds.has(artifact.id) && artifact.reviewState === "accepted") ?? null;
  const selectedRoute = routeStatus?.choice?.image || routeStatus?.image?.selected || "current Settings route";
  const selectedOption = routeStatus?.image?.options?.[selectedRoute];
  const cloudRoute = selectedOption?.locality === "cloud";
  const manualRoute = selectedOption?.locality === "manual" || selectedRoute === "manual";
  const routeReady = selectedOption?.ready !== false;
  const authoringAllowed = selected.state !== "locked" && selectedMini.state !== "locked";

  const rememberPosition = (blockNumber: number, miniBlockNumber: number) => {
    void persistStoryMapContext(project.id, { blockNumber, miniBlockNumber, stage: "map" }).catch(() => undefined);
  };

  useEffect(() => { setLocalShifts({}); }, [project.revision]);
  useEffect(() => {
    const location = new URL(window.location.href);
    location.searchParams.set("workspace", "dashboard");
    location.searchParams.set("block", String(selected.number));
    location.searchParams.set("mini", String(selectedMini.number));
    window.history.replaceState({ plotpickleStoryMap: true }, "", `${location.pathname}${location.search}`);
  }, [selected.number, selectedMini.number]);
  useEffect(() => {
    let cancelled = false;
    setDecisionMarkerError("");
    void authenticatedProfileFetch(`/api/story-decisions?projectId=${encodeURIComponent(project.id)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as StoryDecisionListResponse;
        if (!response.ok) throw new Error(body.message || "Story Decision markers could not be loaded.");
        if (!cancelled) setDecisionMarkers(deriveVisualStoryDecisionMarkers(body.decisions ?? [], project.revision));
      })
      .catch(() => {
        if (!cancelled) {
          setDecisionMarkers([]);
          setDecisionMarkerError("Story Decision markers are temporarily unavailable.");
        }
      });
    return () => { cancelled = true; };
  }, [project.id, project.revision]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai-routing/status", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<ImageRouteStatus> : null)
      .then((status) => { if (!cancelled && status) setRouteStatus(status); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const saveSequenceShift = (sequenceNumber: number, shiftId: string) => {
    const id = sequenceId(sequenceNumber);
    setLocalShifts((current) => ({ ...current, [id]: shiftId }));
    setOpenShiftSequence(null);
    const current = loadFoundationProject();
    const next = applyStoryCommand(current.id === project.id ? current : project, {
      type: "foundations.sequence-shift.update",
      sequenceId: id,
      shiftId,
      occurredAt: new Date().toISOString(),
    });
    saveFoundationProject(next);
  };

  const selectCandidate = (artifact: FoundationsVisualArtifact) => {
    if (!authoringAllowed) return;
    let next = loadFoundationProject();
    const currentAccepted = new Set(next.build.foundations.acceptedVisualArtifactIds);
    for (const candidate of next.build.foundations.visualArtifacts.filter((item) => artifactTargetsAnchor(item, anchorRef))) {
      if (candidate.id !== artifact.id && currentAccepted.has(candidate.id)) {
        next = applyStoryCommand(next, { type: "foundations.visual.unaccept", artifactId: candidate.id, occurredAt: new Date().toISOString() });
      }
    }
    next = applyStoryCommand(next, { type: "foundations.visual.accept", artifactId: artifact.id, occurredAt: new Date().toISOString() });
    saveFoundationProject(next);
    setVisualMessage(`Mini-Block ${selected.number}.${selectedMini.number} now uses this accepted visual. Other candidates remain available.`);
  };

  const addVisualCandidate = async () => {
    if (!authoringAllowed || generating) return;
    if (manualRoute) {
      setVisualMessage("Manual image mode is selected. Choose a configured image provider in Settings before adding a visual candidate.");
      return;
    }
    if (!routeReady) {
      setVisualMessage(selectedOption?.error || "The selected image route is not ready yet.");
      return;
    }
    if (cloudRoute && !billingAcknowledged) {
      setVisualMessage("Confirm the paid image request before sending this visual candidate to the selected cloud provider.");
      return;
    }

    const prompt = `Create one cinematic visual-development frame for ${project.title || "this story"}. Block ${String(selected.number).padStart(2, "0")} (${selected.sequenceTitle}), Mini-Block ${selectedMini.number} (${selectedMini.label}). Story purpose: ${selected.sequencePurpose}. Treat this as a visual candidate only, not accepted canon. No titles, captions, typography, UI, or watermarks.`;
    setGenerating(true);
    setVisualMessage(`Adding another visual candidate to Mini-Block ${selected.number}.${selectedMini.number}…`);
    try {
      const response = await fetch("/api/local-ai/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          assetId: `story-map-${project.id}-${selected.number}-${selectedMini.number}-${Date.now()}`,
          aspect: "landscape",
          quality: "low",
          requestCount: 1,
          billingAcknowledged: cloudRoute ? billingAcknowledged : false,
        }),
      });
      const result = await response.json() as ImageGenerationResponse;
      if (!response.ok || !result.ok || !result.assetUrl) throw new Error(result.message || "The image route returned no usable visual.");
      const now = new Date().toISOString();
      const artifact: FoundationsVisualArtifact = {
        id: newVisualId(selected.number, selectedMini.number),
        assetUrl: result.assetUrl,
        prompt: result.revisedPrompt?.trim() || prompt,
        createdAt: now,
        provider: result.provider || selectedRoute,
        model: result.model || selectedOption?.model || "",
        frameNumber: selectedMini.number,
        narrativeIntention: `Block ${selected.number}.${selectedMini.number} · ${selectedMini.label}`,
        sourceDecisionKeys: [
          `storyboard-target:${storyboardTargetId(selected.id)}`,
          anchorRef,
          `story-map:block-${String(selected.number).padStart(2, "0")}`,
          `ppf-revision:${project.revision}`,
        ],
        workflow: STORY_MAP_VISUAL_WORKFLOW,
        reviewState: "draft",
        parentArtifactId: acceptedCandidate?.id ?? candidates[0]?.id ?? null,
      };
      const current = loadFoundationProject();
      const next = applyStoryCommand(current.id === project.id ? current : project, { type: "foundations.visual.store", artifact, occurredAt: now });
      saveFoundationProject(next);
      setVisualMessage(`Visual candidate added to Mini-Block ${selected.number}.${selectedMini.number}. Select it when it becomes the working choice.`);
    } catch (error) {
      setVisualMessage(error instanceof Error ? error.message : "The selected image provider could not create this candidate.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className={styles.panel} aria-labelledby="progressive-story-map-title" data-progressive-story-map="24x96">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Story Map · 4 Acts / 24 Blocks / 96 Mini-Blocks</p>
          <h2 id="progressive-story-map-title">The story is the navigation.</h2>
          <p>Select a Block, select one of its four Mini-Blocks, then PLAN, BUILD, collect visuals and STORYBOARD without losing your place in the whole story.</p>
        </div>
        <div className={styles.sourceSummary}>
          <strong>Active project</strong>
          <span>{project.title || "Untitled Story"}</span>
          <small>Block {String(selected.number).padStart(2, "0")} · Mini {selectedMini.number} · {project.revision} PPF revision</small>
        </div>
      </header>

      <div className={styles.map} aria-label="12 story Sequences containing 24 Blocks">
        {sequences.map((sequence) => {
          const currentShift = shiftOption(localShifts[sequence.id] ?? persistedShifts[sequence.id], sequence.number);
          const shiftOpen = openShiftSequence === sequence.number;
          return (
            <section className={`${styles.sequenceSlot} ${sequence.marker ? styles.sequenceSlotWithMarker : ""}`.trim()} data-sequence={sequence.number} key={sequence.id}>
              <div className={styles.sequenceBox}>
                <header className={styles.sequenceHeader}>
                  <div className={styles.sequenceIdentity}><strong>S{String(sequence.number).padStart(2, "0")}</strong><span>{sequence.title}</span></div>
                  <div className={styles.shiftControl} onKeyDown={(event) => { if (event.key === "Escape") setOpenShiftSequence(null); }}>
                    <span className={styles.shiftPrefix}>Shift:</span>
                    <button aria-expanded={shiftOpen} aria-haspopup="listbox" aria-label={`Shift: ${currentShift.from} to ${currentShift.to}`} className={styles.shiftButton} onClick={() => setOpenShiftSequence(shiftOpen ? null : sequence.number)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setOpenShiftSequence(sequence.number); } }} type="button">
                      <span className={styles.shiftFrom}>{currentShift.from}</span><span aria-hidden="true" className={styles.shiftArrow}>→</span><span className={styles.shiftTo}>{currentShift.to}</span><span aria-hidden="true" className={styles.shiftChevron}>▾</span>
                    </button>
                    {shiftOpen ? (
                      <div aria-label={`Sequence ${sequence.number} shift options`} className={styles.shiftMenu} role="listbox">
                        {SEQUENCE_SHIFT_OPTIONS.map((option) => (
                          <button aria-selected={option.id === currentShift.id} className={styles.shiftOption} key={option.id} onClick={() => saveSequenceShift(sequence.number, option.id)} role="option" type="button">
                            <span className={styles.shiftFrom}>{option.from}</span><span aria-hidden="true" className={styles.shiftArrow}>→</span><span className={styles.shiftTo}>{option.to}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </header>
                <div className={styles.sequenceBlocks}>
                  {sequence.blocks.map((block) => {
                    const blockDecisionCount = markersByBlock.get(block.id)?.length ?? 0;
                    return (
                      <button aria-pressed={selected.number === block.number} className={styles.block} data-canonical-story-id={block.id} data-state={block.state} data-story-decision-count={blockDecisionCount} key={block.id} onClick={() => { setSelectedBlockNumber(block.number); setSelectedMiniBlockNumber(1); setVisualMessage(""); rememberPosition(block.number, 1); }} type="button">
                        <span className={styles.blockNumber}>{String(block.number).padStart(2, "0")}</span>
                        <span className={styles.sequence}>A{block.act} · S{String(block.sequenceNumber).padStart(2, "0")}</span>
                        <span role="img" aria-label={`Status: ${STATE_LABELS[block.state]}${block.state === "locked" ? ". Editing unavailable." : ""}`} className={styles.statusLine} data-state={block.state}><i aria-hidden="true" className={styles.statusDot} /></span>
                        <small>{block.state === "defined" ? "4 / 4 visual anchors accepted" : block.state === "locked" ? "Visible · waiting for previous Block" : `${block.acceptedMiniBlockCount} / 4 visual anchors accepted`}{blockDecisionCount ? ` · ${blockDecisionCount} Story Decision${blockDecisionCount === 1 ? "" : "s"}` : ""}</small>
                        <span className={styles.minis} aria-label={`Block ${block.number} Mini-Blocks`}>
                          {block.miniBlocks.map((mini) => (
                            <span aria-label={`Mini-Block ${mini.number}, ${mini.label}: ${STATE_LABELS[mini.state]}`} className={styles.miniStep} data-state={mini.state} key={mini.id} title={`${mini.label}: ${STATE_LABELS[mini.state]}`}>{mini.number}</span>
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {sequence.marker ? (
                <div aria-label={sequence.marker.meaning} className={styles.turningPoint} data-marker={sequence.marker.badge} title={sequence.marker.meaning}>
                  {sequence.marker.badge === "FINALE" ? <strong className={styles.finale}>FINALE</strong> : <><strong>{sequence.marker.badge.slice(0, 2)}</strong><span>TP</span></>}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className={styles.legend} aria-label="24/96 evidence states">
        {(Object.keys(STATE_LABELS) as BuildStoryEvidenceState[]).map((state) => <span data-state={state} key={state}><i aria-hidden="true" className={styles.legendDot} />{STATE_LABELS[state]}</span>)}
      </div>

      <article className={styles.inspector} data-canonical-story-id={selected.id} data-selected-block={selected.number}>
        <header>
          <div><p className={styles.kicker}>Selected story position</p><h3>Act {selected.act} · Block {String(selected.number).padStart(2, "0")} · {selected.sequenceTitle}</h3></div>
          <span role="img" aria-label={`Status: ${STATE_LABELS[selected.state]}`} className={styles.inspectorStatus} data-state={selected.state}><i aria-hidden="true" className={styles.statusDot} /></span>
        </header>
        <p>{selected.mappingNote}</p>

        <div className={styles.storyActions} aria-label={`Block ${selected.number} Mini-Block ${selectedMini.number} local workflow`}>
          <a className={styles.storyAction} href={`/?workspace=plan&block=${selected.number}&mini=${selectedMini.number}`}>PLAN</a>
          <a className={styles.storyAction} href={`/?workspace=build&block=${selected.number}&mini=${selectedMini.number}`}>BUILD</a>
          <a className={styles.storyAction} href={`/storyboard?block=${selected.number}&mini=${selectedMini.number}`}>STORYBOARD</a>
        </div>

        <div className={styles.explainGrid}>
          <section>
            <h4>Mini-Block anchors</h4>
            <ol className={styles.miniInspector}>
              {selected.miniBlocks.map((mini) => (
                <li data-state={mini.state} data-selected={mini.number === selectedMini.number ? "true" : undefined} key={mini.id}>
                  <button className={styles.miniInspectorButton} disabled={mini.state === "locked"} onClick={() => { setSelectedMiniBlockNumber(mini.number); setVisualMessage(""); rememberPosition(selected.number, mini.number); }} type="button">
                    <span>{selected.number}.{mini.number} · {mini.label}</span><i role="img" aria-label={`Status: ${STATE_LABELS[mini.state]}`} className={styles.statusDot} data-state={mini.state} />
                    <small>{mini.state === "defined" ? "Accepted visual anchor" : mini.state === "locked" ? "Unlocks with the previous Block" : mini.observedPassageCount ? `${mini.observedPassageCount} observed passage${mini.observedPassageCount === 1 ? "" : "s"}` : "Ready for visual development"}</small>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.visualWorkbench} aria-label={`Visual candidates for Mini-Block ${selected.number}.${selectedMini.number}`}>
            <div className={styles.visualHeading}>
              <div><h4>Visual candidates · {selected.number}.{selectedMini.number}</h4><p>{acceptedCandidate ? "One working visual is accepted. Keep adding alternatives whenever useful." : "Collect alternatives here; generation alone never accepts canon."}</p></div>
              <button disabled={!authoringAllowed || generating} onClick={() => void addVisualCandidate()} type="button">{generating ? "Adding…" : "Add visual"}</button>
            </div>
            {cloudRoute ? <label className={styles.consent}><input checked={billingAcknowledged} onChange={(event) => setBillingAcknowledged(event.target.checked)} type="checkbox" /> Confirm paid image request</label> : null}
            {candidates.length ? (
              <div className={styles.visualGrid}>
                {candidates.map((artifact) => {
                  const accepted = acceptedIds.has(artifact.id) && artifact.reviewState === "accepted";
                  return <article className={styles.visualCard} data-accepted={accepted ? "true" : undefined} key={artifact.id}>
                    <img alt={artifact.narrativeIntention || `Visual candidate for Mini-Block ${selected.number}.${selectedMini.number}`} decoding="async" loading="lazy" src={artifact.assetUrl} />
                    <div className={styles.visualMeta}><strong>{accepted ? "Working visual" : "Candidate"}</strong><small>{artifact.model || artifact.provider || "configured image route"}</small></div>
                    <button disabled={!authoringAllowed || accepted} onClick={() => selectCandidate(artifact)} type="button">{accepted ? "Selected" : "Select"}</button>
                  </article>;
                })}
              </div>
            ) : <p className={styles.unresolved}>No visual candidate has been attached to this Mini-Block yet.</p>}
            {visualMessage ? <p className={styles.visualMessage} role="status">{visualMessage}</p> : null}
          </section>

          <details className={styles.inspectorDetails} data-story-decision-target={selected.id}>
            <summary><span>Story Decisions</span><small>{selectedDecisionMarkers.length ? `${selectedDecisionMarkers.length} to review` : "No active decisions"}</small></summary>
            <div className={styles.inspectorDetailsBody}>
              {decisionMarkerError ? <p className={styles.unresolved}>{decisionMarkerError}</p> : selectedDecisionMarkers.length ? (
                <ul>
                  {selectedDecisionMarkers.map((marker) => {
                    const action = decisionAction(marker);
                    return <li key={`${selected.id}-${marker.decisionId}`}><strong>{marker.stale ? "STALE" : marker.needsWorkbench ? "WORKBENCH" : "NEEDS HUMAN"} · {marker.severity}</strong><br /><span>{marker.question}</span><br /><a href={action.href}>{action.label}</a></li>;
                  })}
                </ul>
              ) : <p className={styles.unresolved}>No active Story Decision targets this Block.</p>}
              <p>These markers are read-only review records. They do not change PPF canon; answered choices still require Story Workbench validation.</p>
            </div>
          </details>
          <details className={`${styles.inspectorDetails} ${styles.textProjection}`} data-canonical-story-id={selected.backgroundText.targetRef} data-state={selected.backgroundText.state} data-text-projection={selected.backgroundText.state} data-text-review={selected.backgroundText.reviewState}>
            <summary>
              <span>Background story text</span>
              <small>{selected.backgroundText.reviewState === "needs-review" ? "Needs review" : STATE_LABELS[selected.backgroundText.state]}</small>
            </summary>
            <div className={styles.inspectorDetailsBody}>
              <header className={styles.textProjectionHeader}>
                <div><h4>Read-only source projection</h4><p>Same canonical Block</p></div>
                <div><strong data-state={selected.backgroundText.state}>{STATE_LABELS[selected.backgroundText.state]}</strong><br /><small>{selected.backgroundText.reviewState === "needs-review" ? "NEEDS REVIEW" : "CURRENT"}</small></div>
              </header>
              {selected.backgroundText.reviewState === "needs-review" ? <p className={styles.unresolved} role="status"><strong>Needs Human review.</strong> This Block changed upstream at PPF revision {selected.backgroundText.staleAtRevision ?? project.revision}. The source screenplay below has not been rewritten.</p> : null}
              {selected.backgroundText.passages.length ? (
                <ol className={styles.sourcePassages}>
                  {selected.backgroundText.passages.map((passage) => (
                    <li key={passage.id}>
                      <small>Scene {passage.sceneNumber || "—"} · Mini-Block {passage.miniBlockNumber} · {passage.type}</small>
                      <p>{passage.text}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.unresolved}>No observed screenplay text is attached to this Block. PlotPickle does not fabricate background script text.</p>
              )}
              <p className={styles.textProvenance}>
                {selected.backgroundText.sourceKind === "observed-screenplay"
                  ? `Source: ${selected.backgroundText.sourceFileName}. Observed source text is shown without rewriting. ${selected.backgroundText.reviewState === "needs-review" ? `This projection needs review against PPF revision ${selected.backgroundText.staleAtRevision ?? project.revision}; only this dependency-backed Block was marked stale.` : selected.backgroundText.placementReviewed ? "Its Block placement has been Human-reviewed." : "Its suggested Block placement still requires Human review."}`
                  : "No source screenplay passage currently supports this exact Block. The text projection remains missing instead of generating filler."}
              </p>
            </div>
          </details>
        </div>
        <p className={styles.provenance}>The Story Map stays the navigation surface. Generated visuals remain candidates until the Human selects them; four accepted Mini-Block visual anchors complete a Block and unlock the next one.</p>
      </article>
    </section>
  );
}
