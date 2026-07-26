"use client";

import { useMemo, useState } from "react";
import styles from "./build-workspace.module.css";
import {
  createBuildWorkspaceModel,
  updateCanonicalBuildBlock,
  type BuildBlockCard,
  type BuildBlockPatch,
  type BuildBlockStatus,
  type BuildWorkspaceView,
} from "@/lib/build-workspace-model";
import type { PlotPickleProject, StoryBlock } from "@/lib/project";

type BuildWorkspaceProps = {
  project: PlotPickleProject;
  onProjectChange: (project: PlotPickleProject) => void;
  onOpenBlock: (number: number) => void;
};

const VIEW_OPTIONS: { id: BuildWorkspaceView; label: string; description: string }[] = [
  { id: "whole-film", label: "Whole film", description: "Four acts and twelve sequences" },
  { id: "act", label: "Acts", description: "Six Blocks per act" },
  { id: "sequence", label: "Sequences", description: "Two Blocks per sequence" },
  { id: "blocks", label: "24 Blocks", description: "Every canonical story movement" },
];

const STATUS_OPTIONS: { id: BuildBlockStatus | "all"; label: string }[] = [
  { id: "all", label: "All statuses" },
  { id: "empty", label: "Empty" },
  { id: "developing", label: "Developing" },
  { id: "ready", label: "Ready" },
  { id: "locked", label: "Locked" },
];

function statusLabel(status: BuildBlockStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function BlockCard({ card, selected, onSelect }: { card: BuildBlockCard; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={`${styles.blockCard} ${selected ? styles.blockCardSelected : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={styles.cardTopline}>
        <strong>Block {card.number}</strong>
        <i className={`${styles.status} ${styles[`status${statusLabel(card.status)}`]}`}>{statusLabel(card.status)}</i>
      </span>
      <span className={styles.cardTitle}>{card.title || "Untitled Block"}</span>
      <span className={styles.cardPurpose}>{card.purpose || "Add the dramatic purpose for this movement."}</span>
      <span className={styles.cardMeta}>{card.sceneCount} scenes · {card.miniBlockCount} mini-blocks</span>
      {card.characterFocus.length ? <span className={styles.cardLabels}>{card.characterFocus.slice(0, 3).join(" · ")}</span> : null}
    </button>
  );
}

function CardGrid({ cards, selectedId, onSelect }: { cards: BuildBlockCard[]; selectedId: string; onSelect: (id: string) => void }) {
  if (!cards.length) return <p className={styles.emptyState}>No Blocks match the current filters.</p>;
  return (
    <div className={styles.cardGrid}>
      {cards.map((card) => <BlockCard key={card.id} card={card} selected={card.id === selectedId} onSelect={() => onSelect(card.id)} />)}
    </div>
  );
}

function InspectorField({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <label className={styles.inspectorField}>
      <span>{label}</span>
      {rows === 1
        ? <input value={value} onChange={(event) => onChange(event.target.value)} />
        : <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

export default function BuildWorkspace({ project, onProjectChange, onOpenBlock }: BuildWorkspaceProps) {
  const [view, setView] = useState<BuildWorkspaceView>("whole-film");
  const [query, setQuery] = useState("");
  const [act, setAct] = useState(0);
  const [sequence, setSequence] = useState(0);
  const [status, setStatus] = useState<BuildBlockStatus | "all">("all");
  const [label, setLabel] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState(project.blocks[0]?.id ?? "");

  const model = useMemo(() => createBuildWorkspaceModel(project, {
    query,
    acts: act ? [act] : undefined,
    sequences: sequence ? [sequence] : undefined,
    statuses: status === "all" ? undefined : [status],
    labels: label ? [label] : undefined,
  }), [project, query, act, sequence, status, label]);

  const selectedBlock = project.blocks.find((block) => block.id === selectedBlockId) ?? project.blocks[0];
  const selectedCard = model.cards.find((card) => card.id === selectedBlock?.id);
  const labels = useMemo(() => [...new Set(model.cards.flatMap((card) => card.labels))].sort(), [model.cards]);

  function patchSelected(patch: BuildBlockPatch) {
    if (!selectedBlock) return;
    onProjectChange(updateCanonicalBuildBlock(project, selectedBlock.id, patch));
  }

  function toggleCharacter(characterId: string) {
    if (!selectedBlock) return;
    const characterIds = selectedBlock.characterIds.includes(characterId)
      ? selectedBlock.characterIds.filter((id) => id !== characterId)
      : [...selectedBlock.characterIds, characterId];
    patchSelected({ characterIds });
  }

  function renderCanvas() {
    if (view === "blocks") return <CardGrid cards={model.visibleCards} selectedId={selectedBlock?.id ?? ""} onSelect={setSelectedBlockId} />;
    if (view === "sequence") {
      return <div className={styles.laneStack}>{model.sequences.map((lane) => (
        <section className={styles.lane} key={lane.id}>
          <header><div><p>Sequence {lane.number} · Act {lane.act}</p><h2>{lane.title}</h2></div><span>{lane.cards.length} Blocks</span></header>
          <p>{lane.purpose}</p>
          <CardGrid cards={lane.cards} selectedId={selectedBlock?.id ?? ""} onSelect={setSelectedBlockId} />
        </section>
      ))}</div>;
    }
    if (view === "act") {
      return <div className={styles.laneStack}>{model.acts.map((lane) => (
        <section className={styles.lane} key={lane.number}>
          <header><div><p>Act {lane.number}</p><h2>{["Setup", "Confrontation", "Complication", "Resolution"][lane.number - 1]}</h2></div><span>{lane.cards.length} Blocks</span></header>
          <CardGrid cards={lane.cards} selectedId={selectedBlock?.id ?? ""} onSelect={setSelectedBlockId} />
        </section>
      ))}</div>;
    }
    return <div className={styles.filmMap}>{model.acts.map((actLane) => (
      <section className={styles.actColumn} key={actLane.number}>
        <header><p>Act {actLane.number}</p><h2>{["Setup", "Confrontation", "Complication", "Resolution"][actLane.number - 1]}</h2></header>
        {actLane.sequences.map((sequenceLane) => (
          <div className={styles.sequenceGroup} key={sequenceLane.id}>
            <div className={styles.sequenceHeading}><strong>Sequence {sequenceLane.number}</strong><span>{sequenceLane.title}</span></div>
            {sequenceLane.cards.map((card) => <BlockCard key={card.id} card={card} selected={card.id === selectedBlock?.id} onSelect={() => setSelectedBlockId(card.id)} />)}
          </div>
        ))}
      </section>
    ))}</div>;
  }

  return (
    <div className={styles.workspace}>
      <aside className={styles.submenu} aria-label="Build sections">
        <div><p className={styles.eyebrow}>Build</p><strong>Arrange the film</strong><span>One canonical 24-Block structure.</span></div>
        <nav aria-label="Build views">
          {VIEW_OPTIONS.map((option) => (
            <button type="button" key={option.id} className={view === option.id ? styles.activeView : ""} onClick={() => setView(option.id)}>
              <strong>{option.label}</strong><span>{option.description}</span>
            </button>
          ))}
        </nav>
        <div className={styles.canonicalNote}>
          <span>Canonical project</span>
          <strong>{model.totals.blocks} Blocks · {model.totals.scenes} scenes · {model.totals.miniBlocks} mini-blocks</strong>
          <p>Edits autosave through the same project used by Plan, Write, Storyboard, Feedback and Reports.</p>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.hero}>
          <div><p className={styles.eyebrow}>Visual story construction</p><h1>Build the whole film, then refine one Block without losing context.</h1><p>Move between four acts, twelve sequences and twenty-four stable Block IDs. Search and inspect the same data already used throughout PlotPickle.</p></div>
          <div className={styles.heroMetric}><strong>{model.visibleCards.length}</strong><span>visible Blocks</span></div>
        </header>

        <section className={styles.filters} aria-label="Build filters">
          <label><span>Search</span><input type="search" value={query} placeholder="Title, purpose, character, setup…" onChange={(event) => setQuery(event.target.value)} /></label>
          <label><span>Act</span><select value={act} onChange={(event) => setAct(Number(event.target.value))}><option value={0}>All acts</option>{[1, 2, 3, 4].map((value) => <option value={value} key={value}>Act {value}</option>)}</select></label>
          <label><span>Sequence</span><select value={sequence} onChange={(event) => setSequence(Number(event.target.value))}><option value={0}>All sequences</option>{project.structure.sequences.map((item) => <option value={item.number} key={item.id}>Sequence {item.number}</option>)}</select></label>
          <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as BuildBlockStatus | "all")}>{STATUS_OPTIONS.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
          <label><span>Label</span><select value={label} onChange={(event) => setLabel(event.target.value)}><option value="">All labels</option>{labels.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
          <button type="button" onClick={() => { setQuery(""); setAct(0); setSequence(0); setStatus("all"); setLabel(""); }}>Clear filters</button>
        </section>

        <section className={styles.canvas} aria-label={`${VIEW_OPTIONS.find((option) => option.id === view)?.label} Build view`}>
          {renderCanvas()}
        </section>
      </main>

      <aside className={styles.inspector} aria-label="Block inspector">
        {selectedBlock && selectedCard ? (
          <>
            <header><div><p className={styles.eyebrow}>Block inspector</p><h2>Block {selectedBlock.number}</h2></div><span className={`${styles.status} ${styles[`status${statusLabel(selectedCard.status)}`]}`}>{statusLabel(selectedCard.status)}</span></header>
            <InspectorField label="Title" rows={1} value={selectedBlock.title} onChange={(value) => patchSelected({ title: value })} />
            <InspectorField label="Purpose" value={selectedBlock.purpose} onChange={(value) => patchSelected({ purpose: value })} />
            <InspectorField label="Conflict" value={selectedBlock.conflict} onChange={(value) => patchSelected({ conflict: value })} />
            <InspectorField label="Emotional movement" value={selectedBlock.emotionalTurn} onChange={(value) => patchSelected({ emotionalTurn: value })} />
            <div className={styles.pairedFields}>
              <InspectorField label="Setup" value={selectedBlock.setup} onChange={(value) => patchSelected({ setup: value })} />
              <InspectorField label="Payoff" value={selectedBlock.payoff} onChange={(value) => patchSelected({ payoff: value })} />
            </div>
            <fieldset className={styles.characterFieldset}>
              <legend>Character focus</legend>
              {project.characters.map((character) => (
                <label key={character.id}><input type="checkbox" checked={selectedBlock.characterIds.includes(character.id)} onChange={() => toggleCharacter(character.id)} /><span>{character.name || "Unnamed character"}</span></label>
              ))}
            </fieldset>
            <InspectorField label="Notes" rows={4} value={selectedBlock.notes} onChange={(value) => patchSelected({ notes: value })} />
            <section className={styles.linkedScenes}>
              <div><strong>Linked scenes</strong><span>{selectedBlock.scenes.length}</span></div>
              {selectedBlock.scenes.length ? selectedBlock.scenes.map((scene) => <p key={scene.id}><strong>{scene.title}</strong><span>{scene.status} · {scene.miniBlocks.length} mini-blocks</span></p>) : <p>No scenes are linked yet.</p>}
            </section>
            <button type="button" className={styles.primaryAction} onClick={() => onOpenBlock(selectedBlock.number)}>Open full Block editor in Plan</button>
          </>
        ) : <p className={styles.emptyState}>Choose a Block to inspect it.</p>}
      </aside>
    </div>
  );
}
