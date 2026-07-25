import Link from "next/link";
import { completionFor, type PlotPickleProject } from "@/lib/project";
import {
  nextRecommendedSection,
  projectSectionProgress,
  recommendedSectionOrder,
  type ProjectProgressSection,
} from "@/lib/project-progress";
import AfterglowLegacyVisuals from "./afterglow-legacy-visuals";
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

function readableDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
  const overall = completionFor(project);
  const nextSection = nextRecommendedSection(project);
  const developedBlocks = project.blocks.filter(
    (block) => block.summary && block.conflict && (block.choice || block.action),
  ).length;
  const developedSequences = project.structure.sequences.filter(
    (sequence) => sequence.promise && sequence.turningPoint,
  ).length;
  const allScenes = project.blocks.flatMap((block) => block.scenes);
  const allMinis = allScenes.flatMap((scene) => scene.miniBlocks);
  const beats = allMinis.reduce((sum, mini) => sum + mini.beatTarget, 0);
  const shots = allMinis.reduce((sum, mini) => sum + mini.shotTarget, 0);
  const openQuestionPreview = project.development.notes.openQuestions
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
  const firstDevelopingBlock = project.blocks.find(
    (block) => progress.blocks < 100 && (!block.summary || !block.conflict || (!block.choice && !block.action)),
  );

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>OV · Project Overview</p>
          <h1>{project.metadata.title || "Untitled PlotPickle Project"}</h1>
          <p>
            Re-enter the story from one clear dashboard. Review what is complete, what still needs attention, and which PlotPickle workspace is most useful next.
          </p>
          <div className={styles.actions}>
            <button type="button" className="primary-button" onClick={() => onOpenSection(nextSection)}>
              Continue with {sectionLabels[nextSection]}
            </button>
            <button type="button" className="secondary-button" onClick={onOpenEngines}>
              Choose a specialist engine
            </button>
          </div>
        </div>
        <div className={styles.completionCard}>
          <span>Overall planning coverage</span>
          <strong>{overall}%</strong>
          <div aria-label={`${overall}% project coverage`}><i style={{ width: `${overall}%` }} /></div>
          <small>Coverage is a planning prompt, not a quality grade.</small>
        </div>
      </section>

      <section className={styles.panel} aria-label="Why PlotPickle">
        <header><div><p className={styles.eyebrow}>Why PlotPickle</p><h2>One story, one canonical project.</h2></div></header>
        <p>PlotPickle grew from Afterglow, the 24 Blocks learning archive and several OpenStory experiments. The current local application keeps foundations, structure, treatment, screenplay, visuals, review, production, rights and provenance connected while the writer works on one manageable unit at a time.</p>
        <div className={styles.rightsLinks}><Link href="/about">About, origins and product principles</Link><Link href="/read-learn?module=why-plotpickle-works-in-layers">Why PlotPickle Works in Layers</Link></div>
      </section>

      <section className={styles.identityGrid} aria-label="Project identity">
        <article><span>Format</span><strong>{project.metadata.format || "Not set"}</strong></article>
        <article><span>Target runtime</span><strong>{project.metadata.targetMinutes || 0} minutes</strong></article>
        <article><span>Status</span><strong>{project.metadata.status || "Not set"}</strong></article>
        <article><span>Last updated</span><strong>{readableDate(project.metadata.updatedAt)}</strong></article>
      </section>

      <AfterglowLegacyVisuals project={project} mode="overview" />

      {project.id === "afterglow-echoes-of-sentience" ? <section className={styles.panel} aria-label="Afterglow Source Reconciliation"><header><div><p className={styles.eyebrow}>Afterglow Source Reconciliation</p><h2>Complete baseline, partial rewrite, current decisions.</h2></div><Link href="/afterglow-reconciliation">Open Version Bridge</Link></header><p>The complete v9 screenplay remains readable, v10 is preserved as an unfinished Blocks 1–8 alternate, and the current Reflections rewrite advances only through reviewed decisions. CC BY-SA attribution, modification history and poster rights remain visible.</p><div className={styles.rightsLinks}><Link href="/afterglow-reconciliation">Review source claims and versions</Link><Link href="/legal">Review attribution and licensing</Link></div></section> : null}

      <div className={styles.dashboardGrid}>
        <section className={styles.panel}>
          <header>
            <div><p className={styles.eyebrow}>Story checklist</p><h2>Progress by section</h2></div>
            <span>{recommendedSectionOrder.filter((section) => progress[section] >= 70).length}/{recommendedSectionOrder.length} ready</span>
          </header>
          <div className={styles.progressList}>
            {recommendedSectionOrder.map((section) => (
              <button type="button" key={section} onClick={() => onOpenSection(section)}>
                <span>{sectionLabels[section]}</span>
                <i><b style={{ width: `${progress[section]}%` }} /></i>
                <strong>{progress[section]}%</strong>
              </button>
            ))}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.structurePanel}`}>
          <header>
            <div><p className={styles.eyebrow}>Complete hierarchy</p><h2>Structure snapshot</h2></div>
            <button type="button" onClick={() => onOpenSection("structureMap")}>Open map</button>
          </header>
          <div className={styles.metricGrid}>
            <article><strong>4</strong><span>Acts</span></article>
            <article><strong>12</strong><span>Sequences</span></article>
            <article><strong>24</strong><span>Blocks</span></article>
            <article><strong>{allScenes.length}</strong><span>Scenes</span></article>
            <article><strong>96</strong><span>Mini-blocks</span></article>
            <article><strong>{shots}</strong><span>Shot targets</span></article>
          </div>
          <p>{developedSequences}/12 sequences and {developedBlocks}/24 blocks currently carry their core dramatic evidence.</p>
          <div className={styles.structureActions}>
            <button type="button" onClick={() => onOpenSection("structureMap")}>Review the Structure Map</button>
            {firstDevelopingBlock ? <button type="button" onClick={() => onOpenBlock(firstDevelopingBlock.number)}>Continue Block {firstDevelopingBlock.number}</button> : null}
          </div>
          <small>{beats} planned beats · {shots} planned shots · schema {project.schemaVersion}</small>
        </section>

        <section className={styles.panel}>
          <header>
            <div><p className={styles.eyebrow}>Attention ledger</p><h2>Open questions</h2></div>
            <button type="button" onClick={() => onOpenSection("notes")}>Open Notes</button>
          </header>
          {openQuestionPreview.length ? (
            <ul className={styles.questions}>
              {openQuestionPreview.map((question) => <li key={question}>{question}</li>)}
            </ul>
          ) : (
            <div className={styles.emptyState}>
              <strong>No open questions are recorded.</strong>
              <p>Use Notes to keep uncertainty visible instead of hiding it inside draft prose.</p>
            </div>
          )}
        </section>

        <section className={`${styles.panel} ${styles.rightsPanel}`}>
          <header>
            <div><p className={styles.eyebrow}>Ownership and use</p><h2>Your story remains yours.</h2></div>
          </header>
          <p>
            PlotPickle’s software and educational materials have open licences, but the stories, characters, dialogue, images, and project files created by a user are not transferred to PlotPickle.
          </p>
          <div className={styles.rightsLinks}>
            <Link href="/legal">Read copyright and licensing</Link>
            {project.collaboration.sourceRepositoryUrl ? <a href={project.collaboration.sourceRepositoryUrl} target="_blank" rel="noreferrer">Open this story’s GitHub repository</a> : <a href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">View PlotPickle source repository</a>}
          </div>
        </section>
      </div>
    </div>
  );
}
