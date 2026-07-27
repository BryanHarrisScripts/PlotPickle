"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { PlotPickleProject } from "@/lib/project";
import { providerPresets } from "@/lib/ai/providers";
import {
  defaultPlotPickleSettings,
  isSupportedMusicArtistUrl,
  normalizePlotPickleSettings,
  type MusicArtistLink,
  type PlotPickleSettings,
} from "@/lib/ai/settings";
import type {
  ConnectionStatusSnapshot,
  PublicConnectionStatus,
} from "@/lib/connection-status";
import {
  announceSettingsChanged,
  SETTINGS_STORAGE_KEY,
} from "./use-connection-status";
import styles from "./settings-panel.module.css";
import GitHubCollaboration from "./github-collaboration";

const AI_CONNECTION_API = "/api/local-ai/connection";
const GOOGLE_CONNECTION_API = "/api/local-google/connection";
const SETTINGS_SECTION_KEY = "plotpickle.settings.section";

type SettingsSection =
  | "general"
  | "appearance"
  | "project-defaults"
  | "storage"
  | "ai"
  | "github"
  | "plugins"
  | "google"
  | "privacy"
  | "accessibility"
  | "about";

type ConnectionState = "loading" | "idle" | "checking" | "connected" | "error" | "unavailable";

type AiConnectionStatus = {
  state: ConnectionState;
  saved: boolean;
  provider?: PlotPickleSettings["ai"]["provider"];
  checkedAt?: string;
  message: string;
};

type AiConnectionResponse = {
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

const SETTINGS_SECTIONS: Array<{ id: SettingsSection; label: string; description: string }> = [
  { id: "general", label: "General", description: "Language, startup and confirmation preferences" },
  { id: "appearance", label: "Appearance", description: "Theme, density and visual effects" },
  { id: "project-defaults", label: "Project defaults", description: "Format, target length and autosave" },
  { id: "storage", label: "Storage and backups", description: "Local projects, rolling backups and recovery" },
  { id: "ai", label: "AI providers", description: "OpenAI, compatible services, local models or no AI" },
  { id: "github", label: "GitHub", description: "Repository, proposals, .ppf backups and history" },
  { id: "plugins", label: "Plugins", description: "Optional extensions and connected media links" },
  { id: "google", label: "Google and Connected Services", description: "Optional Google sign-in, Calendar and Meet" },
  { id: "privacy", label: "Privacy and permissions", description: "External sharing, diagnostics and local boundaries" },
  { id: "accessibility", label: "Accessibility", description: "Contrast, motion and text preferences" },
  { id: "about", label: "About and licensing", description: "Version, origins, attribution and open licence" },
];

function createMusicLink(): MusicArtistLink {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `music-${Date.now()}`,
    service: "suno",
    artistName: "",
    artistUrl: "",
  };
}

async function jsonRequest<T extends object>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: object,
) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new Error("local-gateway-unavailable");
  const value = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(value.message || "The connection could not be checked.");
  return value;
}

function statusLabel(status: PublicConnectionStatus) {
  if (status.state === "connected") return "Connected";
  if (status.state === "configured") return "Configured";
  if (status.state === "checking") return "Checking";
  if (status.state === "error") return "Needs repair";
  if (status.state === "unavailable") return "Unavailable";
  if (status.state === "disabled") return "Disabled by choice";
  return "Not connected";
}

function formatDate(value: string) {
  if (!value) return "No successful connection recorded";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className={styles.sectionHeading}>
      <div><p>{eyebrow}</p><h2>{title}</h2><span>{description}</span></div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.toggle}>
      <span><b>{label}</b><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function SharedConnectionCard({ status, actions }: { status: PublicConnectionStatus; actions?: ReactNode }) {
  const healthy = status.state === "connected" || status.state === "disabled";
  const failed = status.state === "error";
  return (
    <article className={`${styles.connectionOverview} ${healthy ? styles.connectionPanelConnected : ""} ${failed ? styles.connectionPanelError : ""}`}>
      <header>
        <div>
          <p>Shared connection status</p>
          <h3>{status.label}</h3>
          <span>{status.identity || "No account or provider identity"}</span>
        </div>
        <div className={`${styles.connectionBadge} ${healthy ? styles.connectionBadgeConnected : ""}`} role="status">
          <i aria-hidden="true" />{statusLabel(status)}
        </div>
      </header>
      <p>{status.detail}</p>
      <dl className={styles.statusMeta}>
        <div><dt>Last successful connection</dt><dd>{formatDate(status.lastSuccessfulConnection)}</dd></div>
        <div><dt>What data is shared</dt><dd>{status.dataShared.length ? status.dataShared.join("; ") : "Nothing"}</dd></div>
        <div><dt>Permissions</dt><dd>{status.scopes.length ? status.scopes.join("; ") : "No external permission granted"}</dd></div>
      </dl>
      {status.error ? <p className={styles.connectionError}><b>Error:</b> {status.error}</p> : null}
      <p className={styles.repair}><b>Repair guidance:</b> {status.repairGuidance}</p>
      {actions ? <div className={styles.connectionActions}>{actions}</div> : null}
    </article>
  );
}

export default function SettingsPanel({
  project,
  onProjectChange,
  connections,
  onConnectionChange,
}: {
  project: PlotPickleProject;
  onProjectChange: (project: PlotPickleProject) => void;
  connections: ConnectionStatusSnapshot;
  onConnectionChange: () => void | Promise<void>;
}) {
  const [section, setSection] = useState<SettingsSection>("general");
  const [settings, setSettings] = useState<PlotPickleSettings>(() => structuredClone(defaultPlotPickleSettings));
  const [sessionKey, setSessionKey] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState("");
  const [googlePermissions, setGooglePermissions] = useState<Array<"calendar" | "meet">>([]);
  const [googleWorking, setGoogleWorking] = useState(false);
  const [aiConnection, setAiConnection] = useState<AiConnectionStatus>({
    state: "loading",
    saved: false,
    message: "Checking local connection settings…",
  });

  useEffect(() => {
    function selectRequestedSection(value: string | null) {
      const aliases: Record<string, SettingsSection> = {
        collaboration: "github",
        music: "plugins",
      };
      const resolved = value ? aliases[value] || value : "";
      if (SETTINGS_SECTIONS.some((item) => item.id === resolved)) setSection(resolved as SettingsSection);
    }
    selectRequestedSection(window.sessionStorage.getItem(SETTINGS_SECTION_KEY));
    window.sessionStorage.removeItem(SETTINGS_SECTION_KEY);
    const handleSectionRequest = (event: Event) => selectRequestedSection((event as CustomEvent<string>).detail);
    window.addEventListener("plotpickle:settings-section", handleSectionRequest);
    return () => window.removeEventListener("plotpickle:settings-section", handleSectionRequest);
  }, []);

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
    const granted = connections.items.google.permissions
      .filter((permission) => permission.state === "granted")
      .map((permission) => permission.id);
    setGooglePermissions(granted);
  }, [connections.items.google.permissions]);

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const saved = await jsonRequest<AiConnectionResponse>("GET", AI_CONNECTION_API);
        if (!saved.saved) {
          setAiConnection({ state: "idle", saved: false, message: "No API connection has been saved." });
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
        setAiConnection({ state: "checking", saved: true, provider: saved.provider, checkedAt: saved.checkedAt, message: "Checking the saved API connection…" });
        const checked = await jsonRequest<AiConnectionResponse>("POST", `${AI_CONNECTION_API}/check`);
        if (!controller.signal.aborted) {
          setAiConnection({ state: "connected", saved: true, provider: checked.provider, checkedAt: checked.checkedAt, message: checked.message || "API connected." });
          await onConnectionChange();
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "The API connection could not be checked.";
        if (message === "local-gateway-unavailable") {
          setAiConnection({ state: "unavailable", saved: false, message: "Local API setup is available in the downloaded PlotPickle app." });
        } else {
          setAiConnection({ state: "error", saved: true, message });
        }
      }
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [hydrated, onConnectionChange]);

  useEffect(() => {
    const handleGoogleCallback = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== "plotpickle-google-oauth") return;
      setNotice(event.data.ok ? "Google authorization completed. Connection status refreshed." : "Google authorization was not completed. Local project work is unchanged.");
      setGoogleWorking(false);
      void onConnectionChange();
    };
    window.addEventListener("message", handleGoogleCallback);
    return () => window.removeEventListener("message", handleGoogleCallback);
  }, [onConnectionChange]);

  const preset = useMemo(
    () => providerPresets.find((item) => item.kind === settings.ai.provider) ?? providerPresets.at(-1),
    [settings.ai.provider],
  );
  const liveProvider = settings.ai.provider !== "disabled" && settings.ai.provider !== "manual";
  const connectionMatchesProvider = aiConnection.provider === settings.ai.provider;

  function saveSettings() {
    if (!hydrated) return;
    const invalidLink = settings.music.find((item) => item.artistUrl && !isSupportedMusicArtistUrl(item.service, item.artistUrl));
    if (invalidLink) {
      setSection("plugins");
      setNotice(`Use a valid https://${invalidLink.service}.com artist link for ${invalidLink.artistName || "this artist"}.`);
      return;
    }
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    announceSettingsChanged();
    setNotice("Preferences saved on this device. Credentials remain in the private local-server secrets area.");
  }

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
    setAiConnection((current) => ({
      ...current,
      state: "idle",
      message: current.saved ? "Save and test this provider to replace the saved connection." : "No API connection has been saved.",
    }));
  }

  function updateAi(key: "baseUrl" | "textModel" | "imageModel", value: string) {
    setSettings((current) => ({ ...current, ai: { ...current.ai, [key]: value } }));
    setAiConnection((current) => current.state === "connected"
      ? { ...current, state: "idle", message: "Connection details changed. Save and test again." }
      : current);
  }

  function updateMusic(id: string, patch: Partial<MusicArtistLink>) {
    setSettings((current) => ({
      ...current,
      music: current.music.map((item) => item.id === id ? { ...item, ...patch } : item),
    }));
  }

  async function saveAndConnectAi() {
    if (!liveProvider || aiConnection.state === "checking") return;
    setNotice("");
    setAiConnection((current) => ({ ...current, state: "checking", message: "Saving and checking the API connection…" }));
    try {
      const result = await jsonRequest<AiConnectionResponse>("POST", AI_CONNECTION_API, {
        provider: settings.ai.provider,
        baseUrl: settings.ai.baseUrl,
        textModel: settings.ai.textModel,
        imageModel: settings.ai.imageModel,
        apiKey: sessionKey,
      });
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      announceSettingsChanged();
      setSessionKey("");
      setAiConnection({ state: "connected", saved: true, provider: result.provider, checkedAt: result.checkedAt, message: result.message || "API connected." });
      await onConnectionChange();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The API connection could not be checked.";
      setAiConnection({
        state: message === "local-gateway-unavailable" ? "unavailable" : "error",
        saved: aiConnection.saved,
        provider: aiConnection.provider,
        checkedAt: aiConnection.checkedAt,
        message: message === "local-gateway-unavailable" ? "Local API setup is available in the downloaded PlotPickle app." : message,
      });
    }
  }

  async function testAiAgain() {
    setAiConnection((current) => ({ ...current, state: "checking", message: "Checking the saved API connection…" }));
    try {
      const result = await jsonRequest<AiConnectionResponse>("POST", `${AI_CONNECTION_API}/check`);
      setAiConnection({ state: "connected", saved: true, provider: result.provider, checkedAt: result.checkedAt, message: result.message || "API connected." });
      await onConnectionChange();
    } catch (error) {
      setAiConnection((current) => ({ ...current, state: "error", message: error instanceof Error ? error.message : "The API connection could not be checked." }));
    }
  }

  async function removeAiConnection() {
    try {
      await jsonRequest<AiConnectionResponse>("DELETE", AI_CONNECTION_API);
      setSessionKey("");
      setAiConnection({ state: "idle", saved: false, message: "No API connection has been saved." });
      setNotice("The saved API connection was removed from this computer.");
      await onConnectionChange();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The saved API connection could not be removed.");
    }
  }

  function toggleGooglePermission(permission: "calendar" | "meet") {
    setGooglePermissions((current) => current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission]);
  }

  async function connectGoogle() {
    setGoogleWorking(true);
    setNotice("");
    try {
      const result = await jsonRequest<{ authorizationUrl?: string }>("POST", `${GOOGLE_CONNECTION_API}/start`, { permissions: googlePermissions });
      if (!result.authorizationUrl) throw new Error("Google did not return an authorization address.");
      const authorization = new URL(result.authorizationUrl);
      if (authorization.protocol !== "https:" || authorization.hostname !== "accounts.google.com") throw new Error("The Google authorization address was invalid.");
      const popup = window.open(authorization.toString(), "plotpickle-google-oauth", "popup,width=720,height=760");
      if (!popup) throw new Error("Allow the Google sign-in window, then try again.");
      setNotice("Review Google's consent screen. PlotPickle remains available while sign-in is open.");
    } catch (error) {
      setGoogleWorking(false);
      const message = error instanceof Error ? error.message : "Google sign-in could not begin.";
      setNotice(message === "local-gateway-unavailable" ? "Google setup is available in the downloaded local PlotPickle server." : message);
    }
  }

  async function testGoogle() {
    setGoogleWorking(true);
    try {
      const result = await jsonRequest<{ message?: string }>("POST", `${GOOGLE_CONNECTION_API}/check`);
      setNotice(result.message || "Google connection verified.");
      await onConnectionChange();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Google connection could not be checked.");
    } finally {
      setGoogleWorking(false);
    }
  }

  async function revokeGoogle() {
    setGoogleWorking(true);
    try {
      const result = await jsonRequest<{ message?: string }>("DELETE", GOOGLE_CONNECTION_API);
      setNotice(result.message || "Google access was revoked and local tokens were removed.");
      setGooglePermissions([]);
      await onConnectionChange();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Google access could not be removed.");
    } finally {
      setGoogleWorking(false);
    }
  }

  const aiStatusLabel = aiConnection.state === "connected" && connectionMatchesProvider
    ? "API connected"
    : aiConnection.state === "checking"
      ? "Checking connection"
      : aiConnection.state === "unavailable"
        ? "Local setup unavailable"
        : "Not connected";

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p>Settings</p>
          <h1>Preferences, connections and permissions</h1>
          <span>Local writing always remains available. Optional providers show exactly what is connected, what is shared and how access can be tested or revoked.</span>
        </div>
        <button type="button" onClick={saveSettings}>Save preferences</button>
      </header>

      <div className={styles.layout}>
        <nav className={styles.menu} aria-label="Settings sections">
          {SETTINGS_SECTIONS.map((item) => (
            <button type="button" key={item.id} className={section === item.id ? styles.active : ""} onClick={() => setSection(item.id)}>
              <b>{item.label}</b><span>{item.description}</span>
            </button>
          ))}
        </nav>

        <section className={styles.content}>
          {section === "general" ? (
            <div className={styles.sectionStack}>
              <SectionHeading eyebrow="General" title="Set the everyday PlotPickle experience." description="These preferences stay on this device and do not change the active .ppf project." />
              <div className={styles.settingGrid}>
                <label><span>Language</span><input value={settings.general.language} onChange={(event) => setSettings((current) => ({ ...current, general: { ...current.general, language: event.target.value } }))} /></label>
                <label><span>Startup workspace</span><select value={settings.general.startupPage} onChange={(event) => setSettings((current) => ({ ...current, general: { ...current.general, startupPage: event.target.value as PlotPickleSettings["general"]["startupPage"] } }))}><option value="dashboard">Dashboard</option><option value="simple-start">Simple Start</option></select></label>
              </div>
              <Toggle label="Confirm destructive actions" description="Ask before deleting or replacing material that may be difficult to recover." checked={settings.general.confirmDestructiveActions} onChange={(checked) => setSettings((current) => ({ ...current, general: { ...current.general, confirmDestructiveActions: checked } }))} />
            </div>
          ) : null}

          {section === "appearance" ? (
            <div className={styles.sectionStack}>
              <SectionHeading eyebrow="Appearance" title="Choose a comfortable working surface." description="Appearance preferences affect this installation only." />
              <div className={styles.settingGrid}>
                <label><span>Theme</span><select value={settings.appearance.theme} onChange={(event) => setSettings((current) => ({ ...current, appearance: { ...current.appearance, theme: event.target.value as PlotPickleSettings["appearance"]["theme"] } }))}><option value="system">Use system setting</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
                <label><span>Interface density</span><select value={settings.appearance.density} onChange={(event) => setSettings((current) => ({ ...current, appearance: { ...current.appearance, density: event.target.value as PlotPickleSettings["appearance"]["density"] } }))}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
              </div>
              <Toggle label="Reduce transparency" description="Use more solid surfaces behind text and controls." checked={settings.appearance.reduceTransparency} onChange={(checked) => setSettings((current) => ({ ...current, appearance: { ...current.appearance, reduceTransparency: checked } }))} />
            </div>
          ) : null}

          {section === "project-defaults" ? (
            <div className={styles.sectionStack}>
              <SectionHeading eyebrow="Project defaults" title="Prepare sensible starting values for new stories." description="Existing projects keep their own canonical metadata." />
              <div className={styles.settingGrid}>
                <label><span>Default format</span><select value={settings.projectDefaults.format} onChange={(event) => setSettings((current) => ({ ...current, projectDefaults: { ...current.projectDefaults, format: event.target.value as PlotPickleSettings["projectDefaults"]["format"] } }))}><option value="feature">Feature</option><option value="short">Short</option><option value="series">Series</option><option value="stage">Stage</option></select></label>
                <label><span>Target minutes</span><input type="number" min="1" max="600" value={settings.projectDefaults.targetMinutes} onChange={(event) => setSettings((current) => ({ ...current, projectDefaults: { ...current.projectDefaults, targetMinutes: Number(event.target.value) || 1 } }))} /></label>
                <label><span>Autosave interval (seconds)</span><input type="number" min="5" max="300" value={settings.projectDefaults.autosaveSeconds} onChange={(event) => setSettings((current) => ({ ...current, projectDefaults: { ...current.projectDefaults, autosaveSeconds: Number(event.target.value) || 30 } }))} /></label>
              </div>
            </div>
          ) : null}

          {section === "storage" ? (
            <div className={styles.sectionStack}>
              <SectionHeading eyebrow="Storage and backups" title="Keep projects local, readable and recoverable." description="Project files and rolling backups stay under the current computer account unless you explicitly export or connect GitHub." />
              <SharedConnectionCard status={connections.items.storage} />
              <SharedConnectionCard status={connections.items.backups} />
              <div className={styles.settingGrid}>
                <label><span>Rolling backup limit</span><input type="number" min="1" max="100" value={settings.storage.backupLimit} onChange={(event) => setSettings((current) => ({ ...current, storage: { ...current.storage, backupLimit: Number(event.target.value) || 20 } }))} /></label>
              </div>
              <Toggle label="Create a rolling backup when saving" description="Keep recoverable local history without placing credentials in the project." checked={settings.storage.backupOnSave} onChange={(checked) => setSettings((current) => ({ ...current, storage: { ...current.storage, backupOnSave: checked } }))} />
            </div>
          ) : null}

          {section === "ai" ? (
            <div className={styles.sectionStack}>
              <SectionHeading eyebrow="AI providers" title="Choose how PlotPickle may assist you." description="OpenAI is the primary tested connection. Compatible services, local models, manual prompting and no-AI use remain available." />
              <SharedConnectionCard status={connections.items.ai} />
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
                    <label><span>{settings.ai.provider === "ollama" ? "API key (usually not required)" : "API key"}</span><input type="password" autoComplete="off" value={sessionKey} onChange={(event) => { setSessionKey(event.target.value); setAiConnection((current) => ({ ...current, state: "idle", message: "Save and test the new key to connect." })); }} placeholder={aiConnection.saved && connectionMatchesProvider ? "Saved securely on this computer" : "Enter API key"} /></label>
                  </div>
                  <div className={`${styles.connectionPanel} ${aiConnection.state === "connected" && connectionMatchesProvider ? styles.connectionPanelConnected : aiConnection.state === "error" ? styles.connectionPanelError : ""}`}>
                    <div className={styles.connectionSummary}>
                      <i aria-hidden="true" />
                      <div><strong>{aiStatusLabel}</strong><span>{aiConnection.message}</span>{aiConnection.checkedAt && aiConnection.state === "connected" ? <small>Last verified {formatDate(aiConnection.checkedAt)}</small> : null}</div>
                    </div>
                    <div className={styles.connectionActions}>
                      <button type="button" onClick={() => void saveAndConnectAi()} disabled={aiConnection.state === "checking"}>{aiConnection.state === "checking" ? "Checking…" : aiConnection.saved && connectionMatchesProvider ? "Save & reconnect" : "Save key & connect"}</button>
                      {aiConnection.saved && connectionMatchesProvider ? <button type="button" className={styles.secondaryAction} onClick={() => void testAiAgain()} disabled={aiConnection.state === "checking"}>Test again</button> : null}
                      {aiConnection.saved ? <button type="button" className={styles.removeConnection} onClick={() => void removeAiConnection()}>Remove saved key</button> : null}
                    </div>
                  </div>
                  <p className={styles.note}>The key is saved in PlotPickle&apos;s private local-server data under your computer account. It is never written to browser settings, story projects, exports, reports, prompts, logs or GitHub.</p>
                </div>
              ) : null}
              {preset?.limitations.length ? <div className={styles.notice}>{preset.limitations.map((item) => <p key={item}>{item}</p>)}</div> : null}
            </div>
          ) : null}

          {section === "github" ? (
            <div className={styles.sectionStack}>
              <SectionHeading eyebrow="GitHub" title="Connect collaboration without surrendering canon." description="Repository credentials stay in the private local-server secrets area. The .ppf stores only non-secret repository metadata." />
              <SharedConnectionCard status={connections.items.github} />
              <GitHubCollaboration project={project} onChange={onProjectChange} onConnectionChange={() => void onConnectionChange()} />
            </div>
          ) : null}

          {section === "plugins" ? (
            <div className={styles.sectionStack}>
              <SectionHeading eyebrow="Plugins" title="Keep optional extensions visible and bounded." description="No plugin is required for local writing. Each enabled plugin must disclose its capabilities and shared data." />
              <SharedConnectionCard status={connections.items.plugins} />
              <div className={styles.pluginGrid}>
                {settings.plugins.map((plugin) => (
                  <article key={plugin.id}>
                    <span>{plugin.status === "coming-soon" ? "Coming soon" : plugin.status}</span>
                    <h3>{plugin.label}</h3>
                    <p>{plugin.status === "coming-soon" ? "This placeholder has no permission and shares no data." : "Review this plugin's declared permissions before enabling it."}</p>
                    <button type="button" disabled={plugin.status === "coming-soon"} onClick={() => setSettings((current) => ({ ...current, plugins: current.plugins.map((item) => item.id === plugin.id ? { ...item, status: item.status === "enabled" ? "disabled" : "enabled" } : item) }))}>{plugin.status === "enabled" ? "Disable" : "Enable"}</button>
                  </article>
                ))}
              </div>
              <div className={styles.formCard}>
                <h3>Music service links</h3>
                <p className={styles.note}>Suno and Udio links are references only. PlotPickle does not copy, connect to or publish music.</p>
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
              </div>
            </div>
          ) : null}

          {section === "google" ? (
            <div className={styles.sectionStack}>
              <SectionHeading eyebrow="Google and Connected Services" title="Grant only the Google access this project needs." description="Google Calendar and Google Meet are optional. Failed or declined authentication never blocks local project work." />
              <SharedConnectionCard
                status={connections.items.google}
                actions={(
                  <>
                    <button type="button" disabled={googleWorking || connections.items.google.state === "unavailable"} onClick={() => void connectGoogle()}>{googleWorking ? "Working…" : connections.items.google.state === "connected" ? "Review or add permissions" : "Sign in with Google"}</button>
                    {connections.items.google.state === "connected" ? <button type="button" className={styles.secondaryAction} disabled={googleWorking} onClick={() => void testGoogle()}>Test connection</button> : null}
                    {connections.items.google.state === "connected" ? <button type="button" className={styles.removeConnection} disabled={googleWorking} onClick={() => void revokeGoogle()}>Disconnect and revoke</button> : null}
                  </>
                )}
              />
              <div className={styles.permissionGrid}>
                {connections.items.google.permissions.map((permission) => (
                  <article key={permission.id}>
                    <header><div><p>{permission.label}</p><h3>{permission.state === "granted" ? "Permission granted" : permission.state === "unavailable" ? "OAuth setup required" : "Not granted"}</h3></div><input type="checkbox" aria-label={`Request ${permission.label} permission`} checked={googlePermissions.includes(permission.id)} onChange={() => toggleGooglePermission(permission.id)} /></header>
                    <p>{permission.explanation}</p>
                    <code>{permission.scope}</code>
                  </article>
                ))}
              </div>
              <div className={styles.privacyBoundary}>
                <strong>Google data boundary</strong>
                <p>OAuth access and refresh tokens are written only to the private local secrets area under the current computer account. They are excluded from .ppf projects, reports, exports, logs and GitHub.</p>
                <p>A project may retain only non-sensitive meeting metadata: title, start and end time, meeting link and Calendar event ID. Attendees, email bodies, recordings, transcripts and tokens are not stored in the project foundation.</p>
              </div>
            </div>
          ) : null}

          {section === "privacy" ? (
            <div className={styles.sectionStack}>
              <SectionHeading eyebrow="Privacy and permissions" title="Make every external boundary explicit." description="PlotPickle is local-first. Nothing is sent to an optional provider until the writer initiates an action and the provider's permissions allow it." />
              <Toggle label="Confirm external sharing" description="Show the provider and selected context before any AI, GitHub or connected-service submission." checked={settings.privacy.confirmExternalSharing} onChange={(checked) => setSettings((current) => ({ ...current, privacy: { ...current.privacy, confirmExternalSharing: checked } }))} />
              <Toggle label="Allow anonymous diagnostic reports" description="Diagnostic sharing is off by default and never includes story text or credentials." checked={settings.privacy.diagnosticReports} onChange={(checked) => setSettings((current) => ({ ...current, privacy: { ...current.privacy, diagnosticReports: checked } }))} />
              <div className={styles.privacyBoundary}><strong>Credential rule</strong><p>API keys, repository tokens and OAuth tokens must remain outside project files, Reports, exports, prompts, logs and source control.</p></div>
            </div>
          ) : null}

          {section === "accessibility" ? (
            <div className={styles.sectionStack}>
              <SectionHeading eyebrow="Accessibility" title="Adapt PlotPickle to the writer." description="Colour is paired with text and icons throughout connection status. These additional preferences stay on this device." />
              <Toggle label="Higher contrast" description="Increase separation between text, controls and surfaces." checked={settings.accessibility.highContrast} onChange={(checked) => setSettings((current) => ({ ...current, accessibility: { ...current.accessibility, highContrast: checked } }))} />
              <Toggle label="Reduced motion" description="Minimize non-essential animation and movement." checked={settings.accessibility.reducedMotion} onChange={(checked) => setSettings((current) => ({ ...current, accessibility: { ...current.accessibility, reducedMotion: checked } }))} />
              <Toggle label="Larger interface text" description="Increase working text and control labels." checked={settings.accessibility.largeText} onChange={(checked) => setSettings((current) => ({ ...current, accessibility: { ...current.accessibility, largeText: checked } }))} />
            </div>
          ) : null}

          {section === "about" ? (
            <div className={styles.sectionStack}>
              <SectionHeading eyebrow="About and licensing" title="PlotPickle is an open storytelling workspace." description="The application preserves its creative origins, attribution and share-alike obligations." />
              <div className={styles.aboutGrid}>
                <article><span>Application</span><h3>PlotPickle</h3><p>Local-first story planning, screenplay, storyboard, feedback, reports and production tools.</p></article>
                <article><span>Original author</span><h3>Bryan Elgin Harris</h3><p>Original storytelling method, learning material and PlotPickle product direction.</p></article>
                <article><span>Licence</span><h3>CC BY-SA 4.0</h3><p>Reuse and adaptation are permitted with attribution, a link to the licence, noted modifications and the same licence on derivatives.</p></article>
              </div>
              <div className={styles.connectionActions}>
                <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">Read the CC BY-SA 4.0 licence</a>
                <a href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">Open the PlotPickle repository</a>
                <a href="https://github.com/BryanHarrisScripts/24-Blocks-OpenStoryStudio" target="_blank" rel="noreferrer">Open the original 24 Blocks repository</a>
              </div>
            </div>
          ) : null}

          {notice ? <p className={styles.status} role="status">{notice}</p> : null}
        </section>
      </div>
    </div>
  );
}
