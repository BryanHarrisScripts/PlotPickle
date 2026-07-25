"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import { providerPresets } from "@/lib/ai/providers";
import {
  defaultPlotPickleSettings,
  isSupportedMusicArtistUrl,
  normalizePlotPickleSettings,
  type MusicArtistLink,
  type PlotPickleSettings,
} from "@/lib/ai/settings";
import styles from "./settings-panel.module.css";
import GitHubCollaboration from "./github-collaboration";

const SETTINGS_STORAGE_KEY = "plotpickle.settings.v1";
const CONNECTION_API = "/api/local-ai/connection";
type SettingsSection = "collaboration" | "ai" | "music";
type ConnectionState = "loading" | "idle" | "checking" | "connected" | "error" | "unavailable";

type ConnectionStatus = {
  state: ConnectionState;
  saved: boolean;
  provider?: PlotPickleSettings["ai"]["provider"];
  checkedAt?: string;
  message: string;
};

type ConnectionResponse = {
  ok?: boolean;
  available?: boolean;
  saved?: boolean;
  provider?: PlotPickleSettings["ai"]["provider"];
  baseUrl?: string;
  textModel?: string;
  imageModel?: string;
  checkedAt?: string;
  message?: string;
};

function createMusicLink(): MusicArtistLink {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `music-${Date.now()}`,
    service: "suno",
    artistName: "",
    artistUrl: "",
  };
}

async function connectionRequest(method: "GET" | "POST" | "DELETE", path = CONNECTION_API, body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new Error("local-gateway-unavailable");
  const value = await response.json() as ConnectionResponse;
  if (!response.ok) throw new Error(value.message || "The API connection could not be checked.");
  return value;
}

export default function SettingsPanel({ project, onProjectChange }: { project: PlotPickleProject; onProjectChange: (project: PlotPickleProject) => void }) {
  const [section, setSection] = useState<SettingsSection>("collaboration");
  const [settings, setSettings] = useState<PlotPickleSettings>(() => structuredClone(defaultPlotPickleSettings));
  const [sessionKey, setSessionKey] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState<ConnectionStatus>({
    state: "loading",
    saved: false,
    message: "Checking local connection settings…",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (stored) setSettings(normalizePlotPickleSettings(JSON.parse(stored)));
      } catch {
        setNotice("Saved settings could not be read. Safe defaults are in use.");
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const saved = await connectionRequest("GET");
        if (!saved.saved) {
          setConnection({ state: "idle", saved: false, message: "No API connection has been saved." });
          return;
        }
        if (saved.provider && saved.baseUrl) {
          setSettings((current) => ({
            ...current,
            ai: {
              provider: saved.provider!,
              baseUrl: saved.baseUrl!,
              textModel: saved.textModel ?? current.ai.textModel,
              imageModel: saved.imageModel ?? current.ai.imageModel,
            },
          }));
        }
        setConnection({ state: "checking", saved: true, provider: saved.provider, checkedAt: saved.checkedAt, message: "Checking the saved API connection…" });
        const checked = await connectionRequest("POST", `${CONNECTION_API}/check`);
        if (!controller.signal.aborted) {
          setConnection({ state: "connected", saved: true, provider: checked.provider, checkedAt: checked.checkedAt, message: checked.message || "API connected." });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "The API connection could not be checked.";
        if (message === "local-gateway-unavailable") {
          setConnection({ state: "unavailable", saved: false, message: "Local API setup is available in the downloaded PlotPickle app." });
        } else {
          setConnection({ state: "error", saved: true, message });
        }
      }
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [hydrated]);

  const preset = useMemo(
    () => providerPresets.find((item) => item.kind === settings.ai.provider) ?? providerPresets.at(-1),
    [settings.ai.provider],
  );

  const liveProvider = settings.ai.provider !== "disabled" && settings.ai.provider !== "manual";
  const connectionMatchesProvider = connection.provider === settings.ai.provider;

  function selectProvider(provider: PlotPickleSettings["ai"]["provider"]) {
    const nextPreset = providerPresets.find((item) => item.kind === provider);
    setSettings((current) => ({
      ...current,
      ai: {
        provider,
        baseUrl: nextPreset?.defaultConfig.baseUrl ?? "",
        textModel: nextPreset?.defaultConfig.models.text ?? "",
        imageModel: nextPreset?.defaultConfig.models.image ?? "",
      },
    }));
    setSessionKey("");
    setNotice("");
    setConnection((current) => ({
      ...current,
      state: "idle",
      message: current.saved ? "Save and test this provider to replace the saved connection." : "No API connection has been saved.",
    }));
  }

  function updateAi(key: "baseUrl" | "textModel" | "imageModel", value: string) {
    setSettings((current) => ({ ...current, ai: { ...current.ai, [key]: value } }));
    setConnection((current) => current.state === "connected"
      ? { ...current, state: "idle", message: "Connection details changed. Save and test again." }
      : current);
  }

  function updateMusic(id: string, patch: Partial<MusicArtistLink>) {
    setSettings((current) => ({
      ...current,
      music: current.music.map((item) => item.id === id ? { ...item, ...patch } : item),
    }));
  }

  function saveSettings() {
    if (!hydrated) return;
    const invalidLink = settings.music.find((item) => item.artistUrl && !isSupportedMusicArtistUrl(item.service, item.artistUrl));
    if (invalidLink) {
      setSection("music");
      setNotice(`Use a valid https://${invalidLink.service}.com artist link for ${invalidLink.artistName || "this artist"}.`);
      return;
    }
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    setNotice("Preferences saved on this device. API keys are managed separately by the private local server.");
  }

  async function saveAndConnect() {
    if (!liveProvider || connection.state === "checking") return;
    setNotice("");
    setConnection((current) => ({ ...current, state: "checking", message: "Saving and checking the API connection…" }));
    try {
      const result = await connectionRequest("POST", CONNECTION_API, {
        provider: settings.ai.provider,
        baseUrl: settings.ai.baseUrl,
        textModel: settings.ai.textModel,
        imageModel: settings.ai.imageModel,
        apiKey: sessionKey,
      });
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      setSessionKey("");
      setConnection({ state: "connected", saved: true, provider: result.provider, checkedAt: result.checkedAt, message: result.message || "API connected." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The API connection could not be checked.";
      setConnection({
        state: message === "local-gateway-unavailable" ? "unavailable" : "error",
        saved: connection.saved,
        provider: connection.provider,
        checkedAt: connection.checkedAt,
        message: message === "local-gateway-unavailable" ? "Local API setup is available in the downloaded PlotPickle app." : message,
      });
    }
  }

  async function testAgain() {
    setConnection((current) => ({ ...current, state: "checking", message: "Checking the saved API connection…" }));
    try {
      const result = await connectionRequest("POST", `${CONNECTION_API}/check`);
      setConnection({ state: "connected", saved: true, provider: result.provider, checkedAt: result.checkedAt, message: result.message || "API connected." });
    } catch (error) {
      setConnection((current) => ({ ...current, state: "error", message: error instanceof Error ? error.message : "The API connection could not be checked." }));
    }
  }

  async function removeConnection() {
    try {
      await connectionRequest("DELETE");
      setSessionKey("");
      setConnection({ state: "idle", saved: false, message: "No API connection has been saved." });
      setNotice("The saved API connection was removed from this computer.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The saved API connection could not be removed.");
    }
  }

  const statusLabel = connection.state === "connected" && connectionMatchesProvider
    ? "API connected"
    : connection.state === "checking"
      ? "Checking connection"
      : connection.state === "unavailable"
        ? "Local setup unavailable"
        : "Not connected";

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p>Settings · Setup</p>
          <h1>Connect PlotPickle services</h1>
          <span>GitHub collaboration, AI providers and music links live together in Setup. Reports and Terminology now belong to the core writing and learning workspaces.</span>
        </div>
        {section === "ai" || section === "music" ? <button type="button" onClick={saveSettings}>Save preferences</button> : null}
      </header>

      <div className={styles.layout}>
        <nav className={styles.menu} aria-label="Settings sections">
          <button type="button" className={section === "collaboration" ? styles.active : ""} onClick={() => setSection("collaboration")}><b>GitHub setup</b><span>Shared repository, proposals, .ppf backups and history</span></button>
          <button type="button" className={section === "ai" ? styles.active : ""} onClick={() => setSection("ai")}><b>AI setup</b><span>ChatGPT, other AI, local LLM or no AI</span></button>
          <button type="button" className={section === "music" ? styles.active : ""} onClick={() => setSection("music")}><b>Music setup</b><span>Suno, Udio and artist links</span></button>
        </nav>

        <section className={styles.content}>
          {section === "collaboration" ? <GitHubCollaboration project={project} onChange={onProjectChange} /> : null}
          {section === "ai" ? (
            <>
              <div className={styles.sectionHeading}>
                <div><p>AI Setup</p><h2>Choose how PlotPickle may assist you.</h2><span>ChatGPT / OpenAI API is our primary tested connection. Other services and no-AI use remain available.</span></div>
                <div className={`${styles.connectionBadge} ${connection.state === "connected" && connectionMatchesProvider ? styles.connectionBadgeConnected : ""}`} role="status">
                  <i aria-hidden="true" />{statusLabel}
                </div>
              </div>
              <div className={styles.providerGrid}>
                {providerPresets.map((item) => (
                  <button type="button" key={item.kind} className={settings.ai.provider === item.kind ? styles.selectedCard : styles.card} onClick={() => selectProvider(item.kind)}>
                    <span>{item.testedFocus ? "Primary testing" : item.kind === "disabled" ? "Always available" : "Optional"}</span>
                    <b>{item.label}</b>
                    <small>{item.description}</small>
                  </button>
                ))}
              </div>

              {liveProvider ? (
                <div className={styles.formCard}>
                  <h3>Connection details</h3>
                  <div className={styles.formGrid}>
                    <label><span>Server address</span><input type="url" value={settings.ai.baseUrl} onChange={(event) => updateAi("baseUrl", event.target.value)} /></label>
                    <label><span>Text model</span><input value={settings.ai.textModel} onChange={(event) => updateAi("textModel", event.target.value)} placeholder="Choose or enter a model" /></label>
                    <label><span>Image model</span><input value={settings.ai.imageModel} onChange={(event) => updateAi("imageModel", event.target.value)} placeholder="Optional" /></label>
                    <label><span>{settings.ai.provider === "ollama" ? "API key (usually not required)" : "API key"}</span><input type="password" autoComplete="off" value={sessionKey} onChange={(event) => { setSessionKey(event.target.value); setConnection((current) => ({ ...current, state: "idle", message: "Save and test the new key to connect." })); }} placeholder={connection.saved && connectionMatchesProvider ? "Saved securely on this computer" : "Enter API key"} /></label>
                  </div>

                  <div className={`${styles.connectionPanel} ${connection.state === "connected" && connectionMatchesProvider ? styles.connectionPanelConnected : connection.state === "error" ? styles.connectionPanelError : ""}`}>
                    <div className={styles.connectionSummary}>
                      <i aria-hidden="true" />
                      <div><strong>{statusLabel}</strong><span>{connection.message}</span>{connection.checkedAt && connection.state === "connected" ? <small>Last verified {new Date(connection.checkedAt).toLocaleString()}</small> : null}</div>
                    </div>
                    <div className={styles.connectionActions}>
                      <button type="button" onClick={saveAndConnect} disabled={connection.state === "checking"}>{connection.state === "checking" ? "Checking…" : connection.saved && connectionMatchesProvider ? "Save & reconnect" : "Save key & connect"}</button>
                      {connection.saved && connectionMatchesProvider ? <button type="button" className={styles.secondaryAction} onClick={testAgain} disabled={connection.state === "checking"}>Test again</button> : null}
                      {connection.saved ? <button type="button" className={styles.removeConnection} onClick={removeConnection}>Remove saved key</button> : null}
                    </div>
                  </div>
                  <p className={styles.note}>The key is saved in PlotPickle&apos;s private local-server data under your computer account. It is never written to browser settings, story projects, exports, prompts, logs, or GitHub. ChatGPT subscriptions and OpenAI API billing are separate.</p>
                </div>
              ) : null}

              {preset?.limitations.length ? <div className={styles.notice}>{preset.limitations.map((item) => <p key={item}>{item}</p>)}</div> : null}
            </>
          ) : null}

          {section === "music" ? (
            <>
              <div className={styles.sectionHeading}><div><p>Music</p><h2>Keep your artist pages close to the story.</h2><span>Add Suno or Udio artist links, such as Ava Iris. PlotPickle stores the links; it does not copy or publish the music.</span></div></div>
              <div className={styles.artistList}>
                {settings.music.map((item) => (
                  <article className={styles.artistCard} key={item.id}>
                    <label><span>Service</span><select value={item.service} onChange={(event) => updateMusic(item.id, { service: event.target.value as MusicArtistLink["service"], artistUrl: "" })}><option value="suno">Suno</option><option value="udio">Udio</option></select></label>
                    <label><span>Artist name</span><input value={item.artistName} onChange={(event) => updateMusic(item.id, { artistName: event.target.value })} placeholder="Ava Iris" /></label>
                    <label className={styles.urlField}><span>Artist link</span><input type="url" value={item.artistUrl} onChange={(event) => updateMusic(item.id, { artistUrl: event.target.value })} placeholder={`https://${item.service}.com/@artist`} /></label>
                    {item.artistUrl && isSupportedMusicArtistUrl(item.service, item.artistUrl) ? <a href={item.artistUrl} target="_blank" rel="noreferrer">Open artist</a> : null}
                    <button type="button" className={styles.removeButton} onClick={() => setSettings((current) => ({ ...current, music: current.music.filter((link) => link.id !== item.id) }))}>Remove</button>
                  </article>
                ))}
                {!settings.music.length ? <div className={styles.empty}><p>No artist links have been added.</p><span>You can use PlotPickle without connecting a music service.</span></div> : null}
              </div>
              <button type="button" className={styles.addButton} onClick={() => setSettings((current) => ({ ...current, music: [...current.music, createMusicLink()] }))}>Add artist link</button>
            </>
          ) : null}

          {notice ? <p className={styles.status} role="status">{notice}</p> : null}
        </section>
      </div>
    </div>
  );
}
