"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PreproductionWorkspace, { type ProductionScope } from "../preproduction-workspace";
import { createBlankProject, normalizePlotPickleProject, type PlotPickleProject } from "@/lib/projects/project";
import { ensureProductionWorkspace } from "@/lib/preproduction";
import styles from "./page.module.css";

const STORAGE_KEY = "plotpickle.project.v1";

export default function ProductionPage() {
  const [project, setProject] = useState<PlotPickleProject>(() => ensureProductionWorkspace(createBlankProject()));
  const [status, setStatus] = useState("Loading the active PlotPickle project…");
  const [scope, setScope] = useState<ProductionScope>("build");
  const [returnWorkspace, setReturnWorkspace] = useState("build");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const parameters = new URLSearchParams(window.location.search);
      if (parameters.get("scope") === "storyboard") setScope("storyboard");
      const requestedReturn = parameters.get("return");
      if (requestedReturn === "storyboard" || requestedReturn === "build") setReturnWorkspace(requestedReturn);
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setStatus("No saved project was found. The blank project is ready for pre-production planning.");
          return;
        }
        const normalized = normalizePlotPickleProject(JSON.parse(stored));
        if (!normalized) {
          setStatus("The saved project could not be upgraded. The blank project is shown instead.");
          return;
        }
        const prepared = ensureProductionWorkspace(normalized);
        setProject(prepared);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prepared));
        setStatus("Connected to the active canonical PlotPickle project and its production plan.");
      } catch {
        setStatus("The saved project could not be opened. The blank project is shown instead.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function save(next: PlotPickleProject) {
    setProject(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setStatus("The pre-production plan was saved to the active PlotPickle project.");
  }

  return (
    <main className={`${styles.page} standalone-studio-surface`}>
      <div className={styles.frame}>
        <h1 className={styles.heading}>Reports</h1>
        <nav className={styles.nav}>
          <Link className={styles.returnLink} href={`/?workspace=${returnWorkspace}`}>Back to {returnWorkspace === "storyboard" ? "Storyboard" : "Build"}</Link>
          <div className={styles.links}><Link href="/structure">Structure</Link><Link href="/diagnostics">Diagnostics</Link><Link href="/labs">Specialist Labs</Link><Link href="/pitch-review">Pitch & Review</Link></div>
        </nav>
        <PreproductionWorkspace project={project} onProjectChange={save} scope={scope} />
        <p className={styles.status} aria-live="polite">{status}</p>
      </div>
    </main>
  );
}