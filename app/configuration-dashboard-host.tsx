"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ConfigurationDashboardOverview from "./configuration-dashboard-overview";
import ProjectStorageModePanel from "./project-storage-mode-panel";
import WritingAssistantConsole from "./writing-assistant-console";
import MediaRoutingPanel from "./media-routing-panel";
import H3NativePanel from "./h3-native-panel";

const SETUP_SELECTOR = "#dashboard-setup";
const COMFY_DIAGNOSTICS_PATH = "/api/provider-diagnostics/comfyui";
const MEDIA_STATUS_PATH = "/api/media-routing/status";

type ComfyManagementReadiness = {
  serviceReady?: boolean;
  connectionState?: string;
  capabilityError?: string;
  error?: string;
  management?: {
    adapter?: "comfy-mcp" | "direct-api";
    ready?: boolean;
    mcpInstalled?: boolean;
    mcpVersion?: string;
    comfyCliInstalled?: boolean;
    comfyCliVersion?: string;
    minimumComfyCliVersion?: string;
    message?: string;
  };
  hardware?: {
    gpuName?: string;
    totalVramMb?: number | null;
    freeVramMb?: number | null;
  };
};

function findSetupButton(root: HTMLElement, phrase: string) {
  const article = Array.from(root.querySelectorAll("article")).find((item) => {
    const heading = item.querySelector("h3")?.textContent || "";
    return heading.includes(phrase);
  });
  return Array.from(article?.querySelectorAll("button") || []).find((button) => /configure in plotpickle/i.test(button.textContent || "")) as HTMLButtonElement | undefined;
}

function ComfyManagementStatus() {
  const [readiness, setReadiness] = useState<ComfyManagementReadiness | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const mediaResponse = await fetch(MEDIA_STATUS_PATH, { headers: { Accept: "application/json" } });
      if (!mediaResponse.ok) return;
      const media = await mediaResponse.json() as { comfyui?: { baseUrl?: string } };
      const response = await fetch(COMFY_DIAGNOSTICS_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ baseUrl: media.comfyui?.baseUrl || "http://127.0.0.1:8188" }),
      });
      if (!response.ok) return;
      const result = await response.json() as { comfyui?: ComfyManagementReadiness };
      if (!cancelled) setReadiness(result.comfyui ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!readiness?.management) return null;
  const management = readiness.management;
  const hardware = readiness.hardware;
  const managerLabel = management.ready ? "Managed · Comfy MCP" : "Direct local ComfyUI API";
  const serviceLabel = readiness.serviceReady
    ? readiness.connectionState === "ready" ? "Ready" : "Running · setup needed"
    : management.ready ? "Installed · not running" : "Not connected";
  const totalVram = hardware?.totalVramMb ? `${Math.round(hardware.totalVramMb / 1024)} GB VRAM` : "";
  const freeVram = hardware?.freeVramMb ? `${(hardware.freeVramMb / 1024).toFixed(1)} GB free` : "";

  return (
    <section
      aria-label="ComfyUI management readiness"
      data-comfy-management-adapter={management.adapter || "direct-api"}
      style={{
        margin: "12px 0",
        padding: 14,
        border: "1px solid rgba(53, 201, 184, 0.26)",
        borderRadius: 10,
        background: "rgba(10, 14, 16, 0.82)",
        color: "#ded8ce",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <div>
          <small style={{ color: "#8ea9a4" }}>Local ComfyUI management</small>
          <h3 style={{ margin: "4px 0", color: "#d7bc76" }}>{managerLabel}</h3>
        </div>
        <strong style={{ color: readiness.serviceReady ? "#7cf1df" : "#d7bc76" }}>{serviceLabel}</strong>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.5 }}>
        {management.message || "PlotPickle is using its existing direct local ComfyUI connection."}
      </p>
      {hardware?.gpuName ? (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b9d8d3" }}>
          Local GPU: <strong>{hardware.gpuName}</strong>{totalVram ? ` · ${totalVram}` : ""}{freeVram ? ` · ${freeVram}` : ""}
        </p>
      ) : null}
      {readiness.capabilityError || readiness.error ? (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#d7bc76" }}>{readiness.capabilityError || readiness.error}</p>
      ) : null}
      <small style={{ display: "block", marginTop: 8, color: "#8ea9a4", lineHeight: 1.45 }}>
        Starting or opening a local ComfyUI workspace still requires your action in Images &amp; Video. PlotPickle never turns a failed local setup into a paid cloud request automatically.
      </small>
    </section>
  );
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
      <ComfyManagementStatus />
      <H3NativePanel />
    </>,
    portalTarget,
  );
}
