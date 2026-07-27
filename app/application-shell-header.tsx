"use client";

import { PRODUCT_NAVIGATION, PROJECT_ACTIONS, type ProductNavigationId } from "@/lib/product-direction";

type ProjectActionId = (typeof PROJECT_ACTIONS)[number]["id"];

type ApplicationShellHeaderProps = {
  activeTab: ProductNavigationId;
  onNavigate: (tab: ProductNavigationId) => void;
  onProjectAction: (action: ProjectActionId) => void;
  onOpenLanding: () => void;
};

const orientation = PRODUCT_NAVIGATION.filter((item) => item.zone === "orientation");
const workflow = PRODUCT_NAVIGATION.filter((item) => item.zone === "workflow");
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
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activeTab === id}
      className={activeTab === id ? "active" : ""}
      title={description}
      onClick={() => onNavigate(id)}
    >
      <span>{label}</span>
    </button>
  );
}

export default function ApplicationShellHeader({ activeTab, onNavigate, onProjectAction, onOpenLanding }: ApplicationShellHeaderProps) {
  return (
    <header className="topbar application-shell-header">
      <button type="button" className="brand-lockup home-trigger shell-brand" onClick={onOpenLanding} aria-label="Open the PlotPickle marketing page">
        <img className="brand-icon" src="/brand/favicon/plotpickle-icon-128.png" alt="" aria-hidden="true" />
        <div><strong>PlotPickle</strong><span>PlotPickle Playhouse</span></div>
      </button>

      <nav className="main-tabs shell-zone shell-zone-orientation orientation-tabs" aria-label="Orientation workspace" role="tablist">
        {orientation.map((tab) => <WorkspaceButton key={tab.id} {...tab} activeTab={activeTab} onNavigate={onNavigate} />)}
      </nav>

      <nav className="main-tabs shell-zone shell-zone-workflow" aria-label="Creative workflow" role="tablist">
        {workflow.map((tab) => <WorkspaceButton key={tab.id} {...tab} activeTab={activeTab} onNavigate={onNavigate} />)}
      </nav>

      <div className="shell-zone shell-zone-project-actions" aria-label="Project actions">
        {PROJECT_ACTIONS.map((action) => (
          <button type="button" className={action.id === "load-afterglow" ? "primary-button compact" : "text-button"} key={action.id} onClick={() => onProjectAction(action.id)}>
            {action.label}
          </button>
        ))}
      </div>

      <nav className="main-tabs shell-zone shell-zone-configuration" aria-label="Application configuration" role="tablist">
        {configuration.map((tab) => <WorkspaceButton key={tab.id} {...tab} activeTab={activeTab} onNavigate={onNavigate} />)}
      </nav>
    </header>
  );
}
