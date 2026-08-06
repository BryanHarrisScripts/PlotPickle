"use client";

import { useEffect, useMemo, useState } from "react";
import { requestConnectionStatusRefresh } from "./use-connection-status";
import styles from "./ai-routing-panel.module.css";
import consoleStyles from "./ai-routing-source-console.module.css";

type Capability = "text" | "image" | "video";
type OptionState = {
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
  choice: {
    text: "ollama" | "openai" | "minimax" | "off";
    image: "comfyui" | "ollama-comfyui" | "openai" | "minimax" | "manual";
    video: "comfyui-native" | "minimax" | "openai" | "off";
  };
  text: { selected: string; options: Record<string, OptionState> };
  image: { selected: string; options: Record<string, OptionState> };
  video: { selected: string; options: Record<string, OptionState> };
};

type LocalInstallation = {
  installed: boolean;
  running: boolean;
  location: string;
  detection: "running" | "path" | "registry" | "missing";
};

type InstallationStatus = {
  checkedAt: string;
  ollama: LocalInstallation;
  comfyui: LocalInstallation;
};

const API = "/api/ai-routing";
const INSTALLATIONS_API = "/api/local-ai/installations";

const OPTION_LABELS: Record<Capability, Record<string, { title: string; description: string }>> = {
  text: {
    ollama: { title: "Ollama · Local", description: "Use the selected Ollama LLM installed on this computer." },
    openai: { title: "OpenAI · Cloud", description: "Use the selected OpenAI text model through the user-owned API account." },
    minimax: { title: "MiniMax Text · Cloud", description: "Use the MiniMax text model configured with the same account that can provide H3 video." },
    off: { title: "Off", description: "Keep writing assistance off. PlotPickle remains fully usable." },
  },
  image: {
    comfyui: { title: "ComfyUI · Local", description: "Generate images through the selected local checkpoint and reviewed workflow." },
    "ollama-comfyui": { title: "Ollama + ComfyUI · Local", description: "Use the selected Ollama LLM to refine the visual prompt, then generate locally through ComfyUI." },
    openai: { title: "OpenAI Images · Cloud", description: "Generate or edit images through the configured OpenAI image model." },
    minimax: { title: "MiniMax Images · Cloud", description: "Use the configured MiniMax image model through the user-owned account." },
    manual: { title: "Manual Import", description: "Create images elsewhere and import them without an AI request." },
  },
  video: {
    "comfyui-native": { title: "ComfyUI H3 · Local", description: "Run user-owned MiniMax H3 weights locally through a reviewed ComfyUI workflow." },
    minimax: { title: "MiniMax H3 · Cloud", description: "Send one approved video request to the configured MiniMax account." },
    openai: { title: "OpenAI Video · Cloud", description: "Create an asynchronous OpenAI video job through the configured account." },
    off: { title: "Off", description: "Do not generate video. Existing and imported video assets remain available." },
  },
};

const GROUPS: Array<{ capability: Capability; title: string; description: string }> = [
  { capability: "text", title: "Writing", description: "Choose one writing and planning engine: Ollama, OpenAI, MiniMax Text, or Off." },
  { capability: "image", title: "Images", description: "Choose ComfyUI, Ollama-assisted ComfyUI, OpenAI, MiniMax, or Manual Import." },
  { capability: "video", title: "Video", description: "Choose local ComfyUI H3, OpenAI Video, MiniMax H3 cloud, or Off." },
];

async function request<T>(path: string, method: "GET" | "POST" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("The local AI routing gateway is unavailable.");
  const value = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(value.message || "AI routing could not be updated.");
  return value;
}

function statusLabel(selected: boolean, option: OptionState) {
  if (selected) return option.ready ? "Active · Ready" : option.error ? "Active · Error" : "Active · Setup required";
  return option.ready ? "Ready · Off" : option.configured ? "Configured · Test needed" : "Off · Setup needed";
}

function formatDate(value?: string) {
  if (!value) return "Not tested";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function activeTone(option: OptionState) {
  if (option.ready) return "green";
  if (option.error) return "red";
  return "yellow";
}

function routeCanRun(route: string, option: OptionState) {
  return route === "off" || route === "manual" || option.ready;
}

function installationForRoute(capability: Capability, route: string, option: OptionState, installations: InstallationStatus | null) {
  if (route === "off" || route === "manual") return { installed: true, running: true, label: "Built in" };
  if (option.locality === "cloud") return {
    installed: option.configured,
    running: option.ready,
    label: option.configured ? "Configured" : "Not configured",
  };
  if (route === "ollama") {
    const local = installations?.ollama;
    return { installed: Boolean(local?.installed), running: Boolean(local?.running), label: local?.installed ? "Installed" : "Not installed" };
  }
  if (route === "ollama-comfyui") {
    const installed = Boolean(installations?.ollama.installed && installations?.comfyui.installed);
    const running = Boolean(installations?.ollama.running && installations?.comfyui.running);
    return { installed, running, label: installed ? "Both installed" : "Install local tools" };
  }
  const local = installations?.comfyui;
  return { installed: Boolean(local?.installed), running: Boolean(local?.running), label: local?.installed ? "Installed" : "Not installed" };
}

export default function AiRoutingPanel() {
  const [status, setStatus] = useState<RoutingStatus | null>(null);
  const [installations, setInstallations] = useState<InstallationStatus | null>(null);
  const [paidAcknowledged, setPaidAcknowledged] = useState(false);
  const [dataSharingAcknowledged, setDataSharingAcknowledged] = useState(false);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");

  function refreshDashboardLights() {
    requestConnectionStatusRefresh();
    window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
  }

  async function refresh() {
    try {
      const [routing, local] = await Promise.all([
        request<RoutingStatus>(`${API}/status`),
        request<InstallationStatus>(INSTALLATIONS_API).catch(() => null),
      ]);
      setStatus(routing);
      setInstallations(local);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "AI routing is available in the downloaded local PlotPickle app.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function select(capability: Capability, route: string) {
    const option = status?.[capability].options[route];
    if (!option) return;
    if (!routeCanRun(route, option)) {
      setNotice(`${OPTION_LABELS[capability][route].title} cannot be turned on yet. Use its setup action, complete the test, then return here.`);
      return;
    }
    const cloud = option.locality === "cloud";
    if (cloud && !paidAcknowledged) {
      setNotice("Confirm possible provider charges before selecting a cloud route.");
      return;
    }
    if (capability === "video" && cloud && !dataSharingAcknowledged) {
      setNotice("Confirm that the video prompt and selected reference image may leave this computer.");
      return;
    }
    setWorking(`${capability}:${route}`);
    setNotice("");
    try {
      const next = await request<RoutingStatus>(`${API}/select`, "POST", {
        capability,
        route,
        paidAcknowledged: cloud ? paidAcknowledged : false,
        dataSharingAcknowledged: capability === "video" && cloud ? dataSharingAcknowledged : false,
      });
      setStatus(next);
      setNotice(`${OPTION_LABELS[capability][route].title} is now active for ${capability === "text" ? "writing" : capability}.`);
      refreshDashboardLights();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The route could not be selected.");
    } finally {
      setWorking("");
    }
  }

  async function applyPreset(kind: "local" | "cloud") {
    if (!status) return;
    if (kind === "cloud" && (!paidAcknowledged || !dataSharingAcknowledged)) {
      setNotice("Confirm cloud charges and video data sharing before selecting the cloud-enabled setup.");
      return;
    }
    const choices = kind === "local"
      ? [
          { capability: "text", route: "ollama" },
          { capability: "image", route: "ollama-comfyui" },
          { capability: "video", route: "comfyui-native" },
        ] as const
      : [
          { capability: "text", route: "openai" },
          { capability: "image", route: "openai" },
          { capability: "video", route: "minimax" },
        ] as const;
    const unavailable = choices.filter((item) => !routeCanRun(item.route, status[item.capability].options[item.route]));
    if (unavailable.length) {
      setNotice(`${kind === "local" ? "Local-first" : "Cloud"} setup is not ready. Complete setup and testing for ${unavailable.map((item) => OPTION_LABELS[item.capability][item.route].title).join(", ")} first.`);
      return;
    }
    setWorking(`${kind}-preset`);
    setNotice("");
    try {
      let next: RoutingStatus | null = null;
      for (const item of choices) {
        const cloud = kind === "cloud";
        next = await request<RoutingStatus>(`${API}/select`, "POST", {
          ...item,
          paidAcknowledged: cloud,
          dataSharingAcknowledged: cloud && item.capability === "video",
        });
      }
      setStatus(next);
      setNotice(kind === "local"
        ? "Local-first routing is active: Ollama writing, Ollama + ComfyUI images, and local ComfyUI H3 video."
        : "Cloud routing is active: OpenAI writing and images, with MiniMax H3 video.");
      refreshDashboardLights();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The routing preset could not be selected.");
      await refresh();
    } finally {
      setWorking("");
    }
  }

  function openSettings(target: string) {
    if (!target) return;
    window.sessionStorage.setItem("plotpickle.settings.section", target);
    window.location.assign("/?workspace=settings");
  }

  const providerCards = useMemo(() => {
    if (!status) return [];
    const selected = [status.text.selected, status.image.selected, status.video.selected];
    const aggregate = (provider: "openai" | "minimax") => {
      const options = [status.text.options[provider], status.image.options[provider], status.video.options[provider]].filter(Boolean);
      const active = selected.filter((route) => route === provider).length;
      return {
        id: provider,
        title: provider === "openai" ? "OpenAI" : "MiniMax",
        kind: "Cloud account",
        installed: options.some((option) => option.configured),
        running: options.some((option) => option.ready),
        readyCount: options.filter((option) => option.ready).length,
        activeCount: active,
        detail: options.some((option) => option.configured) ? `${options.filter((option) => option.ready).length} of 3 capabilities tested` : "API account not configured",
        target: provider,
      };
    };
    const ollamaActive = Number(status.text.selected === "ollama") + Number(status.image.selected === "ollama-comfyui");
    const comfyActive = Number(status.image.selected === "comfyui" || status.image.selected === "ollama-comfyui") + Number(status.video.selected === "comfyui-native");
    return [
      {
        id: "ollama",
        title: "Ollama",
        kind: "Local software",
        installed: Boolean(installations?.ollama.installed),
        running: Boolean(installations?.ollama.running),
        readyCount: Number(status.text.options.ollama.ready),
        activeCount: ollamaActive,
        detail: installations?.ollama.running ? status.text.options.ollama.model || "Running · choose a model" : installations?.ollama.installed ? "Installed · not running" : "Not installed",
        target: "ollama",
      },
      {
        id: "comfyui",
        title: "ComfyUI",
        kind: "Local software",
        installed: Boolean(installations?.comfyui.installed),
        running: Boolean(installations?.comfyui.running),
        readyCount: Number(status.image.options.comfyui.ready) + Number(status.video.options["comfyui-native"].ready),
        activeCount: comfyActive,
        detail: installations?.comfyui.running ? status.image.options.comfyui.model || "Running · choose a checkpoint" : installations?.comfyui.installed ? "Installed · not running" : "Not installed",
        target: "comfyui",
      },
      aggregate("openai"),
      aggregate("minimax"),
    ];
  }, [installations, status]);

  if (!status) {
    return <section className={styles.loading} aria-live="polite">{notice || "Checking AI routing…"}</section>;
  }

  const activeOptions = GROUPS.map(({ capability }) => status[capability].options[status[capability].selected]);
  const localActive = activeOptions.filter((option) => option.locality === "local").length;
  const cloudActive = activeOptions.filter((option) => option.locality === "cloud").length;
  const sourceMode = localActive && cloudActive ? "HYBRID" : localActive ? "LOCAL" : cloudActive ? "CLOUD" : "NO AI / MANUAL";

  return (
    <section className={styles.panel} aria-labelledby="ai-routing-title">
      <header className={styles.header}>
        <div>
          <p>Settings · AI Routing</p>
          <h1 id="ai-routing-title">Choose where text, images and video are created.</h1>
          <span>Each capability has one active route. PlotPickle never switches to a paid provider automatically.</span>
        </div>
        <div className={styles.presetActions}>
          <button type="button" aria-label="Use local-first AI routing setup" onClick={() => void applyPreset("local")} disabled={Boolean(working)}>
            {working === "local-preset" ? "Selecting local routes…" : "Use local-first setup"}
          </button>
          <button type="button" aria-label="Switch to cloud AI routing setup" onClick={() => void applyPreset("cloud")} disabled={Boolean(working)}>
            {working === "cloud-preset" ? "Selecting cloud routes…" : "Switch to cloud setup"}
          </button>
          <button type="button" className={styles.secondaryButton} aria-label="Refresh current AI routing configuration" onClick={() => void refresh()} disabled={Boolean(working)}>Refresh current configuration</button>
        </div>
      </header>

      <section className={`${styles.activeNow} ${consoleStyles.sourceConsole}`} aria-labelledby="active-routing-title">
        <header className={consoleStyles.consoleHeader}>
          <div><p>Current configuration</p><h2 id="active-routing-title">System Source Console</h2></div>
          <strong>ACTIVE SOURCE: {sourceMode}</strong>
          <span>These are the exact providers, models and workflows PlotPickle will use at this moment.</span>
        </header>
        <div className={consoleStyles.modeSelectors} aria-label="Active local and cloud source counts">
          <div className={consoleStyles.modeCard} data-active={localActive > 0}>
            <i aria-hidden="true" /><strong>LOCAL</strong><span>{localActive} active route{localActive === 1 ? "" : "s"}</span>
          </div>
          <div className={consoleStyles.modeCard} data-active={cloudActive > 0}>
            <i aria-hidden="true" /><strong>CLOUD</strong><span>{cloudActive} active route{cloudActive === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div className={styles.activeGrid}>
          {GROUPS.map(({ capability, title }) => {
            const group = status[capability];
            const selected = group.selected;
            const option = group.options[selected];
            const label = OPTION_LABELS[capability][selected];
            const tone = activeTone(option);
            return (
              <article data-tone={tone} key={capability}>
                <header><span>{title}</span><strong>{option.ready ? "ACTIVE · READY" : option.error ? "ACTIVE · ERROR" : "ACTIVE · ATTENTION"}</strong></header>
                <h3>{label.title}</h3>
                <dl>
                  <div><dt>Model / workflow</dt><dd>{option.model || (selected === "off" ? "Off" : selected === "manual" ? "Manual Import" : "Not selected")}</dd></div>
                  <div><dt>Location</dt><dd>{option.locality === "cloud" ? "Cloud" : option.locality === "local" ? "This computer" : option.locality}</dd></div>
                  <div><dt>Last successful test</dt><dd>{formatDate(option.verifiedAt)}</dd></div>
                  <div><dt>Cost</dt><dd>{option.cost}</dd></div>
                </dl>
                {!option.ready ? <p>{option.error || "This active route still needs setup or a successful test."}</p> : null}
                {option.settingsTarget ? <button type="button" aria-label={`Open ${label.title.split(" · ")[0]} settings for active ${title.toLowerCase()} route`} onClick={() => openSettings(option.settingsTarget)}>Open {label.title.split(" · ")[0]} Settings</button> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className={consoleStyles.installedGate} aria-labelledby="installed-gate-title">
        <header>
          <div><p>Availability gate</p><h2 id="installed-gate-title">Installed &amp; available</h2></div>
          <span>Installed or configured is not the same as ready. Active means PlotPickle is using it now.</span>
        </header>
        <div className={consoleStyles.providerGrid}>
          {providerCards.map((provider) => {
            const state = provider.activeCount ? "active" : provider.running ? "ready" : provider.installed ? "attention" : "off";
            return (
              <article data-state={state} key={provider.id}>
                <header><div><span>{provider.kind}</span><h3>{provider.title}</h3></div><strong>{provider.activeCount ? "ACTIVE" : provider.running ? "READY" : provider.installed ? "INSTALLED" : "OFF"}</strong></header>
                <div className={consoleStyles.providerFacts}>
                  <span data-on={provider.installed}>{provider.kind === "Cloud account" ? "Configured" : "Installed"}</span>
                  <span data-on={provider.running}>{provider.kind === "Cloud account" ? "Tested" : "Running"}</span>
                  <span data-on={provider.activeCount > 0}>{provider.activeCount ? `${provider.activeCount} active` : "Off"}</span>
                </div>
                <p>{provider.detail}</p>
                <button type="button" aria-label={`${provider.installed ? "Configure or test" : provider.kind === "Cloud account" ? "Configure account" : "Install or repair"} ${provider.title}`} onClick={() => openSettings(provider.target)}>{provider.installed ? "Configure or test" : provider.kind === "Cloud account" ? "Configure account" : "Install or repair"}</button>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.consent} aria-labelledby="cloud-consent-title">
        <div>
          <h2 id="cloud-consent-title">Cloud-provider consent</h2>
          <p>These confirmations are required only when selecting a cloud route. Selecting a provider does not run a paid test or generation.</p>
        </div>
        <label>
          <input type="checkbox" checked={paidAcknowledged} onChange={(event) => setPaidAcknowledged(event.target.checked)} />
          <span><strong>I understand cloud API requests can incur charges.</strong><small>PlotPickle uses only the API key and account configured by the user.</small></span>
        </label>
        <label>
          <input type="checkbox" checked={dataSharingAcknowledged} onChange={(event) => setDataSharingAcknowledged(event.target.checked)} />
          <span><strong>I understand cloud video sends the prompt and selected reference image.</strong><small>Local ComfyUI routes keep generation on this computer.</small></span>
        </label>
      </section>

      <div className={styles.groups}>
        {GROUPS.map(({ capability, title, description }) => {
          const group = status[capability];
          return (
            <fieldset className={styles.group} key={capability}>
              <legend>{title}</legend>
              <span className={styles.srOnly}>Active now</span>
              <p>{description}</p>
              <ul className={styles.options}>
                {Object.entries(group.options).map(([route, option]) => {
                  const selected = group.selected === route;
                  const label = OPTION_LABELS[capability][route];
                  const pending = working === `${capability}:${route}`;
                  const availability = installationForRoute(capability, route, option, installations);
                  const selectable = routeCanRun(route, option);
                  return (
                    <li className={styles.option} data-selected={selected} data-ready={option.ready} data-available={selectable} key={route}>
                      <label aria-disabled={!selectable}>
                        <input
                          type="radio"
                          name={`ai-route-${capability}`}
                          value={route}
                          checked={selected}
                          onChange={() => void select(capability, route)}
                          disabled={Boolean(working) || !selectable}
                        />
                        <span className={styles.switch} aria-hidden="true" />
                        <span className={styles.copy}>
                          <strong>{label.title}</strong>
                          <small>{label.description}</small>
                        </span>
                      </label>
                      <div className={consoleStyles.routeBadges} aria-label={`${label.title} state`}>
                        <span data-on={availability.installed}>{availability.label}</span>
                        {option.locality === "local" ? <span data-on={availability.running}>{availability.running ? "Running" : "Stopped"}</span> : null}
                        <span data-on={option.ready}>{option.ready ? "Ready" : "Not ready"}</span>
                        <span data-on={selected}>{selected ? "Active" : "Off"}</span>
                      </div>
                      <dl>
                        <div><dt>Status</dt><dd>{pending ? "Updating…" : statusLabel(selected, option)}</dd></div>
                        <div><dt>Cost</dt><dd>{option.cost}</dd></div>
                        {option.model ? <div><dt>Model or workflow</dt><dd>{option.model}</dd></div> : null}
                        <div><dt>Last test</dt><dd>{formatDate(option.verifiedAt)}</dd></div>
                      </dl>
                      {!selectable ? <p className={styles.warning}>{option.error || "Complete installation, configuration and a successful test before turning this route on."}</p> : selected && !option.ready ? <p className={styles.warning}>{option.error || "This route is active but still needs configuration or a successful test."}</p> : null}
                      {option.settingsTarget ? <button type="button" className={styles.settingsLink} aria-label={`${selectable ? "Open" : "Set up"} ${label.title.split(" · ")[0]} settings for ${title.toLowerCase()}`} onClick={() => openSettings(option.settingsTarget)}>{selectable ? "Open" : "Set up"} {label.title.split(" · ")[0]} Settings</button> : null}
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          );
        })}
      </div>

      <footer className={styles.boundary}>
        <strong>Routing choices stay in encrypted local application settings.</strong>
        <p>API keys remain outside PPF story projects. Changing a route does not delete another provider’s key, model, checkpoint or workflow.</p>
      </footer>

      <p className={styles.notice} aria-live="polite">{notice}</p>
    </section>
  );
}
