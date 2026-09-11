"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import AiRoutingPanel from "../ai-routing-panel";
import CloudModelCatalogPanel from "../settings/compute/cloud-model-catalog-panel";
import GeminiProviderSetupPanel from "../settings/ai-provider/gemini-provider-setup-panel";
import CloudProviderSetupPanel from "./cloud-provider-setup-panel";

type CloudStoryView = "menu" | "writing" | "images" | "video" | "agents" | "openai" | "minimax" | "gemini";
type CloudMenuView = Exclude<CloudStoryView, "menu">;
type CapabilityKey = "writing" | "images" | "video" | "agents";
type RoutingOption = { configured: boolean; ready: boolean; locality: string };
type RoutingGroup = { selected: string; options: Record<string, RoutingOption> };
type RoutingStatus = { text: RoutingGroup; image: RoutingGroup; video: RoutingGroup };
type CloudMenuItem = Readonly<{
  id: CloudMenuView;
  shortcut: string;
  label: string;
  detail: string;
  group: "TASKS" | "CLOUD RESOURCES";
}>;

const shell: React.CSSProperties = {
  minHeight: "100vh",
  padding: "var(--pp-skin-space-4) clamp(10px, 2vw, var(--pp-skin-space-6)) var(--pp-skin-space-7)",
  background: "var(--pp-skin-fill-panel)",
  color: "var(--pp-skin-ink)",
  fontFamily: "var(--pp-skin-font-ui)",
};

const boundary: React.CSSProperties = {
  margin: "0 0 var(--pp-skin-space-4)",
  padding: "var(--pp-skin-space-4)",
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-accent)",
  background: "var(--pp-skin-fill-accent-header)",
  lineHeight: "var(--pp-skin-leading-body)",
  boxShadow: "var(--pp-skin-shadow-control)",
};

const chromeBoundary: React.CSSProperties = {
  ...boundary,
  background: "var(--pp-skin-accent-deep)",
  backgroundImage: "none",
};

const statusPanel: React.CSSProperties = {
  ...boundary,
  display: "grid",
  gap: "var(--pp-skin-space-3)",
  background: "var(--pp-skin-fill-panel)",
};

const directoryMenu: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0 var(--pp-skin-space-3) var(--pp-skin-space-4)",
  background: "transparent",
  fontFamily: "var(--pp-skin-font-ui)",
};

function directoryRow(selected: boolean): React.CSSProperties {
  return {
    position: "relative",
    display: "block",
    width: "100%",
    minHeight: "var(--pp-skin-control-height)",
    margin: 0,
    padding: "var(--pp-skin-space-2) var(--pp-skin-space-9) var(--pp-skin-space-2) var(--pp-skin-space-2)",
    border: `var(--pp-skin-border-thin) solid ${selected ? "var(--pp-skin-accent-bright)" : "transparent"}`,
    borderRadius: "var(--pp-skin-radius)",
    background: selected ? "var(--pp-skin-accent-deep)" : "transparent",
    color: "var(--pp-skin-ink)",
    boxShadow: "none",
    fontFamily: "var(--pp-skin-font-ui)",
    fontSize: "var(--pp-skin-font-body)",
    fontWeight: 400,
    lineHeight: "var(--pp-skin-leading-body)",
    textAlign: "left",
    whiteSpace: "pre-wrap",
    cursor: "pointer",
  };
}

const CLOUD_MENU: readonly CloudMenuItem[] = [
  { id: "writing", shortcut: "W", label: "WRITING", detail: "Cloud writing and story reasoning", group: "TASKS" },
  { id: "images", shortcut: "I", label: "IMAGES", detail: "Cloud artwork and visual generation", group: "TASKS" },
  { id: "video", shortcut: "V", label: "VIDEO", detail: "Cloud motion and previs generation", group: "TASKS" },
  { id: "agents", shortcut: "A", label: "AGENTS", detail: "Cloud text compute available to PlotPickle Agents", group: "TASKS" },
  { id: "openai", shortcut: "O", label: "OPENAI", detail: "User-owned OpenAI API authority for supported writing and image tasks", group: "CLOUD RESOURCES" },
  { id: "minimax", shortcut: "M", label: "MINIMAX", detail: "User-owned MiniMax API authority for supported writing, image and video tasks", group: "CLOUD RESOURCES" },
  { id: "gemini", shortcut: "G", label: "GOOGLE GEMINI", detail: "User-owned Gemini authority for supported writing and Agent text tasks", group: "CLOUD RESOURCES" },
];

const VIEW_TITLES: Record<CloudMenuView, string> = {
  writing: "WRITING",
  images: "IMAGES",
  video: "VIDEO",
  agents: "AGENTS",
  openai: "OPENAI",
  minimax: "MINIMAX",
  gemini: "GOOGLE GEMINI",
};

function cloudReady(group: RoutingGroup | undefined) {
  if (!group) return false;
  const option = group.options[group.selected];
  return Boolean(option?.ready && option.locality === "cloud");
}

function StatusLight({ label, ready }: { label: string; ready: boolean }) {
  return (
    <span
      role="img"
      aria-label={`${label} ${ready ? "cloud route active and ready" : "cloud route not active or not ready"}`}
      title={ready ? "Cloud route active and ready" : "Cloud route not active or not ready"}
      style={{
        width: 12,
        height: 12,
        borderRadius: "var(--pp-skin-radius)",
        border: `var(--pp-skin-border-thin) solid ${ready ? "var(--pp-skin-accent-bright)" : "var(--pp-skin-line)"}`,
        background: ready ? "var(--pp-skin-accent-bright)" : "var(--pp-skin-surface-3)",
        boxShadow: ready ? "2px 2px 0 var(--pp-skin-accent-deep)" : "none",
        justifySelf: "end",
      }}
    />
  );
}

export default function CloudStoryModeHost() {
  const [view, setView] = useState<CloudStoryView>("menu");
  const [routing, setRouting] = useState<RoutingStatus | null>(null);
  const [menuSelectedIndex, setMenuSelectedIndex] = useState(0);
  const menuRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/ai-routing/status", { cache: "no-store" }).catch(() => null);
    if (response?.ok) setRouting(await response.json() as RoutingStatus);
  }, []);

  useEffect(() => {
    void refreshStatus();
    const refresh = () => void refreshStatus();
    window.addEventListener("plotpickle:setup-status-refresh", refresh);
    return () => window.removeEventListener("plotpickle:setup-status-refresh", refresh);
  }, [refreshStatus]);

  const lights: Record<CapabilityKey, boolean> = {
    writing: cloudReady(routing?.text),
    images: cloudReady(routing?.image),
    video: cloudReady(routing?.video),
    agents: cloudReady(routing?.text),
  };

  const selectMenuItem = (index: number) => {
    const normalized = (index + CLOUD_MENU.length) % CLOUD_MENU.length;
    setMenuSelectedIndex(normalized);
    window.requestAnimationFrame(() => menuRefs.current[normalized]?.focus());
  };

  const activateMenuItem = (index: number) => {
    const item = CLOUD_MENU[index];
    if (!item) return;
    setMenuSelectedIndex(index);
    setView(item.id);
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key.length === 1) {
      const shortcut = event.key.toUpperCase();
      const shortcutIndex = CLOUD_MENU.findIndex((item) => item.shortcut === shortcut);
      if (shortcutIndex >= 0) {
        event.preventDefault();
        selectMenuItem(shortcutIndex);
        activateMenuItem(shortcutIndex);
        return;
      }
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectMenuItem(index + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectMenuItem(index - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectMenuItem(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      selectMenuItem(CLOUD_MENU.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateMenuItem(index);
    }
  };

  const manageRoute = (target: "ollama" | "openai" | "gemini" | "minimax" | "comfyui") => {
    if (target === "openai" || target === "minimax" || target === "gemini") setView(target);
  };

  if (view !== "menu") {
    const task = view === "writing" || view === "images" || view === "video" || view === "agents" ? view : null;
    const routingCapability = view === "writing" || view === "agents" ? "text" : view === "images" ? "image" : view === "video" ? "video" : null;
    return (
      <div style={shell} data-skin-v1-cloud-story-mode="true" data-cloud-story-view={view}>
        <section style={chromeBoundary} data-skin-chrome="solid" aria-labelledby="skin-v1-cloud-story-section-title">
          <p style={{ margin: 0, color: "var(--pp-skin-accent-bright)", fontSize: 12, letterSpacing: ".08em" }}>SETTINGS / CLOUD STORY MODE / {VIEW_TITLES[view]}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <h1 id="skin-v1-cloud-story-section-title" style={{ margin: "5px 0", fontSize: 24 }}>{VIEW_TITLES[view]}</h1>
            <button type="button" onClick={() => setView("menu")} style={{ padding: "var(--pp-skin-space-2) var(--pp-skin-space-3)", border: "var(--pp-skin-border-thin) solid var(--pp-skin-accent)", borderRadius: "var(--pp-skin-radius)", background: "var(--pp-skin-surface-0)", color: "var(--pp-skin-ink)", font: "inherit", cursor: "pointer" }}>BACK TO CLOUD STORY MODE</button>
          </div>
        </section>

        {task ? <CloudModelCatalogPanel capability={task} /> : null}
        {routingCapability ? <AiRoutingPanel capability={routingCapability} locality="cloud" onManage={manageRoute} /> : null}
        {view === "agents" ? <section style={boundary}><strong>AGENT ASSIGNMENT</strong><p style={{ margin: "6px 0 0", color: "var(--pp-skin-ink-soft)" }}>Cloud Story Mode supplies supported cloud text compute. Choose the PlotPickle-wide default and any per-Agent override in Settings / Agents. BUZZ is not part of this compute assignment.</p></section> : null}
        {view === "openai" ? <CloudProviderSetupPanel provider="openai" /> : null}
        {view === "minimax" ? <CloudProviderSetupPanel provider="minimax" /> : null}
        {view === "gemini" ? <GeminiProviderSetupPanel /> : null}
      </div>
    );
  }

  return (
    <div style={shell} data-skin-v1-cloud-story-mode="true" data-cloud-story-view="menu">
      <section style={chromeBoundary} data-skin-chrome="solid" aria-labelledby="skin-v1-cloud-story-title">
        <p style={{ margin: 0, color: "var(--pp-skin-accent-bright)", fontSize: 12, letterSpacing: ".08em" }}>SETTINGS / CLOUD STORY MODE</p>
        <h1 id="skin-v1-cloud-story-title" style={{ margin: "5px 0 4px", fontSize: 24 }}>CLOUD STORY MODE</h1>
      </section>

      <section style={statusPanel} aria-labelledby="plotpickle-cloud-title">
        <div>
          <h2 id="plotpickle-cloud-title" style={{ margin: 0, fontSize: 16, letterSpacing: ".09em" }}>PLOTPICKLE CLOUD</h2>
          <p style={{ margin: "4px 0 0", color: "var(--pp-skin-accent-bright)", fontSize: 12, letterSpacing: ".08em" }}>USER-OWNED PROVIDERS / EXPLICIT PAID ROUTES</p>
        </div>
        {(["writing", "images", "video", "agents"] as const).map((capability) => (
          <div key={capability} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: "7px 0", borderTop: "var(--pp-skin-border-thin) solid var(--pp-skin-line)" }}>
            <strong>{capability.toUpperCase()}</strong>
            <StatusLight label={capability} ready={lights[capability]} />
          </div>
        ))}
      </section>

      <div
        className="pp-skin-v1-menu"
        style={directoryMenu}
        role="listbox"
        aria-label="Cloud Story Mode directory"
        data-skin-menu="cloud-story-mode"
      >
        {CLOUD_MENU.map((item, index) => {
          const selected = index === menuSelectedIndex;
          const showGroup = index === 0 || CLOUD_MENU[index - 1]?.group !== item.group;
          const command = `[${item.shortcut}] ${item.label}`.padEnd(24, " ");
          return (
            <Fragment key={item.id}>
              {showGroup ? <div className="pp-skin-v1-dashboard-group" aria-hidden="true">-- {item.group} --</div> : null}
              <button
                ref={(node) => { menuRefs.current[index] = node; }}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                autoFocus={selected}
                className={`pp-skin-v1-menu-item pp-skin-v1-dashboard-row pp-skin-v1-submenu-item${selected ? " is-selected" : ""}`}
                style={directoryRow(selected)}
                data-skin-menu-row={item.id}
                data-skin-menu-shortcut={item.shortcut}
                data-skin-menu-connected="true"
                onClick={() => activateMenuItem(index)}
                onKeyDown={(event) => handleMenuKeyDown(event, index)}
              >
                <span className="pp-skin-v1-dashboard-command-line">{command} - {item.detail}</span>
                <span
                  className="pp-skin-v1-dashboard-status-box is-active"
                  aria-label="Connected Cloud Story Mode destination"
                  data-skin-menu-indicator="connected"
                />
              </button>
            </Fragment>
          );
        })}
      </div>

      <footer style={{ ...chromeBoundary, margin: "var(--pp-skin-space-4) 0 0", color: "var(--pp-skin-ink-soft)", fontSize: 13 }} data-skin-chrome="solid">
        Cloud Story Mode uses credentials owned by the current human profile. Saving authority does not activate a paid route. Writing, image and video tests require an explicit user action, and PlotPickle never silently falls back to a paid provider.
      </footer>
    </div>
  );
}
