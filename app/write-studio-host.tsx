"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./write-studio-host.module.css";

function normalized(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

export default function WriteStudioHost() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [shell, setShell] = useState<HTMLElement | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let host: HTMLElement | null = null;
    let activeShell: HTMLElement | null = null;
    let defaultApplied = false;

    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("workspace") !== "write") {
        host?.remove();
        host = null;
        activeShell?.removeAttribute("data-write-studio");
        activeShell?.removeAttribute("data-write-more");
        activeShell = null;
        setTarget(null);
        setShell(null);
        return;
      }

      const modeBar = document.querySelector<HTMLElement>('[class*="modeBar"]');
      const nextShell = modeBar?.parentElement as HTMLElement | null;
      const hasWriterIdentity = normalized(modeBar?.querySelector("strong")?.textContent) === "writer";
      const hasScreenplayMode = Boolean(Array.from(modeBar?.querySelectorAll("button") ?? [])
        .some((button) => normalized(button.textContent) === "screenplay"));
      if (!modeBar || !nextShell || !hasWriterIdentity || !hasScreenplayMode) return;

      if (activeShell && activeShell !== nextShell) {
        activeShell.removeAttribute("data-write-studio");
        activeShell.removeAttribute("data-write-more");
      }
      activeShell = nextShell;
      activeShell.dataset.writeStudio = "true";
      setShell(activeShell);

      if (!defaultApplied) {
        defaultApplied = true;
        const buttons = Array.from(modeBar.querySelectorAll<HTMLButtonElement>("button"));
        const screenplay = buttons.find((button) => normalized(button.textContent) === "screenplay");
        const treatment = buttons.find((button) => normalized(button.textContent) === "treatment");
        if (screenplay && treatment?.className && !screenplay.className) screenplay.click();
      }

      if (!host || !host.isConnected || host.parentElement !== activeShell) {
        host?.remove();
        host = document.createElement("div");
        host.dataset.writeStudioTools = "true";
        activeShell.insertBefore(host, activeShell.children[1] || null);
        setTarget(host);
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", sync);

    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", sync);
      host?.remove();
      activeShell?.removeAttribute("data-write-studio");
      activeShell?.removeAttribute("data-write-more");
    };
  }, []);

  if (!target || !shell) return null;

  function toggleMore(open: boolean) {
    setMoreOpen(open);
    if (open) shell!.dataset.writeMore = "open";
    else delete shell!.dataset.writeMore;
  }

  return createPortal(
    <details
      className={styles.more}
      open={moreOpen}
      onToggle={(event) => toggleMore(event.currentTarget.open)}
    >
      <summary>More writing tools</summary>
      <p>Exports and production-draft controls remain available here when you need them. They stay out of the main drafting flow.</p>
    </details>,
    target,
  );
}
