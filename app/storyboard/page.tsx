"use client";

import { useEffect, useState } from "react";
import type { PPFProject } from "@/core/project/project";
import { loadFoundationProject } from "@/core/storage/foundation-project-browser";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import { normalizePlotPickleProject, type PlotPickleProject } from "@/lib/projects/project";
import StoryboardReadinessWorkspace from "../_components/storyboard/storyboard-readiness-workspace";
import StoryMapContextRuntime from "../story-map-workspace/context-runtime";
import styles from "./storyboard-page.module.css";

const LEGACY_PROJECT_STORAGE_KEY = "plotpickle.project.v1";

function boundedBlock(value: string | null) {
  const number = Number(value || 1);
  return Number.isFinite(number) ? Math.min(24, Math.max(1, Math.trunc(number))) : 1;
}

function boundedMini(value: string | null) {
  const number = Number(value || 1);
  return Number.isFinite(number) ? Math.min(4, Math.max(1, Math.trunc(number))) : 1;
}

function legacySceneProjectionSource() {
  try {
    const stored = window.localStorage.getItem(LEGACY_PROJECT_STORAGE_KEY);
    return stored ? normalizePlotPickleProject(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

export default function StoryboardPage() {
  const [project, setProject] = useState<LibraryPPFProject | null>(null);
  const [legacyProject, setLegacyProject] = useState<PlotPickleProject | null>(null);
  const [initialBlockNumber, setInitialBlockNumber] = useState(1);
  const [initialMiniBlockNumber, setInitialMiniBlockNumber] = useState(1);
  const [initialSceneId, setInitialSceneId] = useState<string | undefined>();
  const [initialShotId, setInitialShotId] = useState<string | undefined>();
  const [initialVisualView, setInitialVisualView] = useState<"story" | "timeline">("story");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const search = new URLSearchParams(window.location.search);
        setInitialBlockNumber(boundedBlock(search.get("block")));
        setInitialMiniBlockNumber(boundedMini(search.get("mini")));
        setInitialSceneId(search.get("scene")?.trim() || undefined);
        setInitialShotId(search.get("shot")?.trim() || undefined);
        setInitialVisualView(search.get("view") === "timeline" ? "timeline" : "story");
        setLegacyProject(legacySceneProjectionSource());
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

  function applyProjectChange(next: PPFProject) {
    setProject({
      ...project,
      ...next,
      structure: project.structure,
      sourceEvidence: project.sourceEvidence,
    });
  }

  return (
    <div data-canonical-project-id={project.id}>
      <StoryMapContextRuntime />
      <StoryboardReadinessWorkspace
        initialBlockNumber={initialBlockNumber}
        initialMiniBlockNumber={initialMiniBlockNumber}
        initialSceneId={initialSceneId}
        initialShotId={initialShotId}
        initialVisualView={initialVisualView}
        legacyProject={legacyProject}
        project={project}
        onProjectChange={applyProjectChange}
        onOpenBuild={(blockNumber, miniBlockNumber) => window.location.assign(
          `/?workspace=build&block=${blockNumber}&mini=${miniBlockNumber}`,
        )}
      />
    </div>
  );
}
