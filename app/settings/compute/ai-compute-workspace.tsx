"use client";

import { useEffect, useMemo, useState } from "react";
import AiRoutingPanel from "../../ai-routing-panel";
import LocalRuntimePanel from "../../local-runtime-panel";
import MediaRoutingPanel from "../../media-routing-panel";
import SageFastModelSetup from "../../sage-fast-model-setup";
import AiProviderSetupPanel from "../ai-provider/ai-provider-setup-panel";
import styles from "./ai-compute-workspace.module.css";

type ComputeMode = "local" | "cloud";
type ComputeCapability = "writing" | "images" | "video";
type ProviderTarget = "ollama" | "openai" | "minimax" | "comfyui";

type CapabilityDefinition = {
  id: ComputeCapability;
  routingCapability: "text" | "image" | "video";
  label: string;
  localDetail: string;
  cloudDetail: string;
};

const CAPABILITIES: CapabilityDefinition[] = [
  {
    id: "writing",
    routingCapability: "text",
    label: "Writing",
    localDetail: "Use this computer for Sage, PLAN and story work.",
    cloudDetail: "Use an explicitly connected online model for writing and planning.",
  },
  {
    id: "images",
    routingCapability: "image",
    label: "Images",
    localDetail: "Generate artwork on this computer with a verified local image route.",
    cloudDetail: "Use an explicitly connected online image provider.",
  },
  {
    id: "video",
    routingCapability: "video",
    label: "Video",
    localDetail: "Use a supported local video route when this Node can provide one.",
    cloudDetail: "Use an explicitly connected online video provider with the existing consent gates.",
  },
];

const LEGACY_CAPABILITY_TARGETS: Record<string, ComputeCapability> = {
  "settings-models": "writing",
  "settings-sage": "writing",
  "settings-plan": "writing",
  "settings-routing": "writing",
  "settings-ollama": "writing",
  "settings-openai": "writing",
  "settings-minimax": "writing",
  "settings-comfyui": "images",
  "settings-images": "images",
  "settings-video": "video",
};

function sessionKey(mode: ComputeMode) {
  return `plotpickle.settings.compute.${mode}.capability`;
}

function readInitialCapability(mode: ComputeMode): ComputeCapability {
  if (typeof window === "undefined") return "writing";
  const url = new URL(window.location.href);
  const query = url.searchParams.get("compute");
  if (CAPABILITIES.some((item) => item.id === query)) return query as ComputeCapability;
  const legacyTarget = url.hash.replace(/^#/, "").trim().toLowerCase();
  if (legacyTarget in LEGACY_CAPABILITY_TARGETS) return LEGACY_CAPABILITY_TARGETS[legacyTarget];
  const saved = window.sessionStorage.getItem(sessionKey(mode));
  return CAPABILITIES.some((item) => item.id === saved) ? saved as ComputeCapability : "writing";
}

function modeCopy(mode: ComputeMode) {
  return mode === "local"
    ? {
        eyebrow: "Settings · AI Compute",
        title: "Local Compute",
        detail: "Run AI privately on this PlotPickle Node. Start with the simple setup below; open Advanced Options only when you need model, endpoint, workflow or runtime details.",
        badge: "THIS COMPUTER",
      }
    : {
        eyebrow: "Settings · AI Compute",
        title: "Cloud Compute",
        detail: "Use online AI services you deliberately connect. Provider credentials stay protected, paid routes remain explicit, and a failed local route never silently becomes a cloud request.",
        badge: "ONLINE SERVICES",
      };
}

export default function AiComputeWorkspace({ mode }: { mode: ComputeMode }) {
  const [activeCapability, setActiveCapability] = useState<ComputeCapability>("writing");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [providerFocus, setProviderFocus] = useState<ProviderTarget | null>(null);
  const copy = modeCopy(mode);
  const capability = useMemo(
    () => CAPABILITIES.find((item) => item.id === activeCapability) || CAPABILITIES[0],
    [activeCapability],
  );

  useEffect(() => {
    setActiveCapability(readInitialCapability(mode));
  }, [mode]);

  function selectCapability(next: ComputeCapability) {
    setActiveCapability(next);
    setAdvancedOpen(false);
    setProviderFocus(null);
    window.sessionStorage.setItem(sessionKey(mode), next);
    const url = new URL(window.location.href);
    url.searchParams.set("compute", next);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }

  function openAdvanced(target?: ProviderTarget) {
    if (target) setProviderFocus(target);
    setAdvancedOpen(true);
    window.requestAnimationFrame(() => document.getElementById(`${mode}-compute-advanced`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function renderLocalAdvanced() {
    if (activeCapability === "writing") {
      return (
        <div className={styles.advancedStack}>
          <SageFastModelSetup />
          <details className={styles.expertDetails}>
            <summary>Expert runtime diagnostics</summary>
            <p>Inspect hardware, installed models and lower-level local runtime information. These controls reuse the existing local runtime authority.</p>
            <LocalRuntimePanel />
          </details>
        </div>
      );
    }

    return (
      <div className={styles.advancedStack}>
        <p className={styles.advancedNote}>The detailed media engine panel below is the existing authority for ComfyUI installation, checkpoints, workflows, image tests and video prerequisites. It remains shared so PlotPickle does not create a second media configuration system.</p>
        <MediaRoutingPanel onManage={(target) => {
          if (/openai|minimax|cloud/i.test(target)) {
            window.dispatchEvent(new CustomEvent("plotpickle:settings-section", { detail: "cloud-compute" }));
          }
        }} />
      </div>
    );
  }

  function renderCloudAdvanced() {
    return (
      <div className={styles.advancedStack}>
        <section className={styles.connectionMethods} aria-labelledby="cloud-connection-methods-title">
          <header><p>Connection methods</p><h3 id="cloud-connection-methods-title">Choose the secure connection your provider supports.</h3></header>
          <div>
            <article data-available="true"><strong>API key</strong><span>Available for the current OpenAI and MiniMax provider adapters. The saved secret remains protected and is never displayed after storage.</span></article>
            <article data-available="false"><strong>MCP / OAuth</strong><span>Shown as a supported connection class, but no current OpenAI or MiniMax OAuth/MCP provider adapter is registered here. PlotPickle will not pretend an OAuth connection exists.</span></article>
          </div>
        </section>
        <AiProviderSetupPanel provider="openai" />
        <AiProviderSetupPanel provider="minimax" />
        {activeCapability !== "writing" ? (
          <details className={styles.expertDetails}>
            <summary>Expert media routing and returned-asset diagnostics</summary>
            <p>Use the existing media authority for paid test consent, returned assets and hybrid ComfyUI/MiniMax prerequisites.</p>
            <MediaRoutingPanel onManage={() => undefined} />
          </details>
        ) : null}
      </div>
    );
  }

  return (
    <section className={styles.workspace} data-ai-compute-mode={mode} data-ai-compute-capability={activeCapability}>
      <header className={styles.hero}>
        <div><p>{copy.eyebrow}</p><h1>{copy.title}</h1><span>{copy.detail}</span></div>
        <strong>{copy.badge}</strong>
      </header>

      <nav className={styles.tabs} aria-label={`${copy.title} capabilities`}>
        {CAPABILITIES.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-current={activeCapability === item.id ? "page" : undefined}
            data-compute-tab={item.id}
            onClick={() => selectCapability(item.id)}
          >
            <strong>{item.label}</strong>
            <span>{mode === "local" ? item.localDetail : item.cloudDetail}</span>
          </button>
        ))}
      </nav>

      <section className={styles.capabilityIntro} aria-labelledby={`${mode}-${activeCapability}-title`}>
        <div>
          <p>{copy.title} · {capability.label}</p>
          <h2 id={`${mode}-${activeCapability}-title`}>{capability.label} setup</h2>
          <span>{mode === "local" ? capability.localDetail : capability.cloudDetail}</span>
        </div>
        <button type="button" onClick={() => openAdvanced()} aria-expanded={advancedOpen}>Advanced Options</button>
      </section>

      <AiRoutingPanel
        capability={capability.routingCapability}
        locality={mode}
        onManage={(target) => openAdvanced(target)}
      />

      <details id={`${mode}-compute-advanced`} className={styles.advanced} open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
        <summary>
          <span><strong>Advanced Options</strong><small>{mode === "local" ? "Models, runtimes, ComfyUI and expert diagnostics" : "Provider credentials, models, endpoints, MCP/OAuth availability and expert diagnostics"}</small></span>
          {providerFocus ? <em>Requested: {providerFocus}</em> : null}
        </summary>
        <div className={styles.advancedBody}>
          {mode === "local" ? renderLocalAdvanced() : renderCloudAdvanced()}
        </div>
      </details>

      <footer className={styles.boundary}>
        <strong>{mode === "local" ? "Local means this Node." : "Cloud means explicitly connected online services."}</strong>
        <span>{mode === "local"
          ? "No local failure silently promotes work to a paid provider."
          : "Credentials stay outside story projects, and paid generation still requires the existing explicit consent boundaries."}</span>
      </footer>
    </section>
  );
}