"use client";

import { useRouter } from "next/navigation";
import PlotPickleWorkspaceShell, { type RootWorkspace } from "../plotpickle-workspace-shell";
import StoryZeroWorkspace from "../_components/story/story-zero-workspace";

export default function StoryHomePage() {
  const router = useRouter();

  function navigateWorkspace(workspace: RootWorkspace) {
    if (workspace === "story") return;
    if (workspace === "library") {
      router.push("/library");
      return;
    }
    router.push(`/?workspace=${encodeURIComponent(workspace)}`);
  }

  return (
    <PlotPickleWorkspaceShell activeWorkspace="story" activeShortcutId="story" onNavigate={navigateWorkspace}>
      <StoryZeroWorkspace />
    </PlotPickleWorkspaceShell>
  );
}
