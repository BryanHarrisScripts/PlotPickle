"use client";

import { authenticatedComputeFetch as fetch } from "../../core/auth/profile-request-browser";

import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import CloudStoryModeHost from "./cloud-story-mode-host";
import LocalAiSkinHost from "./local-ai-skin-host";
import HybridStoryModePanel from "./hybrid-story-mode-panel";
import MenuFeedbackFooter from "./menu-feedback-footer";

export type StoryModePolicy = "local" | "cloud" | "hybrid";
type StoryModeView = "landing" | StoryModePolicy;

type RouteStatus = {
  readonly configured?: boolean;
  readonly ready?: boolean;
  readonly locality?: string;
};

type CapabilityStatus = {
  readonly selected?: string;
  readonly options?: Readonly<Record<string, RouteStatus>>;
};

type AiRoutingStatus = {
  readonly ok?: boolean;
  readonly text?: CapabilityStatus;
  readonly image?: CapabilityStatus;
  readonly video?: CapabilityStatus;
};


type StoryModePolicyResponse = {
  readonly ok?: boolean;
  readonly mode?: StoryModePolicy;
  readonly message?: string;
};

const STORY_MODE_ROWS = [
  {
    mode: "local",
    shortcut: "L",
    label: "LOCAL",
    description: "Local-first Story compute and generation",
  },
  {
    mode: "cloud",
    shortcut: "C",
    label: "CLOUD",
    description: "Explicit cloud Story connections",
  },
  {
    mode: "hybrid",
    shortcut: "H",
    label: "HYBRID",
    description: "Route across Local and Cloud capabilities",
  },
] as const;

type LocalityCoverage = { readonly configured: number; readonly ready: number; readonly total: number };

function localityCoverage(status: AiRoutingStatus | null, locality: "local" | "cloud"): LocalityCoverage {
  const capabilities = status ? [status.text, status.image, status.video] : [];
  let configured = 0;
  let ready = 0;
  for (const capability of capabilities) {
    const routes = Object.values(capability?.options ?? {}).filter((route) => route.locality === locality);
    if (routes.some((route) => route.ready === true || Boolean((route as RouteStatus & { configured?: boolean }).configured))) configured += 1;
    if (routes.some((route) => route.ready === true)) ready += 1;
  }
  return { configured, ready, total: 3 };
}

function hybridSelectionReady(status: AiRoutingStatus | null) {
  if (!status) return false;
  const selected = [status.text, status.image, status.video].map((capability) => {
    const route = capability?.selected ? capability.options?.[capability.selected] : null;
    return route?.ready === true && (route.locality === "local" || route.locality === "cloud")
      ? route.locality
      : null;
  });
  return selected.every(Boolean);
}


function readinessLabel(ready: boolean, loaded: boolean) {
  if (!loaded) return "CHECKING";
  return ready ? "READY" : "NOT READY";
}

function readinessState(ready: boolean, loaded: boolean) {
  if (!loaded) return "checking";
  return ready ? "ready" : "not-ready";
}

function coverageLabel(coverage: LocalityCoverage, loaded: boolean) {
  if (!loaded) return "CHECKING";
  if (coverage.ready === coverage.total) return `${coverage.ready}/${coverage.total} READY`;
  if (coverage.ready > 0) return `${coverage.ready}/${coverage.total} READY`;
  if (coverage.configured > 0) return `${coverage.configured}/${coverage.total} CONFIGURED`;
  return "NOT SET UP";
}

function StoryModeReadiness({
  localCoverage,
  cloudCoverage,
  hybridReady,
  loaded,
  mode,
}: {
  readonly localCoverage: LocalityCoverage;
  readonly cloudCoverage: LocalityCoverage;
  readonly hybridReady: boolean;
  readonly loaded: boolean;
  readonly mode: StoryModePolicy;
}) {
  const statuses = [
    { label: "LOCAL", ready: localCoverage.ready === localCoverage.total, value: coverageLabel(localCoverage, loaded) },
    { label: "CLOUD", ready: cloudCoverage.ready === cloudCoverage.total, value: coverageLabel(cloudCoverage, loaded) },
    { label: "HYBRID", ready: hybridReady, value: readinessLabel(hybridReady, loaded) },
  ] as const;

  return (
    <div className="pp-skin-v1-story-mode-readiness" aria-label="Story Mode status" data-story-mode-status="derived">
      {statuses.map((status) => (
        <span key={status.label} data-story-mode-readiness={readinessState(status.ready, loaded)}>
          <i aria-hidden="true" />
          <strong>{status.label}</strong>: {status.value}
        </span>
      ))}
      <span data-story-mode-active-policy={mode}><strong>MODE</strong>: {mode.toUpperCase()}</span>
    </div>
  );
}

export default function StoryModeHost({
  initialView = "landing",
  onReturnToSettings,
}: {
  readonly initialView?: StoryModeView;
  readonly onReturnToSettings?: () => void;
} = {}) {
  const [view, setView] = useState<StoryModeView>(initialView);
  const [mode, setMode] = useState<StoryModePolicy>("hybrid");
  const [routingStatus, setRoutingStatus] = useState<AiRoutingStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("Loading Story Mode readiness...");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const localCoverage = localityCoverage(routingStatus, "local");
  const cloudCoverage = localityCoverage(routingStatus, "cloud");
  const localReady = localCoverage.ready === localCoverage.total;
  const cloudReady = cloudCoverage.ready === cloudCoverage.total;
  const hybridReady = hybridSelectionReady(routingStatus);

  const refresh = useCallback(async () => {
    try {
      const [policyResponse, routingResponse] = await Promise.all([
        fetch("/api/story-mode/policy", { cache: "no-store" }),
        fetch("/api/ai-routing/status", { cache: "no-store" }),
        fetch("/api/local-ai/runtime", { cache: "no-store" }).catch(() => null),
      ]);
      const policy = await policyResponse.json() as StoryModePolicyResponse;
      const routing = await routingResponse.json() as AiRoutingStatus & { readonly message?: string };
      if (!policyResponse.ok || !policy.ok || !policy.mode) throw new Error(policy.message || "Story Mode policy is unavailable.");
      if (!routingResponse.ok || !routing.ok) throw new Error(routing.message || "Story Mode readiness is unavailable.");
      setMode(policy.mode);
      setRoutingStatus(routing);
      setMessage("LOCAL and CLOUD report the capability setup actually detected in each system area. HYBRID is READY only when the selected Writing, Images and Video mix is tested and uses both Local and Cloud.");
    } catch (error) {
      setRoutingStatus(null);
      setMessage(error instanceof Error ? error.message : "Story Mode readiness is unavailable.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const handleRefresh = () => { void refresh(); };
    handleRefresh();
    window.addEventListener("plotpickle:setup-status-refresh", handleRefresh);
    window.addEventListener("plotpickle:connection-status-refresh", handleRefresh);
    return () => {
      window.removeEventListener("plotpickle:setup-status-refresh", handleRefresh);
      window.removeEventListener("plotpickle:connection-status-refresh", handleRefresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (initialView === "landing") return;
    setView(initialView);
    void activate(initialView);
  }, [initialView]);

  useEffect(() => {
    const returnToSurface = (event: Event) => {
      const detail = (event as CustomEvent<{ parentSurface?: string }>).detail;
      if (detail?.parentSurface === "story-mode") setView("landing");
    };
    window.addEventListener("plotpickle:return-surface", returnToSurface);
    return () => window.removeEventListener("plotpickle:return-surface", returnToSurface);
  }, []);

  function returnFromMode() {
    if (onReturnToSettings) {
      onReturnToSettings();
      return;
    }
    setView("landing");
  }

  function selectIndex(index: number) {
    const normalized = (index + STORY_MODE_ROWS.length) % STORY_MODE_ROWS.length;
    setSelectedIndex(normalized);
    window.requestAnimationFrame(() => itemRefs.current[normalized]?.focus());
  }

  async function activate(nextMode: StoryModePolicy) {
    setView(nextMode);
    setMessage(nextMode === "hybrid" ? "Hybrid controls capability routing." : `${nextMode.toUpperCase()} configures and verifies resources. Route selection stays in Hybrid.`);
    void refresh();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key.length === 1) {
      const shortcut = event.key.toUpperCase();
      const shortcutIndex = STORY_MODE_ROWS.findIndex((item) => item.shortcut === shortcut);
      if (shortcutIndex >= 0) {
        event.preventDefault();
        selectIndex(shortcutIndex);
        void activate(STORY_MODE_ROWS[shortcutIndex].mode);
        return;
      }
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectIndex(index + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectIndex(index - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      selectIndex(STORY_MODE_ROWS.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void activate(STORY_MODE_ROWS[index].mode);
    }
  }

  if (view === "local") {
    return (
      <section aria-label="Local Story Mode setup" data-story-mode-view="local" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); returnFromMode(); }
      }}>
        <div className="pp-skin-v1-bbs-banner">
          <h1>LOCAL</h1>
          <button type="button" className="pp-skin-v1-return" onClick={returnFromMode}>{onReturnToSettings ? "Back to Settings" : "Back to Story Mode"}</button>
        </div>
        <LocalAiSkinHost />
      </section>
    );
  }

  if (view === "cloud") {
    return (
      <section aria-label="Cloud Story Mode setup" data-story-mode-view="cloud" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); returnFromMode(); }
      }}>
        <div className="pp-skin-v1-bbs-banner">
          <h1>CLOUD</h1>
          <button type="button" className="pp-skin-v1-return" onClick={returnFromMode}>{onReturnToSettings ? "Back to Settings" : "Back to Story Mode"}</button>
        </div>
        <CloudStoryModeHost />
      </section>
    );
  }

  if (view === "hybrid") {
    return (
      <section aria-label="Hybrid Story Mode" data-story-mode-view="hybrid" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); returnFromMode(); }
      }}>
        <div className="pp-skin-v1-bbs-banner">
          <h1>HYBRID</h1>
          <button type="button" className="pp-skin-v1-return" onClick={returnFromMode}>{onReturnToSettings ? "Back to Settings" : "Back to Story Mode"}</button>
        </div>
        <StoryModeReadiness localCoverage={localCoverage} cloudCoverage={cloudCoverage} hybridReady={hybridReady} loaded={loaded} mode={mode} />
        <HybridStoryModePanel onChanged={() => void refresh()} />
      </section>
    );
  }

  return (
    <section
      className="pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs"
      aria-label="Story Mode directory"
      data-story-mode-parent="true"
      data-skin-menu="story-mode"
    >
      <div className="pp-skin-v1-bbs" data-skin-reference-panel="standard">
        <div className="pp-skin-v1-dashboard-title" data-skin-v1-local-chrome="decorative-title">*** STORY MODE ***</div>
        <StoryModeReadiness localCoverage={localCoverage} cloudCoverage={cloudCoverage} hybridReady={hybridReady} loaded={loaded} mode={mode} />

        <div className="pp-skin-v1-menu pp-skin-v1-dashboard-menu" role="listbox" aria-label="Story Mode policies" aria-describedby="story-mode-status-message">
          {STORY_MODE_ROWS.map((item, index) => {
            const selected = index === selectedIndex;
            const active = item.mode === mode;
            const ready = item.mode === "local" ? localReady : item.mode === "cloud" ? cloudReady : hybridReady;
            return (
              <Fragment key={item.mode}>
                <button
                  ref={(node) => { itemRefs.current[index] = node; }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  autoFocus={index === 0}
                  className={`pp-skin-v1-menu-item pp-skin-v1-dashboard-row pp-skin-v1-submenu-item${selected ? " is-selected" : ""}`}
                  data-story-mode-policy={item.mode}
                  data-story-mode-shortcut={item.shortcut}
                  data-story-mode-active={active ? "true" : "false"}
                  onClick={() => void activate(item.mode)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                >
                  <span className="pp-skin-v1-dashboard-command-line">[{item.shortcut}] {item.label} - {item.description}</span>
                  <span
                    className={`pp-skin-v1-dashboard-status-box${active && ready ? " is-active" : ""}`}
                    aria-label={`${item.label}: ${active ? (ready ? "active and ready" : "active but not ready") : (ready ? "ready" : "not ready")}`}
                    data-dashboard-status={active && ready ? "active" : "inactive"}
                    data-story-mode-ready={ready ? "true" : "false"}
                  />
                </button>
              </Fragment>
            );
          })}
        </div>

        <MenuFeedbackFooter id="story-mode-status-message" label={message} available={loaded} />
      </div>
    </section>
  );
}
