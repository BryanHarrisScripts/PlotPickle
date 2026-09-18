"use client";

import { Fragment, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import CloudStoryModeHost from "./cloud-story-mode-host";
import LocalAiSkinHost from "./local-ai-skin-host";
import HybridStoryModePanel from "./hybrid-story-mode-panel";
import MenuFeedbackFooter from "./menu-feedback-footer";

type StoryModePolicy = "local" | "cloud" | "hybrid";
type StoryModeView = "landing" | StoryModePolicy;

type RouteStatus = {
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

type LocalRuntimeStatus = {
  readonly ok?: boolean;
  readonly activeRuntime?: { readonly reachable?: boolean };
  readonly roles?: Readonly<Record<string, { readonly available?: boolean }>>;
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

function localityReady(status: AiRoutingStatus | null, locality: "local" | "cloud") {
  if (!status) return false;
  return [status.text, status.image, status.video].every((capability) =>
    Object.values(capability?.options ?? {}).some((route) => route.locality === locality && route.ready === true),
  );
}

function hybridSelectionReady(status: AiRoutingStatus | null) {
  if (!status) return false;
  const selected = [status.text, status.image, status.video].map((capability) => {
    const route = capability?.selected ? capability.options?.[capability.selected] : null;
    return route?.ready === true && (route.locality === "local" || route.locality === "cloud")
      ? route.locality
      : null;
  });
  return selected.every(Boolean) && selected.includes("local") && selected.includes("cloud");
}

function hardwareLocalReady(status: LocalRuntimeStatus | null) {
  if (!status?.ok || status.activeRuntime?.reachable !== true) return false;
  return Object.values(status.roles ?? {}).some((role) => role.available === true);
}

function readinessLabel(ready: boolean, loaded: boolean) {
  if (!loaded) return "CHECKING";
  return ready ? "READY" : "NOT READY";
}

function readinessState(ready: boolean, loaded: boolean) {
  if (!loaded) return "checking";
  return ready ? "ready" : "not-ready";
}

function StoryModeReadiness({
  localReady,
  cloudReady,
  hybridReady,
  loaded,
  mode,
}: {
  readonly localReady: boolean;
  readonly cloudReady: boolean;
  readonly hybridReady: boolean;
  readonly loaded: boolean;
  readonly mode: StoryModePolicy;
}) {
  const statuses = [
    { label: "LOCAL", ready: localReady },
    { label: "CLOUD", ready: cloudReady },
    { label: "HYBRID", ready: hybridReady },
  ] as const;

  return (
    <div className="pp-skin-v1-story-mode-readiness" aria-label="Story Mode status" data-story-mode-status="derived">
      {statuses.map((status) => (
        <span key={status.label} data-story-mode-readiness={readinessState(status.ready, loaded)}>
          <i aria-hidden="true" />
          <strong>{status.label}</strong>: {readinessLabel(status.ready, loaded)}
        </span>
      ))}
      <span data-story-mode-active-policy={mode}><strong>MODE</strong>: {mode.toUpperCase()}</span>
    </div>
  );
}

export default function StoryModeHost() {
  const [view, setView] = useState<StoryModeView>("landing");
  const [mode, setMode] = useState<StoryModePolicy>("hybrid");
  const [routingStatus, setRoutingStatus] = useState<AiRoutingStatus | null>(null);
  const [localRuntimeStatus, setLocalRuntimeStatus] = useState<LocalRuntimeStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("Loading Story Mode readiness...");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const localReady = localityReady(routingStatus, "local") && hardwareLocalReady(localRuntimeStatus);
  const cloudReady = localityReady(routingStatus, "cloud");
  const hybridReady = hybridSelectionReady(routingStatus);

  async function refresh() {
    try {
      const [policyResponse, routingResponse, localRuntimeResponse] = await Promise.all([
        fetch("/api/story-mode/policy", { cache: "no-store" }),
        fetch("/api/ai-routing/status", { cache: "no-store" }),
        fetch("/api/local-ai/runtime", { cache: "no-store" }).catch(() => null),
      ]);
      const policy = await policyResponse.json() as StoryModePolicyResponse;
      const routing = await routingResponse.json() as AiRoutingStatus & { readonly message?: string };
      const localRuntime = localRuntimeResponse?.ok
        ? await localRuntimeResponse.json() as LocalRuntimeStatus
        : null;
      if (!policyResponse.ok || !policy.ok || !policy.mode) throw new Error(policy.message || "Story Mode policy is unavailable.");
      if (!routingResponse.ok || !routing.ok) throw new Error(routing.message || "Story Mode readiness is unavailable.");
      setMode(policy.mode);
      setRoutingStatus(routing);
      setLocalRuntimeStatus(localRuntime);
      setMessage("LOCAL and CLOUD are READY only when Writing, Images and Video each have a tested route. HYBRID is READY only when the selected capability mix uses both Local and Cloud.");
    } catch (error) {
      setRoutingStatus(null);
      setLocalRuntimeStatus(null);
      setMessage(error instanceof Error ? error.message : "Story Mode readiness is unavailable.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { void refresh(); }, []);

  function selectIndex(index: number) {
    const normalized = (index + STORY_MODE_ROWS.length) % STORY_MODE_ROWS.length;
    setSelectedIndex(normalized);
    window.requestAnimationFrame(() => itemRefs.current[normalized]?.focus());
  }

  async function activate(nextMode: StoryModePolicy) {
    // Configuration remains reachable even while the execution-policy write is pending or unavailable.
    // The active policy indicator changes only after the policy authority confirms the write.
    setView(nextMode);
    setMessage(`Switching Story Mode to ${nextMode.toUpperCase()}...`);
    try {
      const response = await fetch("/api/story-mode/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode }),
      });
      const payload = await response.json() as StoryModePolicyResponse;
      if (!response.ok || !payload.ok || payload.mode !== nextMode) throw new Error(payload.message || "Story Mode policy update failed.");
      setMode(nextMode);
      setMessage(`Story Mode is ${nextMode.toUpperCase()}.`);
      void refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Story Mode policy update failed.");
    }
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
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setView("landing"); }
      }}>
        <div className="pp-skin-v1-bbs-banner">
          <h1>LOCAL STORY MODE</h1>
          <button type="button" className="pp-skin-v1-return" onClick={() => setView("landing")}>Back to Story Mode</button>
        </div>
        <LocalAiSkinHost />
      </section>
    );
  }

  if (view === "cloud") {
    return (
      <section aria-label="Cloud Story Mode setup" data-story-mode-view="cloud" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setView("landing"); }
      }}>
        <div className="pp-skin-v1-bbs-banner">
          <h1>CLOUD STORY MODE</h1>
          <button type="button" className="pp-skin-v1-return" onClick={() => setView("landing")}>Back to Story Mode</button>
        </div>
        <CloudStoryModeHost />
      </section>
    );
  }

  if (view === "hybrid") {
    return (
      <section aria-label="Hybrid Story Mode" data-story-mode-view="hybrid" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setView("landing"); }
      }}>
        <div className="pp-skin-v1-bbs-banner">
          <h1>HYBRID STORY MODE</h1>
          <button type="button" className="pp-skin-v1-return" onClick={() => setView("landing")}>Back to Story Mode</button>
        </div>
        <StoryModeReadiness localReady={localReady} cloudReady={cloudReady} hybridReady={hybridReady} loaded={loaded} mode={mode} />
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
        <div className="pp-skin-v1-dashboard-title">*** STORY MODE ***</div>
        <StoryModeReadiness localReady={localReady} cloudReady={cloudReady} hybridReady={hybridReady} loaded={loaded} mode={mode} />

        <div className="pp-skin-v1-menu pp-skin-v1-dashboard-menu" role="listbox" aria-label="Story Mode policies" aria-describedby="story-mode-status-message">
          {STORY_MODE_ROWS.map((item, index) => {
            const selected = index === selectedIndex;
            const active = item.mode === mode;
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
                    className={`pp-skin-v1-dashboard-status-box${active ? " is-active" : ""}`}
                    aria-label={`${item.label}: ${active ? "active mode" : "available policy"}`}
                    data-dashboard-status={active ? "active" : "inactive"}
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
