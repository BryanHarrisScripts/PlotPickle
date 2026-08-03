"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ConfigurationDashboardOverview from "./configuration-dashboard-overview";
import ProjectStorageModePanel from "./project-storage-mode-panel";
import WritingAssistantConsole from "./writing-assistant-console";
import MediaRoutingPanel from "./media-routing-panel";
import H3NativePanel from "./h3-native-panel";

const SETUP_SELECTOR = "#dashboard-setup";

function findSetupButton(root: HTMLElement, phrase: string) {
  const article = Array.from(root.querySelectorAll("article")).find((item) => {
    const heading = item.querySelector("h3")?.textContent || "";
    return heading.includes(phrase);
  });
  return Array.from(article?.querySelectorAll("button") || []).find((button) => /configure in plotpickle/i.test(button.textContent || "")) as HTMLButtonElement | undefined;
}

export default function ConfigurationDashboardHost() {
  const [setupRoot, setSetupRoot] = useState<HTMLElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    let currentRoot: HTMLElement | null = null;
    let currentHost: HTMLElement | null = null;

    const sync = () => {
      const nextRoot = document.querySelector<HTMLElement>(SETUP_SELECTOR);
      if (nextRoot === currentRoot) return;

      currentHost?.remove();
      currentHost = null;
      currentRoot = nextRoot;
      setDetailsOpen(false);

      if (!nextRoot) {
        setSetupRoot(null);
        setPortalTarget(null);
        return;
      }

      const existing = nextRoot.querySelector<HTMLElement>(":scope > .plotpickle-config-host");
      currentHost = existing || document.createElement("div");
      currentHost.className = "plotpickle-config-host";
      if (!existing) nextRoot.prepend(currentHost);
      setSetupRoot(nextRoot);
      setPortalTarget(currentHost);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      currentHost?.remove();
    };
  }, []);

  function openSettings(target: string) {
    if (!setupRoot) return;
    if (/comfyui/i.test(target)) {
      setDetailsOpen(true);
      setupRoot.classList.add("configuration-details-open");
      window.requestAnimationFrame(() => {
        const panel = document.querySelector<HTMLElement>("#plotpickle-comfyui-connection");
        panel?.scrollIntoView({ behavior: "smooth", block: "center" });
        panel?.querySelector<HTMLInputElement>("input")?.focus();
      });
      return;
    }
    const button = findSetupButton(setupRoot, target)
      || Array.from(setupRoot.querySelectorAll("button")).find((item) => /configure in plotpickle/i.test(item.textContent || "")) as HTMLButtonElement | undefined;
    button?.click();
  }

  function testConnections() {
    if (!setupRoot) return;
    const button = Array.from(setupRoot.querySelectorAll("button")).find((item) => /test all connections/i.test(item.textContent || "")) as HTMLButtonElement | undefined;
    button?.click();
  }

  function toggleDetails() {
    if (!setupRoot) return;
    setDetailsOpen((current) => {
      const next = !current;
      setupRoot.classList.toggle("configuration-details-open", next);
      return next;
    });
  }

  if (!portalTarget || !setupRoot) return null;

  return createPortal(
    <>
      <ConfigurationDashboardOverview
        variant="live"
        sourceRoot={setupRoot}
        onManage={openSettings}
        onTest={testConnections}
        onToggleDetails={toggleDetails}
        detailsOpen={detailsOpen}
      />
      <ProjectStorageModePanel onManage={openSettings} />
      <WritingAssistantConsole onManage={openSettings} />
      <MediaRoutingPanel onManage={openSettings} />
      <H3NativePanel />
    </>,
    portalTarget,
  );
}