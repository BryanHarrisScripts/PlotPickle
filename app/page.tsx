"use client";

import { useEffect, useState } from "react";
import { plotPickleCurriculum } from "../adapters/curriculum/current-catalog";
import { answerFromCurriculum } from "../modules/creative-room/curriculum-guide";
import LearnWorkspace from "../modules/learn/ui/learn-workspace";
import FoundationsPlanWorkspace from "../modules/plan/ui/foundations-plan-workspace";
import { normalizeFoundationProject, type PPFProject } from "../core/project/project";

type Workspace = "learn" | "plan";

const PROJECT_KEY = "plotpickle.foundation.project.v1";

function requestedWorkspace(): Workspace {
  if (typeof window === "undefined") return "learn";
  return new URLSearchParams(window.location.search).get("workspace") === "plan" ? "plan" : "learn";
}

function repairPersistedProject() {
  const saved = localStorage.getItem(PROJECT_KEY);
  if (!saved) return;

  try {
    const normalized = normalizeFoundationProject(JSON.parse(saved) as Partial<PPFProject>);
    const validLessonIds = new Set(plotPickleCurriculum.map((lesson) => lesson.id));
    const repaired: PPFProject = {
      ...normalized,
      learning: {
        activeLessonId: normalized.learning.activeLessonId && validLessonIds.has(normalized.learning.activeLessonId)
          ? normalized.learning.activeLessonId
          : null,
        completedLessonIds: normalized.learning.completedLessonIds.filter((lessonId) => validLessonIds.has(lessonId)),
      },
    };
    localStorage.setItem(PROJECT_KEY, JSON.stringify(repaired));
  } catch {
    // Invalid JSON should not strand the application on its opening screen.
    // The workspace loader will create a clean project when the bad cache is gone.
    localStorage.removeItem(PROJECT_KEY);
  }
}

export default function Home() {
  const [workspace, setWorkspace] = useState<Workspace>("learn");
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    repairPersistedProject();
    const sync = () => setWorkspace(requestedWorkspace());
    sync();
    setStorageReady(true);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  if (!storageReady) {
    return <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#090a0b", color: "#35c9b8" }}>Opening PlotPickle…</main>;
  }

  if (workspace === "plan") {
    return <FoundationsPlanWorkspace curriculum={plotPickleCurriculum} />;
  }

  return (
    <LearnWorkspace
      curriculum={plotPickleCurriculum}
      guide={answerFromCurriculum}
    />
  );
}
