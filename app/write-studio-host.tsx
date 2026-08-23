"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./write-studio-host.module.css";

export default function WriteStudioHost() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let activeWorkspace: HTMLElement | null = null;
    let host: HTMLElement | null = null;

    const clear = () => {
      host?.remove();
      host = null;
      setPortalTarget(null);
      if (!activeWorkspace) return;
      delete activeWorkspace.dataset.writeStudio;
      delete activeWorkspace.dataset.writeAdvanced;
      activeWorkspace = null;
      workspaceRef.current = null;
    };

    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("workspace") !== "write") {
        clear();
        return;
      }

      const workspace = document.querySelector<HTMLElement>(".workspace");
      if (!workspace) return;
      if (activeWorkspace && activeWorkspace !== workspace) {
        delete activeWorkspace.dataset.writeStudio;
        delete activeWorkspace.dataset.writeAdvanced;
      }
      activeWorkspace = workspace;
      workspaceRef.current = workspace;
      workspace.dataset.writeStudio = "true";

      const shell = workspace.querySelector<HTMLElement>('[class*="workspaceShell"]');
      const writerHeader = shell?.querySelector<HTMLElement>('[class*="writerHeader"]') || null;
      if (!shell || !writerHeader) {
        host?.remove();
        host = null;
        setPortalTarget(null);
        return;
      }

      if (!host || !host.isConnected || host.parentElement !== shell) {
        host?.remove();
        host = document.createElement("div");
        host.dataset.writeAdvancedTools = "true";
        writerHeader.insertAdjacentElement("afterend", host);
        setPortalTarget(host);
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", sync);

    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", sync);
      clear();
    };
  }, []);

  function setAdvanced(open: boolean) {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    if (open) workspace.dataset.writeAdvanced = "open";
    else delete workspace.dataset.writeAdvanced;
  }

  if (!portalTarget) return null;

  return createPortal(
    <details className={styles.more} onToggle={(event) => setAdvanced(event.currentTarget.open)}>
      <summary>More writing tools</summary>
      <p>Exports and Shooting Script controls stay available here when you need them. They remain outside the main drafting flow.</p>
    </details>,
    portalTarget,
  );
}
