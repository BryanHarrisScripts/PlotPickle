"use client";

import Link from "next/link";
import RefineReturnNav from "../refine-return-nav";
import { useEffect, useState } from "react";
import CraftDiagnosticsWorkspace from "../craft-diagnostics";
import LocalBackupControls from "../local-backup-controls";
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

  function applyRestoredProject(restored: PlotPickleProject, source: string) {
    const normalized = normalizePlotPickleProject(restored);
    if (!normalized) {
      setStatus("The validated backup returned a project that could not be normalized. The active project was not changed.");
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    setProject(normalized);
    setStatus(`Restored the active PlotPickle project from ${source}. The backup was validated before this replacement.`);
  }

  return (
    <main className="standalone-studio-surface" style={{ minHeight: "100vh", padding: "24px" }}>
      <RefineReturnNav />
      <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gap: 18 }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <Link href="/?workspace=refine" style={{ color: "#163331", fontWeight: 800 }}>Back to Refine</Link>
          <div style={{ display: "flex", gap: 12 }}><Link href="/structure">Structure</Link><Link href="/draftlens">DraftLens</Link></div>
        </nav>
        <LocalBackupControls project={project} onRestore={applyRestoredProject} />
        <CraftDiagnosticsWorkspace project={project} />
        <p style={{ color: "#57706d" }} aria-live="polite">{status}</p>
      </div>
    </main>
  );
}
