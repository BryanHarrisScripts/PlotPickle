"use client";

import { useEffect, useState } from "react";
import { requestConnectionStatusRefresh } from "./use-connection-status";
import styles from "./ai-routing-panel.module.css";

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

const API = "/api/ai-routing";

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
  if (!selected) return option.ready ? "Ready" : option.configured ? "Configured · test needed" : "Not configured";
  return option.ready ? "Selected · Ready" : option.error ? "Selected · Error" : "Selected · Setup required";
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

export default function AiRoutingPanel() {
  const [status, setStatus] = useState<RoutingStatus | null>(null);
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
      setStatus(await request<RoutingStatus>(`${API}/status`));
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
      setNotice(option.ready
        ? `${OPTION_LABELS[capability][route].title} is now the selected ${capability} route.`
        : `${OPTION_LABELS[capability][route].title} is selected. The Active now card shows exactly what still needs attention.`);
      refreshDashboardLights();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The route could not be selected.");
    } finally {
      setWorking("");
    }
  }

  async function applyPreset(kind: "local" | "cloud") {
    if (kind === "cloud" && (!paidAcknowledged || !dataSharingAcknowledged)) {
      setNotice("Confirm cloud charges and video data sharing before selecting the cloud-enabled setup.");
      return;
    }
    setWorking(`${kind}-preset`);
    setNotice("");
    try {
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
        ? "Local-first routing selected: Ollama text, Ollama + ComfyUI images, and local ComfyUI H3 video. Missing models remain yellow; PlotPickle will not silently use cloud services."
        : "Cloud-enabled routing selected: OpenAI text and images, MiniMax H3 video. Each provider still requires its own successful configuration test.");
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

  if (!status) {
    return <section className={styles.loading} aria-live="polite">{notice || "Checking AI routing…"}</section>;
  }

  const groups: Array<{ capability: Capability; title: string; description: string }> = [
    { capability: "text", title: "Text", description: "Choose one writing and planning engine: Ollama, OpenAI, MiniMax Text, or Off." },
    { capability: "image", title: "Images", description: "Choose ComfyUI, Ollama-assisted ComfyUI, OpenAI, MiniMax, or Manual Import." },
    { capability: "video", title: "Video", description: "Choose local ComfyUI H3, OpenAI Video, MiniMax H3 cloud, or Off." },
  ];

  return (
    <section className={styles.panel} aria-labelledby="ai-routing-title">
      <header className={styles.header}>
        <div>
          <p>Settings · AI Routing</p>
          <h1 id="ai-routing-title">Choose where text, images and video are created.</h1>
          <span>Each capability has one active route. PlotPickle never switches to a paid provider automatically.</span>
        </div>
        <div className={styles.presetActions}>
          <button type="button" onClick={() => void applyPreset("local")} disabled={Boolean(working)}>
            {working === "local-preset" ? "Selecting local routes…" : "Use local-first setup"}
          </button>
          <button type="button" onClick={() => void applyPreset("cloud")} disabled={Boolean(working)}>
            {working === "cloud-preset" ? "Selecting cloud routes…" : "Switch to cloud setup"}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => void refresh()} disabled={Boolean(working)}>Refresh current configuration</button>
        </div>
      </header>

      <section className={styles.activeNow} aria-labelledby="active-routing-title">
        <header>
          <div><p>Current configuration</p><h2 id="active-routing-title">Active now</h2></div>
          <span>These are the exact providers, models and workflows PlotPickle will use at this moment.</span>
        </header>
        <div className={styles.activeGrid}>
          {groups.map(({ capability, title }) => {
            const group = status[capability];
            const selected = group.selected;
            const option = group.options[selected];
            const label = OPTION_LABELS[capability][selected];
            const tone = activeTone(option);
            return (
              <article data-tone={tone} key={capability}>
                <header><span>{title}</span><strong>{option.ready ? "Ready" : option.error ? "Error" : "Attention"}</strong></header>
                <h3>{label.title}</h3>
                <dl>
                  <div><dt>Model / workflow</dt><dd>{option.model || selected === "off" ? option.model || "Off" : "Not selected"}</dd></div>
                  <div><dt>Location</dt><dd>{option.locality === "cloud" ? "Cloud" : option.locality === "local" ? "This computer" : option.locality}</dd></div>
                  <div><dt>Last successful test</dt><dd>{formatDate(option.verifiedAt)}</dd></div>
                  <div><dt>Cost</dt><dd>{option.cost}</dd></div>
                </dl>
                {!option.ready ? <p>{option.error || "This route is selected but still needs setup or a successful test."}</p> : null}
                {option.settingsTarget ? <button type="button" onClick={() => openSettings(option.settingsTarget)}>Open {label.title.split(" · ")[0]} Settings</button> : null}
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
        {groups.map(({ capability, title, description }) => {
          const group = status[capability];
          return (
            <fieldset className={styles.group} key={capability}>
              <legend>{title}</legend>
              <p>{description}</p>
              <ul className={styles.options}>
                {Object.entries(group.options).map(([route, option]) => {
                  const selected = group.selected === route;
                  const label = OPTION_LABELS[capability][route];
                  const pending = working === `${capability}:${route}`;
                  return (
                    <li className={styles.option} data-selected={selected} data-ready={option.ready} key={route}>
                      <label>
                        <input
                          type="radio"
                          name={`ai-route-${capability}`}
                          value={route}
                          checked={selected}
                          onChange={() => void select(capability, route)}
                          disabled={Boolean(working)}
                        />
                        <span className={styles.switch} aria-hidden="true" />
                        <span className={styles.copy}>
                          <strong>{label.title}</strong>
                          <small>{label.description}</small>
                        </span>
                      </label>
                      <dl>
                        <div><dt>Status</dt><dd>{pending ? "Updating…" : statusLabel(selected, option)}</dd></div>
                        <div><dt>Cost</dt><dd>{option.cost}</dd></div>
                        {option.model ? <div><dt>Model or workflow</dt><dd>{option.model}</dd></div> : null}
                        <div><dt>Last test</dt><dd>{formatDate(option.verifiedAt)}</dd></div>
                      </dl>
                      {selected && !option.ready ? <p className={styles.warning}>{option.error || "This route is selected but still needs configuration or a successful test."}</p> : null}
                      {option.settingsTarget ? <button type="button" className={styles.settingsLink} onClick={() => openSettings(option.settingsTarget)}>Open {label.title.split(" · ")[0]} Settings</button> : null}
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