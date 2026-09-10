"use client";

import { useCallback, useEffect, useState } from "react";
import AiRoutingPanel from "../ai-routing-panel";
import LocalRuntimePanel from "../local-runtime-panel";
import LocalComfyUiPanel from "./local-comfyui-panel";
import LocalH3SetupPanel from "./local-h3-setup-panel";
import LocalLtxSetupPanel from "./local-ltx-setup-panel";
import LocalVideoPanel from "./local-video-panel";

type LocalAiView = "menu" | "writing" | "images" | "video" | "ollama" | "comfyui" | "ltx" | "h3";
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

const statusPanel: React.CSSProperties = {
  ...boundary,
  display: "grid",
  gap: "var(--pp-skin-space-3)",
  background: "var(--pp-skin-fill-panel)",
};

const menuSection: React.CSSProperties = {
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-line)",
  background: "var(--pp-skin-surface-1)",
  padding: "var(--pp-skin-space-3)",
  marginBottom: "var(--pp-skin-space-3)",
  boxShadow: "var(--pp-skin-inset-highlight)",
};

const menuButton: React.CSSProperties = {
  width: "100%",
  display: "grid",
  gridTemplateColumns: "minmax(120px, 0.55fr) 1fr auto",
  gap: "var(--pp-skin-space-3)",
  alignItems: "center",
  minHeight: "var(--pp-skin-touch-target)",
  padding: "var(--pp-skin-space-3)",
  border: 0,
  borderTop: "var(--pp-skin-border-thin) solid var(--pp-skin-line)",
  borderRadius: "var(--pp-skin-radius)",
  background: "var(--pp-skin-surface-0)",
  color: "var(--pp-skin-ink)",
  textAlign: "left",
  font: "inherit",
  cursor: "pointer",
};

const TASKS: Array<{ id: LocalAiView; label: string; detail: string }> = [
  { id: "writing", label: "WRITING", detail: "Story, Sage and PLAN" },
  { id: "images", label: "IMAGES", detail: "Local artwork and visual generation" },
  { id: "video", label: "VIDEO", detail: "Local motion and previs generation" },
];

const ENGINES: Array<{ id: LocalAiView; label: string; detail: string }> = [
  { id: "ollama", label: "OLLAMA", detail: "Local text runtime and models" },
  { id: "comfyui", label: "COMFYUI", detail: "Local image and video engine" },
  { id: "ltx", label: "LTX-VIDEO", detail: "Default local text-to-video plug-in" },
  { id: "h3", label: "MINIMAX H3", detail: "Advanced local video plug-in and setup" },
];

const VIEW_TITLES: Record<Exclude<LocalAiView, "menu">, string> = {
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

function MenuGroup({ title, items, onOpen }: { title: string; items: typeof TASKS; onOpen: (view: LocalAiView) => void }) {
  return (
    <section style={menuSection} aria-labelledby={`local-ai-${title.toLowerCase()}-title`}>
      <h2 id={`local-ai-${title.toLowerCase()}-title`} style={{ margin: "2px 4px 8px", fontSize: 12, letterSpacing: ".16em", color: "var(--pp-skin-accent-bright)" }}>{title}</h2>
      {items.map((item) => (
        <button type="button" key={item.id} style={menuButton} onClick={() => onOpen(item.id)}>
          <strong>{item.label}</strong>
          <span style={{ color: "var(--pp-skin-ink-soft)", fontSize: 13 }}>{item.detail}</span>
          <span aria-hidden="true" style={{ color: "var(--pp-skin-accent-bright)" }}>&gt;</span>
        </button>
      ))}
    </section>
  );
}

export default function LocalAiSkinHost() {
  const [view, setView] = useState<LocalAiView>("menu");
  const [routing, setRouting] = useState<RoutingStatus | null>(null);
  const [mediaImages, setMediaImages] = useState<MediaImageStatus | null>(null);
  const [videoPlugin, setVideoPlugin] = useState<VideoPluginStatus | null>(null);

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

  const manageRoute = (target: "ollama" | "openai" | "gemini" | "minimax" | "comfyui") => {
    if (target === "ollama") setView("ollama");
    if (target === "comfyui") setView("comfyui");
    if (target === "minimax") setView("h3");
  };

  if (view !== "menu") {
    return (
      <div style={shell} data-skin-v1-local-ai="true" data-local-ai-view={view}>
        <section style={boundary} aria-labelledby="skin-v1-local-ai-section-title">
          <p style={{ margin: 0, color: "var(--pp-skin-accent-bright)", fontSize: 12, letterSpacing: ".08em" }}>PROFILE / LOCAL AI / {VIEW_TITLES[view]}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <h1 id="skin-v1-local-ai-section-title" style={{ margin: "5px 0", fontSize: 24 }}>{VIEW_TITLES[view]}</h1>
            <button type="button" onClick={() => setView("menu")} style={{ padding: "var(--pp-skin-space-2) var(--pp-skin-space-3)", border: "var(--pp-skin-border-thin) solid var(--pp-skin-accent)", borderRadius: "var(--pp-skin-radius)", background: "var(--pp-skin-surface-0)", color: "var(--pp-skin-ink)", font: "inherit", cursor: "pointer" }}>BACK TO LOCAL AI</button>
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
      <section style={boundary} aria-labelledby="skin-v1-local-ai-title">
        <p style={{ margin: 0, color: "var(--pp-skin-accent-bright)", fontSize: 12, letterSpacing: ".08em" }}>PROFILE / LOCAL AI</p>
        <h1 id="skin-v1-local-ai-title" style={{ margin: "5px 0 4px", fontSize: 24 }}>LOCAL AI</h1>
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

      <MenuGroup title="TASKS" items={TASKS} onOpen={setView} />
      <MenuGroup title="ENGINES" items={ENGINES} onOpen={setView} />

      <footer style={{ ...boundary, margin: "var(--pp-skin-space-4) 0 0", color: "var(--pp-skin-ink-soft)", fontSize: 13 }}>
        PlotPickle defaults to local, hardware-aware AI. Opening Local AI does not change an existing route, and a local failure does not silently fall back to a paid cloud provider. These screens are for reviewing or changing the defaults.
      </footer>
    </div>
  );
}
