import Link from "next/link";
import { completionFor, type PlotPickleProject } from "@/lib/project";
import {
  nextRecommendedSection,
  projectSectionProgress,
  recommendedSectionOrder,
  type ProjectProgressSection,
} from "@/lib/project-progress";
import { DORMANT_BUZZ_RUNTIME } from "@/lib/buzz-runtime";
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

function openWorkspace(workspace: string, section?: string) {
  if (section) window.sessionStorage.setItem("plotpickle.settings.section", section);
  window.location.assign(`/?workspace=${encodeURIComponent(workspace)}`);
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
  const openQuestions = project.development.notes.openQuestions
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstDevelopingBlock = project.blocks.find(
    (block) => progress.blocks < 100 && (!block.summary || !block.conflict || (!block.choice && !block.action)),
  );
  const repositoryConnected = Boolean(project.collaboration.sourceRepositoryUrl);
  const isAfterglowReference = project.id === "afterglow-echoes-of-sentience";
  const buzz = DORMANT_BUZZ_RUNTIME;
  const readySections = recommendedSectionOrder.filter((section) => progress[section] >= 70).length;
  const characterCount = project.characters.length;
  const locationCount = project.world.locations.length;

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="dashboard-project-title">
        <div>
          <p className={styles.eyebrow}>Dashboard · Current project</p>
          <h1 id="dashboard-project-title">{project.metadata.title || "Untitled PlotPickle Project"}</h1>
          <p>See the loaded storyworld, current progress, repository authority, local storage and optional collaboration connections without decorative or fabricated live data.</p>
          <div className={styles.actions}>
            <button type="button" className="primary-button" onClick={() => onOpenSection(nextSection)}>Continue with {sectionLabels[nextSection]}</button>
            <button type="button" className="secondary-button" onClick={() => onOpenSection("structureMap")}>Explore Storyworld</button>
          </div>
        </div>
        <div className={styles.completionCard}>
          <span>Overall planning coverage</span>
          <strong>{overall}%</strong>
          <div aria-label={`${overall}% project coverage`}><i style={{ width: `${overall}%` }} /></div>
          <small>Writing and development progress: {readySections}/{recommendedSectionOrder.length} planning areas carry substantial evidence. Coverage is a prompt, not a quality grade.</small>
        </div>
      </section>

      <section className={styles.identityGrid} aria-label="Current project source">
        <article><span>Loaded story</span><strong>{project.metadata.title || "Untitled local project"}</strong></article>
        <article><span>Local storage</span><strong>Canonical PPF on this device</strong></article>
        <article><span>GitHub repository</span><strong>{repositoryConnected ? "Connected" : "Not connected"}</strong></article>
        <article><span>Approved story</span><strong>{project.metadata.status || "In development"}</strong></article>
      </section>

      {isAfterglowReference ? (
        <>
          <AfterglowLegacyVisuals project={project} mode="overview" />
          <section className={styles.panel} aria-label="Afterglow Source Reconciliation">
            <header><div><p className={styles.eyebrow}>Afterglow Source Reconciliation</p><h2>Reference versions remain inspectable.</h2></div><Link href="/afterglow-reconciliation">Open Version Bridge</Link></header>
            <p>The complete v9 screenplay, partial v10 alternate and current Reflections decisions remain separated so legacy evidence never becomes newly approved canon by accident.</p>
          </section>
        </>
      ) : null}

      <div className={styles.dashboardGrid}>
        <section className={`${styles.panel} ${styles.storyworldPanel}`}>
          <header><div><p className={styles.eyebrow}>Storyworld Overview</p><h2>Structure snapshot</h2></div><button type="button" onClick={() => onOpenSection("structureMap")}>Open map</button></header>
          <div className={styles.storyworldMap} aria-label="Storyworld relationship summary">
            <strong>One canonical world, connected.</strong>
            <div><button type="button" onClick={() => onOpenSection("characters")}>{characterCount} Characters</button><button type="button" onClick={() => onOpenSection("world")}>{locationCount} Locations</button><button type="button" onClick={() => onOpenSection("blocks")}>24 Blocks</button></div>
            <div><span>{allScenes.length} Scenes</span><span>{allMinis.length} Mini-blocks</span><span>{beats} Beat targets</span></div>
          </div>
          <p>{developedSequences}/12 sequences and {developedBlocks}/24 blocks currently carry their core dramatic evidence.</p>
        </section>

        <section className={styles.panel}>
          <header><div><p className={styles.eyebrow}>Progress by section</p><h2>Writing Progress · {overall}% complete</h2></div><span>{readySections} areas ready</span></header>
          <div className={styles.progressList}>
            {recommendedSectionOrder.slice(0, 8).map((section) => (
              <button type="button" key={section} onClick={() => onOpenSection(section)}>
                <span>{sectionLabels[section]}</span><i><b style={{ width: `${progress[section]}%` }} /></i><strong>{progress[section]}%</strong>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <header><div><p className={styles.eyebrow}>Recent Activity</p><h2>Project evidence</h2></div><span>Real project state</span></header>
          <div className={styles.activityList}>
            <article><b>Project updated</b><span>{readableDate(project.metadata.updatedAt)}</span></article>
            <article><b>Structure developed</b><span>{developedBlocks}/24 Blocks · {developedSequences}/12 sequences</span></article>
            <article><b>Visual plan</b><span>{shots} shot targets across {allMinis.length} mini-blocks</span></article>
          </div>
        </section>

        <section className={`${styles.panel} ${repositoryConnected ? styles.healthyPanel : styles.attentionPanel}`}>
          <header><div><p className={styles.eyebrow}>GitHub Approvals</p><h2>{repositoryConnected ? "Repository connected" : "Local project only"}</h2></div><span>{repositoryConnected ? "Review in Collab" : "Setup required"}</span></header>
          <p>{repositoryConnected ? "Story Proposals and owner-controlled approvals use the connected repository. Only a human merge changes canonical code or story data." : "GitHub remains optional. Connect a repository in Settings before using Story Proposals and approval history."}</p>
          <div className={styles.rightsLinks}>
            <button type="button" onClick={() => openWorkspace(repositoryConnected ? "collab" : "settings", repositoryConnected ? undefined : "github")}>{repositoryConnected ? "Open Collab approvals" : "Configure GitHub"}</button>
            {project.collaboration.sourceRepositoryUrl ? <a href={project.collaboration.sourceRepositoryUrl} target="_blank" rel="noreferrer">Open this story’s GitHub repository</a> : null}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.attentionPanel}`}>
          <header><div><p className={styles.eyebrow}>Optional Buzz workspace</p><h2>{buzz.lifecycle === "running" ? "Connected" : "Not configured"}</h2></div><span>Dormant by default</span></header>
          <p>Buzz provides rooms, agents, media discussion and development activity beside Collab. No process, port, identity or Buzz project data exists until configuration is deliberately completed.</p>
          <button type="button" onClick={() => window.location.assign(buzz.lifecycle === "running" ? "/buzz" : "/settings/buzz")}>{buzz.lifecycle === "running" ? "Open Buzz" : "Configure Buzz"}</button>
        </section>

        <section className={styles.panel}>
          <header><div><p className={styles.eyebrow}>Storage & Backups</p><h2>Local-first authority</h2></div><span>On this device</span></header>
          <p>The canonical project stays separate from replaceable PlotPickle program files. Rolling backups and recovery are controlled under Settings.</p>
          <button type="button" onClick={() => openWorkspace("settings", "storage")}>Open Storage & Backups</button>
        </section>

        <section className={styles.panel}>
          <header><div><p className={styles.eyebrow}>Open questions</p><h2>Canon & decisions · {openQuestions.length ? `${openQuestions.length} open question${openQuestions.length === 1 ? "" : "s"}` : "No open questions"}</h2></div><button type="button" onClick={() => onOpenSection("notes")}>Open Notes</button></header>
          {openQuestions.length ? <ul className={styles.questions}>{openQuestions.slice(0, 4).map((question) => <li key={question}>{question}</li>)}</ul> : <div className={styles.emptyState}><strong>The decision ledger is clear.</strong><p>Add unresolved canon, continuity or production questions in Notes when they appear.</p></div>}
        </section>

        <section className={`${styles.panel} ${styles.rightsPanel}`}>
          <header><div><p className={styles.eyebrow}>Ownership and use</p><h2>Your story remains yours.</h2></div></header>
          <p>PlotPickle software and learning materials use open licences. Your screenplay, characters, images, notes and PPF project remain under your control.</p>
          <div className={styles.rightsLinks}><Link href="/about">Why PlotPickle</Link><Link href="/legal">Copyright and licensing</Link><button type="button" onClick={onOpenEngines}>Review optional engines</button>{firstDevelopingBlock ? <button type="button" onClick={() => onOpenBlock(firstDevelopingBlock.number)}>Continue Block {firstDevelopingBlock.number}</button> : null}</div>
        </section>
      </div>
    </div>
  );
}
