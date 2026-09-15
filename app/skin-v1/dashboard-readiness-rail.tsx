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
    void refresh();
    window.addEventListener("plotpickle:setup-status-refresh", refresh);
    return () => window.removeEventListener("plotpickle:setup-status-refresh", refresh);
  }, [refresh]);

  const items: ReadonlyArray<{ label: string; ready: boolean | null; target: ReadinessTarget }> = [
    { label: "BUZZ Identity", ready: readiness.buzz, target: "profile" },
    { label: "Community BBS", ready: readiness.community, target: "profile" },
    { label: "Local Model", ready: readiness.local, target: "local-story-mode" },
    { label: "ComfyUI", ready: readiness.comfyui, target: "local-story-mode" },
    { label: "Cloud Compute", ready: readiness.cloud, target: "cloud" },
  ];

  return (
    <section className={styles.rail} aria-label="Dashboard backend readiness">
      <span className={styles.heading}>SYSTEM READINESS</span>
      <div className={styles.items}>
        {items.map((item) => {
          const state = indicatorState(item.ready);
          return (
            <button
              key={item.label}
              type="button"
              className={styles.item}
              onClick={() => openConfiguration(item.target)}
              aria-label={`${item.label}: ${state === "checking" ? "checking" : state === "ready" ? "ready" : "not ready"}`}
            >
              <span>{item.label}</span>
              <i data-ready={state} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
