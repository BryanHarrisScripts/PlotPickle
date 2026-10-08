"use client";

import { authenticatedComputeFetch as fetch } from "../../core/auth/profile-request-browser";

import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import ComputeReadyMarker from "./compute-ready-marker";
import LocalComfyUiApiVideoSetup from "./local-comfyui-api-video-setup";
import LocalRuntimePanel from "../local-runtime-panel";
import LocalComfyUiPanel from "./local-comfyui-panel";
import LocalH3SetupPanel from "./local-h3-setup-panel";
import LocalLtxSetupPanel from "./local-ltx-setup-panel";
import StoryModeCapabilityConnections, {
  type StoryModeCapability,
  type StoryModeConnectionRow,
  type StoryModeConnectionState,
} from "./story-mode-capability-connections";

type LocalAiView = "menu" | StoryModeCapability | "ollama" | "comfyui" | "ltx" | "h3";
type LocalMenuView = Exclude<LocalAiView, "menu">;
type CapabilityKey = StoryModeCapability;
type RoutingCapability = "text" | "image" | "video";
type RoutingOption = {
  configured: boolean;
  ready: boolean;
  model: string;
  verifiedAt: string;
  error: string;
  locality: string;
  cost?: string;
  settingsTarget?: string;
};
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
type LocalPlugin = {
  id: string;
  label: string;
  description: string;
  runtimeProviderId: string;
  preset: string;
};
type VideoPluginStatus = {
  recommendation: {
    selected: LocalPlugin | null;
    candidates: LocalPlugin[];
    ready: boolean;
    active: boolean;
    configured?: boolean;
    runtimeReady?: boolean;
    error: string;
  };
};
type LocalMenuItem = Readonly<{
  id: LocalMenuView;
  shortcut: string;
  detail: string;
  group: "CAPABILITIES" | "CONNECTIONS";
}>;

const LOCAL_SDXL_CHECKPOINT = "sd_xl_base_1.0.safetensors";
const LTX_PLUGIN_ID = "video.ltx-video-2b-0.9.8-distilled";
const H3_PLUGIN_ID = "video.minimax-h3";

const shell: React.CSSProperties = {
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
  { id: "writing", shortcut: "W", detail: "Local story writing, planning and reasoning", group: "CAPABILITIES" },
  { id: "images", shortcut: "I", detail: "Local artwork and visual generation", group: "CAPABILITIES" },
  { id: "video", shortcut: "V", detail: "Local motion and previs generation", group: "CAPABILITIES" },
  { id: "agents", shortcut: "A", detail: "Local text compute available to PlotPickle Agents", group: "CAPABILITIES" },
  { id: "ollama", shortcut: "O", detail: "Local writing and Agent models running on this computer", group: "CONNECTIONS" },
  { id: "comfyui", shortcut: "C", detail: "Local image and video workflow engine using this computer's GPU", group: "CONNECTIONS" },
  { id: "ltx", shortcut: "L", detail: "Local video-generation workflow through ComfyUI", group: "CONNECTIONS" },
  { id: "h3", shortcut: "H", detail: "Advanced local MiniMax H3 text-to-video workflow through ComfyUI", group: "CONNECTIONS" },
];

const LOCAL_DISPLAY_LABELS: Record<LocalMenuView, string> = {
  writing: "Writing",
  images: "Images",
  video: "Video",
  agents: "Agents",
  ollama: "Ollama",
  comfyui: "ComfyUI",
  ltx: "LTX-Video",
  h3: "MiniMax H3",
};

const VIEW_TITLES: Record<LocalMenuView, string> = LOCAL_DISPLAY_LABELS;

const LOCAL_DETAILS: Record<"ollama" | "comfyui" | "ltx" | "h3", string> = {
  ollama: "Runs AI text models on this computer. Used for Writing, PLAN, Sage and supported Agents. No cloud API account or per-request provider charge is required.",
  comfyui: "Runs visual-generation workflows on this computer using the available GPU. PlotPickle uses ComfyUI underneath supported local image and video tools.",
  ltx: "Used for local motion, Previs and video generation. LTX-Video runs through the local ComfyUI workflow and does not contact a cloud video provider.",
  h3: "PlotPickle uses H3 locally for its constrained text-to-video path with ComfyUI as the runtime underneath. It is separate from the MiniMax cloud API.",
};

function routingCapability(capability: CapabilityKey): RoutingCapability {
  if (capability === "writing" || capability === "agents") return "text";
  return capability === "images" ? "image" : "video";
}

function connectionState(option: RoutingOption | undefined): StoryModeConnectionState {
  if (!option) return "setup";
  if (option.error) return "error";
  if (option.ready) return "ready";
  if (option.configured) return "needs-test";
  return "setup";
}

function setupActionLabel(state: StoryModeConnectionState) {
  if (state === "ready") return "Change model";
  if (state === "needs-test" || state === "error") return "Test / setup";
  return "Set up";
}

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
  return <ComputeReadyMarker ready={ready} label={label} />;
}

export default function LocalAiSkinHost() {
  const [view, setView] = useState<LocalAiView>("menu");
  const [routing, setRouting] = useState<RoutingStatus | null>(null);
  const [mediaImages, setMediaImages] = useState<MediaImageStatus | null>(null);
  const [videoPlugin, setVideoPlugin] = useState<VideoPluginStatus | null>(null);
  const [notice, setNotice] = useState("");
  const [menuSelectedIndex, setMenuSelectedIndex] = useState(0);
  const menuRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const refreshStatus = useCallback(async () => {
    const [routingResponse, mediaResponse, videoResponse] = await Promise.all([
      fetch("/api/ai-routing/status", { cache: "no-store" }).catch(() => null),
      fetch("/api/media-routing/status", { cache: "no-store" }).catch(() => null),
      fetch("/api/local-ai/plugins/video", { cache: "no-store" }).catch(() => null),
    ]);
    setRouting(routingResponse?.ok ? await routingResponse.json() as RoutingStatus : null);
    if (mediaResponse?.ok) setMediaImages(await mediaResponse.json() as MediaImageStatus);
    if (videoResponse?.ok) setVideoPlugin(await videoResponse.json() as VideoPluginStatus);
  }, []);

  useEffect(() => {
    void refreshStatus();
    const refresh = () => void refreshStatus();
    const openConnection = (event: Event) => {
      const target = (event as CustomEvent<string>).detail;
      if (target === "comfyui") setView("comfyui");
      if (target === "ollama") setView("ollama");
      if (target === "ltx") setView("ltx");
      if (target === "minimax") setView("h3");
    };
    window.addEventListener("plotpickle:setup-status-refresh", refresh);
    window.addEventListener("plotpickle:settings-section", openConnection);
    return () => {
      window.removeEventListener("plotpickle:setup-status-refresh", refresh);
      window.removeEventListener("plotpickle:settings-section", openConnection);
    };
  }, [refreshStatus]);

  const lights: Record<CapabilityKey, boolean> = {
    writing: Object.values(routing?.text.options || {}).some((option) => option.locality === "local" && option.ready),
    images: Object.values(routing?.image.options || {}).some((option) => option.locality === "local" && option.ready),
    video: Object.values(routing?.video.options || {}).some((option) => option.locality === "local" && option.ready),
    agents: Object.values(routing?.text.options || {}).some((option) => option.locality === "local" && option.ready),
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
    setNotice("");
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

  function ollamaConnection(capability: CapabilityKey): StoryModeConnectionRow {
    const group = routing?.text;
    const option = group?.options.ollama;
    const state = connectionState(option);
    return {
      id: "ollama",
      label: "Ollama",
      role: capability === "agents" ? "Local Agent text models" : "Local writing and planning models",
      detail: LOCAL_DETAILS.ollama,
      state,
      model: option?.model || undefined,
      active: Boolean(option?.ready && group?.selected === "ollama" && option.locality === "local"),
      setupLabel: setupActionLabel(state),
      onSetup: () => setView("ollama"),
    };
  }

  function imageComfyConnection(): StoryModeConnectionRow {
    const option = routing?.image.options.comfyui;
    let state = connectionState(option);
    const fixedReady = fixedLocalImagesReady(mediaImages);
    if (option?.ready) state = "ready";
    else if (option?.error) state = "error";
    else if (mediaImages?.comfyui.reachable || option?.configured) state = "needs-test";
    else state = "setup";
    return {
      id: "comfyui",
      label: "ComfyUI",
      role: "Local image workflow engine",
      detail: LOCAL_DETAILS.comfyui,
      state,
      model: option?.model || (mediaImages?.comfyui.checkpoints?.find((checkpoint) => checkpoint.toLowerCase() === LOCAL_SDXL_CHECKPOINT.toLowerCase()) ?? undefined),
      active: Boolean(fixedReady && routing?.image.selected === "comfyui"),
      setupLabel: state === "ready" ? "Open setup" : state === "needs-test" || state === "error" ? "Test / setup" : "Set up",
      onSetup: () => setView("comfyui"),
    };
  }

  function videoRuntimeConnection(): StoryModeConnectionRow {
    const option = routing?.video.options["minimax-comfyui"];
    return { id: "minimax-comfyui", label: "ComfyUI", role: "MiniMax API video workflow", detail: "Local ComfyUI runs the workflow; MiniMax generates video using your API account.", state: connectionState(option), model: option?.model, active: routing?.video.selected === "minimax-comfyui", setupLabel: "Setup", onSetup: () => setView("comfyui") };
  }

  function videoPluginConnection(kind: "ltx" | "h3"): StoryModeConnectionRow {
    const pluginId = kind === "ltx" ? LTX_PLUGIN_ID : H3_PLUGIN_ID;
    const label = kind === "ltx" ? "LTX-Video" : "MiniMax H3";
    const recommendation = videoPlugin?.recommendation;
    const selected = recommendation?.selected?.id === pluginId;
    const candidate = selected
      ? recommendation?.selected ?? null
      : recommendation?.candidates?.find((item) => item.id === pluginId) ?? null;
    const ready = Boolean(selected && recommendation?.ready && recommendation?.active);
    const state: StoryModeConnectionState = ready
      ? "ready"
      : selected && recommendation?.error
        ? "error"
        : candidate && recommendation?.configured
          ? "needs-test"
          : "setup";
    return {
      id: kind,
      label,
      role: kind === "ltx" ? "Local video-generation workflow" : "Advanced local text-to-video workflow",
      detail: LOCAL_DETAILS[kind],
      state,
      model: candidate?.preset || (selected ? candidate?.label : undefined),
      active: ready,
      setupLabel: ready ? "Open setup" : state === "needs-test" || state === "error" ? "Test / setup" : "Set up",
      onSetup: () => setView(kind),
    };
  }

  function capabilityConnections(capability: CapabilityKey): StoryModeConnectionRow[] {
    if (capability === "writing" || capability === "agents") return [ollamaConnection(capability)];
    if (capability === "images") return [imageComfyConnection()];
    return [videoRuntimeConnection(), { id: "comfyui-native", label: "ComfyUI — Native local inference", role: "Local H3 weights", detail: LOCAL_DETAILS.h3, state: connectionState(routing?.video.options["comfyui-native"]), setupLabel: "Setup", onSetup: () => setView("h3") }];
  }

  if (view !== "menu") {
    const capability = view === "writing" || view === "images" || view === "video" || view === "agents" ? view : null;
    return (
      <div style={shell} data-skin-v1-local-ai="true" data-local-ai-view={view}>
        <section style={chromeBoundary} data-skin-chrome="solid" aria-labelledby="skin-v1-local-ai-section-title">
          <p style={{ margin: 0, color: "var(--pp-skin-accent-bright)", fontSize: 12, letterSpacing: ".08em" }}>SETTINGS / LOCAL STORY MODE / {VIEW_TITLES[view].toUpperCase()}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <h1 id="skin-v1-local-ai-section-title" style={{ margin: "5px 0", fontSize: 24 }}>{VIEW_TITLES[view]}</h1>
            <button type="button" onClick={() => setView("menu")} style={{ padding: "var(--pp-skin-space-2) var(--pp-skin-space-3)", border: "var(--pp-skin-border-thin) solid var(--pp-skin-accent)", borderRadius: "var(--pp-skin-radius)", background: "var(--pp-skin-surface-0)", color: "var(--pp-skin-ink)", font: "inherit", cursor: "pointer" }}>Back to Local Story Mode</button>
          </div>
        </section>

        {capability ? (
          <StoryModeCapabilityConnections
            mode="local"
            capability={capability}
            connections={capabilityConnections(capability)}
            notice={notice}
          />
        ) : null}
        {view === "ollama" ? <LocalRuntimePanel /> : null}
        {view === "comfyui" ? <><LocalComfyUiPanel /><LocalComfyUiApiVideoSetup /></> : null}
        {view === "ltx" ? <LocalLtxSetupPanel /> : null}
        {view === "h3" ? <LocalH3SetupPanel /> : null}
      </div>
    );
  }

  return (
    <div style={shell} data-skin-v1-local-ai="true" data-local-ai-view="menu">
      <section style={chromeBoundary} data-skin-chrome="solid" aria-labelledby="skin-v1-local-ai-title">
        <p style={{ margin: 0, color: "var(--pp-skin-accent-bright)", fontSize: 12, letterSpacing: ".08em" }}>SETTINGS / LOCAL STORY MODE</p>
        <h1 id="skin-v1-local-ai-title" style={{ margin: "5px 0 4px", fontSize: 24 }}>LOCAL STORY MODE</h1>
      </section>

      <section style={statusPanel} aria-labelledby="plotpickle-default-title">
        <div>
          <h2 id="plotpickle-default-title" style={{ margin: 0, fontSize: 16, letterSpacing: ".09em" }}>PLOTPICKLE LOCAL</h2>
          <p style={{ margin: "4px 0 0", color: "var(--pp-skin-accent-bright)", fontSize: 12, letterSpacing: ".08em" }}>THIS COMPUTER / NO CLOUD PROVIDER CHARGES</p>
        </div>
        {(["writing", "images", "video", "agents"] as const).map((capability) => (
          <div key={capability} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: "7px 0", borderTop: "var(--pp-skin-border-thin) solid var(--pp-skin-line)" }}>
            <strong>{LOCAL_DISPLAY_LABELS[capability]}</strong>
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
          const command = `[${item.shortcut}] ${LOCAL_DISPLAY_LABELS[item.id]}`.padEnd(24, " ");
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
                <span className="pp-skin-v1-dashboard-command">{command}</span>
                <span className="pp-skin-v1-dashboard-description">{item.detail}</span>
                <span
                  className="pp-skin-v1-dashboard-status-box is-active"
                  aria-label="Connected Local Story Mode destination"
                  data-dashboard-status="active"
                  data-skin-menu-indicator={"connected"}
                />
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
