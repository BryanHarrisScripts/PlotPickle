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
const ARCHITECTURE_LABEL = "4 Acts · 24 Blocks · 96 mini-blocks";

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

function startNewProject() {
  const canonicalAction = document.querySelector<HTMLButtonElement>('[data-project-action="new-project"]');
  if (!canonicalAction) throw new Error("PlotPickle's canonical New Project action is unavailable.");
  canonicalAction.click();
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
  const developedBlocks = project.blocks.filter((block) => block.summary || block.goal || block.conflict || block.storyboardDirection).length;
  const completedSections = Object.values(progress).filter((value) => value >= 70).length;

  return (
    <main className={styles.page} aria-label="PlotPickle Studio Dashboard">
      <header className={styles.studioHeader}>
        <div>
          <p className={styles.kicker}>PlotPickle Studio / Dashboard</p>
          <h1>Story Library</h1>
          <p className={styles.lede}>Your stories. Your universe. Start something new or return to the exact creative place you left.</p>
        </div>
        <div className={styles.studioActions}>
          <button type="button" className={styles.primaryAction} onClick={startNewProject}>+ New Project</button>
          <button type="button" onClick={() => openWorkspace("planner")}>Import Project</button>
        </div>
      </header>

      <section className={styles.dashboardGrid}>
        <div className={styles.dashboardMain}>
          <section className={styles.library} aria-labelledby="story-library-title">
            <div className={styles.sectionTitle}>
              <div><p className={styles.kicker}>Your Stories</p><h2 id="story-library-title">Available stories</h2></div>
              <span>Local-first. Poster artwork becomes each story&apos;s visual identity.</span>
            </div>

            <div className={styles.posterGrid}>
              <article className={`${styles.storyCard} ${styles.newStoryCard}`}>
                <button type="button" className={`${styles.poster} ${styles.emptyPoster}`} onClick={startNewProject} aria-label="Create a new story">
                  <span>+</span>
                  <strong>New Story</strong>
                  <small>Start from scratch</small>
                </button>
              </article>

              {hasStarted ? (
                <article className={`${styles.storyCard} ${styles.currentStory}`}>
                  <div className={styles.poster}>
                    {poster ? <img src={poster} alt="" /> : <div className={styles.posterPlaceholder}><span>{project.metadata.title || "Untitled Story"}</span></div>}
                    <span className={styles.currentBadge}>Last opened</span>
                  </div>
                  <div className={styles.storyMeta}>
                    <p className={styles.kicker}>Local project</p>
                    <h3>{project.metadata.title || "Untitled Story"}</h3>
                    <p>{project.story.premise || "Continue shaping the premise, world, characters and visual intention."}</p>
                    <div className={styles.cardFooter}><span>{overall}% complete</span><button type="button" onClick={() => onOpenSection(nextSection)}>Continue</button></div>
                  </div>
                </article>
              ) : null}

              <article className={styles.storyCard}>
                <div className={`${styles.poster} ${styles.afterglowPoster}`}>
                  <div className={styles.afterglowArt}><span>AFTERGLOW</span><small>PlotPickle Example</small></div>
                  <span className={styles.exampleBadge}>Read-only example</span>
                </div>
                <div className={styles.storyMeta}>
                  <p className={styles.kicker}>Example story</p>
                  <h3>Afterglow</h3>
                  <p>Explore a complete story structure and visual workflow. It is never loaded automatically.</p>
                  <div className={styles.cardFooter}><span>Optional</span><button type="button" onClick={loadAfterglow}>Load Afterglow</button></div>
                </div>
              </article>
            </div>
          </section>

          <section className={styles.overviewPanel} aria-label="Story overview">
            <div className={styles.sectionTitle}>
              <div><p className={styles.kicker}>Story Overview</p><h2>{project.metadata.title || "Untitled Story"}</h2></div>
              <button type="button" className={styles.textAction} onClick={() => onOpenSection("overview")}>Open Project →</button>
            </div>
            <div className={styles.metricGrid}>
              <div><span>Progress</span><strong>{overall}%</strong><small>{completedSections} sections substantially complete</small></div>
              <div><span>Acts</span><strong>4 / 4</strong><small>Fixed story architecture</small></div>
              <div><span>Blocks</span><strong>{developedBlocks} / 24</strong><small>Developed story moments</small></div>
              <div><span>Mini-Blocks</span><strong>{miniBlocks.length || 96} / 96</strong><small>Visual-writing positions</small></div>
            </div>
            <div className={styles.actRail}>
              {[1, 2, 3, 4].map((act) => (
                <div key={act} className={act === currentAct ? styles.activeAct : ""}>
                  <span>ACT {act}</span>
                  <strong>{act === 1 ? "SETUP" : act === 2 ? "CONFRONTATION" : act === 3 ? "CRISIS" : "RESOLUTION"}</strong>
                  <div className={styles.blockDots}>{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className={styles.contextRail} aria-label="Current story context and quick actions">
          <section>
            <p className={styles.kicker}>Current Context</p>
            <dl>
              <div><dt>Act</dt><dd>{currentAct}</dd></div>
              <div><dt>Block</dt><dd>{currentBlock?.number || 1} · {currentBlock?.title || "Opening"}</dd></div>
              <div><dt>Scenes</dt><dd>{scenes.length}</dd></div>
              <div><dt>Characters</dt><dd>{project.characters.length}</dd></div>
              <div><dt>Locations</dt><dd>{project.world.locations.length}</dd></div>
            </dl>
            <button type="button" onClick={() => onOpenBlock(currentBlock?.number || 1)}>Open Current Block</button>
          </section>

          <section>
            <p className={styles.kicker}>Quick Actions</p>
            <button type="button" onClick={() => onOpenSection("storySetup")}>Story Setup</button>
            <button type="button" onClick={() => onOpenSection("world")}>New Location / World</button>
            <button type="button" onClick={() => onOpenSection("characters")}>New Character</button>
            <button type="button" onClick={() => onOpenSection("blocks")}>24 Blocks</button>
            <button type="button" onClick={onOpenEngines}>Creative Tools</button>
          </section>

          <section>
            <p className={styles.kicker}>Next Step</p>
            <strong className={styles.nextStep}>{sectionLabels[nextSection]}</strong>
            <p>Suggestions guide the workflow but never change canon automatically.</p>
            <button type="button" className={styles.primaryAction} onClick={() => onOpenSection(nextSection)}>Continue</button>
          </section>
        </aside>
      </section>

      <section className={styles.workflowStrip} aria-label="PlotPickle workflow">
        {[
          "Dashboard", "Learn", "Plan", "Storyboard", "Write", "Edit", "Graphic Novel", "Build", "Feedback", "Refine", "Reports",
        ].map((label, index) => <div key={label} className={index === 0 ? styles.workflowActive : ""}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong></div>)}
      </section>

      <footer className={styles.dashboardFooter}>
        <span>{ARCHITECTURE_LABEL} · One Story.</span>
        <div><button type="button" onClick={() => openWorkspace("settings")}>Settings</button><button type="button" onClick={() => onOpenSection("structureMap")}>Story Map</button></div>
      </footer>
    </main>
  );
}
