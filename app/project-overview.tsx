import type { PlotPickleProject } from "@/lib/project";
import {
  nextRecommendedSection,
  projectSectionProgress,
  type ProjectProgressSection,
} from "@/lib/project-progress";
import styles from "./project-overview.module.css";

const sectionLabels: Record<ProjectProgressSection, string> = {
  overview: "Project Overview",
  storySetup: "Story Setup",
  pitch: "Pitch & Vision",
  world: "World",
  characters: "Characters",
  ghost: "Ghost",
  catalyst: "Catalyst",
  foundations: "Foundations",
  pickle: "The Pickle",
  dialogue: "Dialogue",
  structureMap: "Structure Map",
  blocks: "24 Blocks",
  storyboard: "Storyboard",
  notes: "Notes",
};

const planGroups: {
  label: string;
  description: string;
  destination: ProjectProgressSection;
  sections: ProjectProgressSection[];
}[] = [
  {
    label: "Story",
    description: "Premise, setup, concept, pitch and visual intention.",
    destination: "storySetup",
    sections: ["storySetup", "pitch"],
  },
  {
    label: "World & Cast",
    description: "World rules, locations, characters, relationships and references.",
    destination: "characters",
    sections: ["world", "characters"],
  },
  {
    label: "Story Engine",
    description: "Ghost, catalyst, foundations, Pickle, dialogue, stakes and change.",
    destination: "foundations",
    sections: ["ghost", "catalyst", "foundations", "pickle", "dialogue"],
  },
  {
    label: "Structure",
    description: "Four Acts, twenty-four Blocks, ninety-six mini-blocks and scenes.",
    destination: "blocks",
    sections: ["structureMap", "blocks", "storyboard"],
  },
  {
    label: "Canon & Notes",
    description: "Continuity, provenance, revision context and working notes.",
    destination: "notes",
    sections: ["notes"],
  },
];

function averageProgress(
  sections: ProjectProgressSection[],
  progress: Record<ProjectProgressSection, number>,
) {
  if (!sections.length) return 0;
  return Math.round(sections.reduce((total, section) => total + progress[section], 0) / sections.length);
}

function blockHasWork(block: PlotPickleProject["blocks"][number]) {
  return Boolean(block.summary || block.goal || block.conflict || block.scenes.length);
}

function openStoryMoment(workspace: "storyboard" | "write", blockNumber: number, miniBlockNumber: number, sceneId = "") {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("workspace", workspace);
  url.searchParams.set("block", String(blockNumber));
  url.searchParams.set("mini", String(miniBlockNumber));
  if (sceneId) url.searchParams.set("scene", sceneId);
  if (workspace === "storyboard") url.searchParams.set("visualSection", "frames");
  window.location.assign(url);
}

export default function ProjectOverview({
  project,
  onOpenSection,
  onOpenEngines,
  onOpenBlock,
}: {
  project: PlotPickleProject;
  onOpenSection: (section: ProjectProgressSection) => void;
  onOpenEngines: () => void;
  onOpenBlock: (number: number) => void;
}) {
  const progress = projectSectionProgress(project);
  const nextSection = nextRecommendedSection(project);
  const developedBlocks = project.blocks.filter(blockHasWork);
  const currentBlock = developedBlocks[developedBlocks.length - 1] ?? project.blocks[0];
  const currentAct = Math.max(1, Math.min(4, currentBlock?.act || Math.ceil((currentBlock?.number || 1) / 6)));
  const currentScenes = currentBlock?.scenes ?? [];
  const currentMiniBlocks = currentScenes.flatMap((scene) => scene.miniBlocks);
  const allScenes = project.blocks.flatMap((block) => block.scenes);
  const allMiniBlocks = allScenes.flatMap((scene) => scene.miniBlocks);
  const visualIntention = project.development.conceptCanvas.desiredVisualImpact?.trim();
  const storyPromise = project.story.premise?.trim() || "Define the central story promise, pressure and transformation.";

  return (
    <main className={styles.page} aria-label="Plan story architecture">
      <header className={styles.planHeader}>
        <div>
          <p className={styles.kicker}>Plan · Story Architecture</p>
          <h1>{project.metadata.title || "Untitled Story"}</h1>
          <p className={styles.storyPromise}>{storyPromise}</p>
        </div>
        <div className={styles.headerContext}>
          <span>Current position</span>
          <strong>Act {currentAct} · Block {currentBlock?.number || 1}</strong>
          <small>{allScenes.length} scenes · {allMiniBlocks.length || 96} developed mini-block records</small>
        </div>
      </header>

      <section className={styles.intentionGrid} aria-label="Story direction">
        <article className={styles.directionCard}>
          <p className={styles.kicker}>The Story</p>
          <h2>What is this story really about?</h2>
          <p>{storyPromise}</p>
          <button type="button" onClick={() => onOpenSection("pitch")}>Shape premise & pitch</button>
        </article>
        <article className={styles.directionCard}>
          <p className={styles.kicker}>Visual Intention</p>
          <h2>What should the audience see and feel?</h2>
          <p>{visualIntention || "Add the light, texture, scale, point of view or recurring image that should guide Storyboard and later visual work."}</p>
          <button type="button" onClick={() => onOpenSection("pitch")}>Set visual direction</button>
        </article>
        <article className={`${styles.directionCard} ${styles.nextCard}`}>
          <p className={styles.kicker}>Next Useful Task</p>
          <h2>{sectionLabels[nextSection]}</h2>
          <p>PlotPickle can suggest the next planning step, but it never changes canon or advances the story without you.</p>
          <button type="button" className={styles.primaryAction} onClick={() => onOpenSection(nextSection)}>Continue</button>
        </article>
      </section>

      <section className={styles.groupSection} aria-labelledby="plan-groups-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.kicker}>Creative Areas</p>
            <h2 id="plan-groups-title">Five places to shape one story.</h2>
          </div>
          <span>Existing Plan tools remain available; the hierarchy is simpler.</span>
        </div>
        <div className={styles.groupGrid}>
          {planGroups.map((group, index) => {
            const value = averageProgress(group.sections, progress);
            return (
              <button type="button" className={styles.groupCard} key={group.label} onClick={() => onOpenSection(group.destination)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{group.label}</strong>
                <p>{group.description}</p>
                <div><i style={{ width: `${value}%` }} /><small>{value}%</small></div>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.architectureSection} aria-labelledby="architecture-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.kicker}>4 Acts · 24 Blocks · 96 Mini-blocks</p>
            <h2 id="architecture-title">The whole story stays visible.</h2>
          </div>
          <button type="button" className={styles.textAction} onClick={() => onOpenSection("structureMap")}>Open structure map</button>
        </div>

        <div className={styles.actGrid}>
          {[1, 2, 3, 4].map((act) => {
            const blocks = project.blocks.filter((block) => block.act === act || Math.ceil(block.number / 6) === act);
            return (
              <article className={act === currentAct ? `${styles.actCard} ${styles.activeAct}` : styles.actCard} key={act}>
                <div className={styles.actHeading}>
                  <span>ACT {act}</span>
                  <small>Blocks {(act - 1) * 6 + 1}–{act * 6}</small>
                </div>
                <div className={styles.blockGrid}>
                  {blocks.map((block) => {
                    const active = block.number === currentBlock?.number;
                    const started = blockHasWork(block);
                    return (
                      <button
                        type="button"
                        aria-current={active ? "step" : undefined}
                        className={active ? styles.activeBlock : started ? styles.startedBlock : ""}
                        key={block.id}
                        onClick={() => onOpenBlock(block.number)}
                        title={block.title || block.summary || `Block ${block.number}`}
                      >
                        <span>{String(block.number).padStart(2, "0")}</span>
                        <i />
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {currentBlock ? (
        <section className={styles.selectedUnit} aria-label={`Selected story unit Block ${currentBlock.number}`}>
          <div className={styles.selectedStory}>
            <p className={styles.kicker}>Selected Story Unit</p>
            <h2>Block {currentBlock.number}{currentBlock.title ? ` · ${currentBlock.title}` : ""}</h2>
            <p>{currentBlock.summary || currentBlock.goal || "Give this Block a clear goal, conflict, choice, action, consequence and emotional turn."}</p>
            <div className={styles.blockActions}>
              <button type="button" className={styles.primaryAction} onClick={() => onOpenBlock(currentBlock.number)}>Edit Block {currentBlock.number}</button>
              <button type="button" onClick={() => onOpenSection("storyboard")}>Plan visual moments</button>
              <button type="button" onClick={() => onOpenSection("notes")}>Open canon & notes</button>
            </div>
          </div>

          <div className={styles.miniPanel}>
            <div className={styles.miniHeading}>
              <span>Mini-blocks for Block {currentBlock.number}</span>
              <strong>4 story beats</strong>
            </div>
            <div className={styles.miniGrid}>
              {[1, 2, 3, 4].map((mini) => {
                const existing = currentMiniBlocks.find((entry) => entry.number === mini);
                const scene = currentScenes.find((entry) => entry.miniBlocks.some((candidate) => candidate.number === mini));
                return (
                  <div className={existing ? styles.miniStarted : ""} key={mini}>
                    <span>{String((currentBlock.number - 1) * 4 + mini).padStart(2, "0")}</span>
                    <strong>Mini {mini}</strong>
                    <small>{existing ? `${scene ? `Scene ${scene.number} · ` : ""}Story context attached` : "Ready to shape"}</small>
                    <div className={styles.blockActions}>
                      <button
                        type="button"
                        className={styles.primaryAction}
                        onClick={() => openStoryMoment("storyboard", currentBlock.number, mini, scene?.id)}
                      >
                        Storyboard
                      </button>
                      <button
                        type="button"
                        onClick={() => openStoryMoment("write", currentBlock.number, mini, scene?.id)}
                      >
                        Write
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p>Choose a beat and PlotPickle carries the same Block, mini-block and scene identity into Storyboard or Write.</p>
          </div>
        </section>
      ) : null}

      <footer className={styles.planFooter}>
        <span>Same PPF story · same canon · same asset lineage · saved locally</span>
        <div>
          <button type="button" onClick={() => onOpenSection("notes")}>Canon & notes</button>
          <button type="button" onClick={onOpenEngines}>Settings</button>
        </div>
      </footer>
    </main>
  );
}
