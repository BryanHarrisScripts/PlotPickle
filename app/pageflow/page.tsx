"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { blockWritingEntry } from "@/core/contracts/block-writing";
import { normalizeProjectSourceEvidence } from "@/core/contracts/imported-screenplay-evidence";
import {
  PROJECT_LIBRARY_CHANGED_EVENT,
  loadActiveLibraryProject,
  type LibraryPPFProject,
} from "@/core/storage/project-library-browser";
import { scanPageFlowDraft } from "@/lib/pageflow";
import {
  storyLearningContext,
  storyLearningHref,
  storyLearningReturnHref,
} from "@/modules/learn/model/story-learning-context";
import styles from "./pageflow.module.css";

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

function writeHref(blockNumber: number, miniBlockNumber: number) {
  const query = new URLSearchParams({
    workspace: "write",
    block: String(blockNumber),
    mini: String(miniBlockNumber),
  });
  return `/?${query.toString()}`;
}

function pageFlowHref(blockNumber: number, miniBlockNumber: number) {
  const query = typeof window === "undefined"
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search);
  query.set("block", String(blockNumber));
  query.set("mini", String(miniBlockNumber));
  return `/pageflow?${query.toString()}`;
}

function SignalList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <article className={styles.signalCard}>
      <strong>{title}</strong>
      {items.length ? (
        <div className={styles.chips}>{items.map((item) => <span key={item}>{item}</span>)}</div>
      ) : (
        <p>{empty}</p>
      )}
    </article>
  );
}

export default function PageFlowPage() {
  const [project, setProject] = useState<LibraryPPFProject | null>(null);
  const [address, setAddress] = useState(() => currentAddress());
  const [status, setStatus] = useState("Opening the profile-owned PPF project…");

  useEffect(() => {
    const sync = () => {
      setProject(loadActiveLibraryProject());
      setAddress(currentAddress());
      setStatus("Read-only PageFlow diagnostic. Write remains the screenplay authority.");
    };
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
  const workingText = entry?.text ?? "";
  const draftScan = useMemo(() => scanPageFlowDraft(workingText), [workingText]);

  if (!project) return <p role="status">Opening PageFlow…</p>;

  const block = project.structure.blocks.find((candidate) => candidate.number === address.blockNumber)
    ?? project.structure.blocks[0];
  const mini = block?.miniBlocks.find((candidate) => candidate.ordinal === address.miniBlockNumber)
    ?? block?.miniBlocks[0];
  const normalizedAddress = {
    blockNumber: block?.number ?? address.blockNumber,
    miniBlockNumber: mini?.ordinal ?? address.miniBlockNumber,
  };
  const evidence = normalizeProjectSourceEvidence(project.sourceEvidence);
  const sourcePassages = evidence.screenplay?.passages.filter((passage) => (
    passage.blockNumber === normalizedAddress.blockNumber
    && passage.miniBlockNumber === normalizedAddress.miniBlockNumber
  )) ?? [];
  const sourceText = sourcePassages.map((passage) => passage.text).join("\n\n");
  const matrixBlock = evidence.storyMatrix?.blocks.find(
    (candidate) => candidate.blockNumber === normalizedAddress.blockNumber,
  ) ?? null;
  const arcCells = evidence.characterTruth?.arcCells.filter((cell) => (
    cell.blockNumber === normalizedAddress.blockNumber
    && cell.state !== "not-present-no-evidence"
  )) ?? [];
  const learning = storyLearningContext(normalizedAddress);

  function selectAddress(blockNumber: number, miniBlockNumber: number) {
    window.location.assign(pageFlowHref(blockNumber, miniBlockNumber));
  }

  return (
    <main className={`${styles.page} standalone-studio-surface`} data-pageflow-authority="ppf-block-writing-read-only">
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>REFINE · PAGEFLOW · READ-ONLY DIAGNOSTIC</p>
            <h1>PageFlow Diagnostics</h1>
            <p>
              Inspect the exact saved screenplay text owned by Write at this Block / Mini-Block address.
              Imported source evidence and character context remain references; they are not substituted for what is actually on the page.
            </p>
          </div>
          <div className={styles.actions}>
            <Link className={styles.secondaryButton} href={storyLearningReturnHref(normalizedAddress)}>Back to Outline</Link>
            <Link className={styles.button} href={writeHref(normalizedAddress.blockNumber, normalizedAddress.miniBlockNumber)}>Open Write to revise</Link>
          </div>
        </header>

        <section className={styles.projectBar} aria-label="PageFlow story address">
          <div className={styles.projectTitle}>
            <strong>{project.title}</strong>
            <span>PPF revision {project.revision} · Block {String(normalizedAddress.blockNumber).padStart(2, "0")} · Mini-Block {normalizedAddress.miniBlockNumber}</span>
          </div>
          <label className={styles.field}>
            <span>Block</span>
            <select
              value={normalizedAddress.blockNumber}
              onChange={(event) => selectAddress(Number(event.target.value), 1)}
            >
              {project.structure.blocks.map((candidate) => (
                <option value={candidate.number} key={candidate.id}>
                  {String(candidate.number).padStart(2, "0")} · {candidate.title}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Mini-Block</span>
            <select
              value={normalizedAddress.miniBlockNumber}
              onChange={(event) => selectAddress(normalizedAddress.blockNumber, Number(event.target.value))}
            >
              {(block?.miniBlocks ?? []).map((candidate) => (
                <option value={candidate.ordinal} key={candidate.id}>
                  {candidate.ordinal} · {candidate.title}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className={styles.contextGrid}>
          <article>
            <strong>Story position</strong>
            <span>Current PPF address</span>
            <p>Act {block?.actNumber ?? 1} · Sequence {String(block?.sequenceNumber ?? 1).padStart(2, "0")} · {block?.title ?? "Untitled Block"} · {mini?.title ?? learning.miniRole}</p>
          </article>
          <article>
            <strong>Working screenplay</strong>
            <span>Write-owned evidence</span>
            <p>{workingText.trim() ? `Saved working text · ${workingText.length.toLocaleString()} characters` : "No working screenplay text has been saved at this address yet."}</p>
          </article>
          <article>
            <strong>Imported source</strong>
            <span>Immutable evidence</span>
            <p>{sourcePassages.length ? `${sourcePassages.length} mapped source passage${sourcePassages.length === 1 ? "" : "s"} · ${evidence.screenplay?.analysisStatus ?? "none"}` : "No imported source passage is mapped to this Mini-Block."}</p>
          </article>
          <article>
            <strong>Character truth</strong>
            <span>Context, not screenplay proof</span>
            <p>{arcCells.length ? `${arcCells.length} character arc evidence cell${arcCells.length === 1 ? "" : "s"} touch this Block. PageFlow still requires visible/audible page evidence.` : "No character arc evidence is attached here. Profiles never substitute for audience-visible screenplay evidence."}</p>
          </article>
        </section>

        {workingText.trim() ? (
          <section className={styles.scorePanel} aria-label="PageFlow draft signals" data-pageflow-scan-source="working-screenplay">
            <div className={styles.scoreRing} style={{ "--score": `${draftScan.signal * 3.6}deg` } as CSSProperties}>
              <strong>{draftScan.signal}</strong><span>draft signal</span>
            </div>
            <div className={styles.metricGrid}>
              <div><strong>{draftScan.words}</strong><span>action words</span></div>
              <div><strong>{draftScan.paragraphs}</strong><span>visual beats</span></div>
              <div><strong>{draftScan.averageSentence}</strong><span>words per sentence</span></div>
              <div><strong>{draftScan.longParagraphs}</strong><span>dense paragraphs</span></div>
            </div>
            <p>This is an editorial signal, not a grade. PageFlow does not edit, approve or promote screenplay text.</p>
          </section>
        ) : (
          <section className={styles.empty} data-pageflow-scan-source="none">
            <strong>No working screenplay text to diagnose.</strong>
            <p>Imported source may be reviewed below, but PageFlow does not diagnose it as current working screenplay. Open Write, review/copy source if useful, and save the text you want PageFlow to inspect.</p>
            <div className={styles.actions}>
              <Link className={styles.button} href={writeHref(normalizedAddress.blockNumber, normalizedAddress.miniBlockNumber)}>Open Write at this address</Link>
            </div>
          </section>
        )}

        <div className={styles.workspace}>
          <section className={styles.draftPanel}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>WORKING SCREENPLAY · BLOCK {normalizedAddress.blockNumber}.{normalizedAddress.miniBlockNumber}</p>
              <h2>What PageFlow is actually diagnosing</h2>
              <p>This panel is read-only. Exact wording belongs to Write.</p>
            </div>
            <pre data-pageflow-working-text="read-only">{workingText || "No saved working screenplay text at this address."}</pre>

            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>IMMUTABLE IMPORTED SOURCE</p>
              <h2>Source evidence stays separate</h2>
              <p>Source evidence may inform a Human revision, but it is not treated as current working screenplay until the Human deliberately saves working text in Write.</p>
            </div>
            {sourcePassages.length ? (
              <ol data-pageflow-source-evidence="immutable">
                {sourcePassages.map((passage) => (
                  <li key={passage.id}>
                    <small>Scene {passage.sceneNumber || "—"} · {passage.type}</small>
                    <p>{passage.text}</p>
                  </li>
                ))}
              </ol>
            ) : <p>No imported source evidence is mapped here.</p>}
            {sourceText.trim() && !workingText.trim() ? <p><strong>Source-only state:</strong> this text is visible for comparison, but the diagnostic remains empty until working text is saved.</p> : null}

            {matrixBlock ? (
              <div className={styles.contextGrid}>
                <article><strong>Structural responsibility</strong><p>{matrixBlock.responsibility}</p></article>
                <article><strong>Human structural finding</strong><p>{matrixBlock.structuralFinding.state} · {matrixBlock.structuralFinding.reason}</p></article>
              </div>
            ) : null}

            <div className={styles.actions}>
              <Link className={styles.button} href={writeHref(normalizedAddress.blockNumber, normalizedAddress.miniBlockNumber)}>Revise in Write</Link>
              <Link className={styles.secondaryButton} href={storyLearningHref(learning.references[0], normalizedAddress)}>Learn this position</Link>
            </div>
          </section>

          <aside className={styles.diagnosticPanel}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>REVISION SIGNALS</p>
              <h2>Inspect, do not obey blindly.</h2>
              <p>Findings describe deterministic text evidence. Camera language and emotion labels are review prompts, not automatic errors.</p>
            </div>
            <SignalList title="Invisible or explanatory" items={draftScan.invisible} empty={workingText.trim() ? "No common invisible-state terms detected in working action text." : "No working text to scan."} />
            <SignalList title="Possible directing language" items={draftScan.directing} empty={workingText.trim() ? "No common camera or editing terms detected in working action text." : "No working text to scan."} />
            <SignalList title="Weak action phrases" items={draftScan.weak} empty={workingText.trim() ? "No common delayed-action phrases detected in working action text." : "No working text to scan."} />
            <SignalList title="Emotion labels to physicalize" items={draftScan.emotions} empty={workingText.trim() ? "No common emotion labels detected in working action text." : "No working text to scan."} />

            <div className={styles.checklist}>
              <h3>Five-pass rewrite</h3>
              <ol>
                <li><strong>Screen pass</strong><span>Can the audience see or hear every essential idea?</span></li>
                <li><strong>Verb pass</strong><span>Can one exact action replace a weak phrase or explanation?</span></li>
                <li><strong>Actor pass</strong><span>Does the character have behaviour to play rather than an emotion label to imitate?</span></li>
                <li><strong>Rhythm pass</strong><span>Does each paragraph contain one primary visual beat?</span></li>
                <li><strong>Restraint pass</strong><span>Are you guiding attention without directing every shot?</span></li>
              </ol>
            </div>

            <div className={styles.wordBank}>
              <h3>Contextual LEARN</h3>
              <p>{learning.positionNote}</p>
              <div className={styles.actions}>
                {learning.references.map((reference) => (
                  <Link className={styles.secondaryButton} href={storyLearningHref(reference, normalizedAddress)} key={reference.lessonId}>
                    {reference.actionLabel}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <p className={styles.status} aria-live="polite">{status}</p>
      </div>
    </main>
  );
}
