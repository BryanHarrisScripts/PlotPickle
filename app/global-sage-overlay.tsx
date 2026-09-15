"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { plotPickleCurriculum } from "../adapters/curriculum/current-catalog";
import AgentPortrait from "../components/agent-portrait";
import { loadFoundationProject } from "../core/storage/foundation-project-browser";
import { memoryAwareSageGuide } from "../modules/creative-room/memory-aware-sage-guide";
import styles from "./global-sage-overlay.module.css";

type SageMessage = {
  readonly id: string;
  readonly role: "writer" | "guide";
  readonly text: string;
};

let fallbackMessageId = 0;

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function messageId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${++fallbackMessageId}`;
}

function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest([
    "input",
    "textarea",
    "select",
    "[contenteditable='']",
    "[contenteditable='true']",
    "[role='textbox']",
    "[role='searchbox']",
    "[role='combobox']",
  ].join(",")));
}

function hasBlockingOverlay() {
  return Boolean(document.querySelector(
    "dialog[open], [role='dialog'][aria-modal='true'], [data-command-palette-open='true']",
  ));
}

function hasVisiblePlotPickleSurface() {
  const surfaces = document.querySelectorAll<HTMLElement>([
    "[data-plotpickle-global-nav]",
    "[data-story-map-shell]",
    ".pp-skin-v1-dashboard",
  ].join(","));
  return Array.from(surfaces).some((surface) => (
    surface.getClientRects().length > 0 && window.getComputedStyle(surface).visibility !== "hidden"
  ));
}

function visibleFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true" && element.getClientRects().length > 0);
}

function currentSageContext() {
  const fallbackLessonId = plotPickleCurriculum[0]?.id ?? "foundations";
  try {
    const project = loadFoundationProject();
    const activeLessonId = project.learning.activeLessonId
      && plotPickleCurriculum.some((lesson) => lesson.id === project.learning.activeLessonId)
      ? project.learning.activeLessonId
      : fallbackLessonId;
    return {
      activeLessonId,
      projectMemory: {
        id: project.id,
        title: project.title,
        revision: project.revision,
        completedLessonIds: project.learning.completedLessonIds,
      },
    };
  } catch {
    return {
      activeLessonId: fallbackLessonId,
      projectMemory: {
        id: "plotpickle-global-help",
        title: "PlotPickle",
        revision: 0,
        completedLessonIds: [] as readonly string[],
      },
    };
  }
}

export default function GlobalSageOverlay() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SageMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLElement | null>(null);
  const questionRef = useRef<HTMLTextAreaElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const originRef = useRef<HTMLElement | null>(null);

  const closeOverlay = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => {
      if (originRef.current?.isConnected) originRef.current.focus();
      originRef.current = null;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.key.toLowerCase() !== "s" || !event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTextEditingTarget(event.target) || hasBlockingOverlay() || !hasVisiblePlotPickleSurface()) return;
      event.preventDefault();
      event.stopPropagation();
      originRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setError("");
      setOpen(true);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => questionRef.current?.focus());
    const onDialogKeyDown = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeOverlay();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = visibleFocusableElements(panel);
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onDialogKeyDown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onDialogKeyDown, true);
    };
  }, [closeOverlay, open]);

  useEffect(() => {
    if (!open) return;
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages, open, working]);

  async function askSage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitted = draft.trim();
    if (!submitted || working) return;

    const prior = messages;
    const writerMessage: SageMessage = { id: messageId("sage-writer"), role: "writer", text: submitted };
    const pending = [...prior, writerMessage];
    setMessages(pending);
    setDraft("");
    setError("");
    setWorking(true);

    try {
      const context = currentSageContext();
      const answer = await memoryAwareSageGuide({
        curriculum: plotPickleCurriculum,
        activeLessonId: context.activeLessonId,
        question: submitted,
        conversation: prior.slice(-10).map((message) => ({
          role: message.role,
          content: message.text,
        })),
        projectMemory: context.projectMemory,
        interactionMode: "conversation",
      });
      setMessages([
        ...pending,
        { id: messageId("sage-guide"), role: "guide", text: answer.text },
      ]);
    } catch (cause) {
      setMessages(prior);
      setDraft(submitted);
      setError(cause instanceof Error ? cause.message : "Sage could not answer right now.");
    } finally {
      setWorking(false);
    }
  }

  if (!open) return null;

  return (
    <div className={styles.backdrop} data-global-sage-backdrop="true">
      <section
        aria-labelledby="global-sage-title"
        aria-modal="true"
        className={styles.panel}
        data-disable-global-shortcuts="true"
        data-global-sage-overlay="true"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className={styles.header}>
          <AgentPortrait id="sage-brinewick" alt="" size={52} />
          <div>
            <small>GLOBAL HELP</small>
            <h2 id="global-sage-title">Sage</h2>
            <p>Ask about PlotPickle, your story, or what to do next.</p>
          </div>
        </header>

        <div className={styles.thread} ref={threadRef} aria-live="polite" aria-relevant="additions text">
          {messages.length === 0 ? (
            <div className={styles.guideMessage}>
              <strong>Sage</strong>
              <p>I’m here. Ask me what you need without leaving the screen you’re working on.</p>
            </div>
          ) : null}
          {messages.map((message) => (
            <div className={message.role === "writer" ? styles.writerMessage : styles.guideMessage} key={message.id}>
              <strong>{message.role === "writer" ? "You" : "Sage"}</strong>
              <p>{message.text}</p>
            </div>
          ))}
          {working ? <p className={styles.working} role="status">Sage is thinking…</p> : null}
        </div>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}

        <form className={styles.composer} onSubmit={askSage}>
          <label htmlFor="global-sage-question">Ask Sage</label>
          <textarea
            id="global-sage-question"
            disabled={working}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What do you need help with?"
            ref={questionRef}
            rows={3}
            value={draft}
          />
          <div className={styles.composerFooter}>
            <span>Shift+S opens Sage · Escape closes</span>
            <button disabled={working || !draft.trim()} type="submit">Send</button>
          </div>
        </form>

        <button
          aria-label="Close Sage help"
          className={styles.close}
          data-overlay-close
          onClick={closeOverlay}
          type="button"
        >
          Close
        </button>
      </section>
    </div>
  );
}
