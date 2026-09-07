"use client";

import { useRouter } from "next/navigation";
import PlotPickleWorkspaceShell, { type RootWorkspace } from "../plotpickle-workspace-shell";
import StoryMapWorkspace from "./story-map-workspace";

export default function StoryMapPage() {
  const router = useRouter();

  function navigateWorkspace(workspace: RootWorkspace) {
    if (workspace === "library") {
      router.push("/library");
      return;
    }
    if (workspace === "story") {
      router.push("/story");
      return;
    }
    router.push(`/?workspace=${encodeURIComponent(workspace)}`);
  }

  return (
    <PlotPickleWorkspaceShell
      activeWorkspace="build"
      activeShortcutId="story-map"
      navigationArea="create"
      contextId="story-map"
      contextLabel="Story Map"
      contextDetail="4 Acts · 24 Blocks · 96 Mini-Blocks"
      contextScope="Canonical story structure"
      onNavigate={navigateWorkspace}
    >
      <StoryMapWorkspace />
    </PlotPickleWorkspaceShell>
  );
}
