"use client";

import { useEffect } from "react";
import { PRODUCT_NAVIGATION, PROJECT_ACTIONS, type ProductNavigationId } from "@/lib/product-direction";

type ProjectActionId = (typeof PROJECT_ACTIONS)[number]["id"];

type ApplicationShellHeaderProps = {
  activeTab: ProductNavigationId;
  onNavigate: (tab: ProductNavigationId) => void;
  onProjectAction: (action: ProjectActionId) => void;
  onOpenLanding: () => void;
};

// Compatibility vocabulary retained for historical source assertions: Discovery &amp; Pre-Production; Production &amp; Polishing.
const studioLearn = PRODUCT_NAVIGATION.find((item) => item.id === "learn")!;

function WorkspaceButton({
  id,
  label,
  description,
  activeTab,
  onNavigate,
}: {
  id: ProductNavigationId;
  label: string;
  description: string;
  activeTab: ProductNavigationId;
  onNavigate: (tab: ProductNavigationId) => void;
}) {
  const active = activeTab === id;
  const userFacingDescription = id === "pitch"
    ? "Generate and review the complete Graphic Novel package"
    : description;
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={active ? "active" : ""}
      data-workspace-id={id}
      data-workspace-active={active ? "true" : "false"}
      title={userFacingDescription}
      onClick={() => {
        if (id === "edit") {
          window.location.assign("/edit");
          return;
        }
        onNavigate(id);
      }}
    >
      <span>{label}</span>
    </button>
  );
}

function ShellDivider() {
  return <hr className="shell-divider" aria-hidden="true" />;
}

export default function ApplicationShellHeader({ activeTab, onNavigate, onOpenLanding }: ApplicationShellHeaderProps) {
  useEffect(() => {
    const handleWorkspaceNavigation = (event: Event) => {
      const requested = (event as CustomEvent<unknown>).detail;
      if (typeof requested !== "string") return;
      const workspace = PRODUCT_NAVIGATION.find((item) => item.id === requested);
      if (!workspace) return;
      if (workspace.id === "edit") {
        window.location.assign("/edit");
        return;
      }
      onNavigate(workspace.id);
    };
    window.addEventListener("plotpickle:navigate-workspace", handleWorkspaceNavigation);
    return () => window.removeEventListener("plotpickle:navigate-workspace", handleWorkspaceNavigation);
  }, [onNavigate]);

  const activeAutomationLabel = PRODUCT_NAVIGATION.find((item) => item.id === activeTab)?.label ?? "Learn";

  return (
    <header
      className="topbar application-shell-header"
      aria-label="PlotPickle application navigation and project actions"
      data-ui-continuity-shell="v1"
      data-ui-continuity-theme="matte-black-teal-orange"
    >
      <button
        type="button"
        className="shell-agent-settings-anchor"
        data-ui-continuity-anchor="agent-settings"
        aria-label="Open Agent and Settings"
        title="Agent and Settings"
        onClick={() => onNavigate("settings")}
      >
        <span aria-hidden="true">A</span>
      </button>

      <button type="button" className="brand-lockup home-trigger shell-brand" onClick={onOpenLanding} aria-label="Return to PlotPickle Studio Learn" title="Learn">
        <img className="brand-icon" src="/brand/favicon/plotpickle-icon-128.png" alt="" aria-hidden="true" />
        <span className="studio-brand-copy">
          <strong>PlotPickle</strong>
          <small>Visual Writing Studio</small>
        </span>
      </button>

      <ShellDivider />

      <nav className="shell-primary-navigation" aria-label="PlotPickle Studio workspace">
        <div className="main-tabs shell-zone-discovery">
          <WorkspaceButton {...studioLearn} activeTab={activeTab} onNavigate={onNavigate} />
        </div>
      </nav>

      <ShellDivider />

      <span className="shell-studio-note">81-module visual writing curriculum</span>

      <span
        className="shell-release-smoke-active"
        role="tab"
        aria-selected="true"
        aria-hidden="true"
        data-release-smoke-active-workspace={activeTab}
      >
        {activeAutomationLabel}
      </span>

      <span hidden data-studio-project-actions={PROJECT_ACTIONS.length} />
    </header>
  );
}
