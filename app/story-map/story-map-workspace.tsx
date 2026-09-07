"use client";

import { useEffect, useState } from "react";
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

function nextStage(mini: StoryMiniBlockV2): StoryWorkflowStage {
  if (mini.stages.plan.state !== "accepted") return "plan";
  if (mini.stages.build.state !== "accepted") return "build";
  return "storyboard";
}

function stageHref(stage: StoryWorkflowStage, block: StoryBlockV2, mini: StoryMiniBlockV2) {
  const query = `block=${block.number}&mini=${mini.ordinal}`;
  if (stage === "plan") return `/?workspace=plan&${query}`;
  if (stage === "build") return `/?workspace=build&${query}`;
  return `/storyboard?${query}`;
}

function miniDescription(mini: StoryMiniBlockV2, state: StoryWorkflowState, stage: StoryWorkflowStage) {
  if (state === "locked") return "This anchor opens when the previous Block is accepted.";
  if (state === "accepted") return "The visual loop is accepted through STORYBOARD.";
  if (state === "available") return "Ready for PLAN. Define this story movement before BUILD.";
  if (state === "ready") return `${STAGE_LABELS[stage]} is ready for explicit review and acceptance.`;
  return `${STAGE_LABELS[stage]} is in progress. Your saved work remains attached to this anchor.`;
}

function actionLabel(mini: StoryMiniBlockV2, state: StoryWorkflowState, stage: StoryWorkflowStage) {
  if (state === "locked") return "Locked";
  if (state === "accepted") return "Review STORYBOARD";
  if (state === "ready") return `Review ${STAGE_LABELS[stage]}`;
  return `${state === "available" ? "Start" : "Continue"} ${STAGE_LABELS[stage]}`;
}

export default function StoryMapWorkspace() {
  const [project, setProject] = useState<LibraryPPFProject | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setProject(hasActiveLibraryProject() ? loadActiveLibraryProject() : null);
      setLoaded(true);
    };
    refresh();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
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
          <p>The Story Map works from your profile-owned PlotPickle project. LEARN is available whenever you want guidance, but it is not required to start.</p>
          <button type="button" onClick={() => window.location.assign("/library")}>Open Library</button>
        </section>
      </main>
    );
  }

  const structure = project.structure;
  const activeBlock = structure.blocks[structure.activeBlockNumber - 1] ?? structure.blocks[0];
  const activeBlockState = storyBlockState(activeBlock);

  function selectBlock(block: StoryBlockV2) {
    if (storyBlockState(block) === "locked" || !project) return;
    const firstMini = block.miniBlocks[0];
    const stage = nextStage(firstMini);
    const saved = saveActiveLibraryProject({
      ...project,
      structure: {
        ...project.structure,
        activeBlockNumber: block.number,
        activeMiniBlockNumber: firstMini.number,
        activeStage: stage,
      },
    });
    setProject(saved);
  }

  function openMini(block: StoryBlockV2, mini: StoryMiniBlockV2) {
    if (!project) return;
    const state = storyMiniBlockState(mini);
    if (state === "locked") return;
    const stage = nextStage(mini);
    const saved = saveActiveLibraryProject({
      ...project,
      structure: {
        ...project.structure,
        activeBlockNumber: block.number,
        activeMiniBlockNumber: mini.number,
        activeStage: stage,
      },
    });
    setProject(saved);
    window.location.assign(stageHref(stage, block, mini));
  }

  return (
    <main className={styles.workspace} data-story-map-state="project" data-canonical-project-id={project.id}>
      <header className={styles.orientation}>
        <div>
          <p className={styles.eyebrow}>PlotPickle Experience V2</p>
          <h1>Story Map</h1>
          <p>Understand the shape, then work the story. LEARN is optional support; your project starts here.</p>
        </div>
        <dl className={styles.orientationStats} aria-label="PlotPickle story structure">
          <div><dt>Acts</dt><dd>4</dd></div>
          <div><dt>Blocks</dt><dd>24</dd></div>
          <div><dt>Mini-Blocks</dt><dd>96</dd></div>
          <div><dt>Visual loop</dt><dd>PLAN → BUILD → STORYBOARD</dd></div>
        </dl>
      </header>

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
                    disabled={state === "locked"}
                    key={block.id}
                    onClick={() => selectBlock(block)}
                    type="button"
                  >
                    <span className={styles.stateLight} aria-hidden="true" />
                    <strong>{String(block.number).padStart(2, "0")}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className={styles.blockWorkspace} data-state={activeBlockState} aria-labelledby="active-block-title">
        <header className={styles.blockHeader}>
          <div>
            <p className={styles.blockKicker}>BLOCK {String(activeBlock.number).padStart(2, "0")}</p>
            <h2 id="active-block-title">{sequenceName(activeBlock)}</h2>
            <p>Act {activeBlock.actNumber} · Sequence {String(activeBlock.sequenceNumber).padStart(2, "0")} · Choose one of four mini-block anchors and begin with PLAN.</p>
          </div>
          <span className={styles.blockState} data-state={activeBlockState}><span className={styles.stateLight} aria-hidden="true" />{STATE_LABELS[activeBlockState]}</span>
        </header>

        <div className={styles.miniBlockGrid}>
          {activeBlock.miniBlocks.map((mini) => {
            const state = storyMiniBlockState(mini);
            const stage = nextStage(mini);
            const active = mini.number === structure.activeMiniBlockNumber;
            return (
              <article className={styles.miniBlock} data-active={active ? "true" : undefined} data-state={state} key={mini.id}>
                <div className={styles.miniPreview} aria-hidden="true"><span>+</span></div>
                <header>
                  <div><span>MINI-BLOCK ANCHOR</span><strong>{activeBlock.number}.{mini.ordinal}</strong></div>
                  <span className={styles.stateLight} aria-hidden="true" />
                </header>
                <p>{miniDescription(mini, state, stage)}</p>
                <div className={styles.stageTrack} aria-label={`Mini-block ${activeBlock.number}.${mini.ordinal} visual progression`}>
                  {(["plan", "build", "storyboard"] as const).map((stageName) => (
                    <span data-state={mini.stages[stageName].state} key={stageName}>{STAGE_LABELS[stageName]}</span>
                  ))}
                </div>
                <button disabled={state === "locked"} onClick={() => openMini(activeBlock, mini)} type="button">{actionLabel(mini, state, stage)}</button>
              </article>
            );
          })}
        </div>
      </section>

      <footer className={styles.footer}>
        <strong>{project.title || "Untitled Story"}</strong>
        <span>LEARN remains available under Settings whenever you want deeper guidance. It does not unlock or block this Story Map.</span>
      </footer>
    </main>
  );
}
