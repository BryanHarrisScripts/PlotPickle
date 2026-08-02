"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ConfigurationDashboardOverview from "./configuration-dashboard-overview";

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
    let host: HTMLElement | null = null;
    let observer: MutationObserver | null = null;

    const mount = () => {
      const root = document.querySelector<HTMLElement>(SETUP_SELECTOR);
      if (!root || root.querySelector(":scope > .plotpickle-config-host")) return Boolean(root);
      host = document.createElement("div");
      host.className = "plotpickle-config-host";
      root.prepend(host);
      setSetupRoot(root);
      setPortalTarget(host);
      return true;
    };

    if (!mount()) {
      observer = new MutationObserver(() => {
        if (mount()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      host?.remove();
      setSetupRoot(null);
      setPortalTarget(null);
    };
  }, []);

  function openSettings(target: string) {
    if (!setupRoot) return;
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
    <ConfigurationDashboardOverview
      variant="live"
      sourceRoot={setupRoot}
      onManage={openSettings}
      onTest={testConnections}
      onToggleDetails={toggleDetails}
      detailsOpen={detailsOpen}
    />,
    portalTarget,
  );
}
