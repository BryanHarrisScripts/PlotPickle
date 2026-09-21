"use client";

import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { isPublicWebPath } from "../public-web-route";
import styles from "./global-dsdd-conversation.module.css";

type DsddContext = {
  route: string;
  surfaceId: string;
  surfaceLabel: string;
  capturedAt: string;
};

type DsddMessage = {
  id: string;
  role: "human" | "dsdd";
  text: string;
  context?: DsddContext;
  provider?: string;
  model?: string;
};

type TextResponse = {
  ok?: boolean;
  text?: string;
  message?: string;
  provider?: string;
  model?: string;
};

const MAX_MESSAGES = 40;

const DSDD_INSTRUCTIONS = [
  "You are PlotPickle's DSDD Conversational UAT interpreter.",
  "Your job is to preserve the Human's meaning while they narrate problems in the running software.",
  "Do not claim that code was changed, fixed, tested, committed, or merged.",
  "Do not redesign the product unless the Human explicitly asks for a different outcome.",
  "Interpret the Human's language as business/user intent first, not as an implementation command.",
  "In a concise conversational response, restate what you understand the Human expects, distinguish observed behavior from expected behavior, and preserve stated constraints.",
  "If one material ambiguity prevents a deterministic requirement, ask at most one focused question.",
  "Otherwise say that the intent is captured as a candidate and invite the Human to keep narrating.",
  "Treat route and surface metadata as context only. Never invent private screen content that is not in the prompt.",
  "Do not reveal hidden reasoning or chain-of-thought.",
].join(" ");

function messageId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}`;
}

function loopbackHost() {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(window.location.hostname);
}

function visible(element: HTMLElement | null) {
  if (!element || !element.isConnected || element.getClientRects().length === 0) return false;
  return window.getComputedStyle(element).visibility !== "hidden";
}

function currentSurfaceContext(pathname: string): DsddContext {
  const orchestrated = Array.from(document.querySelectorAll<HTMLElement>(
    '[data-skin-v1-orchestrator-active="true"][data-skin-v1-surface-id]',
  )).find(visible);
  const experience = Array.from(document.querySelectorAll<HTMLElement>("[data-experience-surface]")).find(visible);
  const headers = Array.from(document.querySelectorAll<HTMLElement>('[data-skin-v1-standard-header="true"]')).filter(visible);
  const header = headers.at(-1) ?? null;
  const spans = header?.querySelectorAll<HTMLSpanElement>("span");
  const surfaceLabel = spans?.item(0)?.textContent?.trim()
    || orchestrated?.dataset.skinV1SurfaceId
    || experience?.dataset.experienceSurface
    || "PLOTPICKLE";

  return {
    route: pathname || window.location.pathname || "/",
    surfaceId: orchestrated?.dataset.skinV1SurfaceId
      || experience?.dataset.experienceSurface
      || "UNKNOWN",
    surfaceLabel,
    capturedAt: new Date().toISOString(),
  };
}

function contextPrompt(context: DsddContext) {
  return [
    "CURRENT PLOTPICKLE CONTEXT",
    `Route: ${context.route}`,
    `Surface ID: ${context.surfaceId}`,
    `Surface label: ${context.surfaceLabel}`,
  ].join("\n");
}

function conversationPrompt(messages: DsddMessage[], context: DsddContext, submitted: string) {
  const recent = messages.slice(-8).map((message) => (
    `${message.role === "human" ? "Human" : "DSDD"}: ${message.text.slice(0, 1800)}`
  )).join("\n\n");

  return [
    contextPrompt(context),
    "",
    recent ? "RECENT CONVERSATION\n" + recent : "",
    "",
    "NEW HUMAN NARRATION",
    submitted,
    "",
    "Respond as the DSDD Conversational UAT interpreter. Preserve meaning; do not claim implementation work.",
  ].filter(Boolean).join("\n");
}

export default function GlobalDsddConversation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [context, setContext] = useState<DsddContext | null>(null);
  const [messages, setMessages] = useState<DsddMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (!loopbackHost() || isPublicWebPath(pathname)) {
        setEligible(false);
        return;
      }
      const next = currentSurfaceContext(pathname);
      const logonVisible = Boolean(document.querySelector<HTMLElement>(
        '[data-experience-surface="LOGON"][data-skin-v1-logon-state], [data-experience-surface="LOGON"]',
      ));
      setContext(next);
      setEligible(!logonVisible && next.surfaceId !== "LOGON");
    };

    refresh();
    let frame = 0;
    const scheduleRefresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(refresh);
    };
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "data-experience-surface",
        "data-skin-v1-orchestrator-active",
        "data-skin-v1-surface-id",
      ],
    });
    window.addEventListener("popstate", scheduleRefresh);
    window.addEventListener("plotpickle:return-dashboard", scheduleRefresh);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", scheduleRefresh);
      window.removeEventListener("plotpickle:return-dashboard", scheduleRefresh);
    };
  }, [pathname]);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (!eligible) setOpen(false);
  }, [eligible]);

  const currentLabel = useMemo(
    () => context ? `${context.surfaceLabel} · ${context.route}` : "Detecting current surface…",
    [context],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitted = draft.trim();
    if (!submitted || working) return;

    const snapshot = currentSurfaceContext(pathname);
    const humanMessage: DsddMessage = {
      id: messageId("dsdd-human"),
      role: "human",
      text: submitted,
      context: snapshot,
    };
    const prior = messages;
    const pending = [...prior, humanMessage].slice(-MAX_MESSAGES);
    setMessages(pending);
    setDraft("");
    setError("");
    setWorking(true);
    setContext(snapshot);

    try {
      const response = await fetch("/api/local-ai/generate/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "local",
          modelRole: "quality",
          instructions: DSDD_INSTRUCTIONS,
          prompt: conversationPrompt(prior, snapshot, submitted),
        }),
      });
      const body = await response.json() as TextResponse;
      if (!response.ok || !body.text?.trim()) {
        throw new Error(body.message || "The DSDD interpreter did not return a response.");
      }
      setMessages((current) => [...current, {
        id: messageId("dsdd-interpreter"),
        role: "dsdd",
        text: body.text!.trim(),
        context: snapshot,
        provider: body.provider,
        model: body.model,
      }].slice(-MAX_MESSAGES));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The DSDD interpreter is unavailable.");
    } finally {
      setWorking(false);
    }
  }

  function clearSession() {
    setMessages([]);
    setDraft("");
    setError("");
  }

  if (!eligible) return null;

  return (
    <>
      <button
        type="button"
        className={styles.launcher}
        aria-expanded={open}
        aria-controls="plotpickle-dsdd-conversation"
        onClick={() => setOpen((value) => !value)}
      >
        DSDD
        <span>LIVE UAT</span>
      </button>

      {open ? (
        <aside
          id="plotpickle-dsdd-conversation"
          className={styles.panel}
          aria-labelledby="plotpickle-dsdd-title"
          data-dsdd-conversational-uat="true"
          data-dsdd-current-surface={context?.surfaceId || "UNKNOWN"}
        >
          <header className={styles.header}>
            <div>
              <small>DETERMINISTIC SPECIFICATION-DRIVEN DEVELOPMENT</small>
              <h2 id="plotpickle-dsdd-title">Conversational UAT</h2>
              <p>Narrate what you expected and what actually happened while you use PlotPickle.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close DSDD conversation">Close</button>
          </header>

          <div className={styles.context} aria-live="polite">
            <strong>Current context</strong>
            <span>{currentLabel}</span>
          </div>

          <div className={styles.thread} ref={threadRef} role="log" aria-live="polite" aria-relevant="additions text">
            {messages.length === 0 ? (
              <div className={styles.dsddMessage}>
                <strong>DSDD</strong>
                <p>Walk through the product normally. Tell me what you are trying to do, what you expected, and what behaved differently. I will preserve the intent and reflect back what I understand.</p>
              </div>
            ) : null}
            {messages.map((message) => (
              <div className={message.role === "human" ? styles.humanMessage : styles.dsddMessage} key={message.id}>
                <strong>{message.role === "human" ? "You" : "DSDD"}</strong>
                <p>{message.text}</p>
                {message.context ? <small>{message.context.surfaceLabel} · {message.context.route}</small> : null}
                {message.role === "dsdd" && message.model ? (
                  <small>Intent model: {message.provider ? `${message.provider} · ` : ""}{message.model}</small>
                ) : null}
              </div>
            ))}
            {working ? <p className={styles.working} role="status">DSDD is interpreting the narration…</p> : null}
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error} Your narration remains in this browser session; no code change was attempted.
            </p>
          ) : null}

          <form className={styles.composer} onSubmit={submit}>
            <label htmlFor="plotpickle-dsdd-narration">Narrate the workflow or problem</label>
            <textarea
              id="plotpickle-dsdd-narration"
              aria-label="DSDD narration"
              data-purpose="natural-language developer uat narration"
              disabled={working}
              onChange={(event) => setDraft(event.currentTarget.value)}
              placeholder="Example: When I open this, I expect the current draft to stay exactly where I left it, but it sends me back to the dashboard."
              rows={4}
              value={draft}
            />
            <div className={styles.composerFooter}>
              <span>Microphone is ready from this DSDD field. PlotPickle prepares the reviewed local speech runtime automatically after your microphone click. This first slice records and interprets intent; it does not edit code.</span>
              <div>
                <button type="button" className={styles.secondary} disabled={working || messages.length === 0} onClick={clearSession}>Clear</button>
                <button type="submit" disabled={working || !draft.trim()}>Send</button>
              </div>
            </div>
          </form>
        </aside>
      ) : null}
    </>
  );
}
