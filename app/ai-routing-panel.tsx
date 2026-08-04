"use client";

import { useEffect, useState } from "react";
import styles from "./ai-routing-panel.module.css";

type Capability = "text" | "image" | "video";
type OptionState = {
  configured: boolean;
  ready: boolean;
  model: string;
  error: string;
  locality: string;
  cost: string;
  settingsTarget: string;
};

type RoutingStatus = {
  choice: {
    text: "ollama" | "openai" | "off";
    image: "comfyui" | "openai" | "minimax" | "manual";
    video: "comfyui-native" | "minimax" | "openai" | "off";
  };
  text: { selected: string; options: Record<string, OptionState> };
  image: { selected: string; options: Record<string, OptionState> };
  video: { selected: string; options: Record<string, OptionState> };
};

const API = "/api/ai-routing";

const OPTION_LABELS: Record<Capability, Record<string, { title: string; description: string }>> = {
  text: {
    ollama: { title: "Ollama · Local", description: "Use a model installed on this computer for writing and planning." },
    openai: { title: "OpenAI · Cloud", description: "Use the selected OpenAI text model through the user-owned API account." },
    off: { title: "Off", description: "Keep writing assistance off. PlotPickle remains fully usable." },
  },
  image: {
    comfyui: { title: "ComfyUI · Local", description: "Generate images through the selected local checkpoint and reviewed workflow." },
    openai: { title: "OpenAI Images · Cloud", description: "Generate or edit images through the configured OpenAI image model." },
    minimax: { title: "MiniMax Images · Cloud", description: "Use the configured MiniMax image model through the user-owned account." },
    manual: { title: "Manual Import", description: "Create images elsewhere and import them without an AI request." },
  },
  video: {
    "comfyui-native": { title: "ComfyUI H3 · Local", description: "Run user-owned MiniMax H3 weights locally through a reviewed ComfyUI workflow." },
    minimax: { title: "MiniMax H3 · Cloud", description: "Send one approved video request to the configured MiniMax account." },
    openai: { title: "OpenAI Video · Cloud", description: "Create an asynchronous Sora video job through the configured OpenAI account." },
    off: { title: "Off", description: "Do not generate video. Existing and imported video assets remain available." },
  },
};

async function request<T>(path: string, method: "GET" | "POST" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(value.message || "AI routing could not be updated.");
  return value;
}

function statusLabel(selected: boolean, option: OptionState) {
  if (!selected) return option.ready ? "Ready" : option.configured ? "Configured" : "Not configured";
  return option.ready ? "Selected · Ready" : "Selected · Setup required";
}

export default function AiRoutingPanel() {
  const [status, setStatus] = useState<RoutingStatus | null>(null);
  const [paidAcknowledged, setPaidAcknowledged] = useState(false);
  const [dataSharingAcknowledged, setDataSharingAcknowledged] = useState(false);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");

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
        : `${OPTION_LABELS[capability][route].title} is selected. Complete its Settings requirements before use.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The route could not be selected.");
    } finally {
      setWorking("");
    }
  }

  async function selectLocalPreset() {
    setWorking("local-preset");
    setNotice("");
    try {
      let next = await request<RoutingStatus>(`${API}/select`, "POST", { capability: "text", route: "ollama" });
      next = await request<RoutingStatus>(`${API}/select`, "POST", { capability: "image", route: "comfyui" });
      next = await request<RoutingStatus>(`${API}/select`, "POST", { capability: "video", route: "comfyui-native" });
      setStatus(next);
      setNotice("Low-cost local routing selected. Any missing local model or workflow is shown as Setup required rather than silently using a paid provider.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The local preset could not be selected.");
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
    { capability: "text", title: "Text", description: "Choose one writing and planning engine." },
    { capability: "image", title: "Images", description: "Choose one image route or import images manually." },
    { capability: "video", title: "Video", description: "Choose local H3, one paid cloud provider, or turn video generation off." },
  ];

  return (
    <section className={styles.panel} aria-labelledby="ai-routing-title">
      <header className={styles.header}>
        <div>
          <p>Settings · AI Routing</p>
          <h1 id="ai-routing-title">Choose where text, images and video are created.</h1>
          <span>Each capability has one active route. PlotPickle never switches to a paid provider automatically.</span>
        </div>
        <button type="button" onClick={() => void selectLocalPreset()} disabled={Boolean(working)}>
          {working === "local-preset" ? "Selecting local routes…" : "Use low-cost local setup"}
        </button>
      </header>

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
              <div className={styles.options}>
                {Object.entries(group.options).map(([route, option]) => {
                  const selected = group.selected === route;
                  const label = OPTION_LABELS[capability][route];
                  const pending = working === `${capability}:${route}`;
                  return (
                    <article className={styles.option} data-selected={selected} data-ready={option.ready} key={route}>
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
                      </dl>
                      {selected && !option.ready ? <p className={styles.warning}>{option.error || "This route is selected but still needs configuration or a successful test."}</p> : null}
                      {option.settingsTarget ? <button type="button" className={styles.settingsLink} onClick={() => openSettings(option.settingsTarget)}>Open {label.title.split(" · ")[0]} Settings</button> : null}
                    </article>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      <footer className={styles.boundary}>
        <strong>Routing choices stay in encrypted local application settings.</strong>
        <p>API keys remain outside PPF story projects. Changing a route does not delete another provider’s key, model, checkpoint or workflow.</p>
      </footer>

      <p className={styles.notice} role="status" aria-live="polite">{notice}</p>
    </section>
  );
}
