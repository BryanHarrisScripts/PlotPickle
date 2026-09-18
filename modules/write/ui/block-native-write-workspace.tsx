"use client";

import { useEffect, useMemo, useState } from "react";
import { blockWritingEntry, updateBlockWritingEntry } from "@/core/contracts/block-writing";
import { normalizeProjectSourceEvidence } from "@/core/contracts/imported-screenplay-evidence";
import {
  PROJECT_LIBRARY_CHANGED_EVENT,
  loadActiveLibraryProject,
  saveActiveLibraryProject,
  type LibraryPPFProject,
} from "@/core/storage/project-library-browser";
import {
  markCreativeRevisionDependentsStale,
  planCreativeRevisionPropagation,
} from "@/lib/preproduction/creative-revision-propagation";
import {
  storyLearningContext,
  storyLearningHref,
  storyLearningReturnHref,
} from "@/modules/learn/model/story-learning-context";
import styles from "./block-native-write-workspace.module.css";

function bounded(value: string | null, maximum: number) {
  const number = Number(value || 1);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(1, Math.trunc(number))) : 1;
}

function currentAddress() {
  if (typeof window === "undefined") return { blockNumber: 1, miniBlockNumber: 1 };
  const query = new URLSearchParams(window.location.search);
  return {
    blockNumber: bounded(query.get("block"), 24),
    miniBlockNumber: bounded(query.get("mini"), 4),
  };
}

function addressHref(blockNumber: number, miniBlockNumber: number) {
  const query = new URLSearchParams({
    block: String(blockNumber),
    mini: String(miniBlockNumber),
  });
  return `/write?${query.toString()}`;
}

function pageFlowHref(blockNumber: number, miniBlockNumber: number) {
  const query = new URLSearchParams({
    block: String(blockNumber),
    mini: String(miniBlockNumber),
  });
  return `/pageflow?${query.toString()}`;
}

export default function BlockNativeWriteWorkspace() {
  const [project, setProject] = useState<LibraryPPFProject | null>(null);
  const [address, setAddress] = useState(() => currentAddress());
  const [draftText, setDraftText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const sync = () => setProject(loadActiveLibraryProject());
    sync();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const entry = useMemo(
    () => project ? blockWritingEntry(project.writing, address) : null,
    [address, project],
  );

  const revisionImpact = useMemo(() => {
    if (!project || draftText === savedText) return null;
    try {
      return planCreativeRevisionPropagation({
        project,
        target: {
          kind: "writing",
          blockNumber: address.blockNumber,
          miniBlockNumber: address.miniBlockNumber,
        },
        beforeValue: savedText,
        afterValue: draftText,
        changeSetId: `write-impact-${project.revision}-${address.blockNumber}-${address.miniBlockNumber}`,
        summary: `Revise working screenplay text at Block ${String(address.blockNumber).padStart(2, "0")} · Mini-Block ${address.miniBlockNumber}.`,
        occurredAt: project.updatedAt,
      });
    } catch {
      return null;
    }
  }, [address.blockNumber, address.miniBlockNumber, draftText, project, savedText]);

  useEffect(() => {
    const next = entry?.text ?? "";
    setDraftText(next);
    setSavedText(next);
    setStatus("");
  }, [entry?.id, entry?.text]);

  if (!project) return <p role="status">Opening Write…</p>;

  const block = project.structure.blocks[address.blockNumber - 1];
  const mini = block?.miniBlocks[address.miniBlockNumber - 1];
  const source = normalizeProjectSourceEvidence(project.sourceEvidence).screenplay;
  const sourcePassages = source?.passages.filter((passage) => (
    passage.blockNumber === address.blockNumber
    && passage.miniBlockNumber === address.miniBlockNumber
  )) ?? [];
  const sourceText = sourcePassages.map((passage) => passage.text).join("\n\n");
  const learning = storyLearningContext(address);
  const dirty = draftText !== savedText;

  function selectAddress(blockNumber: number, miniBlockNumber: number) {
    if (dirty && !window.confirm("Leave this story position without saving the working screenplay text?")) return;
    window.location.assign(addressHref(blockNumber, miniBlockNumber));
  }

  function save() {
    const savedAt = new Date().toISOString();
    const revision = project.revision + 1;
    const revised: LibraryPPFProject = {
      ...project,
      revision,
      updatedAt: savedAt,
      writing: updateBlockWritingEntry(project.writing, address, draftText, savedAt),
    };
    const next = revisionImpact
      ? markCreativeRevisionDependentsStale(revised, revisionImpact, revision)
      : revised;
    const saved = saveActiveLibraryProject(next);
    setProject(saved);
    setSavedText(draftText);
    const affectedVisuals = revisionImpact?.staleAcceptedVisualArtifactIds.length ?? 0;
    const affectedShots = revisionImpact?.staleProductionShotIds.length ?? 0;
    setStatus(
      `Saved Block ${String(address.blockNumber).padStart(2, "0")} · Mini-Block ${address.miniBlockNumber} working text. `
      + `${affectedVisuals} accepted visual${affectedVisuals === 1 ? "" : "s"} and ${affectedShots} Previs Shot${affectedShots === 1 ? "" : "s"} are dependency-affected and require review; unrelated accepted work remains intact. No regeneration was triggered.`,
    );
  }

  function useSourceAsStartingPoint() {
    if (!sourceText.trim()) return;
    setDraftText(sourceText);
    setStatus("Copied source evidence into the unsaved working editor. Review it before saving; the source evidence itself remains unchanged.");
  }

  return (
    <main className={styles.workspace} data-block-native-write="24x96">
      <header className={styles.header}>
        <div>
          <p>WRITE · BLOCK-NATIVE SCREENPLAY</p>
          <h1>{project.title}</h1>
          <span>Act {block?.actNumber ?? 1} · Sequence {String(block?.sequenceNumber ?? 1).padStart(2, "0")} · Block {String(address.blockNumber).padStart(2, "0")}</span>
        </div>
        <div className={styles.headerActions}>
          <button type="button" onClick={() => window.location.assign(storyLearningReturnHref(address))}>Outline this position</button>
          <button type="button" onClick={() => window.location.assign(pageFlowHref(address.blockNumber, address.miniBlockNumber))}>PageFlow diagnostic</button>
          <button type="button" onClick={() => window.location.assign(storyLearningHref(learning.references[0], address))}>Learn this position</button>
        </div>
      </header>

      <section className={styles.positionBar} aria-label="Writing story position">
        <label>
          <span>Block</span>
          <select value={address.blockNumber} onChange={(event) => selectAddress(Number(event.target.value), 1)}>
            {project.structure.blocks.map((candidate) => (
              <option key={candidate.id} value={candidate.number}>
                {String(candidate.number).padStart(2, "0")} · {candidate.title}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.miniButtons} aria-label="Mini-Block">
          {block?.miniBlocks.map((candidate) => (
            <button
              aria-current={candidate.ordinal === address.miniBlockNumber ? "true" : undefined}
              key={candidate.id}
              onClick={() => selectAddress(address.blockNumber, candidate.ordinal)}
              type="button"
            >
              {candidate.ordinal} · {["Promise", "Progress", "Pressure", "Payoff"][candidate.ordinal - 1]}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.storyHeading}>
        <div>
          <p>BLOCK {String(address.blockNumber).padStart(2, "0")} · MINI-BLOCK {address.miniBlockNumber} · {learning.miniRole.toUpperCase()}</p>
          <h2>{block?.title ?? `Block ${String(address.blockNumber).padStart(2, "0")}`}</h2>
          <span>{mini?.title ?? learning.miniRole}</span>
        </div>
        <p>{learning.positionNote}</p>
      </section>

      <div className={styles.columns}>
        <section className={styles.sourcePanel}>
          <div className={styles.sectionHeading}>
            <p>IMMUTABLE SOURCE EVIDENCE</p>
            <h2>What was actually imported here</h2>
          </div>
          {sourcePassages.length ? (
            <ol>
              {sourcePassages.map((passage) => (
                <li key={passage.id}>
                  <small>Scene {passage.sceneNumber} · {passage.type}</small>
                  <p>{passage.text}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>No imported screenplay passage is mapped to this Mini-Block. PlotPickle will not fabricate one.</p>
          )}
          <button disabled={!sourceText.trim()} onClick={useSourceAsStartingPoint} type="button">
            Use source as an unsaved starting point
          </button>
          <small>Source evidence is never edited by this action. It only copies text into the working editor for Human review.</small>
        </section>

        <section className={styles.editorPanel}>
          <div className={styles.sectionHeading}>
            <p>WORKING SCREENPLAY TEXT</p>
            <h2>Write this story movement</h2>
          </div>
          <textarea
            aria-label={`Working screenplay text for Block ${address.blockNumber} Mini-Block ${address.miniBlockNumber}`}
            onChange={(event) => setDraftText(event.target.value)}
            placeholder="Write only what belongs on the page. Backstory and curriculum can inform the choice without becoming exposition."
            value={draftText}
          />
          <div className={styles.editorActions}>
            <span>{dirty ? "Unsaved changes" : savedText.trim() ? "Saved working text" : "No working text yet"}</span>
            <button disabled={!dirty} onClick={save} type="button">Save working text</button>
          </div>
          {status ? <p aria-live="polite" className={styles.status}>{status}</p> : null}
        </section>
      </div>

      {revisionImpact ? (
        <section className={styles.impactPanel} aria-label="Dependency impact preview">
          <div className={styles.sectionHeading}>
            <p>CHANGE CONSEQUENCE · #2035 CHANGE SET</p>
            <h2>What this unsaved revision would invalidate</h2>
          </div>
          <div className={styles.impactSummary}>
            <span>{revisionImpact.staleAcceptedVisualArtifactIds.length} accepted visuals need review</span>
            <span>{revisionImpact.staleProductionShotIds.length} Previs Shots need review</span>
            <span>{revisionImpact.unaffectedAcceptedVisualArtifactIds.length} accepted visuals remain current</span>
            <span>{revisionImpact.unaffectedProductionShotIds.length} Previs Shots remain current</span>
          </div>
          {revisionImpact.affectedRefs.length ? (
            <details>
              <summary>Inspect {revisionImpact.affectedRefs.length} dependency-affected refs</summary>
              <ol>
                {revisionImpact.affectedRefs.slice(0, 24).map((affected) => (
                  <li key={affected.id}>
                    <strong>{affected.kind}</strong>
                    <span>{affected.id}</span>
                    <small>{affected.explanation}</small>
                  </li>
                ))}
              </ol>
            </details>
          ) : <p>No downstream creative dependency is attached to this story address yet.</p>}
          <small>Invalidation is review evidence only. It does not delete accepted work, approve replacement work, call a provider, or spend generation credits.</small>
        </section>
      ) : null}

      <section className={styles.learningPanel} aria-label="Contextual learning for this story position">
        <div className={styles.sectionHeading}>
          <p>LEARN AT THIS STORY POSITION</p>
          <h2>Use the curriculum as a reference, not a prescription.</h2>
        </div>
        <div className={styles.learningGrid}>
          {learning.references.map((reference) => (
            <article key={reference.lessonId}>
              <strong>{reference.concept}</strong>
              <p>{reference.reason}</p>
              <button onClick={() => window.location.assign(storyLearningHref(reference, address))} type="button">
                {reference.actionLabel}
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
