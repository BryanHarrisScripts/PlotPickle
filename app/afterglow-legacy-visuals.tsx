"use client";

/* eslint-disable @next/next/no-img-element -- Bundled local Afterglow WebP assets are intentional. */

import { useMemo, useState } from "react";
import manifest from "@/data/afterglow-visual-manifest.json";
import type { PlotPickleProject } from "@/lib/project";
import {
  afterglowMappingSummary,
  afterglowOverviewVisuals,
  afterglowVisualsForBlock,
  isAfterglowProject,
  type AfterglowLegacyVisual,
  type AfterglowVisualDecision,
} from "@/lib/afterglow-legacy-visuals";
import styles from "./afterglow-legacy-visuals.module.css";

const visuals = manifest as AfterglowLegacyVisual[];

type Props = {
  project: PlotPickleProject;
  mode: "overview" | "gallery" | "block" | "pitch";
  blockNumber?: number;
  onPrepareDecision?: (visual: AfterglowLegacyVisual, decision: AfterglowVisualDecision) => void;
};

export default function AfterglowLegacyVisuals({ project, mode, blockNumber = 1, onPrepareDecision }: Props) {
  const [selectedId, setSelectedId] = useState("");
  const [writerNote, setWriterNote] = useState("");
  const [action, setAction] = useState<AfterglowVisualDecision["action"]>("pin-reference");
  const summary = afterglowMappingSummary(visuals);
  const available = useMemo(() => {
    if (mode === "overview" || mode === "pitch") return afterglowOverviewVisuals(visuals);
    if (mode === "block") return afterglowVisualsForBlock(visuals, blockNumber);
    return visuals.filter((visual) => visual.kind !== "placeholder");
  }, [mode, blockNumber]);
  const selected = available.find((visual) => visual.id === selectedId) ?? available[0];

  if (!isAfterglowProject(project)) return null;

  function prepare() {
    if (!selected || !onPrepareDecision) return;
    const scope = mode === "block" ? "block" : mode === "pitch" ? "pitch" : "project";
    onPrepareDecision(selected, {
      referenceId: selected.id,
      title: selected.title,
      action,
      scope,
      target: scope === "block" ? `Block ${blockNumber}` : scope,
      writerNote,
    });
  }

  return <section className={styles.panel} aria-label="Legacy Afterglow visuals">
    <header><div><span>Legacy Afterglow Visuals</span><h2>{mode === "block" ? `Block ${blockNumber} source comparison` : "Earlier visual-development stage"}</h2><p>These bundled images document Afterglow’s history. They are references to review—not automatically approved storyboard frames, Block covers or pitch assets.</p></div><strong>{summary.mappedStoryVisuals} mapped · {summary.unresolved} unresolved</strong></header>
    {mode === "overview" ? <div className={styles.summary}><article><strong>{summary.retained}</strong><span>retained visuals</span></article><article><strong>{summary.proposed}</strong><span>proposed mappings</span></article><article><strong>{summary.placeholders}</strong><span>historical placeholder</span></article><article><strong>17–24</strong><span>need unique coverage review</span></article></div> : null}
    <div className={styles.layout}>
      <div className={styles.grid}>{available.map((visual) => <button type="button" className={visual.id === selected?.id ? styles.selected : styles.card} key={visual.id} onClick={() => setSelectedId(visual.id)}><img src={visual.images.thumb} alt={`${visual.title}, legacy Afterglow visual-development reference`} loading="lazy" /><span>{visual.kind} · {visual.mappingStatus}</span><strong>{visual.title}</strong><small>{visual.proposedBlockNumbers.length ? `Proposed Block${visual.proposedBlockNumbers.length > 1 ? "s" : ""} ${visual.proposedBlockNumbers.join(", ")}` : "No Block mapping"}</small></button>)}</div>
      {selected ? <aside className={styles.detail}><img src={selected.images.card} alt={`${selected.title}, larger legacy Afterglow visual-development reference`} loading="lazy" /><span>{selected.mappingStatus}</span><h3>{selected.title}</h3><p>{selected.mappingNote}</p>{selected.source.originalFilename.toLowerCase().includes("summer") ? <p className={styles.notice}>Legacy naming note: this source image uses Summer terminology. PlotPickle currently treats Summer and Isobel as one character pending final reconciliation.</p> : null}<dl><div><dt>Original filename</dt><dd>{selected.source.originalFilename}</dd></div><div><dt>Source SHA</dt><dd>{selected.source.originalSha.slice(0, 12)}…</dd></div><div><dt>Current use</dt><dd>{selected.kind}</dd></div><div><dt>Rights status</dt><dd>Review required before public release</dd></div></dl>{onPrepareDecision ? <><label>Decision<select value={action} onChange={(event) => setAction(event.target.value as AfterglowVisualDecision["action"])}><option value="pin-reference">Pin as reference</option><option value="approve-block-cover">Approve as Block cover</option><option value="pitch-reference">Pin to pitch references</option><option value="retire">Retire from active use</option></select></label><label>Writer note<textarea value={writerNote} onChange={(event) => setWriterNote(event.target.value)} placeholder="Explain why this source visual should be retained, compared, approved or retired." /></label><button type="button" onClick={prepare}>Prepare reviewable decision</button></> : null}<small>{selected.source.rightsNote}</small></aside> : <p>No legacy visual is mapped to this context.</p>}
    </div>
  </section>;
}
