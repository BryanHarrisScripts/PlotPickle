"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./storyboard-version-control-bridge.module.css";

type PendingDelete = Readonly<{
  button: HTMLButtonElement;
  host: HTMLElement;
}>;

const REVIEW_PANEL_SELECTOR = '[aria-label^="Review frame at position "]';
const ACTION_ATTRIBUTE = "storyboardVersionAction";

function normalizeStoryboardVersionControls(root: ParentNode) {
  for (const panel of root.querySelectorAll<HTMLElement>(REVIEW_PANEL_SELECTOR)) {
    for (const button of panel.querySelectorAll<HTMLButtonElement>("button")) {
      const label = button.textContent?.trim() ?? "";
      const action = button.dataset[ACTION_ATTRIBUTE];

      if (label === "Save this Version" || label === "Saved locally" || action === "save") {
        button.dataset[ACTION_ATTRIBUTE] = "save";
        if (button.textContent !== "Save") button.textContent = "Save";
        continue;
      }
      if (label === "Lock this Version" || label === "Locked" || action === "lock") {
        button.dataset[ACTION_ATTRIBUTE] = "lock";
        if (button.textContent !== "Lock") button.textContent = "Lock";
        continue;
      }
      if (label === "Redo" || action === "redo") {
        button.dataset[ACTION_ATTRIBUTE] = "redo";
        continue;
      }
      if (label === "Reject" || action === "delete") {
        button.dataset[ACTION_ATTRIBUTE] = "delete";
        if (button.textContent !== "Delete") button.textContent = "Delete";
      }
    }
  }
}

export default function StoryboardVersionControlBridge() {
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const bypassDeleteConfirmation = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    normalizeStoryboardVersionControls(document);
    const observer = new MutationObserver(() => normalizeStoryboardVersionControls(document));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLButtonElement>('button[data-storyboard-version-action="delete"]') ?? null;
      if (!button || !button.closest(REVIEW_PANEL_SELECTOR)) return;

      if (bypassDeleteConfirmation.current === button) {
        bypassDeleteConfirmation.current = null;
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const host = button.parentElement;
      if (host) setPendingDelete({ button, host });
    }

    document.addEventListener("click", handleClick, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  if (!pendingDelete) return null;

  return createPortal(
    <div aria-label="Confirm permanent Storyboard version deletion" className={styles.confirmation} role="alertdialog">
      <strong>Delete this version forever?</strong>
      <span>This cannot be undone.</span>
      <div className={styles.actions}>
        <button
          type="button"
          onClick={() => {
            const button = pendingDelete.button;
            bypassDeleteConfirmation.current = button;
            setPendingDelete(null);
            queueMicrotask(() => button.click());
          }}
        >Yes</button>
        <button type="button" onClick={() => setPendingDelete(null)}>No</button>
      </div>
    </div>,
    pendingDelete.host,
  );
}
