"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PreproductionWorkspace from "../preproduction-workspace";
import { createBlankProject, normalizePlotPickleProject, type PlotPickleProject } from "@/lib/project";
import { ensureProductionWorkspace } from "@/lib/preproduction";

const STORAGE_KEY = "plotpickle.project.v1";

export default function ProductionPage() {
  const [project, setProject] = useState<PlotPickleProject>(() => ensureProductionWorkspace(createBlankProject()));
  const [status, setStatus] = useState("Loading the active PlotPickle project…");

  useEffect(() => {
    const timer = window.setTimeout(() => {
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
    <main style={{ minHeight: "100vh", background: "#f4fbf9", padding: "24px" }}>
      <div style={{ maxWidth: 1700, margin: "0 auto", display: "grid", gap: 18 }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "#163331", fontWeight: 800 }}>Back to PlotPickle</Link>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><Link href="/structure">Structure</Link><Link href="/diagnostics">Diagnostics</Link><Link href="/labs">Specialist Labs</Link><Link href="/pitch-review">Pitch & Review</Link></div>
        </nav>
        <PreproductionWorkspace project={project} onProjectChange={save} />
        <p style={{ color: "#57706d" }} aria-live="polite">{status}</p>
      </div>
    </main>
  );
}
