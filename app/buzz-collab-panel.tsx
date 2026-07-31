"use client";

import { useEffect, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import BuzzWorkspace from "./buzz-workspace";

const PROJECT_STORAGE_KEY = "plotpickle.project.v1";

export default function BuzzCollabPanel({
  project,
  onProjectChange,
  onOpenSettings,
}: {
  project: PlotPickleProject;
  onProjectChange: (project: PlotPickleProject) => void;
  onOpenSettings: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    const handleProjectChange = (event: StorageEvent) => {
      if (event.key !== PROJECT_STORAGE_KEY || !event.newValue) return;
      try { onProjectChange(JSON.parse(event.newValue) as PlotPickleProject); } catch { /* Keep the current PPF if a malformed event is received. */ }
    };
    window.addEventListener("storage", handleProjectChange);
    return () => window.removeEventListener("storage", handleProjectChange);
  }, [onProjectChange]);

  if (!mounted) return <p role="status">Preparing the Buzz Story Room…</p>;
  return <BuzzWorkspace onOpenSettings={onOpenSettings} />;
}
