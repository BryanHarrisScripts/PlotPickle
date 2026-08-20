"use client";

import { useRouter } from "next/navigation";
import LibraryWorkspace from "../../modules/library/ui/library-workspace";
import PlotPickleWorkspaceShell, { type RootWorkspace } from "../plotpickle-workspace-shell";

export default function LibraryPage() {
  const router = useRouter();
  const navigateWorkspace = (workspace: RootWorkspace) => {
    if (workspace === "library") return;
    router.push(`/?workspace=${encodeURIComponent(workspace)}`);
  };
  return (
    <PlotPickleWorkspaceShell activeWorkspace="library" onNavigate={navigateWorkspace}>
      <LibraryWorkspace />
    </PlotPickleWorkspaceShell>
  );
}
