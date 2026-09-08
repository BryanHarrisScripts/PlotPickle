"use client";

import { useEffect, useState } from "react";
import type { CurriculumLesson } from "@/core/contracts/curriculum";
import type { PPFProject } from "@/core/project/project";
import {
  FOUNDATION_PROJECT_SAVED_EVENT,
  loadFoundationProject,
} from "@/core/storage/foundation-project-browser";
import ProgressiveStoryMap from "@/modules/build/ui/progressive-story-map";
import DashboardWorkspace from "@/modules/dashboard/ui/dashboard-workspace";

type DashboardDestination = "learn" | "plan" | "build";
type GuidedSection = "foundations" | "world";

export default function StoryMapWorkspace({
  curriculum,
  onNavigate,
  onNavigateGuided,
}: {
  readonly curriculum: readonly CurriculumLesson[];
  readonly onNavigate: (destination: DashboardDestination) => void;
  readonly onNavigateGuided: (workspace: DashboardDestination, section: GuidedSection) => void;
}) {
  const [project, setProject] = useState<PPFProject | null>(null);

  useEffect(() => {
    const sync = () => setProject(loadFoundationProject());
    sync();
    window.addEventListener(FOUNDATION_PROJECT_SAVED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(FOUNDATION_PROJECT_SAVED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!project) return <main>Opening Story Map…</main>;

  return (
    <>
      <ProgressiveStoryMap project={project} />
      <DashboardWorkspace
        curriculum={curriculum}
        onNavigate={onNavigate}
        onNavigateGuided={onNavigateGuided}
      />
    </>
  );
}
