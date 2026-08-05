"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlotPickleSettings } from "@/lib/ai/settings";
import type { ConnectionState, ConnectionStatusSnapshot, PublicConnectionStatus } from "@/lib/connection-status";
import styles from "./compute-hub-dashboard.module.css";

const SYSTEM_API = "/api/local-system/status";
const CONNECTIONS_API = "/api/local-connections";
const ROUTING_API = "/api/ai-routing/status";
const BUZZ_API = "/api/local-buzz/status";

type Tone = "green" | "yellow" | "red";
type RouteMode = "local" | "cloud" | "off";

type RouteOption = {
  configured: boolean;
  ready: boolean;
  model: string;
  verifiedAt: string;
  error: string;
  locality: string;
  cost: string;
  settingsTarget: string;
};

type RoutingStatus = {
  choice: { text: string; image: string; video: string };
  text: { selected: string; options: Record<string, RouteOption> };
  image: { selected: string; options: Record<string, RouteOption> };
  video: { selected: string; options: Record<string, RouteOption> };
};

type LocalService = Omit<PublicConnectionStatus, "id"> & { id: string };
type LocalServices = { checkedAt?: string; ollama?: LocalService; comfyui?: LocalService };

type SystemEvent = { id: string; at: string; tone: Tone; title: string; detail: string };
type SystemStatus = {
  checkedAt: string;
  runtime: { state: string; nodeVersion: string; platform: string; architecture: string; uptimeSeconds: number };
  cpu: { available: boolean; model: string; logicalCores: number; detail: string };
  memory: { available: boolean; totalBytes: number; freeBytes: number; usedBytes: number; detail: string };
  storage: { available: boolean; totalBytes: number; freeBytes: number; usedBytes: number; detail: string };
  gpu: { available: boolean; model: string; totalVramBytes: number; usedVramBytes: number; detail: string };
  jobs: {
    comfyui: { available: boolean; running: number; pending: number; detail: string };
    ollama: { available: boolean; detail: string };
    repository: { available: boolean; detail: string };
  };
  events: SystemEvent[];
};

type BuzzStatus = {
  connection?: { configured?: boolean; identityVerified?: boolean; identityLabel?: string; community?: string; verifiedAt?: string };
  relay?: { reachable?: boolean; checkedAt?: string; detail?: string };
  cli?: { available?: boolean; version?: string };
};

type ServiceCard = {
  id: string;
  label: string;
  tone: Tone;
  status: string;
  detail: string;
  identity: string;
  checkedAt: string;
  settingsSection: string;
};

const toneMeta: Record<Tone, { icon: string; label: string }> = {
  green: { icon: "✓", label: "Ready" },
  yellow: { icon: "!", label: "Review" },
  red: { icon: "×", label: "Repair" },
};

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Unavailable";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size >= 100 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
}

function formatDate(value: string) {
  if (!value) return "Not checked";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function modeForRoute(route: string): RouteMode {
  if (!route || route === "off" || route === "manual" || route === "disabled") return "off";
  if (route.includes("ollama") || route.includes("comfyui")) return "local";
  return "cloud";
}

function modeLabel(mode: RouteMode) {
  if (mode === "local") return "Local";
  if (mode === "cloud") return "Cloud";
  return "Off / Manual";
}

function toneForState(state: ConnectionState | undefined): Tone {
  if (state === "connected") return "green";
  if (state === "error") return "red";
  return "yellow";
}

function stateLabel(state: ConnectionState | undefined) {
  if (state === "connected") return "Verified and working";
  if (state === "configured") return "Configured · test needed";
  if (state === "checking") return "Checking";
  if (state === "error") return "Needs repair";
  if (state === "disabled") return "Disabled by choice";
  if (state === "unavailable") return "Telemetry unavailable";
  return "Optional · not connected";
}

async function requestJson<T>(path: string) {
  const response = await fetch(path, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}.`);
  return await response.json() as T;
}

function providerCard(provider: "openai" | "minimax", routing: RoutingStatus | null): ServiceCard {
  const options = routing
    ? [routing.text.options[provider], routing.image.options[provider], routing.video.options[provider]].filter(Boolean)
    : [];
  const ready = options.some((option) => option.ready);
  const configured = options.some((option) => option.configured);
  const error = options.find((option) => option.error)?.error || "";
  const models = options.map((option) => option.model).filter(Boolean);
  return {
    id: provider,
    label: provider === "openai" ? "OpenAI" : "MiniMax",
    tone: error ? "red" : ready ? "green" : "yellow",
    status: error ? "Needs repair" : ready ? "Verified and working" : configured ? "Configured · test needed" : "Optional · not connected",
    detail: error || (ready
      ? `${provider === "openai" ? "OpenAI" : "MiniMax"} has at least one verified route available.`
      : `${provider === "openai" ? "OpenAI" : "MiniMax"} remains optional until its own Settings section is configured and tested.`),
    identity: models.length ? [...new Set(models)].join(", ") : "User-owned provider account",
    checkedAt: options.map((option) => option.verifiedAt).filter(Boolean).sort().at(-1) || "",
    settingsSection: provider,
  };
}

export default function ComputeHubDashboard({
  settings,
  connectionStatus,
  onOpenSettings,
}: {
  settings: PlotPickleSettings;
  connectionStatus: ConnectionStatusSnapshot;
  onOpenSettings: (section: string) => void;
}) {
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [localServices, setLocalServices] = useState<LocalServices | null>(null);
  const [routing, setRouting] = useState<RoutingStatus | null>(null);
  const [buzz, setBuzz] = useState<BuzzStatus | null>(null);
  const [notice, setNotice] = useState("Checking local compute and service state…");
  const [refreshing, setRefreshing] = useState(true);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const results = await Promise.allSettled([
      requestJson<SystemStatus>(SYSTEM_API),
      requestJson<LocalServices>(CONNECTIONS_API),
      requestJson<RoutingStatus>(ROUTING_API),
      requestJson<BuzzStatus>(BUZZ_API),
    ]);
    if (results[0].status === "fulfilled") setSystem(results[0].value);
    if (results[1].status === "fulfilled") setLocalServices(results[1].value);
    if (results[2].status === "fulfilled") setRouting(results[2].value);
    if (results[3].status === "fulfilled") setBuzz(results[3].value);
    const failures = results.filter((result) => result.status === "rejected").length;
    setNotice(failures
      ? `${4 - failures} of 4 local status sources responded. Unavailable panels say exactly what could not be measured.`
      : "All local Compute Hub status sources responded.");
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    const handleRefresh = () => { void refresh(); };
    window.addEventListener("plotpickle:connection-status-refresh", handleRefresh);
    window.addEventListener("plotpickle:setup-status-refresh", handleRefresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("plotpickle:connection-status-refresh", handleRefresh);
      window.removeEventListener("plotpickle:setup-status-refresh", handleRefresh);
    };
  }, [refresh]);

  const routeSummary = useMemo(() => {
    const choice = routing?.choice ?? {
      text: settings.ai.provider === "ollama" ? "ollama" : settings.ai.provider === "disabled" ? "off" : settings.ai.provider,
      image: settings.ai.imageModel ? settings.ai.provider : "manual",
      video: settings.ai.videoModel ? settings.ai.provider : "off",
    };
    return (["text", "image", "video"] as const).map((capability) => ({
      capability,
      route: choice[capability],
      mode: modeForRoute(choice[capability]),
    }));
  }, [routing, settings]);

  const services = useMemo<ServiceCard[]>(() => {
    const ollama = localServices?.ollama;
    const comfyui = localServices?.comfyui;
    const buzzReady = Boolean(buzz?.connection?.configured && buzz.connection.identityVerified && buzz.relay?.reachable && buzz.cli?.available);
    const buzzPartial = Boolean(buzz?.connection?.configured || buzz?.connection?.identityVerified || buzz?.cli?.available);
    const shared = (id: "github" | "google"): ServiceCard => {
      const status = connectionStatus.items[id];
      return {
        id,
        label: id === "github" ? "GitHub" : "Google",
        tone: toneForState(status.state),
        status: stateLabel(status.state),
        detail: status.error || status.detail,
        identity: status.identity || "No account identity",
        checkedAt: status.lastSuccessfulConnection,
        settingsSection: id,
      };
    };
    return [
      {
        id: "runtime",
        label: "PlotPickle Runtime",
        tone: system ? "green" : "yellow",
        status: system ? "Running locally" : "Runtime telemetry unavailable",
        detail: system
          ? `Node.js ${system.runtime.nodeVersion} · ${system.runtime.platform} ${system.runtime.architecture}`
          : "The app is running, but the local system-status gateway did not respond.",
        identity: "Included with PlotPickle",
        checkedAt: system?.checkedAt || "",
        settingsSection: "about",
      },
      {
        id: "ollama",
        label: "Ollama",
        tone: toneForState(ollama?.state),
        status: stateLabel(ollama?.state),
        detail: ollama?.error || ollama?.detail || "Ollama status has not been reported.",
        identity: ollama?.identity || "Local writing service",
        checkedAt: ollama?.lastSuccessfulConnection || "",
        settingsSection: "ollama",
      },
      {
        id: "comfyui",
        label: "ComfyUI",
        tone: toneForState(comfyui?.state),
        status: stateLabel(comfyui?.state),
        detail: comfyui?.error || comfyui?.detail || "ComfyUI status has not been reported.",
        identity: comfyui?.identity || "Local image/video service",
        checkedAt: comfyui?.lastSuccessfulConnection || "",
        settingsSection: "comfyui",
      },
      {
        id: "buzz",
        label: "Buzz",
        tone: buzzReady ? "green" : "yellow",
        status: buzzReady ? "Verified and working" : buzzPartial ? "Setup or verification needed" : "Optional · not connected",
        detail: buzzReady ? "Buzz Desktop, relay and identity are verified." : buzz?.relay?.detail || "Buzz remains optional until its desktop, relay and identity checks pass.",
        identity: [buzz?.connection?.community, buzz?.connection?.identityLabel, buzz?.cli?.version].filter(Boolean).join(" · ") || "No Buzz identity",
        checkedAt: buzz?.relay?.checkedAt || buzz?.connection?.verifiedAt || "",
        settingsSection: "buzz",
      },
      shared("github"),
      shared("google"),
      providerCard("openai", routing),
      providerCard("minimax", routing),
    ];
  }, [buzz, connectionStatus, localServices, routing, system]);

  const events = useMemo(() => {
    const sharedEvents: SystemEvent[] = Object.values(connectionStatus.items).flatMap((status) => {
      if (status.error) return [{ id: `${status.id}-error`, at: connectionStatus.checkedAt, tone: "red" as const, title: `${status.label} check failed`, detail: status.error }];
      if (status.lastSuccessfulConnection) return [{ id: `${status.id}-success`, at: status.lastSuccessfulConnection, tone: "green" as const, title: `${status.label} verified`, detail: status.detail }];
      return [];
    });
    return [...(system?.events || []), ...sharedEvents]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 10);
  }, [connectionStatus, system]);

  return (
    <section id="dashboard-compute-hub" className={styles.hub} aria-labelledby="compute-hub-title">
      <header className={styles.hero}>
        <div>
          <p>Compute Hub</p>
          <h2 id="compute-hub-title">See what is local, cloud, optional or unavailable.</h2>
          <span>Dashboard is read-only. Every configuration, provider switch, model choice and credential remains in its independent Settings section.</span>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? "Checking…" : "Refresh status"}</button>
      </header>

      <p className={styles.notice} role="status" aria-live="polite">{notice}</p>

      <div className={styles.routeGrid} aria-label="Current compute routes">
        {routeSummary.map((item) => (
          <article key={item.capability} data-mode={item.mode}>
            <span>{item.capability}</span>
            <strong>{modeLabel(item.mode)}</strong>
            <small>{item.route || "Not selected"}</small>
          </article>
        ))}
      </div>

      <div className={styles.sectionHeading}>
        <div><p>Installed and optional services</p><h3>Real readiness, one Settings owner per card</h3></div>
      </div>
      <div className={styles.serviceGrid}>
        {services.map((service) => (
          <article key={service.id} className={styles.serviceCard} data-tone={service.tone}>
            <header><i aria-hidden="true">{toneMeta[service.tone].icon}</i><div><span>{service.label}</span><strong>{service.status}</strong></div></header>
            <p>{service.detail}</p>
            <small>{service.identity}</small>
            <small>Last verified: {formatDate(service.checkedAt)}</small>
            <button type="button" onClick={() => onOpenSettings(service.settingsSection)}>Open {service.label} Settings</button>
          </article>
        ))}
      </div>

      <div className={styles.telemetryGrid}>
        <section aria-labelledby="resource-status-title">
          <div className={styles.sectionHeading}><div><p>Local resources</p><h3 id="resource-status-title">Report only what the runtime can measure</h3></div></div>
          <div className={styles.resourceGrid}>
            <article><span>CPU</span><strong>{system?.cpu.available ? `${system.cpu.logicalCores} logical cores` : "Unavailable"}</strong><small>{system?.cpu.model || "System gateway did not respond."}</small></article>
            <article><span>RAM</span><strong>{system?.memory.available ? `${formatBytes(system.memory.usedBytes)} used` : "Unavailable"}</strong><small>{system?.memory.available ? `${formatBytes(system.memory.totalBytes)} total` : "No live RAM total."}</small></article>
            <article><span>Storage</span><strong>{system?.storage.available ? `${formatBytes(system.storage.freeBytes)} free` : "Unavailable"}</strong><small>{system?.storage.available ? `${formatBytes(system.storage.totalBytes)} on the PlotPickle volume` : system?.storage.detail || "No storage total."}</small></article>
            <article><span>GPU / VRAM</span><strong>{system?.gpu.available ? system.gpu.model : "Unavailable"}</strong><small>{system?.gpu.detail || "GPU telemetry is not reported."}</small></article>
          </div>
        </section>

        <section aria-labelledby="active-jobs-title">
          <div className={styles.sectionHeading}><div><p>Active jobs</p><h3 id="active-jobs-title">No decorative activity</h3></div></div>
          <div className={styles.jobList}>
            <article data-available={system?.jobs.comfyui.available || false}><strong>ComfyUI queue</strong><span>{system?.jobs.comfyui.available ? `${system.jobs.comfyui.running} running · ${system.jobs.comfyui.pending} queued` : "Unavailable"}</span><p>{system?.jobs.comfyui.detail || "Queue telemetry has not been checked."}</p></article>
            <article data-available={false}><strong>Ollama model pulls</strong><span>Unavailable</span><p>{system?.jobs.ollama.detail || "Pull progress is not exposed."}</p></article>
            <article data-available={false}><strong>Repository operations</strong><span>Unavailable</span><p>{system?.jobs.repository.detail || "No shared repository job queue is exposed."}</p></article>
          </div>
        </section>
      </div>

      <section aria-labelledby="compute-events-title">
        <div className={styles.sectionHeading}><div><p>Recent local events</p><h3 id="compute-events-title">Checks and handoffs from real runtime state</h3></div></div>
        {events.length ? (
          <ol className={styles.eventLog} aria-label="Recent local Compute Hub events">
            {events.map((event) => (
              <li key={`${event.id}-${event.at}`} data-tone={event.tone}>
                <i aria-hidden="true">{toneMeta[event.tone].icon}</i>
                <div><strong>{event.title}</strong><p>{event.detail}</p></div>
                <time dateTime={event.at}>{formatDate(event.at)}</time>
              </li>
            ))}
          </ol>
        ) : <p className={styles.empty}>No runtime event has been reported yet. Refresh status to perform a real local check.</p>}
      </section>
    </section>
  );
}
