"use client";

import { useCallback, useEffect, useState } from "react";
import AiRoutingPanel from "../ai-routing-panel";
import H3NativePanel from "../h3-native-panel";
import LocalRuntimePanel from "../local-runtime-panel";
import LocalComfyUiPanel from "./local-comfyui-panel";

type LocalAiView = "menu" | "writing" | "images" | "video" | "ollama" | "comfyui" | "h3";
type CapabilityKey = "writing" | "images" | "video";
type RoutingOption = { ready: boolean; locality: string };
type RoutingGroup = { selected: string; options: Record<string, RoutingOption> };
type RoutingStatus = { text: RoutingGroup; image: RoutingGroup; video: RoutingGroup };
type LocalImageStatus = {
  imageRoute: string;
  comfyui: {
    reachable: boolean;
    checkpoints: string[];
    imageNodesReady: boolean;
    selectedCheckpoint?: string;
  };
};

const LOCAL_IMAGE_CHECKPOINT = "sd_xl_base_1.0.safetensors";

const shell: React.CSSProperties = {
  minHeight: "100vh",
  padding: "14px clamp(10px, 2vw, 24px) 28px",
  background: "linear-gradient(180deg, #050605, #080b09 48%, #020302)",
  color: "#ededed",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

const boundary: React.CSSProperties = {
  margin: "0 0 14px",
  padding: "14px 16px",
  border: "1px solid #287a4b",
  background: "linear-gradient(110deg, #123524, #101310 48%, #080908)",
  lineHeight: 1.5,
};

const statusPanel: React.CSSProperties = {
  ...boundary,
  display: "grid",
  gap: 12,
  background: "linear-gradient(120deg, #07110b, #0d160f 56%, #050705)",
};

const menuSection: React.CSSProperties = {
  border: "1px solid #1c3f2b",
  background: "rgba(4, 7, 5, 0.86)",
  padding: 10,
  marginBottom: 12,
};

const menuButton: React.CSSProperties = {
  width: "100%",
  display: "grid",
  gridTemplateColumns: "minmax(120px, 0.55fr) 1fr auto",
  gap: 12,
  alignItems: "center",
  minHeight: 52,
  padding: "10px 12px",
  border: 0,
  borderTop: "1px solid #183723",
  background: "#050705",
  color: "#ededed",
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
  { id: "h3", label: "MINIMAX H3", detail: "Advanced local H3 video workflow" },
];

const VIEW_TITLES: Record<Exclude<LocalAiView, "menu">, string> = {
  writing: "WRITING",
  images: "IMAGES",
  video: "VIDEO",
  ollama: "OLLAMA",
  comfyui: "COMFYUI",
  h3: "MINIMAX H3",
};

function localReady(group: RoutingGroup | undefined) {
  if (!group) return false;
  const option = group.options[group.selected];
  return Boolean(option?.ready && option.locality === "local");
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
        borderRadius: "50%",
        border: `1px solid ${ready ? "#79bd92" : "#284333"}`,
        background: ready ? "#79bd92" : "#14251a",
        boxShadow: ready ? "0 0 6px #287a4b, 0 0 13px rgba(121, 189, 146, 0.55)" : "none",
        justifySelf: "end",
      }}
    />
  );
}

function MenuGroup({ title, items, onOpen }: { title: string; items: typeof TASKS; onOpen: (view: LocalAiView) => void }) {
  return (
    <section style={menuSection} aria-labelledby={`local-ai-${title.toLowerCase()}-title`}>
      <h2 id={`local-ai-${title.toLowerCase()}-title`} style={{ margin: "2px 4px 8px", fontSize: 12, letterSpacing: ".16em", color: "#79bd92" }}>{title}</h2>
      {items.map((item) => (
        <button type="button" key={item.id} style={menuButton} onClick={() => onOpen(item.id)}>
          <strong>{item.label}</strong>
          <span style={{ color: "#aeb9b1", fontSize: 13 }}>{item.detail}</span>
          <span aria-hidden="true" style={{ color: "#79bd92" }}>&gt;</span>
        </button>
      ))}
    </section>
  );
}

function exactLocalSdxl(checkpoints: readonly string[]) {
  return checkpoints.find((checkpoint) => checkpoint.trim().toLowerCase() === LOCAL_IMAGE_CHECKPOINT) || "";
}

export default function LocalAiSkinHost() {
  const [view, setView] = useState<LocalAiView>("menu");
  const [routing, setRouting] = useState<RoutingStatus | null>(null);
  const [imagesReady, setImagesReady] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const [routingResponse, imageResponse] = await Promise.all([
        fetch("/api/ai-routing/status", { cache: "no-store" }),
        fetch("/api/media-routing/status", { cache: "no-store" }),
      ]);
      if (routingResponse.ok) setRouting(await routingResponse.json() as RoutingStatus);
      if (imageResponse.ok) {
        let imageStatus = await imageResponse.json() as LocalImageStatus;
        const checkpoint = exactLocalSdxl(imageStatus.comfyui.checkpoints || []);
        const ready = Boolean(imageStatus.comfyui.reachable && imageStatus.comfyui.imageNodesReady && checkpoint);
        if (ready && (imageStatus.comfyui.selectedCheckpoint || "").toLowerCase() !== checkpoint.toLowerCase()) {
          const bindResponse = await fetch("/api/media-routing/comfyui/checkpoint", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ checkpoint }),
          });
          if (bindResponse.ok) imageStatus = await bindResponse.json() as LocalImageStatus;
        }
        setImagesReady(Boolean(imageStatus.comfyui.reachable && imageStatus.comfyui.imageNodesReady && exactLocalSdxl(imageStatus.comfyui.checkpoints || [])));
      }
    } catch {
      // The packaged local app owns these same-origin APIs. A dim light is safer than inventing readiness.
      setImagesReady(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    const refresh = () => void refreshStatus();
    const openEngine = (event: Event) => {
      const target = (event as CustomEvent<string>).detail;
      if (target === "comfyui") setView("comfyui");
      if (target === "ollama") setView("ollama");
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
    images: imagesReady,
    video: localReady(routing?.video),
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
          <p style={{ margin: 0, color: "#79bd92", fontSize: 12, letterSpacing: ".08em" }}>PROFILE / LOCAL AI / {VIEW_TITLES[view]}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <h1 id="skin-v1-local-ai-section-title" style={{ margin: "5px 0", fontSize: 24 }}>{VIEW_TITLES[view]}</h1>
            <button type="button" onClick={() => setView("menu")} style={{ padding: "8px 12px", border: "1px solid #287a4b", background: "#050705", color: "#ededed", font: "inherit", cursor: "pointer" }}>BACK TO LOCAL AI</button>
          </div>
        </section>

        {view === "writing" ? <AiRoutingPanel capability="text" locality="local" onManage={manageRoute} /> : null}
        {view === "images" ? <LocalComfyUiPanel /> : null}
        {view === "video" ? <AiRoutingPanel capability="video" locality="local" onManage={manageRoute} /> : null}
        {view === "ollama" ? <LocalRuntimePanel /> : null}
        {view === "comfyui" ? <LocalComfyUiPanel /> : null}
        {view === "h3" ? <H3NativePanel /> : null}
      </div>
    );
  }

  return (
    <div style={shell} data-skin-v1-local-ai="true" data-local-ai-view="menu">
      <section style={boundary} aria-labelledby="skin-v1-local-ai-title">
        <p style={{ margin: 0, color: "#79bd92", fontSize: 12, letterSpacing: ".08em" }}>PROFILE / LOCAL AI</p>
        <h1 id="skin-v1-local-ai-title" style={{ margin: "5px 0 4px", fontSize: 24 }}>LOCAL AI</h1>
      </section>

      <section style={statusPanel} aria-labelledby="plotpickle-default-title">
        <div>
          <h2 id="plotpickle-default-title" style={{ margin: 0, fontSize: 16, letterSpacing: ".09em" }}>PLOTPICKLE DEFAULT</h2>
          <p style={{ margin: "4px 0 0", color: "#79bd92", fontSize: 12, letterSpacing: ".08em" }}>AUTOMATIC / HARDWARE OPTIMIZED</p>
        </div>
        {(["writing", "images", "video"] as const).map((capability) => (
          <div key={capability} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: "7px 0", borderTop: "1px solid #163420" }}>
            <strong>{capability.toUpperCase()}</strong>
            <StatusLight label={capability} ready={lights[capability]} />
          </div>
        ))}
      </section>

      <MenuGroup title="TASKS" items={TASKS} onOpen={setView} />
      <MenuGroup title="ENGINES" items={ENGINES} onOpen={setView} />

      <footer style={{ ...boundary, margin: "16px 0 0", color: "#cbd6ce", fontSize: 13 }}>
        PlotPickle defaults to local, hardware-aware AI. Opening Local AI does not change an existing route, and a local failure does not silently fall back to a paid cloud provider. These screens are for reviewing or changing the defaults.
      </footer>
    </div>
  );
}
