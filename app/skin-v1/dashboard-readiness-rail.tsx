"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./dashboard-readiness-rail.module.css";

type AssistantProviderId = "local" | "ollama" | "openai" | "minimax";
type BuzzIdentity = {
  identityVerified?: boolean;
  humanCommunityAllowed?: boolean;
  kind?: "human" | "agent" | "unknown";
};
type GuildhallStatus = { operational?: boolean };
type AssistantProviderStatus = { ready?: boolean };
type AssistantStatus = {
  activeProvider?: AssistantProviderId | "disabled";
  providers?: Partial<Record<AssistantProviderId, AssistantProviderStatus>>;
  localRuntime?: { ready?: boolean };
};
type LocalConnectionsStatus = {
  comfyui?: { state?: "connected" | "configured" | "disconnected" | "checking" | "error" | "unavailable" | "disabled" };
};
type ReadinessState = {
  buzz: boolean | null;
  community: boolean | null;
  local: boolean | null;
  comfyui: boolean | null;
  cloud: boolean | null;
};

type ReadinessTarget = "profile" | "local-story-mode" | "cloud";

const INITIAL_STATE: ReadinessState = {
  buzz: null,
  community: null,
  local: null,
  comfyui: null,
  cloud: null,
};

async function readJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

function openConfiguration(target: ReadinessTarget) {
  if (target === "profile") {
    document.querySelector<HTMLButtonElement>('[data-dashboard-menu-item="profile"]')?.click();
    return;
  }

  document.querySelector<HTMLButtonElement>('[data-dashboard-menu-item="settings"]')?.click();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-settings-secondary-item="${target}"]`)?.click();
    });
  });
}

function indicatorState(ready: boolean | null) {
  return ready === null ? "checking" : ready ? "ready" : "not-ready";
}

export default function DashboardReadinessRail() {
  const [readiness, setReadiness] = useState<ReadinessState>(INITIAL_STATE);

  const refresh = useCallback(async () => {
    const [buzz, guildhall, assistant, connections] = await Promise.all([
      readJson<BuzzIdentity>("/api/local-buzz/human-identity"),
      readJson<GuildhallStatus>("/api/local-buzz/guildhall/status"),
      readJson<AssistantStatus>("/api/writing-assistant/status"),
      readJson<LocalConnectionsStatus>("/api/local-connections"),
    ]);

    const buzzReady = Boolean(buzz?.humanCommunityAllowed && buzz.identityVerified && buzz.kind === "human");
    const activeProvider = assistant?.activeProvider;
    const localProvider = activeProvider === "local" || activeProvider === "ollama" ? activeProvider : null;
    const cloudProvider = activeProvider === "openai" || activeProvider === "minimax" ? activeProvider : null;
    const localProfile = localProvider ? assistant?.providers?.[localProvider] : null;
    const cloudProfile = cloudProvider ? assistant?.providers?.[cloudProvider] : null;

    setReadiness({
      buzz: buzzReady,
      community: Boolean(buzzReady && guildhall?.operational),
      local: Boolean(localProvider && (localProfile?.ready || (localProvider === "local" && assistant?.localRuntime?.ready))),
      comfyui: connections?.comfyui?.state === "connected",
      cloud: Boolean(cloudProvider && cloudProfile?.ready),
    });
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => { void refresh(); }, 250);
    const handleRefresh = () => { void refresh(); };
    window.addEventListener("plotpickle:setup-status-refresh", handleRefresh);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener("plotpickle:setup-status-refresh", handleRefresh);
    };
  }, [refresh]);

  const items: ReadonlyArray<{ label: string; shortLabel: string; ready: boolean | null; target: ReadinessTarget }> = [
    { label: "BUZZ Identity", shortLabel: "BUZZ", ready: readiness.buzz, target: "profile" },
    { label: "Community BBS", shortLabel: "BBS", ready: readiness.community, target: "profile" },
    { label: "Local Model", shortLabel: "MODEL", ready: readiness.local, target: "local-story-mode" },
    { label: "ComfyUI", shortLabel: "COMFY", ready: readiness.comfyui, target: "local-story-mode" },
    { label: "Cloud Compute", shortLabel: "CLOUD", ready: readiness.cloud, target: "cloud" },
  ];

  return (
    <span className={styles.rail} aria-label="Dashboard backend readiness">
      {items.map((item) => {
        const state = indicatorState(item.ready);
        const stateLabel = state === "checking" ? "checking" : state === "ready" ? "ready" : "not ready";
        return (
          <button
            key={item.label}
            type="button"
            className={styles.item}
            onClick={() => openConfiguration(item.target)}
            title={`${item.label}: ${stateLabel}`}
            aria-label={`${item.label}: ${stateLabel}`}
          >
            <i data-ready={state} aria-hidden="true" />
            <span>{item.shortLabel}</span>
          </button>
        );
      })}
    </span>
  );
}
