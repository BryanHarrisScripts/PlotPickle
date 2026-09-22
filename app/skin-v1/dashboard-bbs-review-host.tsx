"use client";

import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { loadFoundationProject } from "../../core/storage/foundation-project-browser";
import { hydratedStoryMapContext, persistStoryMapContext } from "../../core/storage/profile-private-browser";
import { hasActiveLibraryProject, loadActiveLibraryProject, PROJECT_LIBRARY_CHANGED_EVENT } from "../../core/storage/project-library-browser";
import type { LibraryPPFProject } from "../../core/storage/library-project";
import LibraryWorkspace from "../../modules/library/ui/library-workspace";
import BlockVisualJourneyWorkspace from "./block-visual-journey-workspace";
import DiscoverySurface from "./discovery-surface";
import DashboardBbsPanel, { type DashboardBbsItem } from "./dashboard-bbs-panel";
import HelpIssueLogSkinPanel from "./help-issue-log-skin-panel";
import MatrixStoryMapSurface, { type StoryMapReviewStage } from "./matrix-story-map-surface";
import NodeShutdownPanel from "./node-shutdown-panel";
import OpenSourceSkinPanel from "./open-source-skin-panel";
import StoryBibleSurface from "./story-bible-surface";
import {
  SkinV1BuildReviewSurface,
  SkinV1PrevisReviewSurface,
  SkinV1ProductionReviewSurface,
  SkinV1StoryboardReviewSurface,
  SkinV1TimelineReviewSurface,
  type PreproductionReviewAddress,
} from "./preproduction-review-surfaces";
import reviewStyles from "./dashboard-bbs-review-host.module.css";

const DEFAULT_REVIEW_ADDRESS: PreproductionReviewAddress = { blockNumber: 1, miniBlockNumber: 1 };

function boundedReviewValue(value: string | null, maximum: number) {
  const number = Number(value || 1);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(1, Math.trunc(number))) : 1;
}

function initialReviewAddress(): PreproductionReviewAddress {
  if (typeof window === "undefined") return DEFAULT_REVIEW_ADDRESS;
  const query = new URLSearchParams(window.location.search);
  return {
    blockNumber: boundedReviewValue(query.get("block"), 24),
    miniBlockNumber: boundedReviewValue(query.get("mini"), 4),
  };
}

type BuildReturnTarget = "outline" | "storyboard" | "previs";
type PreproductionStage = "outline" | "storyboard" | "previs" | "timeline" | "production";

const PREPRODUCTION_STAGES: readonly Readonly<{ id: PreproductionStage; label: string; shortcut: string }>[] = [
  { id: "outline", label: "Outline", shortcut: "O" },
  { id: "storyboard", label: "Storyboard", shortcut: "S" },
  { id: "previs", label: "Previs", shortcut: "P" },
  { id: "timeline", label: "Timeline", shortcut: "T" },
  { id: "production", label: "Production", shortcut: "D" },
];

function PreproductionStageRail({
  active,
  onOpen,
}: {
  readonly active: PreproductionStage;
  readonly onOpen: (stage: PreproductionStage) => void;
}) {
  return (
    <nav
      aria-label="Pre-production stages"
      className="pp-skin-v1-preproduction-stage-rail"
      data-preproduction-stage-rail="five-stage"
      data-horizontal-directory-reference="library"
      onKeyDown={(event) => {
        if (event.key.length !== 1) return;
        const shortcut = event.key.toUpperCase();
        const stage = PREPRODUCTION_STAGES.find((candidate) => candidate.shortcut === shortcut);
        if (!stage) return;
        event.preventDefault();
        onOpen(stage.id);
      }}
    >
      {PREPRODUCTION_STAGES.map((stage) => (
        <button
          aria-current={stage.id === active ? "step" : undefined}
          aria-keyshortcuts={stage.shortcut}
          data-preproduction-stage={stage.id}
          data-preproduction-shortcut={stage.shortcut}
          key={stage.id}
          onClick={() => onOpen(stage.id)}
          type="button"
        >
          <span aria-hidden="true">[{stage.shortcut}] </span>{stage.label}
        </button>
      ))}
    </nav>
  );
}

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
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [discoveryProject, setDiscoveryProject] = useState<LibraryPPFProject | null>(null);
  const [storyBibleOpen, setStoryBibleOpen] = useState(false);
  const [storyBibleProject, setStoryBibleProject] = useState<LibraryPPFProject | null>(null);
  const [dashboardNotice, setDashboardNotice] = useState("");
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [storyboardOpen, setStoryboardOpen] = useState(false);
  const [previsOpen, setPrevisOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [productionOpen, setProductionOpen] = useState(false);
  const [reviewAddress, setReviewAddress] = useState<PreproductionReviewAddress>(() => initialReviewAddress());
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
    setTimelineOpen(false);
    setProductionOpen(false);
  }

  function rememberPreproductionContext(
    stage: PreproductionStage | "build",
    address: PreproductionReviewAddress,
  ) {
    try {
      const project = loadFoundationProject();
      const previous = hydratedStoryMapContext(project.id);
      void persistStoryMapContext(project.id, {
        blockNumber: address.blockNumber,
        miniBlockNumber: address.miniBlockNumber,
        stage,
        ...(previous?.passageId ? { passageId: previous.passageId } : {}),
      }).catch(() => undefined);
    } catch {
      // The stage can still open without a loaded project; the canonical surface will report that state.
    }
  }

  function updateReviewAddress(stage: PreproductionStage, address: PreproductionReviewAddress) {
    setReviewAddress(address);
    rememberPreproductionContext(stage, address);
  }

  useEffect(() => {
    const returnToDashboard = () => {
      setLibraryOpen(false);
      setDiscoveryOpen(false);
      setDiscoveryProject(null);
      setStoryBibleOpen(false);
      setStoryBibleProject(null);
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

  useEffect(() => {
    const refreshStoryBible = () => {
      if (!storyBibleOpen) return;
      if (!hasActiveLibraryProject()) {
        setStoryBibleOpen(false);
        setStoryBibleProject(null);
        setDashboardNotice("Please load a story.");
        onSurfaceNameChange("DASHBOARD");
        return;
      }
      setStoryBibleProject(loadActiveLibraryProject());
    };
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refreshStoryBible);
    return () => window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refreshStoryBible);
  }, [onSurfaceNameChange, storyBibleOpen]);

  useEffect(() => {
    const refreshDiscovery = () => {
      if (!discoveryOpen) return;
      setDiscoveryProject(hasActiveLibraryProject() ? loadActiveLibraryProject() : null);
    };
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refreshDiscovery);
    return () => window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refreshDiscovery);
  }, [discoveryOpen]);

  function restoreDashboardFocus(itemId: string) {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-dashboard-menu-item="${itemId}"]`)?.focus();
    });
  }

  function returnDashboard(itemId?: string) {
    setDiscoveryOpen(false);
    setDiscoveryProject(null);
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
    if (stage === "outline") {
      openOutline(address);
      return;
    }
    if (stage === "build") {
      openBuild(address, "outline");
      return;
    }
    openStoryboard(address);
  }

  function openStoryboard(address: PreproductionReviewAddress = reviewAddress) {
    updateReviewAddress("storyboard", address);
    closePreproductionSurfaces();
    setStoryboardOpen(true);
    onSurfaceNameChange("STORYBOARD");
  }

  function openPrevis(address: PreproductionReviewAddress = reviewAddress) {
    updateReviewAddress("previs", address);
    closePreproductionSurfaces();
    setPrevisOpen(true);
    onSurfaceNameChange("PREVIS");
  }

  function openTimeline(address: PreproductionReviewAddress = reviewAddress) {
    updateReviewAddress("timeline", address);
    closePreproductionSurfaces();
    setTimelineOpen(true);
    onSurfaceNameChange("TIMELINE");
  }

  function openProduction(address: PreproductionReviewAddress = reviewAddress) {
    updateReviewAddress("production", address);
    closePreproductionSurfaces();
    setProductionOpen(true);
    onSurfaceNameChange("PRODUCTION");
  }

  function openPreproductionStage(
    stage: PreproductionStage,
    address: PreproductionReviewAddress = reviewAddress,
  ) {
    if (stage === "outline") return openOutline(address);
    if (stage === "storyboard") return openStoryboard(address);
    if (stage === "previs") return openPrevis(address);
    if (stage === "timeline") return openTimeline(address);
    return openProduction(address);
  }

  function openBuild(
    address: PreproductionReviewAddress = reviewAddress,
    returnTarget: BuildReturnTarget = "outline",
  ) {
    setReviewAddress(address);
    rememberPreproductionContext("build", address);
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
    updateReviewAddress("outline", address);
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
    setDashboardNotice("");
    if (item.id === "discovery") {
      onActivate(index);
      setDiscoveryProject(hasActiveLibraryProject() ? loadActiveLibraryProject() : null);
      setDiscoveryOpen(true);
      onSurfaceNameChange("DISCOVERY");
      return;
    }
    if (item.id === "library") {
      onActivate(index);
      onSurfaceNameChange("LIBRARY");
      setLibraryOpen(true);
      return;
    }
    if (item.id === "pitch-package") {
      onActivate(index);
      window.location.assign("/pitch-review?scope=pitch&return=dashboard");
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
    if (item.id === "timeline") {
      onActivate(index);
      openTimeline(reviewAddress);
      return;
    }
    if (item.id === "production") {
      onActivate(index);
      openProduction(reviewAddress);
      return;
    }
    if (item.id === "story-bible") {
      onActivate(index);
      if (!hasActiveLibraryProject()) {
        setDashboardNotice("Please load a story.");
        onSurfaceNameChange("DASHBOARD");
        return;
      }
      setStoryBibleProject(loadActiveLibraryProject());
      setStoryBibleOpen(true);
      onSurfaceNameChange("STORY");
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

  if (discoveryOpen) {
    return (
      <section
        aria-label="Discovery"
        data-dashboard-review-surface="discovery"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            returnDashboard("discovery");
          }
        }}
      >
        <div className="pp-skin-v1-bbs-banner">
          <h1>DISCOVERY</h1>
          <button autoFocus type="button" className="pp-skin-v1-return" onClick={() => returnDashboard("discovery")}>Back to Dashboard</button>
        </div>
        <DiscoverySurface project={discoveryProject} />
      </section>
    );
  }

  if (storyBibleOpen && storyBibleProject) {
    return (
      <section
        aria-label="Story"
        data-dashboard-review-surface="story-bible"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setStoryBibleOpen(false);
            setStoryBibleProject(null);
            onSurfaceNameChange("DASHBOARD");
            restoreDashboardFocus("story-bible");
          }
        }}
      >
        <div className="pp-skin-v1-bbs-banner">
          <h1>STORY</h1>
          <button
            autoFocus
            type="button"
            className="pp-skin-v1-return"
            onClick={() => {
              setStoryBibleOpen(false);
              setStoryBibleProject(null);
              onSurfaceNameChange("DASHBOARD");
              restoreDashboardFocus("story-bible");
            }}
          >Back to Dashboard</button>
        </div>
        <StoryBibleSurface project={storyBibleProject} />
      </section>
    );
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
        <PreproductionStageRail active="outline" onOpen={(stage) => openPreproductionStage(stage, reviewAddress)} />
        <BlockVisualJourneyWorkspace
          address={reviewAddress}
          stage="outline"
          onAddressChange={(address) => updateReviewAddress("outline", address)}
        />
        <MatrixStoryMapSurface
          onAddressChange={(address) => updateReviewAddress("outline", address)}
          onOpenStage={openStoryMapStage}
          onOpenPrevis={openPrevis}
          onOpenStoryModeSettings={openStoryModeSettings}
        />
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
        <PreproductionStageRail active="storyboard" onOpen={(stage) => openPreproductionStage(stage, reviewAddress)} />
        <BlockVisualJourneyWorkspace
          address={reviewAddress}
          stage="storyboard"
          onAddressChange={(address) => updateReviewAddress("storyboard", address)}
        />
        <SkinV1StoryboardReviewSurface
          address={reviewAddress}
          onAddressChange={(address) => updateReviewAddress("storyboard", address)}
          onOpenBuild={() => openBuild(reviewAddress, "storyboard")}
        />
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
        <PreproductionStageRail active="previs" onOpen={(stage) => openPreproductionStage(stage, reviewAddress)} />
        <BlockVisualJourneyWorkspace
          address={reviewAddress}
          stage="previs"
          onAddressChange={(address) => updateReviewAddress("previs", address)}
        />
        <SkinV1PrevisReviewSurface
          address={reviewAddress}
          onAddressChange={(address) => updateReviewAddress("previs", address)}
          onOpenStoryboard={openStoryboard}
          onOpenBuild={() => openBuild(reviewAddress, "previs")}
        />
      </section>
    );
  }

  if (timelineOpen) {
    return (
      <section
        aria-label="Timeline pre-production"
        data-dashboard-review-surface="timeline"
        data-review-state="in-review"
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); returnDashboard("timeline"); }
        }}
      >
        <div className="pp-skin-v1-bbs-banner">
          <h1>TIMELINE</h1>
          <span className={reviewStyles.reviewBadge}>IN REVIEW</span>
          <button autoFocus type="button" className="pp-skin-v1-return" onClick={() => returnDashboard("timeline")}>Back to Dashboard</button>
        </div>
        <PreproductionStageRail active="timeline" onOpen={(stage) => openPreproductionStage(stage, reviewAddress)} />
        <BlockVisualJourneyWorkspace
          address={reviewAddress}
          stage="timeline"
          onAddressChange={(address) => updateReviewAddress("timeline", address)}
        />
        <SkinV1TimelineReviewSurface
          address={reviewAddress}
          onAddressChange={(address) => updateReviewAddress("timeline", address)}
          onOpenStoryboard={openStoryboard}
        />
      </section>
    );
  }

  if (productionOpen) {
    return (
      <section
        aria-label="Production pre-production"
        data-dashboard-review-surface="production"
        data-review-state="in-review"
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); returnDashboard("production"); }
        }}
      >
        <div className="pp-skin-v1-bbs-banner">
          <h1>PRODUCTION</h1>
          <span className={reviewStyles.reviewBadge}>IN REVIEW</span>
          <button autoFocus type="button" className="pp-skin-v1-return" onClick={() => returnDashboard("production")}>Back to Dashboard</button>
        </div>
        <PreproductionStageRail active="production" onOpen={(stage) => openPreproductionStage(stage, reviewAddress)} />
        <BlockVisualJourneyWorkspace
          address={reviewAddress}
          stage="production"
          onAddressChange={(address) => updateReviewAddress("production", address)}
        />
        <SkinV1ProductionReviewSurface
          address={reviewAddress}
          onAddressChange={(address) => updateReviewAddress("production", address)}
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
        notice={dashboardNotice}
      />
    </div>
  );
}
