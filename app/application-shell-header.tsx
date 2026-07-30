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
const discovery = PRODUCT_NAVIGATION.filter((item) => item.zone === "discovery");
const production = PRODUCT_NAVIGATION.filter((item) => item.zone === "production");
const collaboration = PRODUCT_NAVIGATION.filter((item) => item.zone === "collaboration");
const configuration = PRODUCT_NAVIGATION.filter((item) => item.zone === "configuration");

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
  const userFacingDescription = id === "pitch"
    ? "Generate and review the complete Graphic Novel package"
    : description;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activeTab === id}
      aria-current={activeTab === id ? "page" : undefined}
      className={activeTab === id ? "active" : ""}
      title={userFacingDescription}
      onClick={() => {
        if (id === "buzz") {
          window.location.assign("/buzz");
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
  return <span className="shell-divider" aria-hidden="true" />;
}

export default function ApplicationShellHeader({ activeTab, onNavigate, onProjectAction, onOpenLanding }: ApplicationShellHeaderProps) {
  useEffect(() => {
    const handleWorkspaceNavigation = (event: Event) => {
      const requested = (event as CustomEvent<unknown>).detail;
      if (typeof requested !== "string") return;
      if (requested === "buzz") {
        window.location.assign("/buzz");
        return;
      }
      const workspace = PRODUCT_NAVIGATION.find((item) => item.id === requested);
      if (workspace) onNavigate(workspace.id);
    };
    window.addEventListener("plotpickle:navigate-workspace", handleWorkspaceNavigation);
    return () => window.removeEventListener("plotpickle:navigate-workspace", handleWorkspaceNavigation);
  }, [onNavigate]);

  return (
    <header className="topbar application-shell-header">
      <button type="button" className="brand-lockup home-trigger shell-brand" onClick={onOpenLanding} aria-label="Open the PlotPickle marketing page" title="PlotPickle home">
        <img className="brand-icon" src="/brand/favicon/plotpickle-icon-128.png" alt="" aria-hidden="true" />
      </button>

      <ShellDivider />

      <nav className="shell-primary-navigation" aria-label="Primary workflow">
        <div className="main-tabs shell-zone-discovery" role="tablist" aria-label="Discovery and pre-production">
          {discovery.map((tab) => <WorkspaceButton key={tab.id} {...tab} activeTab={activeTab} onNavigate={onNavigate} />)}
        </div>
        <ShellDivider />
        <div className="main-tabs shell-zone-production" role="tablist" aria-label="Production and polishing">
          {production.map((tab) => <WorkspaceButton key={tab.id} {...tab} activeTab={activeTab} onNavigate={onNavigate} />)}
        </div>
      </nav>

      <ShellDivider />

      <nav className="main-tabs shell-zone-collaboration" aria-label="Collaboration" role="tablist">
        {collaboration.map((tab) => <WorkspaceButton key={tab.id} {...tab} activeTab={activeTab} onNavigate={onNavigate} />)}
      </nav>

      <ShellDivider />

      <div className="shell-zone-project-actions" aria-label="Project actions">
        {PROJECT_ACTIONS.map((action) => (
          <button type="button" className="text-button" key={action.id} onClick={() => onProjectAction(action.id)}>
            {action.id === "load-afterglow" ? "Load Example" : action.label}
          </button>
        ))}
      </div>

      <ShellDivider />

      <nav className="main-tabs shell-zone-configuration" aria-label="Application configuration" role="tablist">
        {configuration.map((tab) => <WorkspaceButton key={tab.id} {...tab} activeTab={activeTab} onNavigate={onNavigate} />)}
      </nav>
      {activeTab === "settings" ? <button type="button" className="text-button" onClick={() => window.location.assign("/settings/buzz")}>Buzz Setup</button> : null}
    </header>
  );
}
