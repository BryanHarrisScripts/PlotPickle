"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  ollama: { detected: boolean; models: string[]; baseUrl: string };
};

type AssistantResponse = {
  provider: ProviderId;
  model: string;
  text: string;
  latencyMs: number;
  verifiedAt: string;
};

const STATUS_PATH = "/api/writing-assistant/status";
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
    label: "MiniMax M3",
    short: "MiniMax",
    description: "Cloud writing assistance using your MiniMax API account.",
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
  if (provider === "ollama" && status.ollama.detected) return "detected";
  return "optional";
}

export default function WritingAssistantConsole({ onManage, focusProvider }: { onManage: (target: string) => void; focusProvider?: ProviderId }) {
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [prompt, setPrompt] = useState("");
  const [ollamaModel, setOllamaModel] = useState("");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [technicalOpen, setTechnicalOpen] = useState(false);

  useEffect(() => {
    void refreshStatus();
  }, []);

  useEffect(() => {
    try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages.slice(-30))); } catch { /* Session persistence is optional. */ }
  }, [messages]);

  async function refreshStatus() {
    try {
      const next = await jsonRequest<AssistantStatus>(STATUS_PATH);
      setStatus(next);
      setOllamaModel((current) => current || next.providers.ollama.model || next.ollama.models[0] || "");
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
      if (provider === "ollama" && status.ollama.detected) {
        setNotice("Choose an installed Ollama model, then select Use this model.");
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The text engine could not be selected.");
    } finally {
      setWorking(false);
    }
  }

  async function configureOllama() {
    if (!ollamaModel || working) return;
    setWorking(true);
    setNotice("Testing the selected Ollama model…");
    try {
      const result = await jsonRequest<AssistantResponse>("/api/writing-assistant/ollama", "POST", {
        model: ollamaModel,
        baseUrl: status?.ollama.baseUrl,
      });
      setMessages((current) => [...current,
        { id: messageId(), role: "user", content: TEST_PROMPT },
        { id: messageId(), role: "assistant", content: result.text, provider: result.provider, model: result.model },
      ].slice(-30));
      setNotice(`${result.model} responded in ${result.latencyMs} ms. Ollama is ready.`);
      await refreshStatus();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Ollama model test failed.");
      await refreshStatus();
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The provider test failed.");
      await refreshStatus();
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
                <em>{profile.ready ? "Ready" : profile.configured ? "Test needed" : provider === "ollama" && status?.ollama.detected ? "Detected" : "Configure"}</em>
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

      {status?.ollama.detected && !status.providers.ollama.configured ? (
        <div className={styles.ollamaSetup}>
          <div><strong>Ollama is running.</strong><span>Select an installed model and PlotPickle will send a real test question before showing green.</span></div>
          <label>Installed model<select value={ollamaModel} onChange={(event) => setOllamaModel(event.target.value)}>{status.ollama.models.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>
          <button type="button" onClick={() => void configureOllama()} disabled={working || !ollamaModel}>Use this model</button>
        </div>
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
            <div><dt>Endpoint</dt><dd>{activeProfile?.baseUrl || "No active endpoint"}</dd></div>
            <div><dt>Last successful response</dt><dd>{formatDate(activeProfile?.verifiedAt)}</dd></div>
            <div><dt>Last latency</dt><dd>{activeProfile?.latencyMs ? `${activeProfile.latencyMs} ms` : "Not measured"}</dd></div>
            <div><dt>Last error</dt><dd>{activeProfile?.error || "None"}</dd></div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
