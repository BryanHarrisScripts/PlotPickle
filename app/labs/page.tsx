"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SpecialistLabs, { type LabScope } from "../specialist-labs";
import { createBlankProject, normalizePlotPickleProject, type PlotPickleProject } from "@/lib/project";

const STORAGE_KEY = "plotpickle.project.v1";

export default function SpecialistLabsPage() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [status, setStatus] = useState("Loading the active PlotPickle project…");
  const [scope, setScope] = useState<LabScope>("refine");
  const [returnWorkspace, setReturnWorkspace] = useState("refine");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const parameters = new URLSearchParams(window.location.search);
      const requestedScope = parameters.get("scope");
      if (requestedScope === "plan" || requestedScope === "storyboard" || requestedScope === "feedback" || requestedScope === "refine") setScope(requestedScope);
      const requestedReturn = parameters.get("return");
      if (requestedReturn === "plan" || requestedReturn === "storyboard" || requestedReturn === "feedback" || requestedReturn === "refine") setReturnWorkspace(requestedReturn);
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setStatus("No saved project was found. The blank project is ready for lab testing.");
          return;
        }
        const normalized = normalizePlotPickleProject(JSON.parse(stored));
        if (!normalized) {
          setStatus("The saved project could not be upgraded. The blank project is shown instead.");
          return;
        }
        setProject(normalized);
        setStatus("Connected to the active canonical PlotPickle project.");
      } catch {
        setStatus("The saved project could not be opened. The blank project is shown instead.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function save(next: PlotPickleProject) {
    setProject(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setStatus("The approved specialist pass was saved to the active PlotPickle project.");
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f7fbfa", padding: "24px" }}>
      <div style={{ maxWidth: 1580, margin: "0 auto", display: "grid", gap: 18 }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <Link href={`/?workspace=${returnWorkspace}`} style={{ color: "#163331", fontWeight: 800 }}>Back to {returnWorkspace[0].toUpperCase() + returnWorkspace.slice(1)}</Link>
          <div style={{ display: "flex", gap: 12 }}><Link href="/structure">Structure</Link><Link href="/diagnostics">Diagnostics</Link><Link href="/draftlens">DraftLens</Link></div>
        </nav>
        <SpecialistLabs project={project} onProjectChange={save} scope={scope} />
        <p style={{ color: "#57706d" }} aria-live="polite">{status}</p>
      </div>
    </main>
  );
}
