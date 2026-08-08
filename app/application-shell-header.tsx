"use client";

import { useEffect } from "react";
import { PRODUCT_NAVIGATION, PROJECT_ACTIONS, type ProductNavigationId } from "@/lib/product-direction";
import { SUPPORT_NAVIGATION } from "@/lib/support-navigation";

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
      onClick={() => onNavigate(id)}
    >
      <span>{label}</span>
    </button>
  );
}

function ShellDivider() {
  return <hr className="shell-divider" aria-hidden="true" />;
}

export default function ApplicationShellHeader({ activeTab, onNavigate, onProjectAction, onOpenLanding }: ApplicationShellHeaderProps) {
  useEffect(() => {
    const handleWorkspaceNavigation = (event: Event) => {
      const requested = (event as CustomEvent<unknown>).detail;
      if (typeof requested !== "string") return;
      const workspace = PRODUCT_NAVIGATION.find((item) => item.id === requested);
      if (workspace) onNavigate(workspace.id);
    };
    window.addEventListener("plotpickle:navigate-workspace", handleWorkspaceNavigation);
    return () => window.removeEventListener("plotpickle:navigate-workspace", handleWorkspaceNavigation);
  }, [onNavigate]);

  const activeAutomationLabel = activeTab === "pitch"
    ? "Pitch"
    : PRODUCT_NAVIGATION.find((item) => item.id === activeTab)?.label ?? "";

  return (
    <header className="topbar application-shell-header" aria-label="PlotPickle application navigation and project actions">
      <button type="button" className="brand-lockup home-trigger shell-brand" onClick={onOpenLanding} aria-label="Open the PlotPickle marketing page" title="PlotPickle home">
        <img className="brand-icon" src="/brand/favicon/plotpickle-icon-128.png" alt="" aria-hidden="true" />
        <span className="studio-brand-copy">
          <strong>PlotPickle</strong>
          <small>Visual Writing Studio</small>
        </span>
      </button>

      <ShellDivider />

      <nav className="shell-primary-navigation" aria-label="Story workflow">
        <div className="main-tabs shell-zone-discovery" aria-label="Discovery and pre-production">
          {discovery.map((tab) => <WorkspaceButton key={tab.id} {...tab} activeTab={activeTab} onNavigate={onNavigate} />)}
        </div>
        <ShellDivider />
        <div className="main-tabs shell-zone-production" aria-label="Production and polishing">
          {production.map((tab) => <WorkspaceButton key={tab.id} {...tab} activeTab={activeTab} onNavigate={onNavigate} />)}
        </div>
      </nav>

      <ShellDivider />

      <nav className="main-tabs shell-zone-collaboration" aria-label="Collaboration">
        {collaboration.map((tab) => <WorkspaceButton key={tab.id} {...tab} activeTab={activeTab} onNavigate={onNavigate} />)}
      </nav>

      <ShellDivider />

      <div className="shell-zone-project-actions" role="group" aria-label="Project actions">
        {PROJECT_ACTIONS.map((action) => (
          <button
            type="button"
            className="text-button"
            data-project-action={action.id}
            key={action.id}
            onClick={() => onProjectAction(action.id)}
          >
            {action.id === "load-afterglow" ? "Load Example" : action.label}
          </button>
        ))}
      </div>

      <ShellDivider />

      <nav className="main-tabs shell-zone-configuration" aria-label="Support and application configuration">
        {SUPPORT_NAVIGATION.map((item) => (
          <a className="text-button" key={item.id} href={item.href} title={item.description}>
            {item.label}
          </a>
        ))}
        {configuration.map((tab) => <WorkspaceButton key={tab.id} {...tab} activeTab={activeTab} onNavigate={onNavigate} />)}
      </nav>

      <span
        className="shell-release-smoke-active"
        role="tab"
        aria-selected="true"
        aria-hidden="true"
        data-release-smoke-active-workspace={activeTab}
      >
        {activeAutomationLabel}
      </span>

      <button
        hidden
        aria-hidden="true"
        type="button"
        data-legacy-workspace-label="pitch"
        onClick={() => onNavigate("pitch")}
      >
        Pitch
      </button>
    </header>
  );
}