"use client";

import type { PlotPickleSettings } from "@/lib/ai/settings";
import type { ConnectionStatusSnapshot } from "@/lib/connection-status";
import type { PlotPickleProject } from "@/lib/project";
import type { ProductNavigationId } from "@/lib/product-direction";
import DashboardStoryLibrary from "./dashboard-story-library";

type Props = {
  project: PlotPickleProject;
  saveState: string;
  settings: PlotPickleSettings;
  connectionStatus: ConnectionStatusSnapshot;
  afterglowCopyWorking: boolean;
  onNavigate: (workspace: ProductNavigationId, section?: string) => void;
  onOpenBlock: (blockNumber: number) => void;
  onLoadAfterglow: () => void;
  onMakeAfterglowCopy: () => void;
  onResetAfterglow: () => void;
  onOpenAfterglowGraphicNovel: () => void;
};

export default function DashboardCommandCentre({
  project,
  onNavigate,
  onOpenBlock,
}: Props) {
  return (
    <DashboardStoryLibrary
      project={project}
      onOpenSection={(section) => onNavigate("planner", section)}
      onOpenEngines={() => onNavigate("settings")}
      onOpenBlock={onOpenBlock}
    />
  );
}
