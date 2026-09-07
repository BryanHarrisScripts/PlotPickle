"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { persistActiveProfileProject } from "@/core/storage/profile-private-browser";
import {
  storyBlockState,
  storyMiniBlockState,
  type StoryBlockV2,
  type StoryMiniBlockV2,
  type StoryWorkflowStage,
  type StoryWorkflowState,
} from "@/core/project/story-structure-v2";
import {
  PROJECT_LIBRARY_CHANGED_EVENT,
  hasActiveLibraryProject,
  loadActiveLibraryProject,
  saveActiveLibraryProject,
  type LibraryPPFProject,
} from "@/core/storage/project-library-browser";
import styles from "./story-map-workspace.module.css";
import { nextStoryStage, selectStoryMapLocation, storyStageHref } from "./story-map-navigation";

const SEQUENCE_NAMES = [
  "Awakening",
  "Discovery",
  "Alliance",
  "Conflict",
  "Struggle",
  "Pivot",
  "Apex",
  "Turn",
  "Reveal",
  "Fallout",
  "Mending",
  "Legacy",
] as const;

const ACT_NUMBERS = [1, 2, 3, 4] as const;

const STATE_LABELS: Readonly<Record<StoryWorkflowState, string>> = {
  locked: "Locked",
  available: "Available",
  incomplete: "Incomplete",
  ready: "Ready",
  accepted: "Accepted",
};

const STAGE_LABELS: Readonly<Record<StoryWorkflowStage, string>> = {
  plan: "PLAN",
  build: "BUILD",
  storyboard: "STORYBOARD",
};

function sequenceName(block: StoryBlockV2) {
  return SEQUENCE_NAMES[block.sequenceNumber - 1] ?? `Sequence ${String(block.sequenceNumber).padStart(2, "0")}`;
}

function miniDescription(state: StoryWorkflowState, stage: StoryWorkflowStage) {
  if (state === "locked") return "This anchor opens when the previous Block is accepted.";
  if (state === "accepted") return `${STAGE_LABELS[stage]} is accepted. Open it to review your saved work.`;
  if (state === "available") return `Start ${STAGE_LABELS[stage]} for this story movement.`;
  if (state === "ready") return `${STAGE_LABELS[stage]} is ready for explicit review and acceptance.`;
  return `${STAGE_LABELS[stage]} is in progress. Your saved work remains attached to this anchor.`;
}

function actionLabel(state: StoryWorkflowState, stage: StoryWorkflowStage) {
  if (state === "locked") return "Locked";
  if (state === "accepted") return `Review ${STAGE_LABELS[stage]}`;
  if (state === "ready") return `Review ${STAGE_LABELS[stage]}`;
  return `${state === "available" ? "Start" : "Continue"} ${STAGE_LABELS[stage]}`;
}

export default function StoryMapWorkspace() {
  const router = useRouter();
  const [project, setProject] = useState<LibraryPPFProject | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const refresh = () => {
      try {
        setProject(hasActiveLibraryProject() ? loadActiveLibraryProject() : null);
        setError("");
      } catch {
        setError("Your story could not be opened. Return to Library to reopen it.");
      } finally {
        setLoaded(true);
      }
    };
    refresh();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    return () => {
      mounted.current = false;
      window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    };
  }, []);

  if (!loaded) {
    return <main className={styles.workspace}><p className={styles.loading}>Opening your Story Map…</p></main>;
  }

  if (!project) {
    return (
      <main className={styles.workspace} data-story-map-state="empty">
        <section className={styles.emptyState}>
          <p className={styles.eyebrow}>4 Acts · 24 Blocks · 96 Mini-Blocks</p>
          <h1>Choose a story to begin.</h1>
          <p>Open an existing story or create a new one to begin with Block 01.</p>
          {error ? <p role="alert">{error}</p> : null}
          <button type="button" onClick={() => router.push("/library")}>Open Library</button>
        </section>
      </main>
    );
  }

  const structure = project.structure;
  const activeBlock = structure.blocks[structure.activeBlockNumber - 1] ?? structure.blocks[0];
  const activeBlockState = storyBlockState(activeBlock);

  async function selectLocation(block: StoryBlockV2, mini?: StoryMiniBlockV2) {
    if (!project || saving) return;
    setSaving(true);
    setError("");
    try {
      const current = loadActiveLibraryProject();
      if (current.id !== project.id) throw new Error("The active story changed. Reopen your story from Library.");
      const location = selectStoryMapLocation(current.structure, block.number, mini?.number);
      if (!location) return;
      const saved = saveActiveLibraryProject({ ...current, structure: location });
      setProject(saved);
      await persistActiveProfileProject();
      if (mini && mounted.current && loadActiveLibraryProject().id === saved.id) router.push(storyStageHref(saved.structure));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your location could not be saved. Try the action again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.workspace} data-story-map-state="project" data-canonical-project-id={project.id}>
      {error ? <p className={styles.error} role="alert">{error} Your work remains open. Retry your last action.</p> : null}
      <section className={styles.blockWorkspace} data-state={activeBlockState} aria-labelledby="active-block-title" aria-busy={saving}>
        <header className={styles.blockHeader}>
          <div>
            <p className={styles.eyebrow}>{project.title || "Untitled Story"}</p>
            <h1 id="active-block-title">Block {String(activeBlock.number).padStart(2, "0")} · {sequenceName(activeBlock)}</h1>
            <p>Act {activeBlock.actNumber} · Sequence {String(activeBlock.sequenceNumber).padStart(2, "0")} · Four mini-block anchors</p>
          </div>
          <span className={styles.blockState} data-state={activeBlockState}><span className={styles.stateLight} aria-hidden="true" />{STATE_LABELS[activeBlockState]}</span>
        </header>

        <div className={styles.miniBlockGrid}>
          {activeBlock.miniBlocks.map((mini) => {
            const state = storyMiniBlockState(mini);
            const stage = selectStoryMapLocation(structure, activeBlock.number, mini.number)?.activeStage ?? nextStoryStage(mini);
            const stageState = mini.stages[stage].state;
            const active = mini.number === structure.activeMiniBlockNumber;
            return (
              <article className={styles.miniBlock} data-active={active ? "true" : undefined} data-state={state} key={mini.id}>
                <header>
                  <div><span>MINI-BLOCK ANCHOR</span><strong>{activeBlock.number}.{mini.ordinal}</strong></div>
                  <span className={styles.miniState}>{STATE_LABELS[state]}</span>
                </header>
                <div className={styles.miniPreview}><span>{mini.stages.storyboard.content.trim() || "No storyboard yet"}</span></div>
                <p>{miniDescription(stageState, stage)}</p>
                <ol className={styles.stageTrack} aria-label={`Mini-block ${activeBlock.number}.${mini.ordinal} visual progression`}>
                  {(["plan", "build", "storyboard"] as const).map((stageName) => (
                    <li data-state={mini.stages[stageName].state} key={stageName}>
                      <span>{STAGE_LABELS[stageName]}</span><small>{STATE_LABELS[mini.stages[stageName].state]}</small>
                    </li>
                  ))}
                </ol>
                <button data-primary={active ? "true" : undefined} disabled={saving || state === "locked"} onClick={() => void selectLocation(activeBlock, mini)} type="button" aria-label={`${actionLabel(stageState, stage)} for mini-block ${activeBlock.number}.${mini.ordinal}`}>{actionLabel(stageState, stage)}</button>
              </article>
            );
          })}
        </div>
      </section>

      <details className={styles.orientation}>
        <summary>How the story fits together · 4 Acts / 24 Blocks / 96 Mini-Blocks</summary>
        <dl className={styles.orientationStats} aria-label="PlotPickle story structure">
          <div><dt>Acts</dt><dd>4</dd></div>
          <div><dt>Blocks</dt><dd>24</dd></div>
          <div><dt>Mini-Blocks</dt><dd>96</dd></div>
          <div><dt>Visual loop</dt><dd>PLAN → BUILD → STORYBOARD</dd></div>
        </dl>
        <p>Each Block contains four mini-blocks. Accept PLAN, then BUILD, then STORYBOARD for each anchor. All four anchors must be accepted to open the next Block.</p>
      </details>

      <details className={styles.mapDisclosure}>
        <summary>24/96 Story Map · Active Block {String(activeBlock.number).padStart(2, "0")}</summary>
        <p>Locked Blocks open after all four mini-blocks in the preceding Block are accepted through STORYBOARD.</p>
        <section className={styles.actMap} aria-label="24 Block Story Map">
        {ACT_NUMBERS.map((actNumber) => (
          <div className={styles.actGroup} key={actNumber}>
            <header><span>ACT {actNumber}</span><small>Blocks {String((actNumber - 1) * 6 + 1).padStart(2, "0")}–{String(actNumber * 6).padStart(2, "0")}</small></header>
            <div className={styles.blockRail}>
              {structure.blocks.filter((block) => block.actNumber === actNumber).map((block) => {
                const state = storyBlockState(block);
                const selected = block.number === activeBlock.number;
                return (
                  <button
                    aria-current={selected ? "location" : undefined}
                    aria-label={`Block ${String(block.number).padStart(2, "0")}, ${STATE_LABELS[state]}`}
                    data-state={state}
                    disabled={saving || state === "locked"}
                    key={block.id}
                    onClick={() => void selectLocation(block)}
                    type="button"
                  >
                    <span className={styles.stateLight} aria-hidden="true" />
                    <strong>{String(block.number).padStart(2, "0")}</strong>
                    <small>{STATE_LABELS[state]}</small>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        </section>
      </details>

      <footer className={styles.footer}>
        <span>Need guidance? LEARN is available beside Settings whenever you want it.</span>
      </footer>
    </main>
  );
}
