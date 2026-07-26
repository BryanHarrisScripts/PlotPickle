"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { defaultPlotPickleSettings, normalizePlotPickleSettings, type PlotPickleSettings } from "@/lib/ai/settings";
import {
  createConnectionStatusSnapshot,
  type ConnectionRuntimeSnapshot,
} from "@/lib/connection-status";
import type { PlotPickleProject } from "@/lib/project";

export const SETTINGS_STORAGE_KEY = "plotpickle.settings.v1";
export const SETTINGS_SECTION_KEY = "plotpickle.settings.section";
export const CONNECTIONS_API = "/api/local-connections";

function localSettings() {
  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return stored ? normalizePlotPickleSettings(JSON.parse(stored)) : structuredClone(defaultPlotPickleSettings);
  } catch {
    return structuredClone(defaultPlotPickleSettings);
  }
}

export function announceSettingsChanged() {
  window.dispatchEvent(new CustomEvent("plotpickle:settings-changed"));
}

export function requestConnectionStatusRefresh() {
  window.dispatchEvent(new CustomEvent("plotpickle:connection-status-refresh"));
}

export function useConnectionStatus(project: PlotPickleProject, saveState: string) {
  const [settings, setSettings] = useState<PlotPickleSettings>(() => structuredClone(defaultPlotPickleSettings));
  const [runtime, setRuntime] = useState<ConnectionRuntimeSnapshot>({});

  const refresh = useCallback(async () => {
    setSettings(localSettings());
    try {
      const response = await fetch(CONNECTIONS_API, { headers: { Accept: "application/json" } });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) throw new Error("local-gateway-unavailable");
      const value = await response.json() as ConnectionRuntimeSnapshot & { message?: string };
      if (!response.ok) throw new Error(value.message || "Connection status could not be read.");
      setRuntime(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection status could not be read.";
      setRuntime({
        checkedAt: new Date().toISOString(),
        ai: {
          state: message === "local-gateway-unavailable" ? "unavailable" : "error",
          error: message === "local-gateway-unavailable" ? "" : message,
          detail: "Connection checks are available in the downloaded local PlotPickle server.",
        },
        google: {
          state: "unavailable",
          detail: "Google remains optional and local project work is available.",
          error: message === "local-gateway-unavailable" ? "" : message,
        },
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    const handleRefresh = () => { void refresh(); };
    window.addEventListener("plotpickle:settings-changed", handleRefresh);
    window.addEventListener("plotpickle:connection-status-refresh", handleRefresh);
    window.addEventListener("storage", handleRefresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("plotpickle:settings-changed", handleRefresh);
      window.removeEventListener("plotpickle:connection-status-refresh", handleRefresh);
      window.removeEventListener("storage", handleRefresh);
    };
  }, [refresh]);

  const snapshot = useMemo(
    () => createConnectionStatusSnapshot(project, settings, runtime, saveState),
    [project, runtime, saveState, settings],
  );

  return { snapshot, settings, refresh };
}
