import { completionFor, type PlotPickleProject } from "@/lib/project";
import { createAfterglowProject } from "@/data/afterglow";
import { AFTERGLOW_EXAMPLE_ACTIVE_KEY } from "@/lib/afterglow-example";
import {
  nextRecommendedSection,
  projectSectionProgress,
  type ProjectProgressSection,
} from "@/lib/project-progress";
import styles from "./dashboard-story-library.module.css";

const STORAGE_KEY = "plotpickle.project.v1";

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

function storyPoster(project: PlotPickleProject) {
  const panel = project.review.pitchPackage.comicDeck?.panels?.find((entry) => entry.imageSrc)?.imageSrc;
  if (panel) return panel;
  const character = project.characters.find((entry) => entry.image)?.image;
  return character || "";
}

function openWorkspace(workspace: string, section?: string) {
  if (section) window.sessionStorage.setItem("plotpickle.settings.section", section);
  window.location.assign(`/?workspace=${encodeURIComponent(workspace)}`);
}

function loadAfterglow() {
  window.localStorage.setItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY, "true");
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(createAfterglowProject()));
  window.location.assign("/?workspace=dashboard");
}

export default function DashboardStoryLibrary({
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
  const overall = completionFor(project);
  const progress = projectSectionProgress(project);
  const nextSection = nextRecommendedSection(project);
  const poster = storyPoster(project);
  const hasStarted = Boolean(project.metadata.title || project.story.premise || project.characters.length || project.world.locations.length);
  const scenes = project.blocks.flatMap((block) => block.scenes);
  const miniBlocks = scenes.flatMap((scene) => scene.miniBlocks);
  const currentBlock = project.blocks.find((block) => block.summary || block.goal || block.conflict) ?? project.blocks[0];
  const currentAct = Math.max(1, Math.min(4, Math.ceil((currentBlock?.number || 1) / 6)));

  return (
    <main className={styles.page} aria-label="PlotPickle Studio Dashboard">
      <header className={styles.studioHeader}>
        <div>
          <p className={styles.kicker}>PlotPickle Studio</p>
          <h1>Your stories.</h1>
          <p className={styles.lede}>Start here. Open a story, create something new, or explore the Afterglow example. The same story continues through Plan, Storyboard, Write, Edit, Graphic Novel, Build, Feedback and Refine.</p>
        </div>
        <div className={styles.studioActions}>
          <button type="button" className={styles.primaryAction} onClick={() => onOpenSection("storySetup")}>+ New Project</button>
          <button type="button" onClick={() => openWorkspace("planner")}>Import Project</button>
        </div>
      </header>

      <section className={styles.library} aria-labelledby="story-library-title">
        <div className={styles.sectionTitle}>
          <div><p className={styles.kicker}>Story Library</p><h2 id="story-library-title">Available stories</h2></div>
          <span>Poster artwork becomes each story’s visual identity.</span>
        </div>

        <div className={styles.posterGrid}>
          {hasStarted ? (
            <article className={`${styles.storyCard} ${styles.currentStory}`}>
              <div className={styles.poster}>
                {poster ? <img src={poster} alt="" /> : <div className={styles.posterPlaceholder}><span>{project.metadata.title || "Untitled Story"}</span></div>}
                <span className={styles.currentBadge}>Current story</span>
              </div>
              <div className={styles.storyMeta}>
                <p className={styles.kicker}>Local project</p>
                <h3>{project.metadata.title || "Untitled Story"}</h3>
                <p>{project.story.premise || "Continue shaping the premise, world, characters and visual intention."}</p>
                <div className={styles.cardFooter}><span>{overall}% developed</span><button type="button" onClick={() => onOpenSection(nextSection)}>Continue</button></div>
              </div>
            </article>
          ) : (
            <article className={`${styles.storyCard} ${styles.newStoryCard}`}>
              <div className={`${styles.poster} ${styles.emptyPoster}`}><span>+</span></div>
              <div className={styles.storyMeta}>
                <p className={styles.kicker}>Create</p>
                <h3>Start a new story</h3>
                <p>Begin with concept, title and visual intention. Your first approved image becomes the project poster.</p>
                <div className={styles.cardFooter}><span>Local-first</span><button type="button" onClick={() => onOpenSection("storySetup")}>Create story</button></div>
              </div>
            </article>
          )}

          <article className={styles.storyCard}>
            <div className={`${styles.poster} ${styles.afterglowPoster}`}>
              <div className={styles.afterglowArt}><span>AFTERGLOW</span><small>Reflections of Sentience</small></div>
              <span className={styles.exampleBadge}>Example story</span>
            </div>
            <div className={styles.storyMeta}>
              <p className={styles.kicker}>PlotPickle example</p>
              <h3>Afterglow</h3>
              <p>Explore a complete story structure and visual workflow. It is available here, but never loaded automatically.</p>
              <div className={styles.cardFooter}><span>Read-only source</span><button type="button" onClick={loadAfterglow}>Load Afterglow</button></div>
            </div>
          </article>
        </div>
      </section>

      {hasStarted ? (
        <section className={styles.storyStatus} aria-label="Current story position">
          <div className={styles.storyIdentity}>
            <p className={styles.kicker}>Continue your story</p>
            <h2>{project.metadata.title || "Untitled Story"}</h2>
            <p>{sectionLabels[nextSection]} is the next suggested step. Suggestions guide the workflow but never change canon automatically.</p>
            <div className={styles.storyActions}>
              <button type="button" className={styles.primaryAction} onClick={() => onOpenSection(nextSection)}>Continue to {sectionLabels[nextSection]}</button>
              <button type="button" onClick={() => onOpenSection("structureMap")}>Open Story Map</button>
            </div>
          </div>

          <div className={styles.architecture} aria-label="Four Act 24 Block 96 mini-block architecture">
            <div className={styles.architectureTop}><span>Story architecture</span><strong>4 Acts · 24 Blocks · 96 mini-blocks</strong></div>
            <div className={styles.actRail}>
              {[1, 2, 3, 4].map((act) => (
                <div key={act} className={act === currentAct ? styles.activeAct : ""}>
                  <span>ACT {act}</span>
                  <div className={styles.blockDots}>{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>
                </div>
              ))}
            </div>
            <div className={styles.positionLine}>
              <span>Current position</span>
              <strong>Act {currentAct} · Block {currentBlock?.number || 1}</strong>
              <small>{scenes.length} scenes · {miniBlocks.length || 96} mini-block positions</small>
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.workflowStrip} aria-label="PlotPickle workflow">
        {[
          "Dashboard", "Learn", "Plan", "Storyboard", "Write", "Edit", "Graphic Novel", "Build", "Feedback", "Refine", "Reports",
        ].map((label, index) => <div key={label} className={index === 0 ? styles.workflowActive : ""}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong></div>)}
      </section>

      <footer className={styles.dashboardFooter}>
        <span>PlotPickle Studio keeps story, canon, assets and versions connected.</span>
        <div><button type="button" onClick={() => openWorkspace("settings")}>Settings</button><button type="button" onClick={onOpenEngines}>Creative tools</button>{currentBlock ? <button type="button" onClick={() => onOpenBlock(currentBlock.number)}>Block {currentBlock.number}</button> : null}</div>
      </footer>
    </main>
  );
}
