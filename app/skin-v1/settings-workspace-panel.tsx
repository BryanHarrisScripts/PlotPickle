"use client";

import { useEffect, useState } from "react";
import {
  defaultPlotPickleSettings,
  normalizePlotPickleSettings,
  type PlotPickleSettings,
} from "@/lib/runtime/ai/settings";
import { announceSettingsChanged, SETTINGS_STORAGE_KEY } from "../use-connection-status";
import styles from "./settings-workspace-panel.module.css";

export type WorkspaceSettingsId = "general" | "appearance" | "accessibility" | "defaults";

export function isWorkspaceSettingsId(value: string): value is WorkspaceSettingsId {
  return value === "general" || value === "appearance" || value === "accessibility" || value === "defaults";
}

const TITLES: Record<WorkspaceSettingsId, string> = {
  general: "General",
  appearance: "Appearance",
  accessibility: "Accessibility",
  defaults: "Defaults",
};

function readSettings() {
  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return stored ? normalizePlotPickleSettings(JSON.parse(stored)) : structuredClone(defaultPlotPickleSettings);
  } catch {
    return structuredClone(defaultPlotPickleSettings);
  }
}

export default function SettingsWorkspacePanel({ section }: { readonly section: WorkspaceSettingsId }) {
  const [settings, setSettings] = useState<PlotPickleSettings>(() => structuredClone(defaultPlotPickleSettings));

  useEffect(() => {
    setSettings(readSettings());
  }, []);

  function persist(next: PlotPickleSettings) {
    const normalized = normalizePlotPickleSettings(next);
    setSettings(normalized);
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    announceSettingsChanged();
  }

  return (
    <div className={styles.surface} data-settings-workspace-surface={section}>
      <section className={styles.hero}>
        <p>SETTINGS / {TITLES[section].toUpperCase()}</p>
        <h2>{TITLES[section]}</h2>
        <span>Changes are saved on this device using PlotPickle's existing settings store.</span>
      </section>

      {section === "general" ? (
        <section className={styles.form} aria-label="General settings">
          <label><span>Language</span><input value={settings.general.language} onChange={(event) => persist({ ...settings, general: { ...settings.general, language: event.currentTarget.value } })} /></label>
          <label><span>Startup page</span><select value={settings.general.startupPage} onChange={(event) => persist({ ...settings, general: { ...settings.general, startupPage: event.currentTarget.value === "simple-start" ? "simple-start" : "dashboard" } })}><option value="dashboard">Dashboard</option><option value="simple-start">Simple Start</option></select></label>
          <label className={styles.check}><input type="checkbox" checked={settings.general.confirmDestructiveActions} onChange={(event) => persist({ ...settings, general: { ...settings.general, confirmDestructiveActions: event.currentTarget.checked } })} /><span><strong>Confirm destructive actions</strong><small>Ask before actions that could replace or remove saved work.</small></span></label>
        </section>
      ) : null}

      {section === "appearance" ? (
        <section className={styles.form} aria-label="Appearance settings">
          <label><span>Theme</span><select value={settings.appearance.theme} onChange={(event) => persist({ ...settings, appearance: { ...settings.appearance, theme: event.currentTarget.value as PlotPickleSettings["appearance"]["theme"] } })}><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select></label>
          <label><span>Density</span><select value={settings.appearance.density} onChange={(event) => persist({ ...settings, appearance: { ...settings.appearance, density: event.currentTarget.value === "compact" ? "compact" : "comfortable" } })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
          <label className={styles.check}><input type="checkbox" checked={settings.appearance.reduceTransparency} onChange={(event) => persist({ ...settings, appearance: { ...settings.appearance, reduceTransparency: event.currentTarget.checked } })} /><span><strong>Reduce transparency</strong><small>Use more opaque interface surfaces.</small></span></label>
        </section>
      ) : null}

      {section === "accessibility" ? (
        <section className={styles.form} aria-label="Accessibility settings">
          <label className={styles.check}><input type="checkbox" checked={settings.accessibility.highContrast} onChange={(event) => persist({ ...settings, accessibility: { ...settings.accessibility, highContrast: event.currentTarget.checked } })} /><span><strong>High contrast</strong><small>Increase visual separation between controls and surfaces.</small></span></label>
          <label className={styles.check}><input type="checkbox" checked={settings.accessibility.reducedMotion} onChange={(event) => persist({ ...settings, accessibility: { ...settings.accessibility, reducedMotion: event.currentTarget.checked } })} /><span><strong>Reduced motion</strong><small>Reduce non-essential interface movement.</small></span></label>
          <label className={styles.check}><input type="checkbox" checked={settings.accessibility.largeText} onChange={(event) => persist({ ...settings, accessibility: { ...settings.accessibility, largeText: event.currentTarget.checked } })} /><span><strong>Large text</strong><small>Increase interface text size where supported.</small></span></label>
        </section>
      ) : null}

      {section === "defaults" ? (
        <section className={styles.form} aria-label="Default project settings">
          <label><span>Starting format</span><select value={settings.projectDefaults.format} onChange={(event) => persist({ ...settings, projectDefaults: { ...settings.projectDefaults, format: event.currentTarget.value as PlotPickleSettings["projectDefaults"]["format"] } })}><option value="feature">Feature</option><option value="short">Short</option><option value="series">Series</option><option value="stage">Stage</option></select></label>
          <label><span>Target minutes</span><input type="number" min={1} max={600} value={settings.projectDefaults.targetMinutes} onChange={(event) => persist({ ...settings, projectDefaults: { ...settings.projectDefaults, targetMinutes: Number(event.currentTarget.value) } })} /></label>
          <label><span>Autosave interval (seconds)</span><input type="number" min={5} max={300} value={settings.projectDefaults.autosaveSeconds} onChange={(event) => persist({ ...settings, projectDefaults: { ...settings.projectDefaults, autosaveSeconds: Number(event.currentTarget.value) } })} /></label>
        </section>
      ) : null}
    </div>
  );
}
