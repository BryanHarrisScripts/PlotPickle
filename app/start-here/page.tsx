"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { normalizePlotPickleProject, type PlotPickleProject } from "@/lib/project";
import { beginnerStages, type BeginnerProgressState } from "../beginner-experience";
import styles from "./start-here.module.css";

const STORAGE_KEY = "plotpickle.project.v1";
const RECORD_KEY = "plotpickle.beginner.path.v1";

type PathRecord = { stageStates: Record<string, BeginnerProgressState>; skipped: string[]; updatedAt: string };

const blankRecord: PathRecord = { stageStates: {}, skipped: [], updatedAt: "" };

function workspaceHref(href: string) {
  if (!href.startsWith("/?")) return href;
  return href.includes("workspace=1") ? href : href.replace("/?", "/?workspace=1&");
}

export default function StartHerePage() {
  const [project, setProject] = useState<PlotPickleProject | null>(null);
  const [record, setRecord] = useState<PathRecord>(blankRecord);
  const [active, setActive] = useState(beginnerStages[0].id);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setProject(normalizePlotPickleProject(JSON.parse(raw)));
    try { setRecord(JSON.parse(localStorage.getItem(RECORD_KEY) || JSON.stringify(blankRecord))); } catch { setRecord(blankRecord); }
  }, []);

  const current = useMemo(() => beginnerStages.find((stage) => stage.id === active) ?? beginnerStages[0], [active]);

  function saveProject(next: PlotPickleProject) {
    next.metadata.updatedAt = new Date().toISOString();
    setProject(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function updateField(field: "title" | "format" | "premise" | "audience" | "protagonist", value: string) {
    if (!project) return;
    const next = structuredClone(project);
    if (field === "title") next.metadata.title = value;
    if (field === "format") next.metadata.format = value;
    if (field === "premise") next.story.premise = value;
    if (field === "audience") next.development.pitch.audiencePromise = value;
    if (field === "protagonist") next.development.foundations.protagonist = value;
    saveProject(next);
  }

  function updateState(stageId: string, value: BeginnerProgressState) {
    const next = { ...record, stageStates: { ...record.stageStates, [stageId]: value }, updatedAt: new Date().toISOString() };
    setRecord(next);
    localStorage.setItem(RECORD_KEY, JSON.stringify(next));
  }

  if (!project) return <main className={styles.page}><h1>Start Here</h1><p>Create or load a project from the welcome page first.</p><Link href="/welcome">Open Welcome</Link></main>;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><Link href="/welcome">Welcome</Link> / <span>Start Here</span></div>
        <h1>Build your screenplay one useful decision at a time.</h1>
        <p>Nothing here is a pass/fail test. Skip, return and change decisions while the same canonical project keeps moving with you.</p>
      </header>

      <section className={styles.entry}>
        <h2>Only enough to begin</h2>
        <div className={styles.fields}>
          <label>Working title<input value={project.metadata.title} onChange={(e) => updateField("title", e.target.value)} /></label>
          <label>Format<select value={project.metadata.format} onChange={(e) => updateField("format", e.target.value)}><option>Feature screenplay</option><option>Short screenplay</option><option>Episode</option><option>Custom</option></select></label>
          <label className={styles.wide}>Rough idea or premise<textarea value={project.story.premise} onChange={(e) => updateField("premise", e.target.value)} /></label>
          <label>Audience or emotional experience<textarea value={project.development.pitch.audiencePromise} onChange={(e) => updateField("audience", e.target.value)} /></label>
          <label>Protagonist, even if provisional<textarea value={project.development.foundations.protagonist} onChange={(e) => updateField("protagonist", e.target.value)} /></label>
        </div>
      </section>

      <div className={styles.layout}>
        <nav className={styles.stages} aria-label="Beginner writing stages">
          {beginnerStages.map((stage) => (
            <button key={stage.id} className={stage.id === active ? styles.activeStage : styles.stage} onClick={() => setActive(stage.id)}>
              <span>{stage.number}</span><div><strong>{stage.title}</strong><small>{record.stageStates[stage.id] ?? "not-started"}</small></div>
            </button>
          ))}
        </nav>

        <section className={styles.detail}>
          <p className={styles.step}>Step {current.number} of {beginnerStages.length}</p>
          <h2>{current.title}</h2>
          <p>{current.plainLanguage}</p>
          <aside><strong>Why this matters</strong><p>{current.whyItMatters}</p></aside>
          <div className={styles.learningOrder}>
            <Link href={workspaceHref(current.learningHref)}>1. Complete Learning Library</Link>
            <div><strong>2. Guidance for this step</strong><span>Required now: {current.required.join(" · ")}</span><span>Optional: {current.optional.join(" · ")}</span></div>
          </div>
          <div className={styles.actions}>
            <Link className={styles.primary} href={workspaceHref(current.href)}>Open {current.workspace}</Link>
            <Link href="/worked-examples">Show an example</Link>
            <select aria-label="Progress state" value={record.stageStates[current.id] ?? "not-started"} onChange={(e) => updateState(current.id, e.target.value as BeginnerProgressState)}>
              <option value="not-started">Not started</option><option value="exploring">Exploring</option><option value="working-draft">Working draft</option><option value="reviewed">Reviewed</option><option value="approved-for-draft">Approved for this draft</option><option value="needs-continuity-check">Needs continuity check</option>
            </select>
          </div>
        </section>
      </div>

      <footer className={styles.footer}><Link href="/?workspace=1">Open full workspace</Link><Link href="/screenplay-readiness">Is my screenplay ready?</Link></footer>
    </main>
  );
}
