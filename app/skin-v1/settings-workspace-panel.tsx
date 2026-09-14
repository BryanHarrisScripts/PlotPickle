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
import styles from "./settings-workspace-panel.module.css";

export type WorkspaceSettingsId = "general";

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
          <span>Theme</span>
          <select value="skin-v1" disabled aria-label="Theme">
            <option value="skin-v1">Skin V1</option>
          </select>
          <small>Skin V1 is the current PlotPickle interface theme. Additional skins can be added here when they exist.</small>
        </label>

        <label className={`${styles.check} ${styles.parked}`}>
          <input type="checkbox" checked={settings.general.confirmDestructiveActions} disabled readOnly />
          <span>
            <strong>Confirm destructive actions</strong>
            <small>Parked for now. This preference remains in the settings contract but is not exposed as an active control until its governed behaviour is complete.</small>
          </span>
        </label>
      </section>

      <SettingsReviewSystemPanel systemId="advanced" embedded />
    </div>
  );
}
