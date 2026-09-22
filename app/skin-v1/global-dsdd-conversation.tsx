"use client";

import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { authenticatedProfileFetch } from "../../core/auth/profile-request-browser";
import { isPublicWebPath } from "../public-web-route";
import VoiceInputControl from "../_components/voice-input-control";
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

type DsddLockedIntent = {
  version: number;
  locked: true;
  understoodMeaning: string;
  requirements: Array<{ id: string; text: string; status: "PASS" | "FAIL" | "UNPROVEN" }>;
  buildPacket: { id: string; intentDigest: string };
  build?: { state: "queued" | "running" | "passed-pre-pr" | "failed"; summary: string };
};

type DsddSessionPayload = {
  ok?: boolean;
  message?: string;
  session?: {
    conversation?: Array<DsddMessage & { recordedAt?: string }>;
    intents?: DsddLockedIntent[];
  };
  intent?: DsddLockedIntent;
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
  const [lockedIntent, setLockedIntent] = useState<DsddLockedIntent | null>(null);
  const [locking, setLocking] = useState(false);
  const [buildState, setBuildState] = useState<DsddLockedIntent["build"] | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const narrationRef = useRef<HTMLTextAreaElement | null>(null);
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
    if (!eligible || hydrated) return;
    let cancelled = false;
    void authenticatedProfileFetch("/api/dsdd/session", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as DsddSessionPayload;
        if (!response.ok || !body.ok) throw new Error(body.message || "DSDD session could not be restored.");
        if (cancelled) return;
        const conversation = Array.isArray(body.session?.conversation) ? body.session!.conversation! : [];
        setMessages(conversation.slice(-MAX_MESSAGES).map((entry) => ({
          id: entry.id,
          role: entry.role,
          text: entry.text,
          context: entry.context,
          provider: entry.provider,
          model: entry.model,
        })));
        const intents = Array.isArray(body.session?.intents) ? body.session!.intents! : [];
        const latest = intents.at(-1) || null;
        setLockedIntent(latest);
        setBuildState(latest?.build || null);
        setHydrated(true);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "DSDD session could not be restored.");
          setHydrated(true);
        }
      });
    return () => { cancelled = true; };
  }, [eligible, hydrated]);

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
      const persistHuman = await authenticatedProfileFetch("/api/dsdd/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "append-human", text: submitted, context: snapshot }),
      });
      const persistedHuman = await persistHuman.json() as DsddSessionPayload;
      if (!persistHuman.ok || !persistedHuman.ok) {
        throw new Error(persistedHuman.message || "DSDD could not preserve the Human narration.");
      }

      const response = await fetch("/api/local-ai/generate/text", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-PlotPickle-DSDD-Scope": "intent" },
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
      const interpreted = body.text!.trim();
      const persistInterpretation = await authenticatedProfileFetch("/api/dsdd/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "append-interpretation", text: interpreted, context: snapshot }),
      });
      const persistedInterpretation = await persistInterpretation.json() as DsddSessionPayload;
      if (!persistInterpretation.ok || !persistedInterpretation.ok) {
        throw new Error(persistedInterpretation.message || "DSDD could not preserve its interpretation.");
      }
      setLockedIntent(null);
      setMessages((current) => [...current, {
        id: messageId("dsdd-interpreter"),
        role: "dsdd",
        text: interpreted,
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

  async function lockCurrentIntent() {
    if (working || locking || !messages.some((message) => message.role === "dsdd")) return;
    setLocking(true);
    setError("");
    try {
      const response = await authenticatedProfileFetch("/api/dsdd/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lock-intent" }),
      });
      const body = await response.json() as DsddSessionPayload;
      if (!response.ok || !body.ok || !body.intent) throw new Error(body.message || "DSDD could not lock the approved intent.");
      setLockedIntent(body.intent);
      const buildResponse = await authenticatedProfileFetch("/api/dsdd/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "build" }),
      });
      const buildBody = await buildResponse.json() as DsddSessionPayload;
      if (!buildResponse.ok || !buildBody.ok || !buildBody.intent) {
        throw new Error(buildBody.message || "The locked intent could not enter the bounded build loop.");
      }
      setLockedIntent(buildBody.intent);
      setBuildState(buildBody.intent.build || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "DSDD could not lock the approved intent.");
    } finally {
      setLocking(false);
    }
  }

  function clearDraft() {
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

          {lockedIntent ? (
            <div className={styles.context} data-dsdd-locked-intent="true" aria-live="polite">
              <strong>Locked intent v{lockedIntent.version}</strong>
              <span>{lockedIntent.understoodMeaning}</span>
              <small>{lockedIntent.requirements.map((requirement) => `${requirement.id} ${requirement.status}`).join(" · ")}</small>
              {buildState ? <small>BUILD: {buildState.state.toUpperCase()} · {buildState.summary}</small> : null}
            </div>
          ) : messages.some((message) => message.role === "dsdd") ? (
            <div className={styles.context} data-dsdd-candidate-intent="true">
              <strong>What DSDD understood</strong>
              <span>{[...messages].reverse().find((message) => message.role === "dsdd")?.text}</span>
              <small>Review this meaning. Nothing enters BUILD until you choose Build this.</small>
            </div>
          ) : null}

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
              ref={narrationRef}
              data-voice-input="false"
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
              <span>Microphone is ready here. Human narration and DSDD interpretation are preserved in the authenticated local engineering session. Build this locks the approved meaning, then hands only that locked packet to the existing isolated local Pi developer worker. GitHub exact-head CI remains the merge authority.</span>
              <VoiceInputControl
                value={draft}
                onValueChange={setDraft}
                inputRef={narrationRef}
                disabled={working || locking}
                inputType="textarea"
                purpose="natural-language developer uat narration"
                className={styles.voiceControl}
                statusPlacement="inline"
              />
              <div>
                <button type="button" className={styles.secondary} disabled={working || locking || !draft} onClick={clearDraft}>Clear draft</button>
                <button type="button" className={styles.secondary} disabled={working || locking || Boolean(lockedIntent) || !messages.some((message) => message.role === "dsdd")} onClick={() => { void lockCurrentIntent(); }}>{locking ? "Locking…" : "Build this"}</button>
                <button type="submit" disabled={working || locking || !draft.trim()}>Send</button>
              </div>
            </div>
          </form>
        </aside>
      ) : null}
    </>
  );
}
