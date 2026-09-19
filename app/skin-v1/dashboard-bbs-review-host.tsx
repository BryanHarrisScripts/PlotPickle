"use client";

import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import LibraryWorkspace from "../../modules/library/ui/library-workspace";
import DashboardBbsPanel, { type DashboardBbsItem } from "./dashboard-bbs-panel";
import HelpIssueLogSkinPanel from "./help-issue-log-skin-panel";
import MatrixStoryMapSurface, { type StoryMapReviewStage } from "./matrix-story-map-surface";
import NodeShutdownPanel from "./node-shutdown-panel";
import OpenSourceSkinPanel from "./open-source-skin-panel";
import {
  SkinV1BuildReviewSurface,
  SkinV1PrevisReviewSurface,
  SkinV1StoryboardReviewSurface,
  type PreproductionReviewAddress,
} from "./preproduction-review-surfaces";
import reviewStyles from "./dashboard-bbs-review-host.module.css";

const DEFAULT_REVIEW_ADDRESS: PreproductionReviewAddress = { blockNumber: 1, miniBlockNumber: 1 };
type BuildReturnTarget = "outline" | "storyboard" | "previs";

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
  const [buildOpen, setBuildOpen] = useState(false);
  const [storyboardOpen, setStoryboardOpen] = useState(false);
  const [previsOpen, setPrevisOpen] = useState(false);
  const [reviewAddress, setReviewAddress] = useState<PreproductionReviewAddress>(DEFAULT_REVIEW_ADDRESS);
  const [buildReturnTarget, setBuildReturnTarget] = useState<BuildReturnTarget>("outline");
  const [openSourceOpen, setOpenSourceOpen] = useState(false);
  const [helpIssueLogOpen, setHelpIssueLogOpen] = useState(false);
  const [shutdownOpen, setShutdownOpen] = useState(false);
  const [dashboardGeneration, setDashboardGeneration] = useState(0);

  function closePreproductionSurfaces() {
    setOutlineOpen(false);
    setBuildOpen(false);
    setStoryboardOpen(false);
    setPrevisOpen(false);
  }

  useEffect(() => {
    const returnToDashboard = () => {
      setLibraryOpen(false);
      closePreproductionSurfaces();
      setOpenSourceOpen(false);
      setHelpIssueLogOpen(false);
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

  function returnDashboard(itemId?: string) {
    closePreproductionSurfaces();
    onSurfaceNameChange("DASHBOARD");
    if (itemId) restoreDashboardFocus(itemId);
  }

  function closeReview(itemId: "library" | "plan") {
    if (itemId === "library") setLibraryOpen(false);
    else setOutlineOpen(false);
    onSurfaceNameChange("DASHBOARD");
    restoreDashboardFocus(itemId);
  }

  function openStoryMapStage(stage: StoryMapReviewStage, address: PreproductionReviewAddress) {
    setReviewAddress(address);
    closePreproductionSurfaces();
    if (stage === "outline") {
      setOutlineOpen(true);
      onSurfaceNameChange("STORY MAP");
      return;
    }
    if (stage === "build") {
      openBuild(address, "outline");
      return;
    }
    setStoryboardOpen(true);
    onSurfaceNameChange("STORYBOARD");
  }

  function openStoryboard(address: PreproductionReviewAddress = reviewAddress) {
    setReviewAddress(address);
    closePreproductionSurfaces();
    setStoryboardOpen(true);
    onSurfaceNameChange("STORYBOARD");
  }

  function openPrevis(address: PreproductionReviewAddress = reviewAddress) {
    setReviewAddress(address);
    closePreproductionSurfaces();
    setPrevisOpen(true);
    onSurfaceNameChange("PREVIS");
  }

  function openBuild(
    address: PreproductionReviewAddress = reviewAddress,
    returnTarget: BuildReturnTarget = "outline",
  ) {
    setReviewAddress(address);
    setBuildReturnTarget(returnTarget);
    closePreproductionSurfaces();
    setBuildOpen(true);
    onSurfaceNameChange("BUILD EVIDENCE");
  }

  function returnFromBuild() {
    if (buildReturnTarget === "storyboard") {
      openStoryboard(reviewAddress);
      return;
    }
    if (buildReturnTarget === "previs") {
      openPrevis(reviewAddress);
      return;
    }
    openOutline(reviewAddress);
  }

  const buildReturnLabel = buildReturnTarget === "storyboard"
    ? "Storyboard"
    : buildReturnTarget === "previs"
      ? "Previs"
      : "Outline";

  function openOutline(address: PreproductionReviewAddress = reviewAddress) {
    setReviewAddress(address);
    closePreproductionSurfaces();
    setOutlineOpen(true);
    onSurfaceNameChange("STORY MAP");
  }

  function openStoryModeSettings() {
    closePreproductionSurfaces();
    onSurfaceNameChange("DASHBOARD");
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>("[data-dashboard-menu-item='settings']")?.click();
      window.setTimeout(() => {
        document.querySelector<HTMLButtonElement>("[data-settings-secondary-item='story-mode']")?.click();
      }, 0);
    });
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
      openOutline(reviewAddress);
      return;
    }
    if (item.id === "storyboard") {
      onActivate(index);
      openStoryboard(reviewAddress);
      return;
    }
    if (item.id === "previs") {
      onActivate(index);
      openPrevis(reviewAddress);
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
        <MatrixStoryMapSurface onOpenStage={openStoryMapStage} onOpenPrevis={openPrevis} onOpenStoryModeSettings={openStoryModeSettings} />
      </section>
    );
  }

  if (buildOpen) {
    return (
      <section
        aria-label="Build evidence"
        data-dashboard-review-surface="build"
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); returnFromBuild(); }
        }}
      >
        <div className="pp-skin-v1-bbs-banner">
          <h1>BUILD EVIDENCE</h1>
          <button autoFocus type="button" className="pp-skin-v1-return" onClick={returnFromBuild}>Back to {buildReturnLabel}</button>
        </div>
        <SkinV1BuildReviewSurface
          address={reviewAddress}
          onOpenDashboard={() => returnDashboard(buildReturnTarget === "storyboard" ? "storyboard" : buildReturnTarget === "previs" ? "previs" : "plan")}
          onOpenOutline={() => openOutline(reviewAddress)}
          onReturn={returnFromBuild}
          returnLabel={buildReturnLabel}
        />
      </section>
    );
  }

  if (storyboardOpen) {
    return (
      <section
        aria-label="Storyboard pre-production"
        data-dashboard-review-surface="storyboard"
        data-review-state="in-review"
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); returnDashboard("storyboard"); }
        }}
      >
        <div className="pp-skin-v1-bbs-banner">
          <h1>STORYBOARD</h1>
          <span className={reviewStyles.reviewBadge}>IN REVIEW</span>
          <button autoFocus type="button" className="pp-skin-v1-return" onClick={() => returnDashboard("storyboard")}>Back to Dashboard</button>
        </div>
        <SkinV1StoryboardReviewSurface
          address={reviewAddress}
          onAddressChange={setReviewAddress}
          onOpenBuild={() => openBuild(reviewAddress, "storyboard")}
        />
        <div className="pp-skin-v1-preproduction-handoff">
          <button type="button" onClick={() => openPrevis(reviewAddress)}>Continue to Previs</button>
        </div>
      </section>
    );
  }

  if (previsOpen) {
    return (
      <section
        aria-label="Previs pre-production"
        data-dashboard-review-surface="previs"
        data-review-state="in-review"
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); returnDashboard("previs"); }
        }}
      >
        <div className="pp-skin-v1-bbs-banner">
          <h1>PREVIS</h1>
          <span className={reviewStyles.reviewBadge}>IN REVIEW</span>
          <button autoFocus type="button" className="pp-skin-v1-return" onClick={() => returnDashboard("previs")}>Back to Dashboard</button>
        </div>
        <SkinV1PrevisReviewSurface
          address={reviewAddress}
          onAddressChange={setReviewAddress}
          onOpenStoryboard={openStoryboard}
          onOpenBuild={() => openBuild(reviewAddress, "previs")}
        />
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
