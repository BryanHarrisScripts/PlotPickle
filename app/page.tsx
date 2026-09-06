"use client";

/* eslint-disable @next/next/no-location-assign-relative-destination -- project-state-sensitive navigation deliberately reloads profile-owned project state */

import { useEffect, useState } from "react";
import { plotPickleCurriculum } from "../adapters/curriculum/current-catalog";
import type { PPFProject } from "../core/project/project";
import { loadFoundationProject, saveFoundationProject } from "../core/storage/foundation-project-browser";
import { hasActiveLibraryProject } from "../core/storage/project-library-browser";
import FoundationsBuildWorkspace from "../modules/build/ui/foundations-build-workspace";
import WorldBuildWorkspace from "../modules/build/ui/world-build-workspace";
import { memoryAwareSageGuide } from "../modules/creative-room/memory-aware-sage-guide";
import DashboardWorkspace from "../modules/dashboard/ui/dashboard-workspace";
import LearnWorkspace from "../modules/learn/ui/learn-workspace";
import MarqueeAgentOverlay from "../modules/learn/ui/marquee-agent-overlay";
import FoundationsPlanWorkspace from "../modules/plan/ui/foundations-plan-workspace";
import PlanLessonAnswerPreview from "../modules/plan/ui/plan-lesson-answer-preview";
import WorldPlanWorkspace from "../modules/plan/ui/world-plan-workspace";
import LibraryWorkspace from "../modules/library/ui/library-workspace";
import FoundationsStoryWorkflowPanel from "../modules/story-workflow/ui/foundations-story-workflow-panel";
import WyrmwoodWorkspace from "../modules/wyrmwood/ui/wyrmwood-workspace";
import CollabEntryWorkspace from "./_components/collab/collab-entry-workspace";
import CommunityWorkspace from "./_components/community/community-workspace";
import rootLoadingStyles from "./_components/foundation/root-loading-state.module.css";
import PlotPickleWorkspaceShell, { type RootWorkspace } from "./plotpickle-workspace-shell";
import SageSettingsWorkspace from "./sage-settings-workspace";
import "./issue-1725-polish.css";

type Workspace = RootWorkspace;
type GuidedSection = "foundations" | "world";

function requestedWorkspace(): Workspace {
  if (typeof window === "undefined") return "learn";
  const requested = new URLSearchParams(window.location.search).get("workspace");
  if (requested === "dashboard") return "dashboard";
  if (requested === "plan") return "plan";
  if (requested === "build") return "build";
  if (requested === "community") return "community";
  if (requested === "collab") return "collab";
  if (requested === "settings") return "settings";
  if (requested === "wyrmwood") return "wyrmwood";
  if (requested === "library") return "library";
  return "learn";
}

function requestedSection(): GuidedSection {
  if (typeof window === "undefined") return "foundations";
  return new URLSearchParams(window.location.search).get("section") === "world" ? "world" : "foundations";
}

function currentProjectTitle() {
  if (!hasActiveLibraryProject()) return "No active project";
  return loadFoundationProject().title || "Untitled Story";
}

function repairPersistedProject() {
  try {
    if (!hasActiveLibraryProject()) return;
    const normalized = loadFoundationProject();
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
      world: {
        ...normalized.world,
        activeLessonId: normalized.world.activeLessonId && validLessonIds.has(normalized.world.activeLessonId)
          ? normalized.world.activeLessonId
          : null,
      },
    };
    saveFoundationProject(repaired);
  } catch {
    // The profile-scoped Library owns recovery and quarantine. A later load
    // retries the last verified story without replacing recoverable evidence.
  }
}

function navigateGuided(workspace: "learn" | "plan" | "build", section: GuidedSection, lessonId?: string) {
  const destination = new URL(window.location.href);
  destination.searchParams.set("workspace", workspace);
  if (workspace === "learn") {
    destination.searchParams.delete("section");
    destination.searchParams.delete("lesson");
  } else {
    destination.searchParams.set("section", section);
    if (lessonId) destination.searchParams.set("lesson", lessonId);
    else destination.searchParams.delete("lesson");
  }
  window.location.assign(`${destination.pathname}${destination.search}`);
}

function navigateWorkspace(workspace: Workspace) {
  if (workspace === "library") {
    window.location.assign("/library");
    return;
  }
  const destination = new URL(window.location.href);
  destination.searchParams.set("workspace", workspace);
  if (workspace === "plan" || workspace === "build") {
    destination.searchParams.set("section", "foundations");
    destination.searchParams.delete("lesson");
  } else {
    destination.searchParams.delete("section");
    destination.searchParams.delete("lesson");
  }
  const href = `${destination.pathname}${destination.search}`;
  if (workspace === "community" || workspace === "collab") {
    // Community and Collab are client workspaces inside this root page. Keep
    // URL/history truthful without re-entering the document-level RSC path.
    window.history.pushState({ plotpickleWorkspace: workspace }, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }
  window.location.assign(href);
}

function openLearningApplication(topic: string, lessonId?: string) {
  switch (topic) {
    case "foundations":
      navigateGuided("plan", "foundations", lessonId);
      return;
    case "world":
      navigateGuided("plan", "world", lessonId);
      return;
    case "character":
    case "theme":
      navigateGuided("plan", "foundations");
      return;
    case "structure":
      window.location.assign("/structure");
      return;
    case "visual-storytelling":
      window.location.assign("/storyboard");
      return;
    case "drafting":
    case "dialogue":
      window.location.assign("/pageflow");
      return;
    case "revision":
      window.location.assign("/edit");
      return;
    case "responsible-ai":
      navigateWorkspace("settings");
      return;
    case "industry":
      window.location.assign("/production");
      return;
    case "collaboration":
      navigateWorkspace("collab");
      return;
    default:
      navigateWorkspace("plan");
  }
}

export default function Home() {
  const [workspace, setWorkspace] = useState<Workspace>("learn");
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    repairPersistedProject();
    const syncWorkspace = () => setWorkspace(requestedWorkspace());
    syncWorkspace();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStorageReady(true);
    window.addEventListener("popstate", syncWorkspace);
    return () => window.removeEventListener("popstate", syncWorkspace);
  }, []);

  if (!storageReady) {
    return <main className={rootLoadingStyles.openingState}>Opening PlotPickle…</main>;
  }

  if (workspace === "dashboard") {
    return (
      <PlotPickleWorkspaceShell activeWorkspace="dashboard" onNavigate={navigateWorkspace}>
        <DashboardWorkspace
          curriculum={plotPickleCurriculum}
          onNavigate={navigateWorkspace}
          onNavigateGuided={navigateGuided}
        />
      </PlotPickleWorkspaceShell>
    );
  }

  if (workspace === "collab") {
    return (
      <PlotPickleWorkspaceShell
        activeWorkspace="collab"
        navigationArea="connect"
        contextId="collab"
        contextLabel="Collab"
        contextDetail="Formal shared work routed to current capability owners"
        contextScope="Collaboration"
        onNavigate={navigateWorkspace}
      >
        <CollabEntryWorkspace projectTitle={currentProjectTitle()} />
      </PlotPickleWorkspaceShell>
    );
  }

  if (workspace === "community") {
    return (
      <PlotPickleWorkspaceShell activeWorkspace="community" onNavigate={navigateWorkspace}>
        <CommunityWorkspace onOpenSettings={() => navigateWorkspace("settings")} />
      </PlotPickleWorkspaceShell>
    );
  }

  if (workspace === "settings") {
    return (
      <PlotPickleWorkspaceShell activeWorkspace="settings" onNavigate={navigateWorkspace}>
        <SageSettingsWorkspace />
      </PlotPickleWorkspaceShell>
    );
  }

  if (workspace === "wyrmwood") {
    return (
      <PlotPickleWorkspaceShell activeWorkspace="wyrmwood" onNavigate={navigateWorkspace}>
        <WyrmwoodWorkspace
          curriculum={plotPickleCurriculum}
          onOpenLearn={() => navigateWorkspace("learn")}
          onOpenPlan={() => navigateWorkspace("plan")}
        />
      </PlotPickleWorkspaceShell>
    );
  }

  if (workspace === "library") {
    return (
      <PlotPickleWorkspaceShell activeWorkspace="library" onNavigate={navigateWorkspace}>
        <LibraryWorkspace />
      </PlotPickleWorkspaceShell>
    );
  }

  if (workspace === "build") {
    const section = requestedSection();
    return (
      <PlotPickleWorkspaceShell activeWorkspace="build" onNavigate={navigateWorkspace}>
        {section === "world" ? (
          <WorldBuildWorkspace
            curriculum={plotPickleCurriculum}
            onOpenDashboard={() => navigateWorkspace("dashboard")}
            onOpenPlan={() => navigateGuided("plan", "world")}
          />
        ) : (
          <>
            <FoundationsStoryWorkflowPanel
              curriculum={plotPickleCurriculum}
              project={loadFoundationProject()}
              onOpenPlan={() => navigateGuided("plan", "foundations")}
            />
            <FoundationsBuildWorkspace
              curriculum={plotPickleCurriculum}
              onOpenDashboard={() => navigateWorkspace("dashboard")}
              onOpenPlan={() => navigateGuided("plan", "foundations")}
            />
          </>
        )}
      </PlotPickleWorkspaceShell>
    );
  }

  if (workspace === "plan") {
    const section = requestedSection();
    return (
      <PlotPickleWorkspaceShell activeWorkspace="plan" onNavigate={navigateWorkspace}>
        {section === "world" ? (
          <WorldPlanWorkspace
            curriculum={plotPickleCurriculum}
            onOpenBuild={() => navigateGuided("build", "world")}
            onOpenLearn={() => navigateGuided("learn", "world")}
          />
        ) : (
          <>
            <FoundationsPlanWorkspace curriculum={plotPickleCurriculum} />
            <PlanLessonAnswerPreview curriculum={plotPickleCurriculum} />
          </>
        )}
      </PlotPickleWorkspaceShell>
    );
  }

  const openFoundationsPlan = (lessonId?: string) => navigateGuided("plan", "foundations", lessonId);

  return (
    <PlotPickleWorkspaceShell activeWorkspace="learn" onNavigate={navigateWorkspace}>
      <LearnWorkspace
        curriculum={plotPickleCurriculum}
        guide={memoryAwareSageGuide}
        onApplyLearning={openLearningApplication}
        onOpenFoundationsPlan={openFoundationsPlan}
      />
      <MarqueeAgentOverlay curriculum={plotPickleCurriculum} />
    </PlotPickleWorkspaceShell>
  );
}