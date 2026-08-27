"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PPFProject } from "@/core/project/project";
import { loadFoundationProject } from "@/core/storage/foundation-project-browser";
import { deriveCanonicalScreenplayReadiness } from "./canonical-readiness";
import styles from "./screenplay-readiness.module.css";

function safeFileName(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plotpickle-project";
}

function isSupportedState(state: string) {
  return state === "current" || state === "defined" || state === "observed";
}

export default function ScreenplayReadinessPage() {
  const [project, setProject] = useState<PPFProject | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setProject(loadFoundationProject());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The active PlotPickle project could not be opened.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const readiness = useMemo(() => project ? deriveCanonicalScreenplayReadiness(project) : null, [project]);

  function saveBackup() {
    if (!project) return;
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFileName(project.title)}.ppf.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (error) return <main className={styles.page}><h1>Story readiness</h1><p role="alert">{error}</p><Link href="/start-here">Open Start Here</Link></main>;
  if (!project || !readiness) return <main className={styles.page}><h1>Story readiness</h1><p>Opening the active canonical PPF…</p></main>;

  return <main className={styles.page} data-canonical-project-id={project.id}>
    <header className={styles.header}>
      <div><Link href="/start-here">Start Here</Link> / Finish and share</div>
      <h1>Story readiness</h1>
      <p>Readiness is shown as canonical story coverage, source-text evidence and production timing—not one score. Visual and background-text surfaces read the same active PPF.</p>
      <p><strong>{readiness.projectTitle}</strong> · PPF revision {readiness.revision} · current frontier {readiness.frontier}</p>
    </header>

    <section className={styles.destinations} aria-label="Canonical readiness projections">
      {readiness.items.map((item) => <article key={item.id} className={isSupportedState(item.state) ? styles.ready : styles.notReady} data-readiness-state={item.state}>
        <strong>{item.label}</strong><span>{item.state.toUpperCase()}</span><p>{item.evidence}</p>
      </article>)}
    </section>

    <section className={styles.review}>
      <div className={styles.category}>
        <h2>Same story, different projections</h2>
        {readiness.items.map((item) => <article key={item.id} className={styles.item} data-canonical-readiness-item={item.id}>
          <div><span className={styles.badge}>{item.state}</span><h3>{item.label}</h3><p>{item.evidence}</p></div>
          <div className={styles.itemActions}><Link href={item.href}>{item.action}</Link></div>
        </article>)}
      </div>
    </section>

    <section className={styles.finalActions}>
      <h2>Next actions</h2>
      <p>These open projections of the same PPF. Story and screenplay completion are never inferred from visual progress alone.</p>
      <div><Link href="/?workspace=build">Open visual BUILD</Link><Link href="/storyboard">Open Storyboard</Link><Link href="/previs">Open Previs</Link><button onClick={saveBackup}>Save PPF backup</button></div>
    </section>
  </main>;
}
