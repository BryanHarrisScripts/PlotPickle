"use client";

import { useEffect, useMemo, useState } from "react";
import { authenticatedProfileFetch } from "../../../core/auth/profile-request-browser";
import { FOUNDATION_SEQUENCE_SHIFT_METADATA_ID } from "../../../core/contracts/foundation-plan";
import { applyStoryCommand } from "../../../core/project/apply-command";
import type { PPFProject } from "../../../core/project/project";
import {
  loadFoundationProject,
  saveFoundationProject,
} from "../../../core/storage/foundation-project-browser";
import {
  deriveVisualStoryDecisionMarkers,
  type VisualStoryDecisionMarker,
  type VisualStoryDecisionSource,
} from "../decisions/visual-story-decision-markers";
import {
  deriveProgressiveStoryMap,
  type BuildStoryEvidenceState,
} from "../progressive-story-map";
import styles from "./progressive-story-map.module.css";

const STATE_LABELS: Readonly<Record<BuildStoryEvidenceState, string>> = {
  defined: "DEFINED",
  observed: "OBSERVED",
  emerging: "EMERGING",
  missing: "MISSING",
  locked: "LOCKED",
};

type SequenceShiftOption = { readonly id: string; readonly from: string; readonly to: string };
type StoryDecisionListResponse = { readonly decisions?: readonly VisualStoryDecisionSource[]; readonly message?: string };

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

export default function ProgressiveStoryMap({ project }: { readonly project: PPFProject }) {
  const storyMap = useMemo(() => deriveProgressiveStoryMap(project), [project]);
  const sequences = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    const blocks = storyMap.blocks.filter((block) => block.sequenceNumber === number);
    return { number, id: sequenceId(number), title: blocks[0]?.sequenceTitle ?? `Sequence ${number}`, blocks, marker: STRUCTURAL_MARKERS[number] };
  }), [storyMap.blocks]);
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(1);
  const [openShiftSequence, setOpenShiftSequence] = useState<number | null>(null);
  const [localShifts, setLocalShifts] = useState<Readonly<Record<string, string>>>({});
  const [decisionMarkers, setDecisionMarkers] = useState<readonly VisualStoryDecisionMarker[]>([]);
  const [decisionMarkerError, setDecisionMarkerError] = useState("");
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
  const selectedDecisionMarkers = markersByBlock.get(selected.id) ?? [];
  const persistedShifts = project.foundations.lessons[FOUNDATION_SEQUENCE_SHIFT_METADATA_ID]?.answers ?? {};

  useEffect(() => { setLocalShifts({}); }, [project.revision]);
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

  return (
    <section className={styles.panel} aria-labelledby="progressive-story-map-title" data-progressive-story-map="24x96">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Living story model · 24 Blocks / 96 Mini-Blocks</p>
          <h2 id="progressive-story-map-title">The whole story stays visible.</h2>
          <p>Foundations shows the complete topology without pretending the screenplay is finished. Unknown story areas stay unresolved; later curriculum stages add resolution to this same map.</p>
        </div>
        <div className={styles.sourceSummary}>
          <strong>{storyMap.importedSourceFileName ? "Imported evidence" : "Native PPF"}</strong>
          <span>{storyMap.importedSourceFileName || "No screenplay source attached"}</span>
          {storyMap.importedSourceFileName ? <small>{storyMap.observedPassageCount} observed source passage{storyMap.observedPassageCount === 1 ? "" : "s"}{storyMap.passagesTruncated ? " · bounded evidence view" : ""}</small> : <small>Structure remains open until later story evidence earns it.</small>}
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
                      <button aria-pressed={selected.number === block.number} className={styles.block} data-canonical-story-id={block.id} data-state={block.state} data-story-decision-count={blockDecisionCount} key={block.id} onClick={() => setSelectedBlockNumber(block.number)} type="button">
                        <span className={styles.blockNumber}>{String(block.number).padStart(2, "0")}</span>
                        <span className={styles.sequence}>S{String(block.sequenceNumber).padStart(2, "0")} · {block.sequenceTitle}</span>
                        <span aria-label={`Status: ${STATE_LABELS[block.state]}${block.state === "locked" ? ". Editing unavailable." : ""}`} className={styles.statusLine} data-state={block.state}><i aria-hidden="true" className={styles.statusDot} /></span>
                        <small>{block.observedPassageCount ? `${block.observedPassageCount} source passage${block.observedPassageCount === 1 ? "" : "s"}` : "Not enough information yet"}{blockDecisionCount ? ` · ${blockDecisionCount} Story Decision${blockDecisionCount === 1 ? "" : "s"}` : ""}</small>
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
          <div><p className={styles.kicker}>Selected story position</p><h3>Block {String(selected.number).padStart(2, "0")} · {selected.sequenceTitle}</h3></div>
          <span aria-label={`Status: ${STATE_LABELS[selected.state]}`} className={styles.inspectorStatus} data-state={selected.state}><i aria-hidden="true" className={styles.statusDot} /></span>
        </header>
        <p>{selected.sequencePurpose}</p>
        <div className={styles.explainGrid}>
          <section>
            <h4>Visual story state</h4>
            <p>{selected.mappingNote}</p>
            <p className={styles.canonicalRef}>Canonical target: <code>{selected.id}</code></p>
          </section>
          <section>
            <h4>Mini-Block resolution</h4>
            <ol className={styles.miniInspector}>
              {selected.miniBlocks.map((mini) => (
                <li data-state={mini.state} key={mini.id}><span>{mini.number}. {mini.label}</span><i aria-label={`Status: ${STATE_LABELS[mini.state]}`} className={styles.statusDot} data-state={mini.state} /><small>{mini.observedPassageCount ? `${mini.observedPassageCount} observed passage${mini.observedPassageCount === 1 ? "" : "s"}; placement remains subject to review.` : "Not enough information at the current frontier."}</small></li>
              ))}
            </ol>
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
        {storyMap.importedSourceFileName ? <p className={styles.provenance}>Source: {storyMap.importedSourceFileName}. The screenplay text is observed evidence; a suggested 24/96 placement does not become canon until the Human reviews it.</p> : <p className={styles.provenance}>Current frontier: Foundations. PLAN decisions remain global story context until later Structure work earns exact Block placement.</p>}
      </article>
    </section>
  );
}