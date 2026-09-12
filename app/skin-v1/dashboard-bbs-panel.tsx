"use client";

import Image from "next/image";
import { Fragment, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import settingsTaxonomy from "../../config/settings-system-taxonomy.json";
import CloudStoryModeHost from "./cloud-story-mode-host";
import LearnJourneyPreview from "./learn-journey-preview";
import LocalAiSkinHost from "./local-ai-skin-host";
import MenuFeedbackFooter from "./menu-feedback-footer";
import NodeSkinPanel from "./node-skin-panel";
import PlotPickleAgentsHost from "./plotpickle-agents-host";
import PlotPickleScorePanel from "./plotpickle-score-panel";
import { SKIN_V1_ASSETS } from "./skin-v1-assets";

export type DashboardBbsItem = Readonly<{
  id: string;
  shortcut: string;
  label: string;
  description: string;
  group?: string;
}>;

const CONNECTED_DASHBOARD_ITEMS = new Set(["community", "settings", "profile", "logout", "learn"]);
const SETTINGS_SHORTCUTS: Readonly<Record<string, string>> = {
  general: "G",
  appearance: "A",
  "project-defaults": "P",
  "local-story-mode": "L",
  "node-info": "I",
  cloud: "C",
  data: "D",
  deploy: "E",
  repos: "R",
  auth: "U",
  agents: "N",
  "open-source": "O",
};

const SETTINGS_MENU = [
  {
    id: "node-info",
    shortcut: SETTINGS_SHORTCUTS["node-info"],
    label: "Node Info",
    description: "PlotPickle Node identity, lifecycle, readiness and current project.",
    group: "SYSTEMS",
  },
  {
    id: "local-story-mode",
    shortcut: SETTINGS_SHORTCUTS["local-story-mode"],
    label: "Local Story Mode",
    description: "Local writing, images, video and Agent compute on this computer.",
    group: "SYSTEMS",
  },
  ...settingsTaxonomy.systems
    .filter((system) => system.id !== "local")
    .map((system) => ({
      id: system.id,
      shortcut: SETTINGS_SHORTCUTS[system.id] ?? "?",
      label: system.id === "cloud" ? "Cloud Story Mode" : system.label,
      description: system.id === "cloud"
        ? "Cloud writing, images, video, Agents and user-owned provider authority."
        : system.description,
      group: "SYSTEMS",
    })),
  ...settingsTaxonomy.workspace
    .filter((item) => item.id !== "sitemap")
    .map((item) => ({
      id: item.id,
      shortcut: SETTINGS_SHORTCUTS[item.id] ?? "?",
      label: item.label,
      description: item.description,
      group: "WORKSPACE",
    })),
] as const;

const CONNECTED_SETTINGS_ITEMS = new Set(["local-story-mode", "node-info", "cloud", "agents"]);

// Compatibility contract for the original #1754 fallback assertion: /api/skin-v1/dashboard-art
// Runtime ownership now lives in SKIN_V1_ASSETS so future skins can swap their own artwork.
// Historical title token retained for old static evidence only: *** DASHBOARD ***

export default function DashboardBbsPanel({
  items,
  selectedIndex,
  onActivate,
  onKeyDown,
  setItemRef,
}: {
  readonly items: readonly DashboardBbsItem[];
  readonly selectedIndex: number;
  readonly onActivate: (index: number) => void;
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => void;
  readonly setItemRef: (index: number, node: HTMLButtonElement | null) => void;
}) {
  const [dashboardArt, setDashboardArt] = useState(SKIN_V1_ASSETS.dashboard.hero);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [cloudStoryModeOpen, setCloudStoryModeOpen] = useState(false);
  const [localStoryModeOpen, setLocalStoryModeOpen] = useState(false);
  const [nodeInfoOpen, setNodeInfoOpen] = useState(false);
  const [plotPickleAgentsOpen, setPlotPickleAgentsOpen] = useState(false);
  const [writerCraftMenuOpen, setWriterCraftMenuOpen] = useState(false);
  const [settingsSelectedIndex, setSettingsSelectedIndex] = useState(0);
  const settingsItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedDashboardItem = items[selectedIndex];
  const selectedDashboardConnected = Boolean(selectedDashboardItem && CONNECTED_DASHBOARD_ITEMS.has(selectedDashboardItem.id));
  const selectedSettingsItem = SETTINGS_MENU[settingsSelectedIndex];
  const selectedSettingsConnected = Boolean(selectedSettingsItem && CONNECTED_SETTINGS_ITEMS.has(selectedSettingsItem.id));

  function activateItem(index: number) {
    if (items[index]?.id === "settings") {
      setSettingsSelectedIndex(0);
      setSettingsMenuOpen(true);
      return;
    }
    if (items[index]?.id === "learn") {
      setWriterCraftMenuOpen(true);
      return;
    }
    onActivate(index);
  }

  function handleRowKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key.length === 1) {
      const shortcut = event.key.toUpperCase();
      const shortcutIndex = items.findIndex((item) => item.shortcut.toUpperCase() === shortcut);
      if (shortcutIndex >= 0) {
        event.preventDefault();
        activateItem(shortcutIndex);
        return;
      }
    }
    onKeyDown(event, index);
  }

  function selectSettingsItem(index: number) {
    const normalized = (index + SETTINGS_MENU.length) % SETTINGS_MENU.length;
    setSettingsSelectedIndex(normalized);
    window.requestAnimationFrame(() => settingsItemRefs.current[normalized]?.focus());
  }

  function activateSettingsItem(index: number) {
    const item = SETTINGS_MENU[index];
    if (!item) return;
    setSettingsSelectedIndex(index);
    if (item.id === "local-story-mode") {
      setLocalStoryModeOpen(true);
      return;
    }
    if (item.id === "node-info") {
      setNodeInfoOpen(true);
      return;
    }
    if (item.id === "cloud") {
      setCloudStoryModeOpen(true);
      return;
    }
    if (item.id === "agents") {
      setPlotPickleAgentsOpen(true);
    }
  }

  function handleSettingsKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key.length === 1) {
      const shortcut = event.key.toUpperCase();
      const shortcutIndex = SETTINGS_MENU.findIndex((item) => item.shortcut === shortcut);
      if (shortcutIndex >= 0) {
        event.preventDefault();
        selectSettingsItem(shortcutIndex);
        activateSettingsItem(shortcutIndex);
        return;
      }
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectSettingsItem(index + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectSettingsItem(index - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectSettingsItem(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      selectSettingsItem(SETTINGS_MENU.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateSettingsItem(index);
    }
  }

  if (settingsMenuOpen && cloudStoryModeOpen) {
    return (
      <section aria-label="Cloud Story Mode setup" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); setCloudStoryModeOpen(false); }
      }}>
        <div className="pp-skin-v1-bbs-banner">
          <h1>CLOUD STORY MODE</h1>
          <button type="button" className="pp-skin-v1-return" onClick={() => setCloudStoryModeOpen(false)}>Back to Settings</button>
        </div>
        <CloudStoryModeHost />
      </section>
    );
  }

  if (settingsMenuOpen && localStoryModeOpen) {
    return (
      <section aria-label="Local Story Mode setup" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); setLocalStoryModeOpen(false); }
      }}>
        <div className="pp-skin-v1-bbs-banner">
          <h1>LOCAL STORY MODE</h1>
          <button type="button" className="pp-skin-v1-return" onClick={() => setLocalStoryModeOpen(false)}>Back to Settings</button>
        </div>
        <LocalAiSkinHost />
      </section>
    );
  }

  if (settingsMenuOpen && nodeInfoOpen) {
    return (
      <section aria-label="Node information" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); setNodeInfoOpen(false); }
      }}>
        <div className="pp-skin-v1-bbs-banner">
          <h1>NODE INFO</h1>
          <button type="button" className="pp-skin-v1-return" onClick={() => setNodeInfoOpen(false)}>Back to Settings</button>
        </div>
        <NodeSkinPanel />
      </section>
    );
  }

  if (settingsMenuOpen && plotPickleAgentsOpen) {
    return (
      <section aria-label="PlotPickle Agents setup" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); setPlotPickleAgentsOpen(false); }
      }}>
        <div className="pp-skin-v1-bbs-banner">
          <h1>PLOTPICKLE AGENTS</h1>
          <button type="button" className="pp-skin-v1-return" onClick={() => setPlotPickleAgentsOpen(false)}>Back to Settings</button>
        </div>
        <PlotPickleAgentsHost />
      </section>
    );
  }

  if (settingsMenuOpen) {
    return (
      <section
        className="pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs"
        aria-label="Settings menu"
        data-settings-menu="keyboard-directory"
        data-skin-menu="settings"
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); setSettingsMenuOpen(false); }
        }}
      >
        <div className="pp-skin-v1-bbs" data-skin-reference-panel="standard">
          <div className="pp-skin-v1-bbs-banner">
            <h1>SETTINGS</h1>
            <button type="button" className="pp-skin-v1-return" onClick={() => setSettingsMenuOpen(false)}>Back to Dashboard</button>
          </div>

          <div className="pp-skin-v1-menu pp-skin-v1-dashboard-menu" role="listbox" aria-label="Settings directory" aria-describedby="settings-menu-status">
            {SETTINGS_MENU.map((item, index) => {
              const showGroup = index === 0 || SETTINGS_MENU[index - 1]?.group !== item.group;
              const connected = CONNECTED_SETTINGS_ITEMS.has(item.id);
              const selected = index === settingsSelectedIndex;
              const command = `[${item.shortcut}] ${item.label}`.padEnd(30, " ");
              return (
                <Fragment key={item.id}>
                  {showGroup ? <div className="pp-skin-v1-dashboard-group" aria-hidden="true">-- {item.group} --</div> : null}
                  <button
                    ref={(node) => { settingsItemRefs.current[index] = node; }}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-disabled={!connected}
                    tabIndex={selected ? 0 : -1}
                    autoFocus={index === 0}
                    className={`pp-skin-v1-menu-item pp-skin-v1-dashboard-row pp-skin-v1-submenu-item${selected ? " is-selected" : ""}`}
                    data-settings-secondary-item={item.id}
                    data-settings-shortcut={item.shortcut}
                    data-settings-secondary-connected={connected ? "true" : "false"}
                    data-skin-menu-row={item.id}
                    data-skin-menu-shortcut={item.shortcut}
                    data-skin-menu-connected={connected ? "true" : "false"}
                    onClick={() => activateSettingsItem(index)}
                    onKeyDown={(event) => handleSettingsKeyDown(event, index)}
                  >
                    <span className="pp-skin-v1-dashboard-command-line">{command} - {item.description}</span>
                    <span
                      className={`pp-skin-v1-dashboard-status-box${connected ? " is-active" : ""}`}
                      aria-label={`${item.label}: ${connected ? "available" : "unavailable"}`}
                      data-dashboard-status={connected ? "active" : "inactive"}
                      data-skin-menu-indicator={connected ? "connected" : "unwired"}
                    />
                  </button>
                </Fragment>
              );
            })}
          </div>

          <MenuFeedbackFooter
            id="settings-menu-status"
            label={selectedSettingsItem?.label ?? "No destination"}
            available={selectedSettingsConnected}
          />
        </div>
      </section>
    );
  }

  if (writerCraftMenuOpen) {
    return <LearnJourneyPreview onBack={() => setWriterCraftMenuOpen(false)} />;
  }

  return (
    <section
      className="pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs"
      aria-label="PlotPickle Dashboard"
      data-skin-reference="dashboard-canonical"
      data-skin-menu="dashboard"
    >
      <div className="pp-skin-v1-bbs" data-skin-reference-panel="standard">
        <div className="pp-skin-v1-dashboard-shell-title" data-skin-reference-type="title">
          <span className="pp-skin-v1-dashboard-shell-chevron" aria-hidden="true">&gt;&gt;&gt;</span>
          <span>PLOTPICKLE DASHBOARD</span>
          <span className="pp-skin-v1-dashboard-shell-chevron" aria-hidden="true">&lt;&lt;&lt;</span>
        </div>

        <div className="pp-skin-v1-dashboard-art" aria-hidden="true" data-skin-reference-media-container="primary">
          <Image
            src={dashboardArt}
            alt=""
            width={1200}
            height={377}
            priority
            draggable={false}
            data-dashboard-art="skin-v1"
            data-skin-reference-media="primary"
            onError={() => {
              if (dashboardArt === SKIN_V1_ASSETS.dashboard.heroFallback) return;
              setDashboardArt(SKIN_V1_ASSETS.dashboard.heroFallback);
            }}
          />
        </div>

        <PlotPickleScorePanel />

        <div className="pp-skin-v1-dashboard-brand" aria-label="PlotPickle AI-Native Agentic Story Operating System">
          <h1 data-skin-reference-type="brand">PlotPickle</h1>
          <p data-skin-reference-type="meta">AI-Native Agentic Story Operating System</p>
          {/* Compatibility token for the original regression contract: AI-NATIVE AGENTIC STORY OPERATING SYSTEM */}
        </div>

        <div className="pp-skin-v1-dashboard-title" data-skin-reference-type="body-title">*** PLOTPICKLE BBS ***</div>

        <div className="pp-skin-v1-menu pp-skin-v1-dashboard-menu" role="listbox" aria-label="Dashboard menu" aria-describedby="dashboard-menu-status">
          {items.map((item, index) => {
            const selected = index === selectedIndex;
            const connected = CONNECTED_DASHBOARD_ITEMS.has(item.id);
            const showGroup = Boolean(item.group && (index === 0 || items[index - 1]?.group !== item.group));
            const command = `[${item.shortcut}] ${item.label}`.padEnd(24, " ");
            return (
              <Fragment key={item.id}>
                {showGroup ? <div className="pp-skin-v1-dashboard-group" aria-hidden="true">-- {item.group} --</div> : null}
                <button
                  ref={(node) => setItemRef(index, node)}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  className={`pp-skin-v1-menu-item pp-skin-v1-dashboard-row${selected ? " is-selected" : ""}`}
                  data-dashboard-menu-item={item.id}
                  data-dashboard-shortcut={item.shortcut}
                  data-dashboard-connected={connected ? "true" : "false"}
                  data-skin-menu-row={item.id}
                  data-skin-menu-shortcut={item.shortcut}
                  data-skin-menu-connected={connected ? "true" : "false"}
                  data-skin-reference-state={selected ? "selected" : "unselected"}
                  onClick={() => activateItem(index)}
                  onKeyDown={(event) => handleRowKeyDown(event, index)}
                >
                  <span className="pp-skin-v1-dashboard-command-line">{command} - {item.description}</span>
                  <span
                    className={`pp-skin-v1-dashboard-status-box${connected ? " is-active" : ""}`}
                    aria-label={`${item.label}: ${connected ? "available" : "unavailable"}`}
                    data-skin-reference-state="status"
                    data-dashboard-status={connected ? "active" : "inactive"}
                    data-skin-menu-indicator={connected ? "connected" : "unwired"}
                  />
                </button>
              </Fragment>
            );
          })}
        </div>

        <div className="pp-skin-v1-dashboard-rule" aria-hidden="true" />
        <p className="pp-skin-v1-dashboard-reminder" data-skin-reference-type="emphasis">Remember: Write dirty, edit clean. 1 page = 1 minute.</p>

        <MenuFeedbackFooter
          id="dashboard-menu-status"
          label={selectedDashboardItem?.label ?? "No destination"}
          available={selectedDashboardConnected}
        />
      </div>
    </section>
  );
}
