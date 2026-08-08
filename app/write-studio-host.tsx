"use client";

import { useEffect } from "react";

export default function WriteStudioHost() {
  useEffect(() => {
    let activeWorkspace: HTMLElement | null = null;

    const clear = () => {
      if (!activeWorkspace) return;
      delete activeWorkspace.dataset.writeStudio;
      activeWorkspace = null;
    };

    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("workspace") !== "write") {
        clear();
        return;
      }

      const workspace = document.querySelector<HTMLElement>(".workspace");
      if (!workspace) return;
      if (activeWorkspace && activeWorkspace !== workspace) delete activeWorkspace.dataset.writeStudio;
      activeWorkspace = workspace;
      workspace.dataset.writeStudio = "true";
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

  return null;
}
