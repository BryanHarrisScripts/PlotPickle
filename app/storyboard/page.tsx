"use client";

import { useEffect, useState } from "react";
import type { PPFProject } from "@/core/project/project";
import { loadFoundationProject } from "@/core/storage/foundation-project-browser";
import StoryboardReadinessWorkspace from "../_components/storyboard/storyboard-readiness-workspace";
import StoryMapContextRuntime from "../story-map-workspace/context-runtime";
import styles from "./storyboard-page.module.css";

function boundedBlock(value: string | null) {
  const number = Number(value || 1);
  return Number.isFinite(number) ? Math.min(24, Math.max(1, Math.trunc(number))) : 1;
}

export default function StoryboardPage() {
  const [project, setProject] = useState<PPFProject | null>(null);
  const [initialBlockNumber, setInitialBlockNumber] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const search = new URLSearchParams(window.location.search);
        setInitialBlockNumber(boundedBlock(search.get("block")));
        setProject(loadFoundationProject());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The canonical project could not be opened.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (error) {
    return <main className={styles.state}><p role="alert">{error}</p></main>;
  }

  if (!project) {
    return <main className={styles.state}>Opening canonical Storyboard readiness…</main>;
  }

  return (
    <div data-canonical-project-id={project.id}>
      <StoryMapContextRuntime />
      <StoryboardReadinessWorkspace
        initialBlockNumber={initialBlockNumber}
        project={project}
        onProjectChange={setProject}
        onOpenBuild={() => window.location.assign(`/?workspace=build&block=${initialBlockNumber}`)}
      />
    </div>
  );
}
