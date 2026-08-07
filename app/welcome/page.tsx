"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createAfterglowProject } from "@/data/afterglow";
import {
  FIVE_KEY_SELLING_POINTS,
  LEARNING_MODULE_COUNT,
  PLOTPICKLE_REPOSITORY_URL,
} from "@/lib/product-direction";
import { createBlankProject, normalizePlotPickleProject, type PlotPickleProject } from "@/lib/project";
import styles from "./welcome.module.css";

const STORAGE_KEY = "plotpickle.project.v1";
const RECENTS_KEY = "plotpickle.recent-projects.v1";

type RecentProject = { id: string; title: string; updatedAt: string; stage: string };

const pathway = ["Idea", "Story Logic", "Characters & World", "24 Blocks", "96 Mini-Blocks", "Screenplay", "Whole Film", "Storyboard", "Production Shots", "Animatic & Pitch"];

const collaborationServers = [
  { installation: "Local PlotPickle", label: "Writer workstation", roles: ["Writer", "Director"] },
  { installation: "Private web PlotPickle", label: "Production team", roles: ["Producer", "Reviewer"] },
  { installation: "Local PlotPickle", label: "Performance notes", roles: ["Actor", "Writer"] },
] as const;

function saveProject(project: PlotPickleProject) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  const current: RecentProject[] = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
  const next = [{ id: project.id, title: project.metadata.title || "Untitled screenplay", updatedAt: new Date().toISOString(), stage: project.metadata.status || "Working draft" }, ...current.filter((item) => item.id !== project.id)].slice(0, 8);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 .7a11.3 11.3 0 0 0-3.6 22c.6.1.8-.2.8-.5v-2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.4-1.3-5.4-5.8 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0C16.3 4.5 17.3 4.8 17.3 4.8c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.5-2.8 5.5-5.4 5.8.4.4.8 1.1.8 2.2v3c0 .3.2.6.8.5A11.3 11.3 0 0 0 12 .7Z" />
    </svg>
  );
}

export default function WelcomePage() {
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [hasCurrent, setHasCurrent] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHasCurrent(Boolean(localStorage.getItem(STORAGE_KEY)));
      try { setRecent(JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]")); } catch { setRecent([]); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const last = useMemo(() => recent[0], [recent]);

  function createBlank(guided: boolean) {
    const project = normalizePlotPickleProject(createBlankProject());
    project.metadata.title = "Untitled screenplay";
    project.metadata.status = guided ? "Exploring — Start Here" : "Working draft";
    saveProject(project);
    window.location.href = guided ? "/start-here" : "/?workspace=1";
  }

  function exploreAfterglow() {
    saveProject(createAfterglowProject());
    window.location.href = "/?workspace=1&tab=instructions&section=overview";
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.brand}>PlotPickle</div>
        <p className={styles.eyebrow}>Simple Start · optional guided entry</p>
        <h1>Shape the story, see the world and direct what comes next.</h1>
        <p className={styles.lede}>PlotPickle is an AI-native visual writing and creative direction studio that connects concepts, story logic, characters, screenplay material and visual exploration in one portable PPF project. Begin manually or with optional creative compute, compare possibilities, and keep every canonical decision under writer control.</p>
        <a className={styles.repositoryLink} href={PLOTPICKLE_REPOSITORY_URL} target="_blank" rel="noreferrer">
          <GitHubMark />
          <span>Official PlotPickle GitHub repository</span>
        </a>
      </header>

      <section className={styles.cards} aria-label="Choose how to begin">
        <button className={styles.primaryCard} onClick={() => createBlank(true)}><strong>I have an idea</strong><span>Begin with only a title, rough premise, audience feeling and provisional protagonist.</span></button>
        <button className={styles.card} onClick={() => createBlank(false)}><strong>Create a new screenplay</strong><span>Create a blank project and enter the direct workspace.</span></button>
        <Link className={`${styles.card} ${!hasCurrent ? styles.disabled : ""}`} href={hasCurrent ? "/?workspace=1" : "/welcome"}><strong>Continue my screenplay</strong><span>{last ? `${last.title} · ${last.stage}` : hasCurrent ? "Open the current local project." : "No local project has been saved yet."}</span></Link>
        <Link className={styles.card} href="/?workspace=1&tab=script&import=1"><strong>Import an existing screenplay</strong><span>Review Final Draft, Fountain or plain-text interpretations before anything becomes canon.</span></Link>
        <button className={styles.card} onClick={exploreAfterglow}><strong>Explore Afterglow</strong><span>Open Afterglow: Reflections of Sentience as a complete example and learning project.</span></button>
        <Link className={styles.card} href="/?workspace=1&tab=learn"><strong>Learn how screenplays work</strong><span>Open the Complete Learning Library without creating a project first.</span></Link>
      </section>

      <section className={styles.learningHighlight}>
        <div>
          <p className={styles.sectionEyebrow}>Built-in screenwriting education</p>
          <h2>{LEARNING_MODULE_COUNT} learning modules live inside the writing workflow.</h2>
          <p>The Complete Learning Library, focused craft collections, worked examples and in-context guidance connect directly to the active project. Writers can learn a concept and immediately apply it to a character, Block, scene, screenplay passage or visual decision.</p>
        </div>
        <Link href="/?workspace=1&tab=learn">Open the Complete Learning Library</Link>
      </section>

      <section className={styles.pathSection}>
        <h2>From first idea to a visible storyworld</h2>
        <div className={styles.path}>{pathway.map((step, index) => <span key={step}>{step}{index < pathway.length - 1 ? <b aria-hidden="true">→</b> : null}</span>)}</div>
      </section>

      <section className={styles.sellingSection} aria-labelledby="five-advantages-title">
        <header>
          <p className={styles.sectionEyebrow}>Why PlotPickle</p>
          <h2 id="five-advantages-title">Five connected advantages, one canonical project.</h2>
        </header>
        <div className={styles.sellingPoints}>
          {FIVE_KEY_SELLING_POINTS.map((point, index) => (
            <article key={point.id} className={point.id === "learning-system" ? styles.featuredPoint : undefined}>
              <span className={styles.pointNumber}>{String(index + 1).padStart(2, "0")}</span>
              <strong>{point.title}</strong>
              <p>{point.summary}</p>
              {point.id === "learning-system" ? <small>{LEARNING_MODULE_COUNT} complete modules</small> : null}
            </article>
          ))}
        </div>
      </section>

      <section className={styles.collaboration} aria-labelledby="collaboration-title">
        <header>
          <p className={styles.sectionEyebrow}>Distributed PlotPickle collaboration</p>
          <h2 id="collaboration-title">Every collaborator uses the same complete PlotPickle product.</h2>
          <p>A PlotPickle installation may run locally on one person&apos;s computer or on a private web server. Writer, Director, Producer, Actor and Reviewer are roles inside PlotPickle—not separate server editions—and one person may hold several roles.</p>
        </header>

        <div className={styles.collaborationDiagram} aria-label="Complete PlotPickle installations collaborating through an owner-controlled GitHub film repository">
          <div className={styles.serverList}>
            {collaborationServers.map((server) => (
              <article className={styles.serverCard} key={`${server.installation}-${server.label}`}>
                <span>Complete product</span>
                <strong>{server.installation}</strong>
                <p>{server.label}</p>
                <div>{server.roles.map((role) => <span key={role}>{role}</span>)}</div>
              </article>
            ))}
          </div>

          <div className={styles.repositoryHub}>
            <GitHubMark />
            <span>Owner-controlled source of truth</span>
            <strong>GitHub film repository</strong>
            <code>main / stories/film-title.ppf</code>
            <p>Proposal branches and pull requests carry controlled script edits, character notes, production plans and visual updates.</p>
          </div>
        </div>

        <div className={styles.flowLegend}>
          <span>Pull / Sync</span><b>→</b><span>Edit locally</span><b>→</b><span>Proposal branch</span><b>→</b><span>Pull request</span><b>→</b><span>Review / Merge</span>
        </div>
        <p className={styles.ownerDecision}>Local work remains local until explicitly proposed or synchronized. The repository owner or maintainer decides what becomes canonical, and every connected PlotPickle installation can then pull the approved version.</p>
      </section>

      <footer className={styles.footer}>
        <p>Simple Start remains available here whenever you need a guided entry; regular launches open the main workspace directly.</p>
        <div><Link href="/about">About PlotPickle</Link><Link href="/?workspace=1">Open main workspace</Link></div>
      </footer>
    </main>
  );
}
