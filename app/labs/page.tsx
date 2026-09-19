"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SpecialistLabs, { type LabScope } from "../specialist-labs";
import { createBlankProject, normalizePlotPickleProject, type PlotPickleProject } from "@/lib/projects/project";

const STORAGE_KEY = "plotpickle.project.v1";

type RoutedLabScope = Exclude<LabScope, "all">;

const LAB_RETURN_TARGETS: Record<RoutedLabScope, { href: string; label: string }> = {
  plan: { href: "/?workspace=plan", label: "Plan" },
  storyboard: { href: "/storyboard", label: "Storyboard" },
  feedback: { href: "/feedback", label: "Feedback" },
  refine: { href: "/diagnostics", label: "Refine" },
};

function isRoutedLabScope(value: string | null): value is RoutedLabScope {
  return value === "plan" || value === "storyboard" || value === "feedback" || value === "refine";
}

export default function SpecialistLabsPage() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [status, setStatus] = useState("Loading the active PlotPickle project…");
  const [scope, setScope] = useState<LabScope>("refine");
  const [returnWorkspace, setReturnWorkspace] = useState<RoutedLabScope>("refine");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const parameters = new URLSearchParams(window.location.search);
      const requestedScope = parameters.get("scope");
      const resolvedScope: RoutedLabScope = isRoutedLabScope(requestedScope) ? requestedScope : "refine";
      setScope(resolvedScope);
      const requestedReturn = parameters.get("return");
      setReturnWorkspace(isRoutedLabScope(requestedReturn) ? requestedReturn : resolvedScope);
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

  const returnTarget = LAB_RETURN_TARGETS[returnWorkspace];

  return (
    <main
      className="standalone-studio-surface"
      data-specialist-labs-surface={scope}
      style={{ minHeight: "100vh", padding: "24px" }}
    >
      <div style={{ maxWidth: 1580, margin: "0 auto", display: "grid", gap: 18 }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <Link data-skin-v1-local-return="true" href={returnTarget.href} style={{ color: "#163331", fontWeight: 800 }}>Back to {returnTarget.label}</Link>
          <div style={{ display: "flex", gap: 12 }}><Link href="/structure">Structure</Link><Link href="/diagnostics">Diagnostics</Link><Link href="/draftlens">DraftLens</Link></div>
        </nav>
        <SpecialistLabs project={project} onProjectChange={save} scope={scope} />
        <p style={{ color: "#57706d" }} aria-live="polite">{status}</p>
      </div>
    </main>
  );
}
