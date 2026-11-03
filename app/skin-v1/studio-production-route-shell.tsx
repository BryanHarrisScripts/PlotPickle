"use client";

import { useRouter } from "next/navigation";
import { useCallback, type ReactNode } from "react";
import PlotPickleWorkspaceShell, { type RootWorkspace } from "../plotpickle-workspace-shell";

/**
 * Reuse the same canonical Studio shell for direct production routes as the
 * root Matrix. Storyboard and Previs keep their existing PPF workspaces and
 * contextual navigation as the center canvas; Elara's authenticated room is
 * the same room used at the root. No second navigation registry or project.
 */
export default function StudioProductionRouteShell({
  activeShortcutId,
  children,
}: {
  readonly activeShortcutId: "storyboard" | "graphic-novel";
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const navigateWorkspace = useCallback((workspace: RootWorkspace) => {
    router.push(`/?workspace=${encodeURIComponent(workspace)}`);
  }, [router]);

  return (
    <PlotPickleWorkspaceShell
      activeWorkspace="build"
      activeShortcutId={activeShortcutId}
      navigationArea="produce"
      onNavigate={navigateWorkspace}
    >
      {children}
    </PlotPickleWorkspaceShell>
  );
}
