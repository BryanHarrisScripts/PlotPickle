"use client";

import { useEffect, useState } from "react";
import {
  defaultPlotPickleSettings,
  normalizePlotPickleSettings,
  type PlotPickleSettings,
} from "@/lib/runtime/ai/settings";
import { announceSettingsChanged, SETTINGS_STORAGE_KEY } from "../use-connection-status";
import { DASHBOARD_STARTUP_CHOICES, isDashboardStartupId } from "./dashboard-menu-registry";
import SettingsReviewSystemPanel from "./settings-review-system-panel";
import UatGuidePanel from "./uat-guide-panel";
import styles from "./settings-workspace-panel.module.css";

export type WorkspaceSettingsId = "general";
type SkinTheme = "skin-v1" | "skin-v2";
type StoryModePolicy = "local" | "cloud" | "hybrid";

const SKIN_STORAGE_KEY = "plotpickle.skin";

export function isWorkspaceSettingsId(value: string): value is WorkspaceSettingsId {
  return value === "general";
}

function readSettings() {
  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return stored ? normalizePlotPickleSettings(JSON.parse(stored)) : structuredClone(defaultPlotPickleSettings);
  } catch {
    return structuredClone(defaultPlotPickleSettings);
  }
}

function readSkinTheme(): SkinTheme {
  return window.localStorage.getItem(SKIN_STORAGE_KEY) === "skin-v2" ? "skin-v2" : "skin-v1";
}

export default function SettingsWorkspacePanel({ section }: { readonly section: WorkspaceSettingsId }) {
  const [settings, setSettings] = useState<PlotPickleSettings>(() => structuredClone(defaultPlotPickleSettings));
  const [skinTheme, setSkinTheme] = useState<SkinTheme>("skin-v1");
  const [storyMode, setStoryMode] = useState<StoryModePolicy>("hybrid");
  const [storyModeBusy, setStoryModeBusy] = useState(false);
  const [storyModeMessage, setStoryModeMessage] = useState("Loading Story Mode…");

  useEffect(() => {
    setSettings(readSettings());
    setSkinTheme(readSkinTheme());
    void fetch("/api/story-mode/policy", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { ok?: boolean; mode?: StoryModePolicy; message?: string };
        if (!response.ok || !body.ok || !body.mode) throw new Error(body.message || "Story Mode is unavailable.");
        setStoryMode(body.mode);
        setStoryModeMessage(`Story Mode is ${body.mode.toUpperCase()}.`);
      })
      .catch((error) => setStoryModeMessage(error instanceof Error ? error.message : "Story Mode is unavailable."));

    const changed = (event: Event) => {
      const mode = (event as CustomEvent<StoryModePolicy>).detail;
      if (mode === "local" || mode === "cloud" || mode === "hybrid") {
        setStoryMode(mode);
        setStoryModeMessage(`Story Mode is ${mode.toUpperCase()}.`);
      }
    };
    window.addEventListener("plotpickle:story-mode-policy-change", changed);
    return () => window.removeEventListener("plotpickle:story-mode-policy-change", changed);
  }, []);

  function persist(next: PlotPickleSettings) {
    const normalized = normalizePlotPickleSettings(next);
    setSettings(normalized);
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    announceSettingsChanged();
  }

  function persistSkinTheme(next: SkinTheme) {
    setSkinTheme(next);
    window.localStorage.setItem(SKIN_STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent("plotpickle:skin-change"));
  }

  async function persistStoryMode(next: StoryModePolicy) {
    setStoryModeBusy(true);
    setStoryModeMessage(`Switching Story Mode to ${next.toUpperCase()}…`);
    try {
      const response = await fetch("/api/story-mode/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      const body = await response.json() as { ok?: boolean; mode?: StoryModePolicy; message?: string };
      if (!response.ok || !body.ok || body.mode !== next) throw new Error(body.message || "Story Mode policy update failed.");
      setStoryMode(next);
      setStoryModeMessage(`Story Mode is ${next.toUpperCase()}.`);
      window.dispatchEvent(new CustomEvent("plotpickle:story-mode-policy-change", { detail: next }));
    } catch (error) {
      setStoryModeMessage(error instanceof Error ? error.message : "Story Mode policy update failed.");
    } finally {
      setStoryModeBusy(false);
    }
  }

  const startupPage = isDashboardStartupId(settings.general.startupPage) ? settings.general.startupPage : "dashboard";

  return (
    <div className={styles.surface} data-settings-workspace-surface={section}>
      <section className={styles.hero}>
        <p>SETTINGS / GENERAL</p>
        <h2>General</h2>
        <span>Human-facing preferences, interface reference, source information and local project recovery live together here.</span>
      </section>

      <section className={styles.form} aria-label="General preferences">
        <h3>General</h3>
        <label>
          <span>Language</span>
          <output className={styles.value}>English</output>
          <small>English is currently the only supported PlotPickle interface language.</small>
        </label>

        <label>
          <span>Startup page</span>
          <select
            value={startupPage}
            onChange={(event) => persist({ ...settings, general: { ...settings.general, startupPage: event.currentTarget.value } })}
          >
            {DASHBOARD_STARTUP_CHOICES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <small>Choices come from Dashboard destinations that are currently connected. Unwired Dashboard rows are not presented as working startup destinations.</small>
        </label>

        <label>
          <span>Story Mode</span>
          <select
            value={storyMode}
            aria-label="Story Mode"
            disabled={storyModeBusy}
            onChange={(event) => void persistStoryMode(event.currentTarget.value as StoryModePolicy)}
          >
            <option value="local">Local</option>
            <option value="cloud">Cloud</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <small>{storyModeMessage} Starting UAT automatically selects Local so no paid provider is used.</small>
        </label>

        <label>
          <span>Theme</span>
          <select
            value={skinTheme}
            aria-label="Theme"
            onChange={(event) => persistSkinTheme(event.currentTarget.value as SkinTheme)}
          >
            <option value="skin-v1">Matrix</option>
            <option value="skin-v2">Black and White</option>
          </select>
          <small>Theme changes apply immediately and stay on this computer.</small>
        </label>

        <label className={`${styles.check} ${styles.parked}`}>
          <input type="checkbox" checked={settings.general.confirmDestructiveActions} disabled readOnly />
          <span>
            <strong>Confirm destructive actions</strong>
            <small>Parked for now. This preference remains in the settings contract but is not exposed as an active control until its governed behaviour is complete.</small>
          </span>
        </label>
      </section>

      <UatGuidePanel mode="settings" />
      <SettingsReviewSystemPanel systemId="advanced" embedded />
    </div>
  );
}
