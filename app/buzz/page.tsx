"use client";

import ApplicationShellHeader from "../application-shell-header";
import BuzzWorkspace from "../buzz-workspace";
import type { ProductNavigationId } from "@/lib/product-direction";

const WORKSPACE_QUERY: Partial<Record<ProductNavigationId, string>> = {
  dashboard: "dashboard",
  learn: "learn",
  planner: "plan",
  visuals: "storyboard",
  script: "write",
  pitch: "pitch",
  build: "build",
  feedback: "feedback",
  engines: "refine",
  reports: "reports",
  collab: "collab",
  settings: "settings",
};

export default function BuzzPage() {
  function navigate(tab: ProductNavigationId) {
    if (tab === "buzz") return;
    const workspace = WORKSPACE_QUERY[tab] ?? "dashboard";
    window.location.assign(`/?workspace=${encodeURIComponent(workspace)}`);
  }

  return (
    <div className="app-shell">
      <ApplicationShellHeader
        activeTab="buzz"
        onNavigate={navigate}
        onProjectAction={(action) => {
          const workspace = action === "new-project" ? "plan" : "dashboard";
          window.location.assign(`/?workspace=${workspace}&action=${encodeURIComponent(action)}`);
        }}
        onOpenLanding={() => window.location.assign("/")}
      />
      <main className="workspace-main">
        <BuzzWorkspace onOpenSettings={() => window.location.assign("/settings/buzz")} />
      </main>
    </div>
  );
}
