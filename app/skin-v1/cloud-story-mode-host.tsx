"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import GeminiProviderSetupPanel from "../settings/ai-provider/gemini-provider-setup-panel";
import CloudProviderSetupPanel from "./cloud-provider-setup-panel";
import ComfyCloudSetupPanel from "./comfy-cloud-setup-panel";
import StoryModeCapabilityConnections, {
  type StoryModeCapability,
  type StoryModeConnectionRow,
  type StoryModeConnectionState,
} from "./story-mode-capability-connections";

type CloudStoryView = "menu" | StoryModeCapability | "openai" | "comfy-cloud" | "gemini" | "minimax";
type CloudMenuView = Exclude<CloudStoryView, "menu">;
type CapabilityKey = StoryModeCapability;
type RoutingCapability = "text" | "image" | "video";
type CloudRoute = "openai" | "gemini" | "minimax";
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
type ComfyCloudStatus = {
  configured: boolean;
  tested: boolean;
  defaultLane?: string;
};
type CloudMenuItem = Readonly<{
  id: CloudMenuView;
  shortcut: string;
  detail: string;
  group: "CAPABILITIES" | "CONNECTIONS";
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
  { id: "writing", shortcut: "W", detail: "Cloud writing and story reasoning", group: "CAPABILITIES" },
  { id: "images", shortcut: "I", detail: "Cloud artwork and visual generation", group: "CAPABILITIES" },
  { id: "video", shortcut: "V", detail: "Cloud motion and previs generation", group: "CAPABILITIES" },
  { id: "agents", shortcut: "A", detail: "Cloud text compute available to PlotPickle Agents", group: "CAPABILITIES" },
  { id: "openai", shortcut: "O", detail: "OpenAI API connection for supported cloud Writing, Images and Agent work", group: "CONNECTIONS" },
  { id: "comfy-cloud", shortcut: "C", detail: "Remote ComfyUI workflow connection for compatible image and video production", group: "CONNECTIONS" },
  { id: "gemini", shortcut: "G", detail: "Google Gemini API connection for supported cloud Writing and Agent text work", group: "CONNECTIONS" },
  { id: "minimax", shortcut: "M", detail: "MiniMax cloud API connection for Writing, Images, Video and Agent text work", group: "CONNECTIONS" },
];

const CLOUD_DISPLAY_LABELS: Record<CloudMenuView, string> = {
  writing: "Writing",
  images: "Images",
  video: "Video",
  agents: "Agents",
  openai: "OpenAI",
  "comfy-cloud": "ComfyUI",
  gemini: "Gemini",
  minimax: "MiniMax",
};

const VIEW_TITLES: Record<CloudMenuView, string> = CLOUD_DISPLAY_LABELS;

const CLOUD_DETAILS: Record<"openai" | "comfy-cloud" | "gemini" | "minimax", string> = {
  openai: "Uses your OpenAI API credential for supported cloud Writing, Images and Agent work. This is an OpenAI API connection, not a ChatGPT subscription. API requests may incur provider charges.",
  "comfy-cloud": "Connects to supported ComfyUI workflows running away from this computer for compatible remote/cloud image and video production.",
  gemini: "Uses your Google Gemini API credential for supported cloud Writing and Agent text work.",
  minimax: "Uses your MiniMax API credential for supported cloud Writing, Images, Video and Agent text work. This cloud service is separate from the local MiniMax H3 workflow.",
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
        borderRadius: "50%",
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
  const [comfyCloud, setComfyCloud] = useState<ComfyCloudStatus | null>(null);
  const [paidAcknowledged, setPaidAcknowledged] = useState(false);
  const [dataSharingAcknowledged, setDataSharingAcknowledged] = useState(false);
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState("");
  const [menuSelectedIndex, setMenuSelectedIndex] = useState(0);
  const menuRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const refreshStatus = useCallback(async () => {
    const [routingResponse, comfyResponse] = await Promise.all([
      fetch("/api/ai-routing/status", { cache: "no-store" }).catch(() => null),
      fetch("/api/cloud-story-mode/comfy-cloud", { cache: "no-store", credentials: "same-origin" }).catch(() => null),
    ]);
    if (routingResponse?.ok) setRouting(await routingResponse.json() as RoutingStatus);
    if (comfyResponse?.ok) setComfyCloud(await comfyResponse.json() as ComfyCloudStatus);
  }, []);

  useEffect(() => {
    void refreshStatus();
    const refresh = () => void refreshStatus();
    window.addEventListener("plotpickle:setup-status-refresh", refresh);
    return () => window.removeEventListener("plotpickle:setup-status-refresh", refresh);
  }, [refreshStatus]);

  const lights: Record<CapabilityKey, boolean> = {
    writing: cloudReady(routing?.text),
    images: cloudReady(routing?.image) || Boolean(comfyCloud?.tested),
    video: cloudReady(routing?.video) || Boolean(comfyCloud?.tested),
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
    setNotice("");
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

  async function selectCloudRoute(capability: CapabilityKey, route: CloudRoute) {
    if (working) return;
    if (!paidAcknowledged) {
      setNotice("Confirm that remote provider API requests may incur charges before choosing a cloud route.");
      return;
    }
    const capabilityId = routingCapability(capability);
    if (capabilityId === "video" && !dataSharingAcknowledged) {
      setNotice("Confirm that cloud video prompts and selected reference media may leave this computer before choosing a cloud video route.");
      return;
    }
    const option = routing?.[capabilityId].options[route];
    if (!option?.ready) {
      setNotice(`${CLOUD_DISPLAY_LABELS[route]} is not ready yet. Open its Connection page and complete setup/testing first.`);
      return;
    }

    setWorking(`${capability}:${route}`);
    setNotice("");
    try {
      const response = await fetch("/api/ai-routing/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capability: capabilityId,
          route,
          paidAcknowledged: true,
          dataSharingAcknowledged: capabilityId === "video" ? dataSharingAcknowledged : false,
        }),
      });
      const body = await response.json() as RoutingStatus & { message?: string };
      if (!response.ok) throw new Error(body.message || "The cloud route could not be selected.");
      setRouting(body);
      setNotice(`${CLOUD_DISPLAY_LABELS[route]} is now the active ${CLOUD_DISPLAY_LABELS[capability].toLowerCase()} connection.`);
      window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The cloud route could not be selected.");
      await refreshStatus();
    } finally {
      setWorking("");
    }
  }

  function routedConnection(capability: CapabilityKey, route: CloudRoute, role: string): StoryModeConnectionRow {
    const capabilityId = routingCapability(capability);
    const group = routing?.[capabilityId];
    const option = group?.options[route];
    const state = connectionState(option);
    const active = Boolean(option?.locality === "cloud" && option.ready && group?.selected === route);
    return {
      id: route,
      label: CLOUD_DISPLAY_LABELS[route],
      role,
      detail: CLOUD_DETAILS[route],
      state,
      model: option?.model || undefined,
      active,
      setupLabel: setupActionLabel(state),
      onSetup: () => setView(route),
      useLabel: `Use for ${CLOUD_DISPLAY_LABELS[capability]}`,
      onUse: () => void selectCloudRoute(capability, route),
      useDisabled: state !== "ready" || Boolean(working) || !paidAcknowledged || (capabilityId === "video" && !dataSharingAcknowledged),
    };
  }

  function comfyConnection(role: string): StoryModeConnectionRow {
    const state: StoryModeConnectionState = comfyCloud?.tested ? "ready" : comfyCloud?.configured ? "needs-test" : "setup";
    return {
      id: "comfy-cloud",
      label: "ComfyUI",
      role,
      detail: CLOUD_DETAILS["comfy-cloud"],
      state,
      model: comfyCloud?.defaultLane ? `Workflow lane: ${comfyCloud.defaultLane}` : undefined,
      setupLabel: state === "ready" ? "Open setup" : state === "needs-test" ? "Test / setup" : "Set up",
      onSetup: () => setView("comfy-cloud"),
    };
  }

  function capabilityConnections(capability: CapabilityKey): StoryModeConnectionRow[] {
    if (capability === "writing") return [
      routedConnection(capability, "openai", "OpenAI API connection"),
      routedConnection(capability, "gemini", "Google Gemini API connection"),
      routedConnection(capability, "minimax", "MiniMax cloud API connection"),
    ];
    if (capability === "agents") return [
      routedConnection(capability, "openai", "OpenAI API connection for Agent text compute"),
      routedConnection(capability, "gemini", "Google Gemini API connection for Agent text compute"),
      routedConnection(capability, "minimax", "MiniMax cloud API connection for Agent text compute"),
    ];
    if (capability === "images") return [
      routedConnection(capability, "openai", "OpenAI API image connection"),
      comfyConnection("Remote ComfyUI image workflow connection"),
      routedConnection(capability, "minimax", "MiniMax cloud image API connection"),
    ];
    return [
      comfyConnection("Remote ComfyUI video workflow connection"),
      routedConnection(capability, "minimax", "MiniMax cloud video API connection"),
    ];
  }

  if (view !== "menu") {
    const capability = view === "writing" || view === "images" || view === "video" || view === "agents" ? view : null;
    return (
      <div style={shell} data-skin-v1-cloud-story-mode="true" data-cloud-story-view={view}>
        <section style={chromeBoundary} data-skin-chrome="solid" aria-labelledby="skin-v1-cloud-story-section-title">
          <p style={{ margin: 0, color: "var(--pp-skin-accent-bright)", fontSize: 12, letterSpacing: ".08em" }}>SETTINGS / CLOUD STORY MODE / {VIEW_TITLES[view].toUpperCase()}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <h1 id="skin-v1-cloud-story-section-title" style={{ margin: "5px 0", fontSize: 24 }}>{VIEW_TITLES[view]}</h1>
            <button type="button" onClick={() => setView("menu")} style={{ padding: "var(--pp-skin-space-2) var(--pp-skin-space-3)", border: "var(--pp-skin-border-thin) solid var(--pp-skin-accent)", borderRadius: "var(--pp-skin-radius)", background: "var(--pp-skin-surface-0)", color: "var(--pp-skin-ink)", font: "inherit", cursor: "pointer" }}>Back to Cloud Story Mode</button>
          </div>
        </section>

        {capability ? (
          <StoryModeCapabilityConnections
            mode="cloud"
            capability={capability}
            connections={capabilityConnections(capability)}
            notice={notice}
            paidAcknowledged={paidAcknowledged}
            onPaidAcknowledged={setPaidAcknowledged}
            dataSharingAcknowledged={dataSharingAcknowledged}
            onDataSharingAcknowledged={setDataSharingAcknowledged}
          />
        ) : null}
        {view === "openai" ? <CloudProviderSetupPanel provider="openai" /> : null}
        {view === "comfy-cloud" ? <ComfyCloudSetupPanel /> : null}
        {view === "gemini" ? <GeminiProviderSetupPanel /> : null}
        {view === "minimax" ? <CloudProviderSetupPanel provider="minimax" /> : null}
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
          <p style={{ margin: "4px 0 0", color: "var(--pp-skin-accent-bright)", fontSize: 12, letterSpacing: ".08em" }}>EXPLICIT CONNECTIONS / PAID ROUTES REQUIRE CONSENT</p>
        </div>
        {(["writing", "images", "video", "agents"] as const).map((capability) => (
          <div key={capability} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: "7px 0", borderTop: "var(--pp-skin-border-thin) solid var(--pp-skin-line)" }}>
            <strong>{CLOUD_DISPLAY_LABELS[capability]}</strong>
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
          const command = `[${item.shortcut}] ${CLOUD_DISPLAY_LABELS[item.id]}`.padEnd(24, " ");
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
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
