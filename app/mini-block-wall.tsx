"use client";

/* eslint-disable @next/next/no-img-element -- Project visuals may use local or user-provided URLs. */

import { useMemo, useState } from "react";
import styles from "./mini-block-wall.module.css";
import {
  createMiniBlockWallModel,
  DEFAULT_MINI_BLOCK_WALL_STATE,
  normalizeMiniBlockWallState,
  type MiniBlockWallCard,
  type MiniBlockWallCardStatus,
  type MiniBlockWallColourMode,
  type MiniBlockWallScope,
  type MiniBlockWallState,
  type MiniBlockWallView,
} from "@/lib/mini-block-wall";
import {
  findCanonicalMiniBlock,
  updateCanonicalMiniBlock,
  type MiniBlockWallPatch,
} from "@/lib/mini-block-wall-edit";
import type { PlotPickleProject } from "@/lib/project";

const wallStateByProject = new Map<string, MiniBlockWallState>();

const VIEW_OPTIONS: { id: MiniBlockWallView; label: string }[] = [
  { id: "whole-film", label: "Whole film" },
  { id: "act", label: "Act" },
  { id: "sequence", label: "Sequence" },
  { id: "block", label: "Block" },
  { id: "character", label: "Character arc" },
  { id: "storyline", label: "Storyline" },
];

const COLOUR_OPTIONS: { id: MiniBlockWallColourMode; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "character", label: "Character" },
  { id: "storyline", label: "Storyline" },
  { id: "location", label: "Location" },
  { id: "setup-payoff", label: "Setup / payoff" },
  { id: "label", label: "Custom label" },
];

const STATUS_OPTIONS: { id: MiniBlockWallCardStatus | ""; label: string }[] = [
  { id: "", label: "All statuses" },
  { id: "empty", label: "Empty" },
  { id: "developing", label: "Developing" },
  { id: "ready", label: "Ready" },
  { id: "overloaded", label: "Overloaded" },
];

const SCOPE_OPTIONS: { id: MiniBlockWallScope; label: string }[] = [
  { id: "all", label: "All 96 expanded" },
  { id: "act", label: "Selected act" },
  { id: "sequence", label: "Selected sequence" },
  { id: "block", label: "Selected Block" },
];

type LegendEntry = { label: string; tone: number };

type MiniBlockWallProps = {
  project: PlotPickleProject;
  onProjectChange: (project: PlotPickleProject) => void;
  onOpenBlock: (number: number) => void;
};

function labelForStatus(status: MiniBlockWallCardStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function hash(value: string) {
  return [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function toneIndex(card: MiniBlockWallCard, state: MiniBlockWallState) {
  if (state.colourMode === "status") return ["empty", "developing", "ready", "overloaded"].indexOf(card.status);
  if (state.colourMode === "setup-payoff") {
    if (card.setup && card.payoff) return 3;
    if (card.setup) return 1;
    if (card.payoff) return 2;
    return 0;
  }
  if (state.colourMode === "character") return hash(card.characterId || "unassigned") % 8;
  if (state.colourMode === "storyline") return hash(card.storylineIds[0] || "unassigned") % 8;
  if (state.colourMode === "location") return hash(card.locationIds[0] || "unassigned") % 8;
  const match = normalized(state.customLabel);
  if (match) {
    const text = normalized(`${card.label} ${card.function} ${card.purpose}`);
    return text.includes(match) ? 6 : 0;
  }
  return hash(card.label || "unlabelled") % 8;
}

function isExpanded(card: MiniBlockWallCard, state: MiniBlockWallState, anchor: MiniBlockWallCard) {
  if (state.expandedScope === "all") return true;
  if (state.expandedScope === "act") return card.act === anchor.act;
  if (state.expandedScope === "sequence") return card.sequenceNumber === anchor.sequenceNumber;
  return card.blockId === anchor.blockId;
}

function WallField({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {rows === 1
        ? <input value={value} onChange={(event) => onChange(event.target.value)} />
        : <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function legendValues(project: PlotPickleProject, state: MiniBlockWallState, cards: MiniBlockWallCard[]): LegendEntry[] {
  if (state.colourMode === "status") {
    return STATUS_OPTIONS.filter((option) => option.id).map((option, index) => ({ label: option.label, tone: index }));
  }
  if (state.colourMode === "character") {
    return project.characters.map((character) => ({ label: character.name || "Unnamed character", tone: hash(character.id) % 8 }));
  }
  if (state.colourMode === "storyline") {
    return project.storyThreads.map((thread) => ({ label: thread.name, tone: hash(thread.id) % 8 }));
  }
  if (state.colourMode === "location") {
    return project.world.locations.map((location) => ({ label: location.name, tone: hash(location.id) % 8 }));
  }
  if (state.colourMode === "setup-payoff") {
    return ["Neither", "Setup", "Payoff", "Both"].map((label, tone) => ({ label, tone }));
  }
  const labels = [...new Set(cards.map((card) => card.label).filter(Boolean))];
  return labels.map((label) => ({ label, tone: hash(label) % 8 }));
}

export default function MiniBlockWall({ project, onProjectChange, onOpenBlock }: MiniBlockWallProps) {
  const [session, setSession] = useState(() => ({
    projectId: project.id,
    state: wallStateByProject.get(project.id) ?? DEFAULT_MINI_BLOCK_WALL_STATE,
  }));
  const state = session.projectId === project.id
    ? session.state
    : wallStateByProject.get(project.id) ?? DEFAULT_MINI_BLOCK_WALL_STATE;
  const model = useMemo(() => createMiniBlockWallModel(project, state), [project, state]);
  const selectedCard = model.cards.find((card) => card.id === state.selectedMiniBlockId)
    ?? model.visibleCards[0]
    ?? model.cards[0];
  const selected = selectedCard ? findCanonicalMiniBlock(project, selectedCard.id) : null;
  const visibleIndex = selectedCard ? model.visibleCards.findIndex((card) => card.id === selectedCard.id) : -1;
  const warningsByCard = useMemo(() => {
    const result = new Map<string, number>();
    model.warnings.forEach((warning) => {
      if (!warning.miniBlockId) return;
      result.set(warning.miniBlockId, (result.get(warning.miniBlockId) ?? 0) + 1);
    });
    return result;
  }, [model.warnings]);
  const cardsByBlock = useMemo(() => {
    const result = new Map<string, MiniBlockWallCard[]>();
    model.visibleCards.forEach((card) => result.set(card.blockId, [...(result.get(card.blockId) ?? []), card]));
    return result;
  }, [model.visibleCards]);
  const relationshipCards = useMemo(() => {
    if (!selectedCard) return [];
    const setup = normalized(selectedCard.setup);
    const payoff = normalized(selectedCard.payoff);
    return model.cards.filter((card) => {
      if (card.id === selectedCard.id) return false;
      if (setup && normalized(card.payoff) === setup) return true;
      if (payoff && normalized(card.setup) === payoff) return true;
      return false;
    });
  }, [model.cards, selectedCard]);
  const legend = legendValues(project, state, model.cards).filter((entry) => entry.label).slice(0, 10);
  const anchor = selectedCard ?? model.cards[0];

  function updateState(patch: Partial<MiniBlockWallState>) {
    const next = normalizeMiniBlockWallState({ ...state, ...patch });
    wallStateByProject.set(project.id, next);
    setSession({ projectId: project.id, state: next });
  }

  function setSingleFilter(key: "characterIds" | "storylineIds" | "locationIds" | "statuses", value: string) {
    updateState({ filters: { ...state.filters, [key]: value ? [value] : [] } });
  }

  function selectCard(card: MiniBlockWallCard, focus = false) {
    updateState({
      selectedMiniBlockId: card.id,
      act: card.act,
      sequenceNumber: card.sequenceNumber,
      blockId: card.blockId,
      characterId: card.characterId || state.characterId,
      storylineId: card.storylineIds[0] || state.storylineId,
    });
    if (focus) requestAnimationFrame(() => document.getElementById(`mini-wall-card-${card.id}`)?.focus());
  }

  function revealCard(card: MiniBlockWallCard) {
    const next = normalizeMiniBlockWallState({
      ...state,
      view: "block",
      selectedMiniBlockId: card.id,
      blockId: card.blockId,
      act: card.act,
      sequenceNumber: card.sequenceNumber,
      expandedScope: "block",
      filters: DEFAULT_MINI_BLOCK_WALL_STATE.filters,
    });
    wallStateByProject.set(project.id, next);
    setSession({ projectId: project.id, state: next });
    requestAnimationFrame(() => document.getElementById(`mini-wall-card-${card.id}`)?.focus());
  }

  function moveSelection(offset: number) {
    if (!model.visibleCards.length) return;
    const base = visibleIndex < 0 ? 0 : visibleIndex;
    const nextIndex = Math.min(model.visibleCards.length - 1, Math.max(0, base + offset));
    const card = model.visibleCards[nextIndex];
    if (card) selectCard(card, true);
  }

  function patchSelected(patch: MiniBlockWallPatch) {
    if (!selectedCard) return;
    onProjectChange(updateCanonicalMiniBlock(project, selectedCard.id, patch));
  }

  function clearFilters() {
    updateState({ filters: DEFAULT_MINI_BLOCK_WALL_STATE.filters });
  }

  function resetView() {
    const next = normalizeMiniBlockWallState({
      ...DEFAULT_MINI_BLOCK_WALL_STATE,
      selectedMiniBlockId: selectedCard?.id ?? "",
    });
    wallStateByProject.set(project.id, next);
    setSession({ projectId: project.id, state: next });
  }

  return (
    <section className={styles.wallWorkspace} aria-label="96 mini-block whole-film wall">
      <header className={styles.wallHeader}>
        <div>
          <p>96 mini-block construction wall</p>
          <h2>See the entire film and edit one precise movement without losing context.</h2>
          <span>All cards come from the canonical project. Filters and colour modes never change story order.</span>
        </div>
        <div className={styles.metrics}>
          <strong>{model.counts.visible}</strong><span>visible of {model.counts.cards}</span>
          <strong>{model.warnings.length}</strong><span>diagnostic signals</span>
        </div>
      </header>

      <div className={styles.viewTabs} role="group" aria-label="Mini-block wall views">
        {VIEW_OPTIONS.map((option) => (
          <button type="button" key={option.id} className={state.view === option.id ? styles.active : ""} onClick={() => updateState({ view: option.id })}>{option.label}</button>
        ))}
      </div>

      <section className={styles.controls} aria-label="Mini-block wall controls">
        <label><span>Act focus</span><select value={state.act} onChange={(event) => updateState({ act: Number(event.target.value), view: event.target.value === "0" ? "whole-film" : "act" })}><option value={0}>All acts</option>{[1, 2, 3, 4].map((act) => <option key={act} value={act}>Act {act}</option>)}</select></label>
        <label><span>Sequence focus</span><select value={state.sequenceNumber} onChange={(event) => updateState({ sequenceNumber: Number(event.target.value), view: event.target.value === "0" ? "whole-film" : "sequence" })}><option value={0}>All sequences</option>{project.structure.sequences.map((sequence) => <option key={sequence.id} value={sequence.number}>Sequence {sequence.number}</option>)}</select></label>
        <label><span>Block focus</span><select value={state.blockId} onChange={(event) => updateState({ blockId: event.target.value, view: event.target.value ? "block" : "whole-film" })}><option value="">All Blocks</option>{project.blocks.map((block) => <option key={block.id} value={block.id}>Block {block.number} · {block.title}</option>)}</select></label>
        <label><span>Character view</span><select value={state.characterId} onChange={(event) => updateState({ characterId: event.target.value, view: event.target.value ? "character" : "whole-film" })}><option value="">All characters</option>{project.characters.map((character) => <option key={character.id} value={character.id}>{character.name || "Unnamed character"}</option>)}</select></label>
        <label><span>Storyline view</span><select value={state.storylineId} onChange={(event) => updateState({ storylineId: event.target.value, view: event.target.value ? "storyline" : "whole-film" })}><option value="">All storylines</option>{project.storyThreads.map((thread) => <option key={thread.id} value={thread.id}>{thread.name}</option>)}</select></label>
        <label><span>Colour mode</span><select value={state.colourMode} onChange={(event) => updateState({ colourMode: event.target.value as MiniBlockWallColourMode })}>{COLOUR_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        {state.colourMode === "label" ? <label><span>Highlight label</span><input value={state.customLabel} placeholder="e.g. reveal" onChange={(event) => updateState({ customLabel: event.target.value })} /></label> : null}
        <label><span>Character filter</span><select value={state.filters.characterIds[0] ?? ""} onChange={(event) => setSingleFilter("characterIds", event.target.value)}><option value="">All characters</option>{project.characters.map((character) => <option key={character.id} value={character.id}>{character.name || "Unnamed character"}</option>)}</select></label>
        <label><span>Storyline filter</span><select value={state.filters.storylineIds[0] ?? ""} onChange={(event) => setSingleFilter("storylineIds", event.target.value)}><option value="">All storylines</option>{project.storyThreads.map((thread) => <option key={thread.id} value={thread.id}>{thread.name}</option>)}</select></label>
        <label><span>Location filter</span><select value={state.filters.locationIds[0] ?? ""} onChange={(event) => setSingleFilter("locationIds", event.target.value)}><option value="">All locations</option>{project.world.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label><span>Status filter</span><select value={state.filters.statuses[0] ?? ""} onChange={(event) => setSingleFilter("statuses", event.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option.id || "all"} value={option.id}>{option.label}</option>)}</select></label>
        <button type="button" onClick={clearFilters}>Clear filters</button>
      </section>

      <section className={styles.expansionBar} aria-label="Expansion zoom and pan controls">
        <div role="group" aria-label="Expanded mini-block scope">
          {SCOPE_OPTIONS.map((option) => <button type="button" key={option.id} className={state.expandedScope === option.id ? styles.active : ""} onClick={() => updateState({ expandedScope: option.id })}>{option.label}</button>)}
        </div>
        <div role="group" aria-label="Zoom controls"><button type="button" onClick={() => updateState({ zoom: state.zoom - 0.1 })}>Zoom out</button><span>{Math.round(state.zoom * 100)}%</span><button type="button" onClick={() => updateState({ zoom: state.zoom + 0.1 })}>Zoom in</button></div>
        <div role="group" aria-label="Pan controls"><button type="button" aria-label="Pan left" onClick={() => updateState({ pan: { ...state.pan, x: state.pan.x + 80 } })}>←</button><button type="button" aria-label="Pan up" onClick={() => updateState({ pan: { ...state.pan, y: state.pan.y + 80 } })}>↑</button><button type="button" aria-label="Pan down" onClick={() => updateState({ pan: { ...state.pan, y: state.pan.y - 80 } })}>↓</button><button type="button" aria-label="Pan right" onClick={() => updateState({ pan: { ...state.pan, x: state.pan.x - 80 } })}>→</button></div>
        <button type="button" onClick={resetView}>Reset wall</button>
      </section>

      <div className={styles.legend} aria-label={`${state.colourMode} colour legend`}>
        <strong>{COLOUR_OPTIONS.find((option) => option.id === state.colourMode)?.label}</strong>
        {legend.length ? legend.map((entry) => <span key={`${entry.label}-${entry.tone}`}><i className={styles[`tone${entry.tone}`]} />{entry.label}</span>) : <span>No labelled items yet.</span>}
      </div>

      <div className={styles.boardLayout}>
        <div className={styles.viewport} tabIndex={0} aria-label="Scrollable and zoomable mini-block wall">
          <div className={styles.wallSurface} style={{ transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`, transformOrigin: "0 0" }}>
            {[1, 2, 3, 4].map((act) => {
              const actBlocks = project.blocks.filter((block) => block.act === act && cardsByBlock.has(block.id));
              if (!actBlocks.length) return null;
              return (
                <section className={styles.actLane} key={act}>
                  <header><div><span>Act {act}</span><strong>{["Setup", "Confrontation", "Complication", "Resolution"][act - 1]}</strong></div><small>{actBlocks.reduce((total, block) => total + (cardsByBlock.get(block.id)?.length ?? 0), 0)} visible cards</small></header>
                  <div className={styles.blockLane}>
                    {actBlocks.map((block) => {
                      const cards = cardsByBlock.get(block.id) ?? [];
                      return (
                        <section className={styles.blockGroup} key={block.id}>
                          <header><div><span>Block {block.number} · Sequence {block.sequenceNumber}</span><strong>{block.title}</strong></div><small>{cards.length} visible</small></header>
                          <div className={styles.miniGrid}>
                            {cards.map((card) => {
                              const expanded = anchor ? isExpanded(card, state, anchor) : true;
                              const warningCount = warningsByCard.get(card.id) ?? 0;
                              return (
                                <button
                                  type="button"
                                  id={`mini-wall-card-${card.id}`}
                                  key={card.id}
                                  tabIndex={card.id === selectedCard?.id ? 0 : -1}
                                  className={`${styles.miniCard} ${styles[`tone${toneIndex(card, state)}`]} ${card.id === selectedCard?.id ? styles.selected : ""} ${expanded ? "" : styles.compact}`}
                                  onClick={() => selectCard(card)}
                                  onKeyDown={(event) => {
                                    if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); moveSelection(1); }
                                    if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); moveSelection(-1); }
                                    if (event.key === "Home") { event.preventDefault(); const first = model.visibleCards[0]; if (first) selectCard(first, true); }
                                    if (event.key === "End") { event.preventDefault(); const last = model.visibleCards.at(-1); if (last) selectCard(last, true); }
                                  }}
                                  aria-pressed={card.id === selectedCard?.id}
                                >
                                  <span className={styles.cardTop}><strong>{card.globalNumber}</strong><i>{labelForStatus(card.status)}</i>{warningCount ? <b aria-label={`${warningCount} diagnostic signals`}>{warningCount}</b> : null}</span>
                                  <span className={styles.cardLabel}>{card.label || `Mini-block ${card.number}`}</span>
                                  {expanded ? <>
                                    {card.frame?.src ? <img src={card.frame.src} alt={card.frame.alt || card.frame.caption || `Mini-block ${card.globalNumber} storyboard`} /> : <span className={styles.framePlaceholder}>No storyboard frame</span>}
                                    <span className={styles.cardPurpose}>{card.turn || card.purpose || card.function || "Define the dramatic movement."}</span>
                                    <span className={styles.relationships}>{card.setup ? <em>Setup</em> : null}{card.payoff ? <em>Payoff</em> : null}</span>
                                    <span className={styles.cardMeta}>{card.characterName || "No character focus"}</span>
                                    <span className={styles.cardMeta}>{card.sceneTitle} · {card.screenplayElementIds.length} script · {card.shotIds.length} shots</span>
                                  </> : <span className={styles.cardMeta}>Block {card.blockNumber} · Mini {card.number}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </section>
              );
            })}
            {!model.visibleCards.length ? <p className={styles.empty}>No mini-blocks match the current view and filters.</p> : null}
          </div>
        </div>

        <aside className={styles.inspector} aria-label="Mini-block inspector">
          {selected && selectedCard ? <>
            <header><div><p>Mini-block inspector</p><h3>{selectedCard.globalNumber} · {selected.miniBlock.label || `Mini-block ${selected.miniBlock.number}`}</h3></div><span>{labelForStatus(selectedCard.status)}</span></header>
            <p className={styles.contextLine}>Block {selected.block.number} · {selected.scene.title} · stable ID {selected.miniBlock.id}</p>
            <WallField label="Label" rows={1} value={selected.miniBlock.label} onChange={(value) => patchSelected({ label: value })} />
            <WallField label="Function" value={selected.miniBlock.function} onChange={(value) => patchSelected({ function: value })} />
            <WallField label="Purpose" value={selected.miniBlock.purpose} onChange={(value) => patchSelected({ purpose: value })} />
            <label className={styles.field}><span>Character focus</span><select value={selected.miniBlock.characterId} onChange={(event) => patchSelected({ characterId: event.target.value })}><option value="">No character focus</option>{project.characters.map((character) => <option key={character.id} value={character.id}>{character.name || "Unnamed character"}</option>)}</select></label>
            <div className={styles.paired}><WallField label="Objective" value={selected.miniBlock.objective} onChange={(value) => patchSelected({ objective: value })} /><WallField label="Resistance" value={selected.miniBlock.resistance} onChange={(value) => patchSelected({ resistance: value })} /></div>
            <WallField label="Action" value={selected.miniBlock.action} onChange={(value) => patchSelected({ action: value })} />
            <div className={styles.paired}><WallField label="Revelation" value={selected.miniBlock.revelation} onChange={(value) => patchSelected({ revelation: value })} /><WallField label="Turn" value={selected.miniBlock.turn} onChange={(value) => patchSelected({ turn: value })} /></div>
            <div className={styles.paired}><WallField label="Entry state" value={selected.miniBlock.entryState} onChange={(value) => patchSelected({ entryState: value })} /><WallField label="Exit state" value={selected.miniBlock.exitState} onChange={(value) => patchSelected({ exitState: value })} /></div>
            <WallField label="Visual beat" value={selected.miniBlock.visualBeat} onChange={(value) => patchSelected({ visualBeat: value })} />
            <WallField label="Dialogue intention" value={selected.miniBlock.dialogueIntention} onChange={(value) => patchSelected({ dialogueIntention: value })} />
            <div className={styles.paired}><WallField label="Setup" value={selected.miniBlock.setup} onChange={(value) => patchSelected({ setup: value })} /><WallField label="Payoff" value={selected.miniBlock.payoff} onChange={(value) => patchSelected({ payoff: value })} /></div>
            {relationshipCards.length ? <section className={styles.relationshipPanel}><strong>Setup / payoff relationships</strong>{relationshipCards.map((card) => <button type="button" key={card.id} onClick={() => revealCard(card)}>Mini {card.globalNumber} · Block {card.blockNumber}<span>{card.label || card.turn || "Related movement"}</span></button>)}</section> : null}
            <WallField label="Notes" rows={4} value={selected.miniBlock.notes} onChange={(value) => patchSelected({ notes: value })} />
            <section className={styles.linkSummary}><strong>Linked context</strong><span>{selectedCard.frame?.src ? "Storyboard frame linked" : "Storyboard frame missing"}</span><span>Scene: {selected.scene.title}</span><span>{selectedCard.screenplayElementIds.length} screenplay elements</span><span>{selectedCard.shotIds.length} production shots</span><span>{selectedCard.storylineNames.join(" · ") || "No storyline linked"}</span><span>{selectedCard.locationNames.join(" · ") || "No location linked"}</span></section>
            <button type="button" className={styles.primary} onClick={() => onOpenBlock(selected.block.number)}>Open Block {selected.block.number} in Plan</button>
          </> : <p>No mini-block matches the current view and filters.</p>}
        </aside>
      </div>

      <details className={styles.diagnostics}>
        <summary>Diagnostics · {model.warnings.length} signals</summary>
        <div>{model.warnings.length ? model.warnings.map((warning, index) => <button type="button" key={`${warning.kind}-${warning.targetId}-${index}`} onClick={() => { const card = model.cards.find((candidate) => candidate.id === warning.miniBlockId); if (card) revealCard(card); }}><strong>{warning.kind.replaceAll("-", " ")}</strong><span>{warning.message}</span></button>) : <p>No structural signals found.</p>}</div>
      </details>
    </section>
  );
}
