"use client";

import { useEffect, useState } from "react";
import type { PPFProject } from "@/core/project/project";
import { loadFoundationProject } from "@/core/storage/foundation-project-browser";
import PrevisReadinessWorkspace from "../_components/previs/previs-readiness-workspace";

export default function PrevisPage() {
  const [project, setProject] = useState<PPFProject | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setProject(loadFoundationProject());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The canonical project could not be opened.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (error) {
    return <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}><p role="alert">{error}</p></main>;
  }

  if (!project) {
    return <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>Opening canonical Previs projection…</main>;
  }

  return (
    <div data-canonical-project-id={project.id}>
      <PrevisReadinessWorkspace
        project={project}
        onProjectChange={setProject}
        onOpenStoryboard={(anchor) => window.location.assign(anchor
          ? `/storyboard?block=${anchor.blockNumber}&mini=${anchor.miniBlockNumber}`
          : "/storyboard")}
        onOpenBuild={(anchor) => window.location.assign(anchor
          ? `/?workspace=build&block=${anchor.blockNumber}&mini=${anchor.miniBlockNumber}`
          : "/?workspace=build")}
      />
    </div>
  );
}
