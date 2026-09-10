"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import AiRoutingPanel from "../ai-routing-panel";
import LocalRuntimePanel from "../local-runtime-panel";
import LocalComfyUiPanel from "./local-comfyui-panel";
import LocalH3SetupPanel from "./local-h3-setup-panel";
import LocalLtxSetupPanel from "./local-ltx-setup-panel";
import LocalVideoPanel from "./local-video-panel";

type LocalAiView = "menu" | "writing" | "images" | "video" | "ollama" | "comfyui" | "ltx" | "h3";
type LocalMenuView = Exclude<LocalAiView, "menu">;
type CapabilityKey = "writing" | "images" | "video";
type RoutingOption = { ready: boolean; locality: string };
type RoutingGroup = { selected: string; options: Record<string, RoutingOption> };
type RoutingStatus = { text: RoutingGroup; image: RoutingGroup; video: RoutingGroup };
type MediaImageStatus = {
  imageRoute: string;
  comfyui: {
    reachable: boolean;
    imageNodesReady: boolean;
    checkpoints: string[];
  };
};
type VideoPluginStatus = {
  recommendation: {
    selected: { id: string; label: string } | null;
    ready: boolean;
    active: boolean;
  };
};
type LocalMenuItem = Readonly<{
  id: LocalMenuView;
  shortcut: string;
  label: string;
  detail: string;
  group: "TASKS" | "ENGINES";
}>;

const LOCAL_SDXL_CHECKPOINT = "sd_xl_base_1.0.safetensors";

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

const LOCAL_MENU: readonly LocalMenuItem[] = [
  { id: "writing", shortcut: "W", label: "WRITING", detail: "Story, Sage and PLAN", group: "TASKS" },
  { id: "images", shortcut: "I", label: "IMAGES", detail: "Local artwork and visual generation", group: "TASKS" },
  { id: "video", shortcut: "V", label: "VIDEO", detail: "Local motion and previs generation", group: "TASKS" },
  { id: "ollama", shortcut: "O", label: "OLLAMA", detail: "Local text runtime and models", group: "ENGINES" },
  { id: "comfyui", shortcut: "C", label: "COMFYUI", detail: "Local image and video engine", group: "ENGINES" },
  { id: "ltx", shortcut: "L", label: "LTX-VIDEO", detail: "Default local text-to-video plug-in", group: "ENGINES" },
  { id: "h3", shortcut: "H", label: "MINIMAX H3", detail: "Advanced local video plug-in and setup", group: "ENGINES" },
];

const VIEW_TITLES: Record<LocalMenuView, string> = {
  writing: "WRITING",
  images: "IMAGES",
  video: "VIDEO",
  ollama: "OLLAMA",
  comfyui: "COMFYUI",
  ltx: "LTX-VIDEO",
  h3: "MINIMAX H3",
};

function localReady(group: RoutingGroup | undefined) {
  if (!group) return false;
  const option = group.options[group.selected];
  return Boolean(option?.ready && option.locality === "local");
}

function fixedLocalImagesReady(status: MediaImageStatus | null) {
  if (!status || status.imageRoute !== "comfyui" || !status.comfyui.reachable || !status.comfyui.imageNodesReady) return false;
  return status.comfyui.checkpoints.some((checkpoint) => checkpoint.toLowerCase() === LOCAL_SDXL_CHECKPOINT.toLowerCase());
}

function automaticLocalVideoReady(status: VideoPluginStatus | null) {
  return Boolean(status?.recommendation.selected && status.recommendation.ready && status.recommendation.active);
}

function StatusLight({ label, ready }: { label: string; ready: boolean }) {
  return (
    <span
      role="img"
      aria-label={`${label} ${ready ? "local default ready" : "local default needs attention"}`}
      title={ready ? "Local default ready" : "Local default needs attention"}
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

export default function LocalAiSkinHost() {
  const [view, setView] = useState<LocalAiView>("menu");
  const [routing, setRouting] = useState<RoutingStatus | null>(null);
  const [mediaImages, setMediaImages] = useState<MediaImageStatus | null>(null);
  const [videoPlugin, setVideoPlugin] = useState<VideoPluginStatus | null>(null);
  const [menuSelectedIndex, setMenuSelectedIndex] = useState(0);
  const menuRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const refreshStatus = useCallback(async () => {
    const [routingResponse, mediaResponse, videoResponse] = await Promise.all([
      fetch("/api/ai-routing/status", { cache: "no-store" }).catch(() => null),
      fetch("/api/media-routing/status", { cache: "no-store" }).catch(() => null),
      fetch("/api/local-ai/plugins/video", { cache: "no-store" }).catch(() => null),
    ]);
    if (routingResponse?.ok) setRouting(await routingResponse.json() as RoutingStatus);
    if (mediaResponse?.ok) setMediaImages(await mediaResponse.json() as MediaImageStatus);
    if (videoResponse?.ok) setVideoPlugin(await videoResponse.json() as VideoPluginStatus);
  }, []);

  useEffect(() => {
    void refreshStatus();
    const refresh = () => void refreshStatus();
    const openEngine = (event: Event) => {
      const target = (event as CustomEvent<string>).detail;
      if (target === "comfyui") setView("comfyui");
      if (target === "ollama") setView("ollama");
      if (target === "ltx") setView("ltx");
      if (target === "minimax") setView("h3");
    };
    window.addEventListener("plotpickle:setup-status-refresh", refresh);
    window.addEventListener("plotpickle:settings-section", openEngine);
    return () => {
      window.removeEventListener("plotpickle:setup-status-refresh", refresh);
      window.removeEventListener("plotpickle:settings-section", openEngine);
    };
  }, [refreshStatus]);

  const lights: Record<CapabilityKey, boolean> = {
    writing: localReady(routing?.text),
    images: fixedLocalImagesReady(mediaImages),
    video: automaticLocalVideoReady(videoPlugin),
  };

  const selectMenuItem = (index: number) => {
    const normalized = (index + LOCAL_MENU.length) % LOCAL_MENU.length;
    setMenuSelectedIndex(normalized);
    window.requestAnimationFrame(() => menuRefs.current[normalized]?.focus());
  };

  const activateMenuItem = (index: number) => {
    const item = LOCAL_MENU[index];
    if (!item) return;
    setMenuSelectedIndex(index);
    setView(item.id);
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key.length === 1) {
      const shortcut = event.key.toUpperCase();
      const shortcutIndex = LOCAL_MENU.findIndex((item) => item.shortcut === shortcut);
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
      selectMenuItem(LOCAL_MENU.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateMenuItem(index);
    }
  };

  const manageRoute = (target: "ollama" | "openai" | "gemini" | "minimax" | "comfyui") => {
    if (target === "ollama") setView("ollama");
    if (target === "comfyui") setView("comfyui");
    if (target === "minimax") setView("h3");
  };

  if (view !== "menu") {
    return (
      <div style={shell} data-skin-v1-local-ai="true" data-local-ai-view={view}>
        <section style={chromeBoundary} data-skin-chrome="solid" aria-labelledby="skin-v1-local-ai-section-title">
          <p style={{ margin: 0, color: "var(--pp-skin-accent-bright)", fontSize: 12, letterSpacing: ".08em" }}>PROFILE / LOCAL STORY MODE / {VIEW_TITLES[view]}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <h1 id="skin-v1-local-ai-section-title" style={{ margin: "5px 0", fontSize: 24 }}>{VIEW_TITLES[view]}</h1>
            <button type="button" onClick={() => setView("menu")} style={{ padding: "var(--pp-skin-space-2) var(--pp-skin-space-3)", border: "var(--pp-skin-border-thin) solid var(--pp-skin-accent)", borderRadius: "var(--pp-skin-radius)", background: "var(--pp-skin-surface-0)", color: "var(--pp-skin-ink)", font: "inherit", cursor: "pointer" }}>BACK TO LOCAL STORY MODE</button>
          </div>
        </section>

        {view === "writing" ? <AiRoutingPanel capability="text" locality="local" onManage={manageRoute} /> : null}
        {view === "images" ? <LocalComfyUiPanel /> : null}
        {view === "video" ? <LocalVideoPanel /> : null}
        {view === "ollama" ? <LocalRuntimePanel /> : null}
        {view === "comfyui" ? <LocalComfyUiPanel /> : null}
        {view === "ltx" ? <LocalLtxSetupPanel /> : null}
        {view === "h3" ? <LocalH3SetupPanel /> : null}
      </div>
    );
  }

  return (
    <div style={shell} data-skin-v1-local-ai="true" data-local-ai-view="menu">
      <section style={chromeBoundary} data-skin-chrome="solid" aria-labelledby="skin-v1-local-ai-title">
        <p style={{ margin: 0, color: "var(--pp-skin-accent-bright)", fontSize: 12, letterSpacing: ".08em" }}>PROFILE / LOCAL STORY MODE</p>
        <h1 id="skin-v1-local-ai-title" style={{ margin: "5px 0 4px", fontSize: 24 }}>LOCAL STORY MODE</h1>
      </section>

      <section style={statusPanel} aria-labelledby="plotpickle-default-title">
        <div>
          <h2 id="plotpickle-default-title" style={{ margin: 0, fontSize: 16, letterSpacing: ".09em" }}>PLOTPICKLE DEFAULT</h2>
          <p style={{ margin: "4px 0 0", color: "var(--pp-skin-accent-bright)", fontSize: 12, letterSpacing: ".08em" }}>AUTOMATIC / HARDWARE OPTIMIZED</p>
        </div>
        {(["writing", "images", "video"] as const).map((capability) => (
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
        aria-label="Local Story Mode directory"
        data-skin-menu="local-story-mode"
      >
        {LOCAL_MENU.map((item, index) => {
          const selected = index === menuSelectedIndex;
          const showGroup = index === 0 || LOCAL_MENU[index - 1]?.group !== item.group;
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
                  aria-label="Connected Local Story Mode destination"
                  data-skin-menu-indicator="connected"
                />
              </button>
            </Fragment>
          );
        })}
      </div>

      <footer style={{ ...chromeBoundary, margin: "var(--pp-skin-space-4) 0 0", color: "var(--pp-skin-ink-soft)", fontSize: 13 }} data-skin-chrome="solid">
        Local Story Mode defaults to local, hardware-aware AI. Opening it does not change an existing route, and a local failure does not silently fall back to a paid cloud provider. These screens are for reviewing or changing the local defaults.
      </footer>
    </div>
  );
}
