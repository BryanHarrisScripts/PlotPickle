"use client";

import { useMemo, useState } from "react";
import type { PPFProject } from "../../../core/project/project";
import {
  deriveProgressiveStoryMap,
  type BuildStoryEvidenceState,
} from "../progressive-story-map";
import styles from "./progressive-story-map.module.css";

const STATE_LABELS: Readonly<Record<BuildStoryEvidenceState, string>> = {
  defined: "Defined",
  observed: "Observed",
  emerging: "Emerging",
  missing: "Missing",
  locked: "Locked",
};

export default function ProgressiveStoryMap({ project }: { readonly project: PPFProject }) {
  const storyMap = useMemo(() => deriveProgressiveStoryMap(project), [project]);
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(1);
  const selected = storyMap.blocks.find((block) => block.number === selectedBlockNumber) ?? storyMap.blocks[0];

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

      <div className={styles.legend} aria-label="24/96 evidence states">
        {(Object.keys(STATE_LABELS) as BuildStoryEvidenceState[]).map((state) => (
          <span data-state={state} key={state}><i aria-hidden="true" />{STATE_LABELS[state]}</span>
        ))}
      </div>

      <div className={styles.map} aria-label="24 story Blocks">
        {storyMap.blocks.map((block) => (
          <button
            aria-pressed={selected.number === block.number}
            className={styles.block}
            data-state={block.state}
            key={block.id}
            onClick={() => setSelectedBlockNumber(block.number)}
            type="button"
          >
            <span className={styles.blockNumber}>{String(block.number).padStart(2, "0")}</span>
            <span className={styles.sequence}>S{String(block.sequenceNumber).padStart(2, "0")} · {block.sequenceTitle}</span>
            <strong>{STATE_LABELS[block.state]}</strong>
            {block.observedPassageCount ? <small>{block.observedPassageCount} source passage{block.observedPassageCount === 1 ? "" : "s"}</small> : <small>Not enough information yet</small>}
            <span className={styles.minis} aria-label={`Block ${block.number} Mini-Blocks`}>
              {block.miniBlocks.map((mini) => (
                <i data-state={mini.state} key={mini.id} title={`${mini.label}: ${STATE_LABELS[mini.state]}`}>{mini.number}</i>
              ))}
            </span>
          </button>
        ))}
      </div>

      <article className={styles.inspector} data-selected-block={selected.number}>
        <header>
          <div><p className={styles.kicker}>Selected story position</p><h3>Block {String(selected.number).padStart(2, "0")} · {selected.sequenceTitle}</h3></div>
          <span data-state={selected.state}>{STATE_LABELS[selected.state]}</span>
        </header>
        <p>{selected.sequencePurpose}</p>
        <div className={styles.explainGrid}>
          <section>
            <h4>What PlotPickle knows</h4>
            <p>{selected.mappingNote}</p>
            {selected.observedExcerpts.length ? (
              <ul>{selected.observedExcerpts.map((item, index) => <li key={`${selected.id}-evidence-${index}`}>{item}</li>)}</ul>
            ) : <p className={styles.unresolved}>No direct screenplay passage or accepted structural decision currently defines this Block.</p>}
          </section>
          <section>
            <h4>Mini-Block resolution</h4>
            <ol className={styles.miniInspector}>
              {selected.miniBlocks.map((mini) => (
                <li data-state={mini.state} key={mini.id}>
                  <span>{mini.number}. {mini.label}</span>
                  <strong>{STATE_LABELS[mini.state]}</strong>
                  <small>{mini.observedPassageCount ? `${mini.observedPassageCount} observed passage${mini.observedPassageCount === 1 ? "" : "s"}; placement remains subject to review.` : "Not enough information at the current frontier."}</small>
                </li>
              ))}
            </ol>
          </section>
        </div>
        {storyMap.importedSourceFileName ? <p className={styles.provenance}>Source: {storyMap.importedSourceFileName}. The screenplay text is observed evidence; a suggested 24/96 placement does not become canon until the Human reviews it.</p> : <p className={styles.provenance}>Current frontier: Foundations. PLAN decisions remain global story context until later Structure work earns exact Block placement.</p>}
      </article>
    </section>
  );
}
