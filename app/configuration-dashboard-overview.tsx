"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./configuration-dashboard-overview.module.css";

export type ConfigurationDashboardVariant = "live" | "marketing";
type ServiceState = "connected" | "optional" | "error" | "supported";

type ServiceId = "ollama" | "openai" | "minimax" | "comfyui" | "github" | "buzz" | "google";
type ServiceSnapshot = Record<ServiceId, ServiceState>;

const serviceIds: ServiceId[] = ["ollama", "openai", "minimax", "comfyui", "github", "buzz", "google"];

const defaultLiveSnapshot: ServiceSnapshot = {
  ollama: "optional",
  openai: "optional",
  minimax: "optional",
  comfyui: "optional",
  github: "optional",
  buzz: "optional",
  google: "optional",
};

const supportedSnapshot: ServiceSnapshot = {
  ollama: "supported",
  openai: "supported",
  minimax: "supported",
  comfyui: "supported",
  github: "supported",
  buzz: "supported",
  google: "supported",
};

const stateCopy: Record<ServiceState, string> = {
  connected: "Connected",
  optional: "Bring Your Own",
  error: "Needs Repair",
  supported: "Supported",
};

const services: Array<{
  id: ServiceId;
  label: string;
  detail: string;
  symbol: string;
  target: string;
}> = [
  { id: "ollama", label: "Ollama Local LLM", detail: "Private writing and planning on this computer", symbol: "O", target: "Local writing & planning · Ollama" },
  { id: "openai", label: "OpenAI API", detail: "Cloud text, vision and image generation", symbol: "AI", target: "Cloud images & video" },
  { id: "minimax", label: "MiniMax API", detail: "MiniMax-M3 text · image-01 · MiniMax-H3 video", symbol: "M", target: "Cloud images & video" },
  { id: "comfyui", label: "ComfyUI", detail: "Local and hybrid image workflows for cost control", symbol: "C", target: "Local image generation · ComfyUI" },
  { id: "github", label: "GitHub Story Repository", detail: "Story history, proposals and collaboration", symbol: "GH", target: "GitHub account & story repository" },
  { id: "buzz", label: "Buzz Account & Community", detail: "Writers’ Room discussion and rooms", symbol: "B", target: "Buzz community" },
  { id: "google", label: "Google Calendar & Meet", detail: "Scheduling and meetings", symbol: "G", target: "Google Calendar & Meet" },
];

function stateFromArticle(article: Element | undefined): ServiceState {
  if (!article) return "optional";
  const text = article.textContent || "";
  if (/previously working connection has failed|needs repair|connection needs repair/i.test(text)) return "error";
  if (/verified and working|running locally|ready without ai/i.test(text)) return "connected";
  return "optional";
}

function findArticle(root: HTMLElement, phrase: string) {
  return Array.from(root.querySelectorAll("article")).find((article) => {
    const heading = article.querySelector("h3")?.textContent || "";
    return heading.includes(phrase);
  });
}

function readLiveSnapshot(root: HTMLElement): ServiceSnapshot {
  const ollamaArticle = findArticle(root, "Local writing & planning · Ollama");
  const comfyArticle = findArticle(root, "Local image generation · ComfyUI");
  const githubArticle = findArticle(root, "GitHub account & story repository");
  const buzzArticle = findArticle(root, "Buzz community");
  const googleArticle = findArticle(root, "Google Calendar & Meet");
  const cloudArticle = findArticle(root, "Cloud images & video");
  const cloudState = stateFromArticle(cloudArticle);
  const cloudIdentity = cloudArticle?.querySelector("dd")?.textContent || "";

  return {
    ollama: stateFromArticle(ollamaArticle),
    comfyui: stateFromArticle(comfyArticle),
    github: stateFromArticle(githubArticle),
    buzz: stateFromArticle(buzzArticle),
    google: stateFromArticle(googleArticle),
    openai: /openai|chatgpt/i.test(cloudIdentity) ? cloudState : "optional",
    minimax: /minimax/i.test(cloudIdentity) ? cloudState : "optional",
  };
}

function snapshotsMatch(current: ServiceSnapshot, next: ServiceSnapshot) {
  return serviceIds.every((id) => current[id] === next[id]);
}

function modeState(service: ServiceState): ServiceState {
  if (service === "connected") return "connected";
  if (service === "error") return "error";
  if (service === "supported") return "supported";
  return "optional";
}

export default function ConfigurationDashboardOverview({
  variant,
  sourceRoot = null,
  onManage,
  onTest,
  onToggleDetails,
  detailsOpen = false,
}: {
  variant: ConfigurationDashboardVariant;
  sourceRoot?: HTMLElement | null;
  onManage?: (target: string) => void;
  onTest?: () => void;
  onToggleDetails?: () => void;
  detailsOpen?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<ServiceSnapshot>(variant === "marketing" ? supportedSnapshot : defaultLiveSnapshot);

  useEffect(() => {
    if (variant !== "live" || !sourceRoot) return;
    const refresh = () => {
      const next = readLiveSnapshot(sourceRoot);
      setSnapshot((current) => snapshotsMatch(current, next) ? current : next);
    };
    const timer = window.setTimeout(refresh, 0);
    const observer = new MutationObserver(refresh);
    observer.observe(sourceRoot, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [sourceRoot, variant]);

  const modes = useMemo(() => [
    {
      id: "local",
      title: "Local Story Mode",
      subtitle: "Work independently on this device.",
      state: variant === "marketing" ? "supported" as const : "connected" as const,
      headline: variant === "marketing" ? "Included" : "Ready",
      description: "Write, plan, storyboard and build locally. No external account or API key is required.",
      items: ["PlotPickle Core", "Local PPF projects", "Rolling backups", "Manual imports and exports"],
    },
    {
      id: "writers-room",
      title: "Writers’ Room Mode",
      subtitle: "Add community discussion through Buzz.",
      state: modeState(snapshot.buzz),
      headline: variant === "marketing" ? "Supported" : stateCopy[modeState(snapshot.buzz)],
      description: "Connect a Buzz account and community when you want rooms, discussion and canon-safe proposals.",
      items: ["Buzz account", "Buzz community or room", "Human-approved proposals"],
    },
    {
      id: "repository",
      title: "Repository Collaboration Mode",
      subtitle: "Keep a local working copy linked to GitHub.",
      state: modeState(snapshot.github),
      headline: variant === "marketing" ? "Supported" : stateCopy[modeState(snapshot.github)],
      description: "Add a repository for story history, proposals, approvals and multi-machine recovery.",
      items: ["GitHub account", "One repository per story", "Local + GitHub working mode"],
    },
  ], [snapshot.buzz, snapshot.github, variant]);

  return (
    <section className={styles.dashboard} data-variant={variant} aria-labelledby={`configuration-dashboard-${variant}`}>
      <header className={styles.topbar}>
        <div>
          <p className={styles.eyebrow}>{variant === "marketing" ? "See exactly what you need" : "First-run operating centre"}</p>
          <h2 id={`configuration-dashboard-${variant}`}>Configuration Dashboard</h2>
          <span>{variant === "marketing" ? "PlotPickle works locally first. Add only the accounts, keys and apps you choose." : "See what is ready, test what you connected and open the exact setup screen you need."}</span>
        </div>
        <div className={styles.topActions}>
          {variant === "live" && onTest ? <button type="button" onClick={onTest}>Test all connections</button> : null}
          {onManage ? <button type="button" className={styles.primary} onClick={() => onManage("Local writing & planning · Ollama")}>{variant === "marketing" ? "Open PlotPickle" : "Open Settings"}</button> : null}
        </div>
      </header>

      <div className={styles.legend} aria-label="Configuration status meaning">
        <span data-state="connected"><i />Connected</span>
        <span data-state="optional"><i />Optional / Bring Your Own</span>
        <span data-state="error"><i />Needs Repair</span>
        {variant === "marketing" ? <span data-state="supported"><i />Supported by PlotPickle</span> : null}
      </div>

      <div className={styles.layout}>
        <div className={styles.modeGrid}>
          {modes.map((mode) => (
            <article className={styles.modeCard} data-state={mode.state} key={mode.id}>
              <header><span className={styles.modeIcon} aria-hidden="true">{mode.id === "local" ? "⌂" : mode.id === "writers-room" ? "◉" : "☁"}</span><div><h3>{mode.title}</h3><p>{mode.subtitle}</p></div></header>
              <div className={styles.light} aria-hidden="true"><i /></div>
              <strong className={styles.headline}>{mode.headline}</strong>
              <p className={styles.description}>{mode.description}</p>
              <ul>{mode.items.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
          ))}
        </div>

        <aside className={styles.services}>
          <header><span aria-hidden="true">▣</span><div><h3>Supported Connections</h3><p>Only systems PlotPickle supports today.</p></div></header>
          <div className={styles.serviceList}>
            {services.map((service) => (
              <button type="button" key={service.id} data-state={snapshot[service.id]} onClick={() => onManage?.(service.target)} disabled={!onManage}>
                <span className={styles.serviceIcon} aria-hidden="true">{service.symbol}</span>
                <span><strong>{service.label}</strong><small>{service.detail}</small></span>
                <em>{stateCopy[snapshot[service.id]]}</em>
              </button>
            ))}
          </div>
          <div className={styles.exampleNote}><strong>Afterglow is an example story.</strong><span>View it, reset it or make your own copy. It is never the destination for a writer’s project.</span></div>
        </aside>
      </div>

      <footer className={styles.footer}>
        <div><strong>Your choice. Your control.</strong><span>Start local, choose a text engine, choose an image path and connect collaboration only when needed.</span></div>
        {variant === "live" && onToggleDetails ? <button type="button" onClick={onToggleDetails}>{detailsOpen ? "Hide detailed setup" : "Show detailed setup and tests"}</button> : null}
      </footer>
    </section>
  );
}
