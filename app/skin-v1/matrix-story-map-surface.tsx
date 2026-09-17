"use client";

import { useEffect, useState } from "react";
import type { PPFProject } from "@/core/project/project";
import {
  FOUNDATION_PROJECT_SAVED_EVENT,
  loadFoundationProject,
} from "@/core/storage/foundation-project-browser";
import ProgressiveStoryMap from "@/modules/build/ui/progressive-story-map";

export default function MatrixStoryMapSurface() {
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

  if (!project) return <p role="status">Opening Story Map…</p>;
  return <ProgressiveStoryMap project={project} />;
}
