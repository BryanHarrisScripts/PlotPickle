"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { requestConnectionStatusRefresh } from "./use-connection-status";
import styles from "./writing-assistant-console.module.css";

type ProviderId = "ollama" | "openai" | "minimax";
type ActiveProvider = ProviderId | "disabled";
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: ProviderId;
  model?: string;
};

type ProviderStatus = {
  configured: boolean;
  ready: boolean;
  active: boolean;
  provider?: ProviderId;
  baseUrl?: string;
  model?: string;
  configuredAt?: string;
  verifiedAt?: string;
  lastAttemptAt?: string;
  latencyMs?: number;
  preview?: string;
  error?: string;
};

type AssistantStatus = {
  activeProvider: ActiveProvider;
  explicitlyDisabled: boolean;
  providers: Record<ProviderId, ProviderStatus>;
  ollama: {
    detected: boolean;
    reachable: boolean;
    models: string[];
    baseUrl: string;
    version: string;
    latencyMs: number;
    checkedAt: string;
    error: string;
  };
};

type AssistantResponse = {
  provider: ProviderId;
  model: string;
  text: string;
  latencyMs: number;
  verifiedAt: string;
};

type OllamaConnectionResponse = {
  reachable: boolean;
  baseUrl: string;
  models: string[];
  version: string;
  latencyMs: number;
  checkedAt: string;
  error: string;
};

type StarterModelResponse = {
  model: string;
  displayName: string;
  qualityBoundary: string;
  installed: boolean;
  alreadyInstalled: boolean;
  models: string[];
};

const STATUS_PATH = "/api/writing-assistant/status";
const STARTER_MODEL_PATH = "/api/ollama-bootstrap/starter-model";
const SESSION_KEY = "plotpickle.writing-assistant.session";
const TEST_PROMPT = "Introduce yourself to a new PlotPickle writer.";
const providerOrder: ProviderId[] = ["ollama", "openai", "minimax"];

const providerCopy: Record<ProviderId, { label: string; short: string; description: string; settingsTarget: string }> = {
  ollama: {
    label: "Ollama Local",
    short: "Ollama",
    description: "Private local writing assistance using an installed model.",
    settingsTarget: "Local writing & planning · Ollama",
  },
  openai: {
    label: "OpenAI API",
    short: "OpenAI",
    description: "Cloud writing assistance using your separate OpenAI API account.",
    settingsTarget: "Cloud images & video",
  },
  minimax: {
    label: "MiniMax Text",
    short: "MiniMax",
    description: "Cloud writing assistance using the MiniMax account that can also provide H3 video.",
    settingsTarget: "Cloud images & video",
  },
};

function messageId() {
  return globalThis.crypto?.randomUUID?.() ?? `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Message>;
  return typeof item.id === "string"
    && (item.role === "user" || item.role === "assistant")
    && typeof item.content === "string";
}

function initialMessages() {
  if (typeof window === "undefined") return [] as Message[];
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isMessage).slice(-30) : [];
  } catch {
    return [];
  }
}

async function jsonRequest<T>(path: string, method: "GET" | "POST" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("The local Writing Assistant gateway is unavailable.");
  const value = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(value.message || "The Writing Assistant request failed.");
  return value;
}

function formatDate(value?: string) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function providerState(profile: ProviderStatus, provider: ProviderId, status: AssistantStatus) {
  if (profile.ready) return "ready";
  if (profile.error) return "error";
  if (profile.configured) return "configured";
  if (provider === "ollama" && status.ollama.reachable) return "detected";
  return "optional";
}

export default function WritingAssistantConsole({ onManage, focusProvider }: { onManage: (target: string) => void; focusProvider?: ProviderId }) {
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [prompt, setPrompt] = useState("");
  const [ollamaModel, setOllamaModel] = useState("");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://127.0.0.1:11434");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [technicalOpen, setTechnicalOpen] = useState(false);

  useEffect(() => {
    void refreshStatus();
  }, []);

  useEffect(() => {
    try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages.slice(-30))); } catch { /* Session persistence is optional. */ }
  }, [messages]);

  function refreshDashboardLights() {
    requestConnectionStatusRefresh();
    window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
  }

  async function refreshStatus() {
    try {
      const next = await jsonRequest<AssistantStatus>(STATUS_PATH);
      setStatus(next);
      setOllamaBaseUrl(next.ollama.baseUrl || "http://127.0.0.1:11434");
      setOllamaModel((current) => {
        const preferred = next.providers.ollama.model || current;
        if (preferred && next.ollama.models.includes(preferred)) return preferred;
        return next.ollama.models[0] || preferred || "";
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Writing Assistant status could not be checked.");
    }
  }

  const visibleProviders = focusProvider ? [focusProvider] : providerOrder;

  const activeProfile = useMemo(() => {
    if (!status || status.activeProvider === "disabled") return null;
    return status.providers[status.activeProvider];
  }, [status]);

  async function selectProvider(provider: ActiveProvider) {
    if (!status || working) return;
    if (provider !== "disabled" && !status.providers[provider].configured) {
      if (provider === "ollama") {
        setNotice(status.ollama.reachable
          ? "Choose an installed Ollama model, then save and test it."
          : "Test the Ollama connection, then choose an installed model.");
        return;
      }
      onManage(providerCopy[provider].settingsTarget);
      return;
    }
    setWorking(true);
    setNotice("");
    try {
      await jsonRequest("/api/writing-assistant/active", "POST", { provider });
      await refreshStatus();
      refreshDashboardLights();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The text engine could not be selected.");
    } finally {
      setWorking(false);
    }
  }

  async function testOllamaConnection() {
    if (working || !ollamaBaseUrl.trim()) return;
    setWorking(true);
    setNotice("Checking the Ollama service and installed models…");
    try {
      const result = await jsonRequest<OllamaConnectionResponse>("/api/writing-assistant/ollama/connection", "POST", { baseUrl: ollamaBaseUrl });
      setNotice(result.models.length
        ? `Ollama ${result.version || "service"} responded in ${result.latencyMs} ms. ${result.models.length} installed model${result.models.length === 1 ? "" : "s"} found.`
        : result.error || "Ollama is running, but no installed models were found.");
      await refreshStatus();
      refreshDashboardLights();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Ollama connection test failed.");
      await refreshStatus();
      refreshDashboardLights();
    } finally {
      setWorking(false);
    }
  }

  async function installStarterModel() {
    if (working || !status?.ollama.reachable) return;
    setWorking(true);
    setNotice("Installing the reviewed 88 MB Ollama starter model…");
    try {
      const result = await jsonRequest<StarterModelResponse>(STARTER_MODEL_PATH, "POST");
      setNotice(result.alreadyInstalled
        ? `${result.displayName} is already installed. Refreshing the model list.`
        : `${result.displayName} was installed. ${result.qualityBoundary}`);
      await refreshStatus();
      setOllamaModel((current) => current || result.model);
      refreshDashboardLights();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Ollama starter model could not be installed.");
      await refreshStatus();
      refreshDashboardLights();
    } finally {
      setWorking(false);
    }
  }

  async function configureOllama() {
    if (!ollamaModel || working) return;
    setWorking(true);
    setNotice("Saving and testing the selected Ollama model…");
    try {
      const result = await jsonRequest<AssistantResponse>("/api/writing-assistant/ollama", "POST", {
        model: ollamaModel,
        baseUrl: ollamaBaseUrl,
      });
      setMessages((current) => [...current,
        { id: messageId(), role: "user", content: TEST_PROMPT },
        { id: messageId(), role: "assistant", content: result.text, provider: result.provider, model: result.model },
      ].slice(-30));
      setNotice(`${result.model} responded in ${result.latencyMs} ms. Ollama is selected and ready.`);
      await refreshStatus();
      refreshDashboardLights();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Ollama model test failed.");
      await refreshStatus();
      refreshDashboardLights();
    } finally {
      setWorking(false);
    }
  }

  async function testProvider(provider: ProviderId) {
    if (working) return;
    setWorking(true);
    setNotice(`Testing ${providerCopy[provider].short}…`);
    try {
      const result = await jsonRequest<AssistantResponse>("/api/writing-assistant/test", "POST", { provider });
      setMessages((current) => [...current,
        { id: messageId(), role: "user", content: TEST_PROMPT },
        { id: messageId(), role: "assistant", content: result.text, provider: result.provider, model: result.model },
      ].slice(-30));
      setNotice(`${result.model} responded in ${result.latencyMs} ms. The connection is ready.`);
      await refreshStatus();
      refreshDashboardLights();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The provider test failed.");
      await refreshStatus();
      refreshDashboardLights();
    } finally {
      setWorking(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || working || !status || status.activeProvider === "disabled") return;
    const userMessage: Message = { id: messageId(), role: "user", content: message };
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage].slice(-30));
    setPrompt("");
    setWorking(true);
    setNotice("");
    try {
      const result = await jsonRequest<AssistantResponse>("/api/writing-assistant/chat", "POST", { message, history });
      setMessages((current) => [...current, {
        id: messageId(),
        role: "assistant",
        content: result.text,
        provider: result.provider,
        model: result.model,
      }].slice(-30));
      setNotice(`${providerCopy[result.provider].short} · ${result.model} · ${result.latencyMs} ms`);
      await refreshStatus();
      refreshDashboardLights();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Writing Assistant could not answer.");
    } finally {
      setWorking(false);
    }
  }

  function clearConversation() {
    setMessages([]);
    setNotice("Temporary assistant conversation cleared. No story canon was changed.");
  }

  const showOllamaSetup = focusProvider === "ollama" || Boolean(status?.ollama.reachable || status?.providers.ollama.configured);

  return (
    <section className={styles.console} aria-labelledby="writing-assistant-title">
      <header className={styles.header}>
        <div>
          <p>Ask while you learn PlotPickle</p>
          <h2 id="writing-assistant-title">{focusProvider ? `${providerCopy[focusProvider].label} Settings` : "Writing Assistant"}</h2>
          <span>Choose one text engine. The selection also routes existing PlotPickle text assistance across Learn, Plan, Write, Feedback and Refine.</span>
        </div>
        <div className={styles.headerActions}>
          <button type="button" onClick={() => setTechnicalOpen((current) => !current)}>{technicalOpen ? "Hide technical log" : "Technical log"}</button>
          <button type="button" onClick={clearConversation} disabled={!messages.length}>Clear</button>
        </div>
      </header>

      <div className={styles.providerGrid} aria-label="Writing Assistant text engine">
        {visibleProviders.map((provider) => {
          const profile = status?.providers[provider] ?? { configured: false, ready: false, active: false };
          const state = status ? providerState(profile, provider, status) : "optional";
          return (
            <article key={provider} data-state={state} data-active={status?.activeProvider === provider || undefined}>
              <button type="button" className={styles.providerButton} onClick={() => void selectProvider(provider)} disabled={working || !status}>
                <span className={styles.providerLight} aria-hidden="true" />
                <span><strong>{providerCopy[provider].label}</strong><small>{providerCopy[provider].description}</small></span>
                <em>{profile.ready ? "Ready" : profile.configured ? "Test needed" : provider === "ollama" && status?.ollama.reachable ? "Service detected" : "Configure"}</em>
              </button>
              {profile.configured ? <button type="button" className={styles.testButton} onClick={() => void testProvider(provider)} disabled={working}>Test response</button> : null}
              {!profile.configured && provider !== "ollama" ? <button type="button" className={styles.testButton} onClick={() => onManage(providerCopy[provider].settingsTarget)}>Open setup</button> : null}
            </article>
          );
        })}
        {!focusProvider ? (
          <article data-state={status?.activeProvider === "disabled" ? "off" : "optional"} data-active={status?.activeProvider === "disabled" || undefined}>
            <button type="button" className={styles.providerButton} onClick={() => void selectProvider("disabled")} disabled={working || !status}>
              <span className={styles.providerLight} aria-hidden="true" />
              <span><strong>Off</strong><small>Use PlotPickle manually without text generation.</small></span>
              <em>{status?.activeProvider === "disabled" ? "Selected" : "Available"}</em>
            </button>
          </article>
        ) : null}
      </div>

      {showOllamaSetup ? (
        <section className={styles.ollamaSetup} aria-labelledby="ollama-model-settings-title">
          <div>
            <strong id="ollama-model-settings-title">Ollama connection and model</strong>
            <span>The service can be running while no usable LLM is selected. PlotPickle turns green only after the selected model answers a real test prompt.</span>
          </div>
          <label>
            Ollama server address
            <input value={ollamaBaseUrl} onChange={(event) => setOllamaBaseUrl(event.target.value)} placeholder="http://127.0.0.1:11434" spellCheck={false} />
          </label>
          <div className={styles.headerActions}>
            <button type="button" onClick={() => void testOllamaConnection()} disabled={working || !ollamaBaseUrl.trim()}>Test connection</button>
            <button type="button" onClick={() => void refreshStatus()} disabled={working}>Refresh models</button>
            {status?.ollama.reachable && !status.ollama.models.length ? (
              <button type="button" onClick={() => void installStarterModel()} disabled={working}>Install starter model</button>
            ) : null}
          </div>
          {status?.ollama.reachable && !status.ollama.models.length ? (
            <p className={styles.starterNote}>Install the reviewed 88 MB SmolLM2 starter to verify the lowest-resource local path. It is a setup model, not the recommended final writing model.</p>
          ) : null}
          <label>
            Installed Ollama LLM
            <select value={ollamaModel} onChange={(event) => setOllamaModel(event.target.value)} disabled={working || !status?.ollama.models.length}>
              {!status?.ollama.models.length ? <option value="">No installed models found</option> : null}
              {status?.ollama.models.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void configureOllama()} disabled={working || !ollamaModel}>Save, select &amp; test this model</button>
          <dl>
            <div><dt>Service</dt><dd>{status?.ollama.reachable ? "Running" : "Not reachable"}</dd></div>
            <div><dt>Version</dt><dd>{status?.ollama.version || "Not reported"}</dd></div>
            <div><dt>Installed models</dt><dd>{status?.ollama.models.length ?? 0}</dd></div>
            <div><dt>Selected model</dt><dd>{status?.providers.ollama.model || "None"}</dd></div>
            <div><dt>Last connection check</dt><dd>{formatDate(status?.ollama.checkedAt)}</dd></div>
            <div><dt>Connection latency</dt><dd>{status?.ollama.latencyMs ? `${status.ollama.latencyMs} ms` : "Not measured"}</dd></div>
          </dl>
          {status?.ollama.error ? <p className={styles.notice}>{status.ollama.error}</p> : null}
        </section>
      ) : null}

      <div className={styles.conversation} aria-live="polite">
        {messages.length ? messages.map((message) => (
          <article key={message.id} data-role={message.role}>
            <header><strong>{message.role === "user" ? "You" : "PlotPickle Assistant"}</strong>{message.provider ? <span>{providerCopy[message.provider].short} · {message.model}</span> : null}</header>
            <p>{message.content}</p>
          </article>
        )) : (
          <div className={styles.emptyConversation}>
            <strong>Ask about PlotPickle, your story structure, or what to do next.</strong>
            <span>Run a provider test first. The answer appears here so you know the connection genuinely works.</span>
          </div>
        )}
        {working ? <p className={styles.thinking}>Waiting for the selected model…</p> : null}
      </div>

      <form className={styles.composer} onSubmit={sendMessage}>
        <label htmlFor="writing-assistant-prompt">Question</label>
        <textarea id="writing-assistant-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={status?.activeProvider === "disabled" ? "Select a text engine to begin." : "Ask Ollama or your cloud model a question…"} disabled={working || !status || status.activeProvider === "disabled"} rows={3} />
        <div><span>This temporary console is local UI state. Answers do not become story canon automatically.</span><button type="submit" disabled={working || !prompt.trim() || !status || status.activeProvider === "disabled"}>Send</button></div>
      </form>

      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      {technicalOpen ? (
        <div className={styles.technical}>
          <header><strong>Technical log</strong><span>No API keys or secret values are displayed.</span></header>
          <dl>
            <div><dt>Active text engine</dt><dd>{status?.activeProvider === "disabled" ? "Off" : status ? providerCopy[status.activeProvider].label : "Checking"}</dd></div>
            <div><dt>Model</dt><dd>{activeProfile?.model || "No active model"}</dd></div>
            <div><dt>Endpoint</dt><dd>{activeProfile?.baseUrl || (status?.activeProvider === "ollama" ? status.ollama.baseUrl : "No active endpoint")}</dd></div>
            <div><dt>Last successful response</dt><dd>{formatDate(activeProfile?.verifiedAt)}</dd></div>
            <div><dt>Last latency</dt><dd>{activeProfile?.latencyMs ? `${activeProfile.latencyMs} ms` : "Not measured"}</dd></div>
            <div><dt>Last error</dt><dd>{activeProfile?.error || "None"}</dd></div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
