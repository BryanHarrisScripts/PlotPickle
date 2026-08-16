"use client";

import { useEffect, useState } from "react";
import { AI_SOURCE_GROUPS, AI_SOURCE_OPTION_LABELS, type AiSourceCapability } from "../lib/ai/source-registry";
import { requestConnectionStatusRefresh } from "./use-connection-status";
import styles from "./ai-routing-panel.module.css";

type Capability = AiSourceCapability;
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

function formatDate(value?: string) {
  if (!value) return "Not tested";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function routeCanRun(route: string, option: OptionState) {
  return route === "off" || route === "manual" || option.ready;
}

function activeTone(option: OptionState) {
  if (option.ready) return "green";
  if (option.error) return "red";
  return "yellow";
}

function statusLabel(selected: boolean, option: OptionState) {
  if (selected) return option.ready ? "Active · Ready" : option.error ? "Active · Error" : "Active · Setup required";
  return option.ready ? "Ready to choose" : option.configured ? "Configured · Test needed" : "Setup needed";
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
      setNotice("");
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
    if (!routeCanRun(route, option)) {
      setNotice(`${AI_SOURCE_OPTION_LABELS[capability][route].title} is not ready yet. Use its setup action and complete a successful test first.`);
      return;
    }

    const cloud = option.locality === "cloud";
    if (cloud && !paidAcknowledged) {
      setNotice("Confirm possible provider charges before choosing a cloud route.");
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
      setNotice(`${AI_SOURCE_OPTION_LABELS[capability][route].title} is now the active ${capability === "text" ? "writing" : capability} route.`);
      refreshDashboardLights();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The route could not be selected.");
      await refresh();
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
      setNotice(`${kind === "local" ? "Local-first" : "Cloud"} setup is not ready. Complete setup and testing for ${unavailable.map((item) => AI_SOURCE_OPTION_LABELS[item.capability][item.route].title).join(", ")} first.`);
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
      if (next) setStatus(next);
      setNotice(kind === "local"
        ? "Local-first routing is active for writing, images and video."
        : "Cloud routing is active for writing, images and video.");
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

  const activeOptions = AI_SOURCE_GROUPS.map(({ capability }) => status[capability].options[status[capability].selected]);
  const localActive = activeOptions.filter((option) => option.locality === "local").length;
  const cloudActive = activeOptions.filter((option) => option.locality === "cloud").length;
  const sourceMode = localActive && cloudActive ? "HYBRID" : localActive ? "LOCAL" : cloudActive ? "CLOUD" : "NO AI / MANUAL";

  return (
    <section className={styles.panel} aria-labelledby="ai-routing-title">
      <header className={styles.header}>
        <div>
          <p>Settings · AI Routing</p>
          <h1 id="ai-routing-title">Choose where writing, images and video are created.</h1>
          <span>Each job has one active choice. Select the route you want; Off and Manual Import are explicit safe choices rather than hidden switch behaviour.</span>
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

      <p className={styles.notice} aria-live="polite">{notice}</p>

      <section className={styles.activeNow} aria-labelledby="active-routing-title">
        <header>
          <div><p>Current configuration</p><h2 id="active-routing-title">Active source: {sourceMode}</h2></div>
          <span>This is what PlotPickle will use now. Changing a choice updates only that job.</span>
        </header>
        <div className={styles.activeGrid}>
          {AI_SOURCE_GROUPS.map(({ capability, title }) => {
            const group = status[capability];
            const selected = group.selected;
            const option = group.options[selected];
            const label = AI_SOURCE_OPTION_LABELS[capability][selected];
            return (
              <article data-tone={activeTone(option)} key={capability}>
                <header><span>{title}</span><strong>{statusLabel(true, option)}</strong></header>
                <h3>{label.title}</h3>
                <dl>
                  <div><dt>Model / workflow</dt><dd>{option.model || (selected === "off" ? "Off" : selected === "manual" ? "Manual Import" : "Not selected")}</dd></div>
                  <div><dt>Location</dt><dd>{option.locality === "cloud" ? "Cloud" : option.locality === "local" ? "This computer" : option.locality}</dd></div>
                  <div><dt>Last successful test</dt><dd>{formatDate(option.verifiedAt)}</dd></div>
                  <div><dt>Cost</dt><dd>{option.cost}</dd></div>
                </dl>
                {!option.ready && selected !== "off" && selected !== "manual" ? <p>{option.error || "This active route still needs setup or a successful test."}</p> : null}
                {option.settingsTarget ? <button type="button" onClick={() => openSettings(option.settingsTarget)}>Open {label.title.split(" · ")[0]} Settings</button> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.consent} aria-labelledby="cloud-consent-title">
        <div>
          <h2 id="cloud-consent-title">Cloud-provider consent</h2>
          <p>These confirmations matter only when you choose a cloud route. Choosing a provider does not itself run a paid generation.</p>
        </div>
        <label>
          <input type="checkbox" checked={paidAcknowledged} onChange={(event) => setPaidAcknowledged(event.target.checked)} />
          <span><strong>I understand cloud API requests can incur charges.</strong><small>PlotPickle uses only the account and API key you configured.</small></span>
        </label>
        <label>
          <input type="checkbox" checked={dataSharingAcknowledged} onChange={(event) => setDataSharingAcknowledged(event.target.checked)} />
          <span><strong>I understand cloud video sends the prompt and selected reference image.</strong><small>Local ComfyUI routes keep generation on this computer.</small></span>
        </label>
      </section>

      <div className={styles.groups}>
        {AI_SOURCE_GROUPS.map(({ capability, title, description }) => {
          const group = status[capability];
          return (
            <fieldset className={styles.group} key={capability}>
              <legend>{title}</legend>
              <p>{description} Choose one option below.</p>
              <ul className={styles.options}>
                {Object.entries(group.options).map(([route, option]) => {
                  const selected = group.selected === route;
                  const label = AI_SOURCE_OPTION_LABELS[capability][route];
                  const pending = working === `${capability}:${route}`;
                  const selectable = routeCanRun(route, option);
                  return (
                    <li className={styles.option} data-selected={selected} data-ready={option.ready} data-available={selectable} key={route}>
                      <label aria-disabled={!selectable && !selected}>
                        <input
                          type="radio"
                          name={`ai-route-${capability}`}
                          value={route}
                          checked={selected}
                          aria-label={`Choose ${label.title} for ${title.toLowerCase()}`}
                          onChange={() => void select(capability, route)}
                          disabled={Boolean(working) || (!selectable && !selected)}
                          style={{ position: "static", width: 20, height: 20, opacity: 1, marginTop: 2, accentColor: "#35c9b8" }}
                        />
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
                      {!selectable && !selected ? <p className={styles.warning}>{option.error || "Complete installation, configuration and a successful test before choosing this route."}</p> : selected && !option.ready && route !== "off" && route !== "manual" ? <p className={styles.warning}>{option.error || "This route is active but still needs configuration or a successful test."}</p> : null}
                      {option.settingsTarget ? <button type="button" className={styles.settingsLink} onClick={() => openSettings(option.settingsTarget)}>{selectable ? "Open" : "Set up"} {label.title.split(" · ")[0]} Settings</button> : null}
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
    </section>
  );
}
