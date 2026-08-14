"use client";

import { useEffect, useState } from "react";
import { plotPickleCurriculum } from "../adapters/curriculum/current-catalog";
import { FOUNDATION_PROJECT_STORAGE_KEY } from "../core/contracts/foundation-plan";
import { normalizeFoundationProject, type PPFProject } from "../core/project/project";
import { answerFromCurriculum } from "../modules/creative-room/curriculum-guide";
import LearnWorkspace from "../modules/learn/ui/learn-workspace";
import FoundationsPlanWorkspace from "../modules/plan/ui/foundations-plan-workspace";
import SageSettingsWorkspace from "./sage-settings-workspace";

type Workspace = "learn" | "plan" | "settings";

function requestedWorkspace(): Workspace {
  if (typeof window === "undefined") return "learn";
  const requested = new URLSearchParams(window.location.search).get("workspace");
  if (requested === "plan") return "plan";
  if (requested === "settings") return "settings";
  return "learn";
}

function repairPersistedProject() {
  const saved = localStorage.getItem(FOUNDATION_PROJECT_STORAGE_KEY);
  if (!saved) return;
  try {
    const normalized = normalizeFoundationProject(JSON.parse(saved));
    const validLessonIds = new Set(plotPickleCurriculum.map((lesson) => lesson.id));
    const repaired: PPFProject = {
      ...normalized,
      learning: {
        activeLessonId: normalized.learning.activeLessonId && validLessonIds.has(normalized.learning.activeLessonId)
          ? normalized.learning.activeLessonId
          : null,
        completedLessonIds: normalized.learning.completedLessonIds.filter((lessonId) => validLessonIds.has(lessonId)),
      },
      foundations: {
        ...normalized.foundations,
        activeLessonId: normalized.foundations.activeLessonId && validLessonIds.has(normalized.foundations.activeLessonId)
          ? normalized.foundations.activeLessonId
          : null,
      },
    };
    localStorage.setItem(FOUNDATION_PROJECT_STORAGE_KEY, JSON.stringify(repaired));
  } catch {
    // Preserve an unreadable cache for manual recovery before allowing the
    // workspaces to create a clean project under the canonical key.
    localStorage.setItem(`${FOUNDATION_PROJECT_STORAGE_KEY}.recovery.${Date.now()}`, saved);
    localStorage.removeItem(FOUNDATION_PROJECT_STORAGE_KEY);
  }
}

export default function Home() {
  const [workspace, setWorkspace] = useState<Workspace>("learn");
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    repairPersistedProject();
    const syncWorkspace = () => setWorkspace(requestedWorkspace());
    syncWorkspace();
    // Browser storage and URL state are unavailable during the server render;
    // this mount gate deliberately opens only after both have been repaired.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStorageReady(true);
    window.addEventListener("popstate", syncWorkspace);
    return () => window.removeEventListener("popstate", syncWorkspace);
  }, []);

  if (!storageReady) {
    return <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>Opening PlotPickle…</main>;
  }

  if (workspace === "settings") {
    return <SageSettingsWorkspace />;
  }

  if (workspace === "plan") {
    return <FoundationsPlanWorkspace curriculum={plotPickleCurriculum} />;
  }

  const openFoundationsPlan = (lessonId?: string) => {
    const destination = new URL(window.location.href);
    destination.searchParams.set("workspace", "plan");
    destination.searchParams.set("section", "foundations");
    if (lessonId) destination.searchParams.set("lesson", lessonId);
    else destination.searchParams.delete("lesson");
    window.location.assign(`${destination.pathname}${destination.search}`);
  };

  return (
    <LearnWorkspace
      curriculum={plotPickleCurriculum}
      guide={answerFromCurriculum}
      onOpenFoundationsPlan={openFoundationsPlan}
    />
  );
}
