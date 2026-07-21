"use client";

import { useEffect, useMemo, useState } from "react";
import { providerPresets } from "@/lib/ai/providers";
import {
  defaultPlotPickleSettings,
  isSupportedMusicArtistUrl,
  normalizePlotPickleSettings,
  type MusicArtistLink,
  type PlotPickleSettings,
} from "@/lib/ai/settings";
import styles from "./settings-panel.module.css";

const SETTINGS_STORAGE_KEY = "plotpickle.settings.v1";
type SettingsSection = "ai" | "music" | "plugins";

function createMusicLink(): MusicArtistLink {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `music-${Date.now()}`,
    service: "suno",
    artistName: "",
    artistUrl: "",
  };
}

export default function SettingsPanel() {
  const [section, setSection] = useState<SettingsSection>("ai");
  const [settings, setSettings] = useState<PlotPickleSettings>(() => structuredClone(defaultPlotPickleSettings));
  const [sessionKey, setSessionKey] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState("");

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

  const preset = useMemo(
    () => providerPresets.find((item) => item.kind === settings.ai.provider) ?? providerPresets.at(-1),
    [settings.ai.provider],
  );

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
    setNotice("");
  }

  function updateAi(key: "baseUrl" | "textModel" | "imageModel", value: string) {
    setSettings((current) => ({ ...current, ai: { ...current.ai, [key]: value } }));
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
    setNotice("Settings saved on this device. API keys are not saved.");
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p>Settings</p>
          <h1>Connections and creative services</h1>
          <span>Set up optional AI and music links. PlotPickle remains fully usable without either.</span>
        </div>
        <button type="button" onClick={saveSettings}>Save settings</button>
      </header>

      <div className={styles.layout}>
        <nav className={styles.menu} aria-label="Settings sections">
          <button type="button" className={section === "ai" ? styles.active : ""} onClick={() => setSection("ai")}><b>AI Setup</b><span>ChatGPT, other AI, or local LLM</span></button>
          <button type="button" className={section === "music" ? styles.active : ""} onClick={() => setSection("music")}><b>Music</b><span>Suno, Udio, and artist links</span></button>
          <button type="button" className={section === "plugins" ? styles.active : ""} onClick={() => setSection("plugins")}><b>Plugins</b><span>Future connectivity</span></button>
        </nav>

        <section className={styles.content}>
          {section === "ai" ? (
            <>
              <div className={styles.sectionHeading}><p>AI Setup</p><h2>Choose how PlotPickle may assist you.</h2><span>ChatGPT / OpenAI API is our primary tested connection. Other services and no-AI use remain available.</span></div>
              <div className={styles.providerGrid}>
                {providerPresets.map((item) => (
                  <button type="button" key={item.kind} className={settings.ai.provider === item.kind ? styles.selectedCard : styles.card} onClick={() => selectProvider(item.kind)}>
                    <span>{item.testedFocus ? "Primary testing" : item.kind === "disabled" ? "Always available" : "Optional"}</span>
                    <b>{item.label}</b>
                    <small>{item.description}</small>
                  </button>
                ))}
              </div>

              {settings.ai.provider !== "disabled" && settings.ai.provider !== "manual" ? (
                <div className={styles.formCard}>
                  <h3>Connection details</h3>
                  <div className={styles.formGrid}>
                    <label><span>Server address</span><input type="url" value={settings.ai.baseUrl} onChange={(event) => updateAi("baseUrl", event.target.value)} /></label>
                    <label><span>Text model</span><input value={settings.ai.textModel} onChange={(event) => updateAi("textModel", event.target.value)} placeholder="Choose or enter a model" /></label>
                    <label><span>Image model</span><input value={settings.ai.imageModel} onChange={(event) => updateAi("imageModel", event.target.value)} placeholder="Optional" /></label>
                    <label><span>API key for this open session</span><input type="password" autoComplete="off" value={sessionKey} onChange={(event) => setSessionKey(event.target.value)} placeholder={settings.ai.provider === "ollama" ? "Usually not required" : "Not saved"} /></label>
                  </div>
                  <p className={styles.note}>The API key stays in memory only while PlotPickle is open. It is not written to local settings or exported story files. ChatGPT subscriptions and OpenAI API billing are separate.</p>
                </div>
              ) : null}

              {preset?.limitations.length ? <div className={styles.notice}>{preset.limitations.map((item) => <p key={item}>{item}</p>)}</div> : null}
            </>
          ) : null}

          {section === "music" ? (
            <>
              <div className={styles.sectionHeading}><p>Music</p><h2>Keep your artist pages close to the story.</h2><span>Add Suno or Udio artist links, such as Ava Iris. PlotPickle stores the links; it does not copy or publish the music.</span></div>
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

          {section === "plugins" ? (
            <>
              <div className={styles.sectionHeading}><p>Plugins</p><h2>Future connectivity will live here.</h2><span>Plugins are placeholders only. Nothing is enabled or given access until a real connection is built and reviewed.</span></div>
              <div className={styles.pluginGrid}>{settings.plugins.map((plugin) => <article key={plugin.id}><span>Coming later</span><h3>{plugin.label}</h3><p>Reserved for future PlotPickle connectivity.</p><button type="button" disabled>Not available yet</button></article>)}</div>
            </>
          ) : null}

          {notice ? <p className={styles.status} role="status">{notice}</p> : null}
        </section>
      </div>
    </div>
  );
}
