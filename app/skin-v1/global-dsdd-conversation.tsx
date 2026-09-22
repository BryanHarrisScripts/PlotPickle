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

type DsddDeveloperBrief = {
  state: "ready";
  generatedAt: string;
  reviewer: "pi";
  piVersion: string;
  model: string;
  runtime: string;
  tools: ["read", "grep", "find", "ls"];
  repositoryMutation: false;
  text: string;
};

type DsddPublishedIssue = {
  repository: "BryanHarrisScripts/PlotPickle";
  number: number;
  title: string;
  url: string;
  publishedAt: string;
};

type DsddLockedIntent = {
  version: number;
  locked: true;
  understoodMeaning: string;
  requirements: Array<{ id: string; text: string; status: "PASS" | "FAIL" | "UNPROVEN" }>;
  handoffPacket?: { id: string; intentDigest: string };
  developerBrief?: DsddDeveloperBrief;
  publishedIssue?: DsddPublishedIssue;
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
const MAX_INTERPRETATION_CHARS = 6000;

const DSDD_INSTRUCTIONS = [
  "You are PlotPickle's DSDD Conversational UAT interpreter.",
  "Your job is to preserve the Human's meaning while they narrate problems in the running software.",
  "Do not claim that code was changed, fixed, tested, committed, or merged.",
  "Do not redesign the product unless the Human explicitly asks for a different outcome.",
  "Interpret the Human's language as business/user intent first, not as an implementation command.",
  "Return a concise product interpretation under 1200 characters.",
  "Use at most five short bullets across expected outcome, observed behavior, constraints, and testable requirements.",
  "If the Human clearly says there is no problem and no development change is required, reply exactly: Understood. This is not a problem and no development action is required. I’ll retain it as a UAT observation.",
  "Do not invite Pi Draft when no development action is required.",
  "If one material ambiguity prevents a deterministic requirement, ask at most one focused question.",
  "Otherwise state that the intent is ready for Human review before Pi Draft.",
  "Treat route and surface metadata as context only. Never invent private screen content that is not in the prompt.",
  "Do not reveal hidden reasoning or chain-of-thought.",
].join(" ");

function messageId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}`;
}

function boundedInterpretation(value: string) {
  const normalized = value.trim();
  if (normalized.length <= MAX_INTERPRETATION_CHARS) return normalized;
  const marker = "\n\n[DSDD interpretation bounded for session persistence.]";
  return normalized.slice(0, MAX_INTERPRETATION_CHARS - marker.length).trimEnd() + marker;
}

const NO_DEVELOPMENT_ACTION_PATTERN = /no (?:development )?(?:action|change) (?:is )?required|no development action is required/iu;

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
  const [piDrafting, setPiDrafting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const narrationRef = useRef<HTMLTextAreaElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const busy = working || piDrafting || publishing;
  const latestInterpretation = useMemo(
    () => [...messages].reverse().find((message) => message.role === "dsdd")?.text || "",
    [messages],
  );
  const hasInterpretation = Boolean(latestInterpretation);
  const noActionRequired = NO_DEVELOPMENT_ACTION_PATTERN.test(latestInterpretation);
  const piDraftReady = Boolean(lockedIntent?.developerBrief);
  const briefPublished = Boolean(lockedIntent?.publishedIssue);
  const interpretStep = working ? "active" : hasInterpretation ? "complete" : draft.trim() ? "active" : "locked";
  const piDraftStep = piDrafting ? "active" : piDraftReady ? "complete" : hasInterpretation && !noActionRequired ? "active" : "locked";
  const publishStep = publishing ? "active" : briefPublished ? "complete" : piDraftReady ? "active" : "locked";

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
  }, [messages, lockedIntent?.developerBrief?.text, open]);

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
        setLockedIntent(intents.at(-1) || null);
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
    if (!submitted || busy) return;

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
      const interpreted = boundedInterpretation(body.text!);
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

  async function createPiDraft() {
    if (busy || !hasInterpretation || noActionRequired) return;
    setPiDrafting(true);
    setError("");
    try {
      let intent = lockedIntent;
      if (!intent) {
        const lockResponse = await authenticatedProfileFetch("/api/dsdd/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "lock-intent" }),
        });
        const lockBody = await lockResponse.json() as DsddSessionPayload;
        if (!lockResponse.ok || !lockBody.ok || !lockBody.intent) {
          throw new Error(lockBody.message || "DSDD could not lock the approved intent for Pi Draft.");
        }
        intent = lockBody.intent;
        setLockedIntent(intent);
      }
      if (intent.developerBrief?.state === "ready") return;
      const draftResponse = await authenticatedProfileFetch("/api/dsdd/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft-brief" }),
      });
      const draftBody = await draftResponse.json() as DsddSessionPayload;
      if (!draftResponse.ok || !draftBody.ok || !draftBody.intent?.developerBrief) {
        throw new Error(draftBody.message || "Pi Draft did not return a technical developer brief.");
      }
      setLockedIntent(draftBody.intent);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pi Draft is unavailable.");
    } finally {
      setPiDrafting(false);
    }
  }

  async function publishBrief() {
    if (busy || !lockedIntent?.developerBrief || lockedIntent.publishedIssue) return;
    setPublishing(true);
    setError("");
    try {
      const response = await authenticatedProfileFetch("/api/dsdd/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish-brief" }),
      });
      const body = await response.json() as DsddSessionPayload;
      if (!response.ok || !body.ok || !body.intent?.publishedIssue) {
        throw new Error(body.message || "DSDD could not publish the developer brief to GitHub.");
      }
      setLockedIntent(body.intent);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publish Brief is unavailable.");
    } finally {
      setPublishing(false);
    }
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
              {lockedIntent.developerBrief ? <small>PI DRAFT: READY · READ-ONLY REPOSITORY REVIEW</small> : <small>PI DRAFT: NOT YET GENERATED</small>}
              {lockedIntent.publishedIssue ? (
                <a href={lockedIntent.publishedIssue.url} target="_blank" rel="noreferrer">
                  GITHUB ISSUE #{lockedIntent.publishedIssue.number}
                </a>
              ) : null}
            </div>
          ) : hasInterpretation ? (
            <div className={styles.context} data-dsdd-candidate-intent="true">
              <strong>What DSDD understood</strong>
              <span>{latestInterpretation}</span>
              <small>{noActionRequired
                ? "No development handoff is required for this observation. Add new narration when you have another UAT finding."
                : "Review this meaning. Step 02 Pi Draft locks it and adds repository-aware technical guidance without changing code."}</small>
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
            {lockedIntent?.developerBrief ? (
              <div className={styles.dsddMessage} data-dsdd-pi-draft="ready">
                <strong>Pi technical developer draft</strong>
                <p>{lockedIntent.developerBrief.text}</p>
                <small>Read-only Pi {lockedIntent.developerBrief.piVersion} · tools: read, grep, find, ls · repository mutation: none</small>
              </div>
            ) : null}
            {working ? <p className={styles.working} role="status">Interpreting your UAT narration with local AI…</p> : null}
            {piDrafting ? <p className={styles.working} role="status">Pi is inspecting the repository read-only and drafting developer guidance…</p> : null}
            {publishing ? <p className={styles.working} role="status">Publishing the approved developer brief as a GitHub Issue…</p> : null}
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error} No source code change was attempted by DSDD.
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
              disabled={busy}
              onChange={(event) => setDraft(event.currentTarget.value)}
              placeholder="Example: When I open this, I expect the current draft to stay exactly where I left it, but it sends me back to the dashboard."
              rows={4}
              value={draft}
            />
            <div className={styles.composerFooter}>
              <span>1 Interpret your intent. 2 Pi prepares the technical developer draft. 3 Publish the approved brief.</span>
              <VoiceInputControl
                value={draft}
                onValueChange={setDraft}
                inputRef={narrationRef}
                disabled={busy}
                inputType="textarea"
                purpose="natural-language developer uat narration"
                className={styles.voiceControl}
                statusPlacement="inline"
              />
              <div className={styles.process} role="group" aria-label="DSDD three-step development handoff">
                <button
                  type="submit"
                  className={styles.processStep}
                  data-step-state={interpretStep}
                  aria-current={interpretStep === "active" ? "step" : undefined}
                  disabled={busy || !draft.trim()}
                >
                  <small>01</small>
                  <strong>{working ? "INTERPRETING…" : "INTERPRET"}</strong>
                  <span>{interpretStep === "complete" ? "COMPLETE" : "UNDERSTAND INTENT"}</span>
                </button>
                <span className={styles.processArrow} aria-hidden="true">→</span>
                <button
                  type="button"
                  className={styles.processStep}
                  data-step-state={piDraftStep}
                  aria-current={piDraftStep === "active" ? "step" : undefined}
                  disabled={busy || noActionRequired || piDraftReady || !hasInterpretation}
                  onClick={() => { void createPiDraft(); }}
                >
                  <small>02</small>
                  <strong>{piDrafting ? "PI DRAFTING…" : "PI DRAFT"}</strong>
                  <span>{noActionRequired ? "NOT REQUIRED" : piDraftStep === "complete" ? "COMPLETE" : "TECHNICAL BRIEF"}</span>
                </button>
                <span className={styles.processArrow} aria-hidden="true">→</span>
                <button
                  type="button"
                  className={styles.processStep}
                  data-step-state={publishStep}
                  aria-current={publishStep === "active" ? "step" : undefined}
                  disabled={busy || noActionRequired || !piDraftReady || briefPublished}
                  onClick={() => { void publishBrief(); }}
                >
                  <small>03</small>
                  <strong>{publishing ? "PUBLISHING…" : "PUBLISH BRIEF"}</strong>
                  <span>{noActionRequired ? "NOT REQUIRED" : publishStep === "complete" ? "COMPLETE" : "DELIVERY HANDOFF"}</span>
                </button>
              </div>
              {noActionRequired ? <span className={styles.noAction}>No development action required. Steps 02 and 03 are not needed for this UAT observation.</span> : null}
            </div>
          </form>
        </aside>
      ) : null}
    </>
  );
}
