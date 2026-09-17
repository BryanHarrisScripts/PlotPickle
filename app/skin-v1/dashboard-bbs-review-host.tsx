"use client";

import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import LibraryWorkspace from "../../modules/library/ui/library-workspace";
import StoryboardPage from "../storyboard/page";
import DashboardBbsPanel, { type DashboardBbsItem } from "./dashboard-bbs-panel";
import HelpIssueLogSkinPanel from "./help-issue-log-skin-panel";
import MatrixStoryMapSurface from "./matrix-story-map-surface";
import NodeShutdownPanel from "./node-shutdown-panel";
import OpenSourceSkinPanel from "./open-source-skin-panel";
import reviewStyles from "./dashboard-bbs-review-host.module.css";

export default function DashboardBbsReviewHost({
  items,
  selectedIndex,
  onActivate,
  onKeyDown,
  onSurfaceNameChange,
  setItemRef,
}: {
  readonly items: readonly DashboardBbsItem[];
  readonly selectedIndex: number;
  readonly onActivate: (index: number) => void;
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => void;
  readonly onSurfaceNameChange: (name: string) => void;
  readonly setItemRef: (index: number, node: HTMLButtonElement | null) => void;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [storyboardOpen, setStoryboardOpen] = useState(false);
  const [openSourceOpen, setOpenSourceOpen] = useState(false);
  const [helpIssueLogOpen, setHelpIssueLogOpen] = useState(false);
  const [shutdownOpen, setShutdownOpen] = useState(false);
  const [dashboardGeneration, setDashboardGeneration] = useState(0);

  useEffect(() => {
    const returnToDashboard = () => {
      setLibraryOpen(false);
      setOutlineOpen(false);
      setStoryboardOpen(false);
      setShutdownOpen(false);
      onSurfaceNameChange("DASHBOARD");
      setDashboardGeneration((generation) => generation + 1);
    };
    window.addEventListener("plotpickle:return-dashboard", returnToDashboard);
    return () => window.removeEventListener("plotpickle:return-dashboard", returnToDashboard);
  }, [onSurfaceNameChange]);

  function restoreDashboardFocus(itemId: string) {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-dashboard-menu-item="${itemId}"]`)?.focus();
    });
  }

  function closeReview(itemId: "library" | "plan") {
    if (itemId === "library") setLibraryOpen(false);
    else setOutlineOpen(false);
    onSurfaceNameChange("DASHBOARD");
    restoreDashboardFocus(itemId);
  }

  function closeStoryboard() {
    setStoryboardOpen(false);
    onSurfaceNameChange("DASHBOARD");
    restoreDashboardFocus("storyboard");
  }

  function closeOpenSource() {
    setOpenSourceOpen(false);
    onSurfaceNameChange("DASHBOARD");
    restoreDashboardFocus("open-source");
  }

  function closeHelpIssueLog() {
    setHelpIssueLogOpen(false);
    onSurfaceNameChange("DASHBOARD");
    restoreDashboardFocus("help");
  }

  function closeShutdown() {
    setShutdownOpen(false);
    onSurfaceNameChange("DASHBOARD");
    restoreDashboardFocus("shutdown");
  }

  function activateItem(index: number) {
    const item = items[index];
    if (!item) return;
    if (item.id === "library") {
      onActivate(index);
      onSurfaceNameChange("LIBRARY");
      setLibraryOpen(true);
      return;
    }
    if (item.id === "plan") {
      onActivate(index);
      onSurfaceNameChange("STORY MAP");
      setOutlineOpen(true);
      return;
    }
    if (item.id === "storyboard") {
      onActivate(index);
      onSurfaceNameChange("STORYBOARD");
      setStoryboardOpen(true);
      return;
    }
    if (item.id === "open-source") {
      onActivate(index);
      onSurfaceNameChange("LICENSING");
      setOpenSourceOpen(true);
      return;
    }
    if (item.id === "help") {
      onActivate(index);
      onSurfaceNameChange("ISSUE LOG");
      setHelpIssueLogOpen(true);
      return;
    }
    if (item.id === "shutdown") {
      onActivate(index);
      onSurfaceNameChange("SHUT DOWN NODE");
      setShutdownOpen(true);
      return;
    }
    onActivate(index);
  }

  if (libraryOpen) {
    return (
      <section
        aria-label="Library"
        data-dashboard-review-surface="library"
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); closeReview("library"); }
        }}
      >
        <div className="pp-skin-v1-bbs-banner">
          <h1>LIBRARY</h1>
          <button autoFocus type="button" className="pp-skin-v1-return" onClick={() => closeReview("library")}>Back to Dashboard</button>
        </div>
        <LibraryWorkspace />
      </section>
    );
  }

  if (outlineOpen) {
    return (
      <section
        className={reviewStyles.reviewSurface}
        aria-label="Story Map"
        data-dashboard-review-surface="outline"
        data-review-state="in-review"
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); closeReview("plan"); }
        }}
      >
        <div className="pp-skin-v1-bbs-banner">
          <h1>STORY MAP</h1>
          <span className={reviewStyles.reviewBadge}>IN REVIEW</span>
          <button autoFocus type="button" className="pp-skin-v1-return" onClick={() => closeReview("plan")}>Back to Dashboard</button>
        </div>
        <MatrixStoryMapSurface />
      </section>
    );
  }

  if (storyboardOpen) {
    return (
      <section
        aria-label="Storyboard pre-production"
        data-dashboard-review-surface="storyboard"
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); closeStoryboard(); }
        }}
      >
        <div className="pp-skin-v1-bbs-banner">
          <h1>STORYBOARD</h1>
          <button autoFocus type="button" className="pp-skin-v1-return" onClick={closeStoryboard}>Back to Dashboard</button>
        </div>
        <StoryboardPage />
      </section>
    );
  }

  if (openSourceOpen) {
    return (
      <section aria-label="Open Source" data-dashboard-review-surface="open-source" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); closeOpenSource(); }
      }}>
        <div className="pp-skin-v1-bbs-banner">
          <h1>LICENSING</h1>
          <button type="button" className="pp-skin-v1-return" onClick={closeOpenSource}>Back to Dashboard</button>
        </div>
        <OpenSourceSkinPanel />
      </section>
    );
  }

  if (helpIssueLogOpen) {
    return (
      <section aria-label="Issue Log" data-dashboard-review-surface="help" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); closeHelpIssueLog(); }
      }}>
        <div className="pp-skin-v1-bbs-banner">
          <h1>ISSUE LOG</h1>
          <button type="button" className="pp-skin-v1-return" onClick={closeHelpIssueLog}>Back to Dashboard</button>
        </div>
        <HelpIssueLogSkinPanel />
      </section>
    );
  }

  if (shutdownOpen) {
    return (
      <div onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); closeShutdown(); }
      }}>
        <NodeShutdownPanel onCancel={closeShutdown} />
      </div>
    );
  }

  return (
    <div className={reviewStyles.reviewHost}>
      <DashboardBbsPanel
        key={dashboardGeneration}
        items={items}
        selectedIndex={selectedIndex}
        onActivate={activateItem}
        onKeyDown={onKeyDown}
        onSurfaceNameChange={onSurfaceNameChange}
        setItemRef={setItemRef}
      />
    </div>
  );
}
