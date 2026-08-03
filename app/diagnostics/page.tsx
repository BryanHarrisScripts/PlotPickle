"use client";

import Link from "next/link";
import RefineReturnNav from "../refine-return-nav";
import { useEffect, useState } from "react";
import CraftDiagnosticsWorkspace from "../craft-diagnostics";
import { createBlankProject, normalizePlotPickleProject, type PlotPickleProject } from "@/lib/project";

const STORAGE_KEY = "plotpickle.project.v1";

export default function DiagnosticCraftPage() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [status, setStatus] = useState("Loading the active PlotPickle project…");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setStatus("No saved project was found. The blank project is ready for diagnostic testing.");
          return;
        }
        const normalized = normalizePlotPickleProject(JSON.parse(stored));
        if (!normalized) {
          setStatus("The saved project could not be upgraded. The blank project is shown instead.");
          return;
        }
        setProject(normalized);
        setStatus("Connected to the active PlotPickle project.");
      } catch {
        setStatus("The saved project could not be opened. The blank project is shown instead.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#f7fbfa", padding: "24px" }}>
      <RefineReturnNav />
      <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gap: 18 }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <Link href="/?workspace=refine" style={{ color: "#163331", fontWeight: 800 }}>Back to Refine</Link>
          <div style={{ display: "flex", gap: 12 }}><Link href="/structure">Structure</Link><Link href="/draftlens">DraftLens</Link></div>
        </nav>
        <CraftDiagnosticsWorkspace project={project} />
        <p style={{ color: "#57706d" }} aria-live="polite">{status}</p>
      </div>
    </main>
  );
}
