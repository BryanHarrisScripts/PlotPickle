"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import styles from "./common-overlay-layer.module.css";

export type PlotPickleNoticeTone = "info" | "success" | "warning" | "error";

export type PlotPickleNoticeOptions = {
  message: string;
  tone?: PlotPickleNoticeTone;
  timeoutMs?: number;
};

export type PlotPickleConfirmationOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type ConfirmationRequest = PlotPickleConfirmationOptions & {
  id: number;
  resolve: (confirmed: boolean) => void;
};

type Notice = Required<Pick<PlotPickleNoticeOptions, "message" | "tone" | "timeoutMs">> & {
  id: number;
};

let requestId = 0;

export function requestPlotPickleConfirmation(options: PlotPickleConfirmationOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent("plotpickle:confirm", {
      detail: { ...options, id: ++requestId, resolve } satisfies ConfirmationRequest,
    }));
  });
}

export function notifyPlotPickle(options: PlotPickleNoticeOptions | string) {
  if (typeof window === "undefined") return;
  const detail = typeof options === "string" ? { message: options } : options;
  window.dispatchEvent(new CustomEvent("plotpickle:notify", { detail }));
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function visibleFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true" && element.getClientRects().length > 0);
}

function NoticeCard({ notice, onDismiss }: { notice: Notice; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const role = notice.tone === "error" || notice.tone === "warning" ? "alert" : "status";

  useEffect(() => {
    if (paused || notice.timeoutMs <= 0) return;
    const timer = window.setTimeout(() => onDismiss(notice.id), notice.timeoutMs);
    return () => window.clearTimeout(timer);
  }, [notice.id, notice.timeoutMs, onDismiss, paused]);

  return (
    <div
      className={styles.notice}
      data-tone={notice.tone}
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
      aria-atomic="true"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event: ReactFocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <span className={styles.noticeMarker} aria-hidden="true" />
      <p>{notice.message}</p>
      <button type="button" onClick={() => onDismiss(notice.id)} aria-label="Dismiss notification">×</button>
    </div>
  );
}

export default function CommonOverlayLayer() {
  const [confirmations, setConfirmations] = useState<ConfirmationRequest[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmationOriginRef = useRef<HTMLElement | null>(null);
  const settlingRef = useRef(false);
  const activeConfirmation = confirmations[0] ?? null;

  const dismissNotice = useCallback((id: number) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  const finishConfirmation = useCallback((confirmed: boolean) => {
    const current = confirmations[0];
    if (!current || settlingRef.current) return;
    settlingRef.current = true;
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    current.resolve(confirmed);
    setConfirmations((queue) => queue.slice(1));
    window.requestAnimationFrame(() => {
      if (confirmationOriginRef.current?.isConnected) confirmationOriginRef.current.focus();
      settlingRef.current = false;
    });
  }, [confirmations]);

  useEffect(() => {
    function onConfirmation(event: Event) {
      const request = (event as CustomEvent<ConfirmationRequest>).detail;
      if (!request?.title || !request?.description || typeof request.resolve !== "function") return;
      setConfirmations((queue) => [...queue, request]);
    }

    function onNotice(event: Event) {
      const detail = (event as CustomEvent<PlotPickleNoticeOptions>).detail;
      const message = detail?.message?.trim();
      if (!message) return;
      const tone = detail.tone ?? "info";
      const timeoutMs = Math.max(0, Math.min(detail.timeoutMs ?? (tone === "error" ? 9000 : 6000), 30000));
      setNotices((current) => [...current.slice(-3), { id: ++requestId, message, tone, timeoutMs }]);
    }

    window.addEventListener("plotpickle:confirm", onConfirmation);
    window.addEventListener("plotpickle:notify", onNotice);
    return () => {
      window.removeEventListener("plotpickle:confirm", onConfirmation);
      window.removeEventListener("plotpickle:notify", onNotice);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!activeConfirmation) {
      if (dialog.open) dialog.close();
      return;
    }
    confirmationOriginRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    const frame = window.requestAnimationFrame(() => confirmButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [activeConfirmation]);

  useEffect(() => {
    let activeModal: HTMLElement | null = null;
    let modalOrigin: HTMLElement | null = null;
    let focusFrame = 0;

    function enrichLegacyFeedback() {
      document.querySelectorAll<HTMLElement>(".toast[role='status'], .toast[role='alert']").forEach((toast) => {
        toast.setAttribute("aria-live", toast.getAttribute("role") === "alert" ? "assertive" : "polite");
        toast.setAttribute("aria-atomic", "true");
        toast.dataset.plotpickleFeedback = "legacy";
      });
    }

    function topModal() {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>("dialog[open], [role='dialog'][aria-modal='true']"));
      return candidates.at(-1) ?? null;
    }

    function restoreOrigin() {
      if (modalOrigin?.isConnected) modalOrigin.focus();
      modalOrigin = null;
    }

    function synchronizeModal() {
      enrichLegacyFeedback();
      const next = topModal();
      if (next === activeModal) return;
      if (activeModal) restoreOrigin();
      activeModal = next;
      document.body.classList.toggle("plotpickle-overlay-active", Boolean(activeModal));
      if (!activeModal) return;
      modalOrigin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!activeModal.hasAttribute("tabindex")) {
        activeModal.setAttribute("tabindex", "-1");
        activeModal.dataset.plotpickleManagedTabindex = "true";
      }
      window.cancelAnimationFrame(focusFrame);
      focusFrame = window.requestAnimationFrame(() => {
        const focusable = visibleFocusableElements(activeModal as HTMLElement);
        (focusable[0] ?? activeModal)?.focus();
      });
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!activeModal) return;
      if (event.key === "Escape") {
        const closeControl = activeModal.querySelector<HTMLElement>("[data-overlay-close]");
        if (closeControl) {
          event.preventDefault();
          closeControl.click();
        } else {
          activeModal.dispatchEvent(new CustomEvent("plotpickle:overlay-dismiss", { bubbles: true }));
        }
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = visibleFocusableElements(activeModal);
      if (!focusable.length) {
        event.preventDefault();
        activeModal.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === activeModal)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    synchronizeModal();
    const observer = new MutationObserver(synchronizeModal);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open", "role", "aria-modal"],
    });
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKeyDown, true);
      window.cancelAnimationFrame(focusFrame);
      document.body.classList.remove("plotpickle-overlay-active");
      restoreOrigin();
    };
  }, []);

  function cancelFromBackdrop(event: ReactMouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) finishConfirmation(false);
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        className={styles.confirmation}
        aria-labelledby="plotpickle-confirmation-title"
        aria-describedby="plotpickle-confirmation-description"
        data-tone={activeConfirmation?.tone ?? "default"}
        onCancel={(event) => {
          event.preventDefault();
          finishConfirmation(false);
        }}
        onClose={() => {
          if (!settlingRef.current && activeConfirmation) finishConfirmation(false);
        }}
        onMouseDown={cancelFromBackdrop}
      >
        {activeConfirmation ? (
          <div className={styles.confirmationCard}>
            <span className={styles.confirmationEyebrow}>{activeConfirmation.tone === "danger" ? "Confirm destructive action" : "Confirm action"}</span>
            <h2 id="plotpickle-confirmation-title">{activeConfirmation.title}</h2>
            <p id="plotpickle-confirmation-description">{activeConfirmation.description}</p>
            <div className={styles.confirmationActions}>
              <button type="button" onClick={() => finishConfirmation(false)}>
                {activeConfirmation.cancelLabel ?? "Cancel"}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                className={styles.confirmAction}
                data-tone={activeConfirmation.tone ?? "default"}
                onClick={() => finishConfirmation(true)}
              >
                {activeConfirmation.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>

      <div className={styles.noticeViewport} aria-label="PlotPickle notifications">
        {notices.map((notice) => <NoticeCard key={notice.id} notice={notice} onDismiss={dismissNotice} />)}
      </div>
    </>
  );
}
