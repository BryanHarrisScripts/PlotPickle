"use client";

import { useEffect, useState } from "react";
import FeedbackWorkspace from "../feedback-workspace";
import type { FeedbackTargetReference } from "@/lib/unified-feedback";
import { createBlankProject, normalizePlotPickleProject, type PlotPickleProject } from "@/lib/projects/project";

const STORAGE_KEY = "plotpickle.project.v1";

function targetHref(target: FeedbackTargetReference) {
  if (target.workspace === "dashboard") return "/skin-v1";
  if (target.workspace === "plan") return "/?workspace=plan";
  if (target.workspace === "build") return "/?workspace=build";
  if (target.workspace === "write") return "/write";
  if (target.workspace === "storyboard") return "/storyboard";
  if (target.workspace === "refine") return "/diagnostics";
  if (target.workspace === "reports") return "/production";
  return "/feedback";
}

export default function FeedbackPage() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [status, setStatus] = useState("Loading the active PlotPickle project…");
  const [initialTargetId, setInitialTargetId] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const parameters = new URLSearchParams(window.location.search);
      setInitialTargetId(parameters.get("target") ?? "");
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setStatus("No saved project was found. The blank project is ready for anchored feedback.");
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
    setStatus("Feedback was saved to the active PlotPickle project.");
  }

  function openTarget(target: FeedbackTargetReference) {
    window.location.assign(targetHref(target));
  }

  return (
    <main
      className="standalone-studio-surface"
      data-feedback-workspace="canonical"
      style={{ minHeight: "100vh" }}
    >
      <FeedbackWorkspace
        project={project}
        onProjectChange={save}
        onOpenTarget={openTarget}
        initialTargetId={initialTargetId}
      />
      <p aria-live="polite" style={{ margin: "0 18px 18px" }}>{status}</p>
    </main>
  );
}
