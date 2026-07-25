"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { normalizePlotPickleProject, type PlotPickleProject } from "@/lib/project";
import { assessScreenplayReadiness, readinessDestinations } from "../beginner-experience";
import styles from "./screenplay-readiness.module.css";

const STORAGE_KEY = "plotpickle.project.v1";

function readinessHref(href: string) {
  if (href === "/core-model") return "/?workspace=1&tab=planner&section=coreModel";
  if (href.startsWith("/?") && !href.includes("workspace=1")) return href.replace("/?", "/?workspace=1&");
  return href;
}

export default function ScreenplayReadinessPage() {
  const [project, setProject] = useState<PlotPickleProject | null>(null);
  const [intentional, setIntentional] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setProject(normalizePlotPickleProject(JSON.parse(raw)));
      try { setIntentional(JSON.parse(localStorage.getItem("plotpickle.readiness.intentional.v1") || "[]")); } catch { setIntentional([]); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const items = useMemo(() => project ? assessScreenplayReadiness(project).map((item) => intentional.includes(item.id) ? { ...item, status: "intentional" as const, kind: "intentional-choice" as const } : item) : [], [project, intentional]);
  const destinations = useMemo(() => readinessDestinations(items), [items]);
  const categories = [...new Set(items.map((item) => item.category))];

  function toggleIntentional(id: string) {
    const next = intentional.includes(id) ? intentional.filter((item) => item !== id) : [...intentional, id];
    setIntentional(next);
    localStorage.setItem("plotpickle.readiness.intentional.v1", JSON.stringify(next));
  }

  function saveBackup() {
    if (!project) return;
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(project.metadata.title || "plotpickle-project").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.plotpickle.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!project) return <main className={styles.page}><h1>Is my screenplay ready?</h1><p>Load or create a project first.</p><Link href="/welcome">Open Welcome</Link></main>;

  return <main className={styles.page}>
    <header className={styles.header}><div><Link href="/start-here">Start Here</Link> / Finish and share</div><h1>Is my screenplay ready?</h1><p>Readiness is a stated next use, not a single quality score. Required technical problems, craft review, optional enhancement and intentional choices stay separate.</p></header>

    <section className={styles.destinations} aria-label="Readiness destinations">{destinations.map((destination) => <article key={destination.id} className={destination.ready ? styles.ready : styles.notReady}><strong>{destination.label}</strong><span>{destination.ready ? "Ready" : "Not yet"}</span><p>{destination.reason}</p></article>)}</section>

    <section className={styles.review}>{categories.map((category) => <div key={category} className={styles.category}><h2>{category}</h2>{items.filter((item) => item.category === category).map((item) => <article key={item.id} className={styles.item}>
      <div><span className={styles.badge}>{item.kind.replace(/-/g, " ")}</span><h3>{item.label}</h3><p>{item.evidence}</p></div>
      <div className={styles.itemActions}><Link href={readinessHref(item.href)}>Open exact item</Link><button onClick={() => toggleIntentional(item.id)}>{intentional.includes(item.id) ? "Restore review" : "Mark intentional"}</button></div>
    </article>)}</div>)}</section>

    <section className={styles.finalActions}><h2>Next actions</h2><div><Link href="/?workspace=1&tab=planner&section=coreModel">Create a revision snapshot</Link><Link href="/?workspace=1&tab=script&view=reader">Export a reader draft</Link><Link href="/?workspace=1&tab=script&view=writer">Export a submission draft</Link><Link href="/?workspace=1&tab=engines">Prepare a table-read package</Link><Link href="/pitch-review">Open Pitch & Review</Link><Link href="/?workspace=1&tab=planner&section=storyboard">Open Production</Link><button onClick={saveBackup}>Save a backup</button></div></section>
  </main>;
}
