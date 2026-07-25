"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createAfterglowProject } from "@/data/afterglow";
import { createBlankProject, normalizePlotPickleProject, type PlotPickleProject } from "@/lib/project";
import styles from "./welcome.module.css";

const STORAGE_KEY = "plotpickle.project.v1";
const RECENTS_KEY = "plotpickle.recent-projects.v1";

type RecentProject = { id: string; title: string; updatedAt: string; stage: string };

const pathway = ["Idea", "Story Setup", "Characters & World", "24 Blocks", "96 Mini-Blocks", "Treatment", "Screenplay", "Revision", "Visuals", "Production & Export"];

function saveProject(project: PlotPickleProject) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  const current: RecentProject[] = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
  const next = [{ id: project.id, title: project.metadata.title || "Untitled screenplay", updatedAt: new Date().toISOString(), stage: project.metadata.status || "Working draft" }, ...current.filter((item) => item.id !== project.id)].slice(0, 8);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

export default function WelcomePage() {
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [openLast, setOpenLast] = useState(false);
  const [hasCurrent, setHasCurrent] = useState(false);

  useEffect(() => {
    setHasCurrent(Boolean(localStorage.getItem(STORAGE_KEY)));
    try { setRecent(JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]")); } catch { setRecent([]); }
    setOpenLast(document.cookie.split("; ").some((part) => part === "plotpickle-open-last=1"));
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

  function updateLaunchPreference(value: boolean) {
    setOpenLast(value);
    document.cookie = `plotpickle-open-last=${value ? "1" : "0"}; path=/; max-age=${value ? 31536000 : 0}; samesite=lax`;
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.brand}>PlotPickle</div>
        <p className={styles.eyebrow}>Local screenplay studio</p>
        <h1>Write your movie one clear piece at a time.</h1>
        <p className={styles.lede}>PlotPickle guides you from an initial idea through characters, world, 24 Blocks, treatment, screenplay, revision, visuals and production planning. Work locally, use AI only if you choose, and keep control of every creative decision.</p>
      </header>

      <section className={styles.cards} aria-label="Choose how to begin">
        <button className={styles.primaryCard} onClick={() => createBlank(true)}><strong>I have an idea</strong><span>Begin with only a title, rough premise, audience feeling and provisional protagonist.</span></button>
        <button className={styles.card} onClick={() => createBlank(false)}><strong>Create a new screenplay</strong><span>Create a blank project and enter the direct workspace.</span></button>
        <Link className={`${styles.card} ${!hasCurrent ? styles.disabled : ""}`} href={hasCurrent ? "/?workspace=1" : "/welcome"}><strong>Continue my screenplay</strong><span>{last ? `${last.title} · ${last.stage}` : hasCurrent ? "Open the current local project." : "No local project has been saved yet."}</span></Link>
        <Link className={styles.card} href="/?workspace=1&tab=script&import=1"><strong>Import an existing screenplay</strong><span>Review Final Draft, Fountain or plain-text interpretations before anything becomes canon.</span></Link>
        <button className={styles.card} onClick={exploreAfterglow}><strong>Explore Afterglow</strong><span>Open Afterglow: Reflections of Sentience as a complete example and learning project.</span></button>
        <Link className={styles.card} href="/?workspace=1&tab=learn"><strong>Learn how screenplays work</strong><span>Open the Complete Learning Library without creating a project first.</span></Link>
      </section>

      <section className={styles.pathSection}>
        <h2>From first idea to finished screenplay</h2>
        <div className={styles.path}>{pathway.map((step, index) => <span key={step}>{step}{index < pathway.length - 1 ? <b aria-hidden="true">→</b> : null}</span>)}</div>
      </section>

      <section className={styles.principles}>
        <article><strong>Local first</strong><p>No PlotPickle cloud account is required.</p></article>
        <article><strong>AI is optional</strong><p>Manual writing remains complete; suggestions require review and approval.</p></article>
        <article><strong>Your rights stay yours</strong><p>New projects default to your chosen ownership and licence.</p></article>
        <article><strong>Portable work</strong><p>Export, back up and carry the same canonical project forward.</p></article>
      </section>

      <footer className={styles.footer}>
        <label><input type="checkbox" checked={openLast} onChange={(event) => updateLaunchPreference(event.target.checked)} /> Open my last project directly on future launches</label>
        <div><Link href="/about">About PlotPickle</Link><Link href="/?workspace=1">Advanced workspace</Link></div>
      </footer>
    </main>
  );
}
