"use client";

import { useCallback, useEffect, useState } from "react";
import AiRoutingPanel from "../ai-routing-panel";
import CloudModelCatalogPanel from "../settings/compute/cloud-model-catalog-panel";
import GeminiProviderSetupPanel from "../settings/ai-provider/gemini-provider-setup-panel";
import CloudProviderSetupPanel from "./cloud-provider-setup-panel";

type CloudStoryView = "menu" | "writing" | "images" | "video" | "agents" | "openai" | "minimax" | "gemini";
type CapabilityKey = "writing" | "images" | "video" | "agents";
type RoutingOption = { configured: boolean; ready: boolean; locality: string };
type RoutingGroup = { selected: string; options: Record<string, RoutingOption> };
type RoutingStatus = { text: RoutingGroup; image: RoutingGroup; video: RoutingGroup };

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

const TASKS: Array<{ id: CloudStoryView; label: string; detail: string }> = [
  { id: "writing", label: "WRITING", detail: "Cloud writing and story reasoning" },
  { id: "images", label: "IMAGES", detail: "Cloud artwork and visual generation" },
  { id: "video", label: "VIDEO", detail: "Cloud motion and previs generation" },
  { id: "agents", label: "AGENTS", detail: "Cloud text compute available to PlotPickle Agents" },
];

const RESOURCES: Array<{ id: CloudStoryView; label: string; detail: string }> = [
  { id: "openai", label: "OPENAI", detail: "User-owned OpenAI API authority for supported writing and image tasks" },
  { id: "minimax", label: "MINIMAX", detail: "User-owned MiniMax API authority for supported writing, image and video tasks" },
  { id: "gemini", label: "GOOGLE GEMINI", detail: "User-owned Gemini authority for supported writing and Agent text tasks" },
];

const VIEW_TITLES: Record<Exclude<CloudStoryView, "menu">, string> = {
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

function MenuGroup({ title, items, onOpen }: { title: string; items: typeof TASKS; onOpen: (view: CloudStoryView) => void }) {
  return (
    <section style={menuSection} aria-labelledby={`cloud-story-${title.toLowerCase()}-title`}>
      <h2 id={`cloud-story-${title.toLowerCase()}-title`} style={{ margin: "2px 4px 8px", fontSize: 12, letterSpacing: ".16em", color: "var(--pp-skin-accent-bright)" }}>{title}</h2>
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

export default function CloudStoryModeHost() {
  const [view, setView] = useState<CloudStoryView>("menu");
  const [routing, setRouting] = useState<RoutingStatus | null>(null);

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

      <MenuGroup title="TASKS" items={TASKS} onOpen={setView} />
      <MenuGroup title="CLOUD RESOURCES" items={RESOURCES} onOpen={setView} />

      <footer style={{ ...chromeBoundary, margin: "var(--pp-skin-space-4) 0 0", color: "var(--pp-skin-ink-soft)", fontSize: 13 }} data-skin-chrome="solid">
        Cloud Story Mode uses credentials owned by the current human profile. Saving authority does not activate a paid route. Writing, image and video tests require an explicit user action, and PlotPickle never silently falls back to a paid provider.
      </footer>
    </div>
  );
}